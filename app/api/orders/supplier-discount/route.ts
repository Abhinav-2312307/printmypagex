import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { authenticateSupplierRequest } from "@/lib/supplier-auth"
import { getPlatformSettings } from "@/lib/platform-settings"
import { calculateOrderPrice, normalizeCopies } from "@/lib/print-pricing"
import { getPrintPricing } from "@/lib/print-pricing-store"
import { pusherServer } from "@/lib/pusher-server"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export async function POST(req: Request) {
  const auth = await authenticateSupplierRequest(req)
  if (!auth.ok) return auth.response

  await connectDB()

  const body = await req.json().catch(() => ({}))

  const orderId = body.orderId as string | undefined
  const discountPercent = body.discountPercent as number | undefined
  const discountAmount = body.discountAmount as number | undefined

  if (!orderId) {
    return NextResponse.json(
      { success: false, message: "Missing orderId" },
      { status: 400 }
    )
  }

  const hasPercent = discountPercent !== undefined && discountPercent !== null && discountPercent !== ""
  const hasAmount = discountAmount !== undefined && discountAmount !== null && discountAmount !== ""

  if (hasPercent && hasAmount) {
    return NextResponse.json(
      { success: false, message: "Use either discountPercent or discountAmount, not both" },
      { status: 400 }
    )
  }

  if (!hasPercent && !hasAmount) {
    return NextResponse.json(
      { success: false, message: "Provide discountPercent or discountAmount" },
      { status: 400 }
    )
  }

  const order = await Order.findById(orderId)

  if (!order) {
    return NextResponse.json(
      { success: false, message: "Order not found" },
      { status: 404 }
    )
  }

  if (String(order.supplierUID) !== auth.uid) {
    return NextResponse.json(
      { success: false, message: "This order is not assigned to you" },
      { status: 403 }
    )
  }

  if (!["awaiting_payment", "accepted"].includes(order.status)) {
    return NextResponse.json(
      { success: false, message: "Discount can only be applied before payment" },
      { status: 400 }
    )
  }

  if (order.paymentStatus === "paid") {
    return NextResponse.json(
      { success: false, message: "Cannot modify discount after payment" },
      { status: 400 }
    )
  }

  const settings = await getPlatformSettings()
  const maxDiscountPercent = settings.maxSupplierDiscountPercent
  const pricing = await getPrintPricing()
  const copies = normalizeCopies(order.copies)
  const pages = order.verifiedPages ?? order.pages ?? 0

  const baseAmount = calculateOrderPrice(pages, order.printType, pricing, {
    copies,
    spiralBinding: Boolean(order.spiralBinding)
  })

  let nextDiscountPercent = 0
  let nextDiscountAmount = 0
  let nextFinalPrice = baseAmount

  if (hasPercent) {
    const parsed = Number(discountPercent)
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return NextResponse.json(
        { success: false, message: "Discount percent must be between 0 and 100" },
        { status: 400 }
      )
    }
    if (parsed > maxDiscountPercent) {
      return NextResponse.json(
        { success: false, message: `Maximum allowed discount is ${maxDiscountPercent}%` },
        { status: 400 }
      )
    }
    nextDiscountPercent = round2(parsed)
    nextDiscountAmount = round2(baseAmount * (nextDiscountPercent / 100))
    nextFinalPrice = round2(Math.max(0, baseAmount - nextDiscountAmount))
  }

  if (hasAmount) {
    const parsed = Number(discountAmount)
    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json(
        { success: false, message: "Discount amount must be 0 or greater" },
        { status: 400 }
      )
    }
    const effectiveAmount = Math.min(parsed, baseAmount)
    const effectivePercent = baseAmount > 0 ? round2((effectiveAmount / baseAmount) * 100) : 0
    if (effectivePercent > maxDiscountPercent) {
      return NextResponse.json(
        { success: false, message: `Maximum allowed discount is ${maxDiscountPercent}% (₹${round2(baseAmount * maxDiscountPercent / 100)})` },
        { status: 400 }
      )
    }
    nextDiscountAmount = round2(effectiveAmount)
    nextDiscountPercent = effectivePercent
    nextFinalPrice = round2(Math.max(0, baseAmount - nextDiscountAmount))
  }

  const now = new Date()

  order.discountPercent = nextDiscountPercent
  order.discountAmount = nextDiscountAmount
  order.finalPrice = nextFinalPrice
  order.logs.push({
    message: nextDiscountPercent > 0
      ? `Supplier applied ${nextDiscountPercent}% discount (₹${nextDiscountAmount} off). Final price: ₹${nextFinalPrice}`
      : "Supplier removed discount",
    time: now
  })

  await order.save()

  try {
    await pusherServer.trigger(`private-user-${order.userUID}`, "order-updated", order)
  } catch (pushError) {
    console.error("PUSHER SUPPLIER DISCOUNT UPDATE ERROR:", pushError)
  }

  try {
    await pusherServer.trigger(`private-supplier-${order.supplierUID}`, "order-updated", order)
  } catch (pushError) {
    console.error("PUSHER SUPPLIER DISCOUNT UPDATE ERROR:", pushError)
  }

  await recordActivity({
    actorType: "supplier",
    actorUID: auth.uid,
    actorEmail: auth.email,
    action: "order.discount_applied",
    entityType: "order",
    entityId: String(order._id),
    level: "info",
    message: nextDiscountPercent > 0
      ? `Supplier applied ${nextDiscountPercent}% discount (₹${nextDiscountAmount}) on order ${String(order._id).slice(-8)}`
      : `Supplier removed discount on order ${String(order._id).slice(-8)}`,
    metadata: {
      orderId: String(order._id),
      discountPercent: nextDiscountPercent,
      discountAmount: nextDiscountAmount,
      finalPrice: nextFinalPrice,
      baseAmount
    }
  })

  return NextResponse.json({
    success: true,
    message: nextDiscountPercent > 0
      ? `${nextDiscountPercent}% discount applied. New price: ₹${nextFinalPrice}`
      : "Discount removed",
    order
  })
}
