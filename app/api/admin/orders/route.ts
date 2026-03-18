import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import Order from "@/models/Order"
import User from "@/models/User"
import Supplier from "@/models/Supplier"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"
import { pusherServer } from "@/lib/pusher-server"
import {
  sendOrderCancelledNotification,
  sendOrderStatusNotification
} from "@/lib/order-email"
import { calculatePrintPrice } from "@/lib/print-pricing"
import { getPrintPricing } from "@/lib/print-pricing-store"

type OrderDoc = {
  _id: string
  userUID?: string
  supplierUID?: string | null
  [key: string]: unknown
}

type MinimalUser = {
  firebaseUID: string
  name?: string
  email?: string
}

type MinimalSupplier = {
  firebaseUID: string
  name?: string
  email?: string
  approved?: boolean
  active?: boolean
}

const UNPAID_ADMIN_STATUSES = new Set([
  "pending",
  "accepted",
  "awaiting_payment",
  "cancelled"
])

const PAID_ADMIN_STATUSES = new Set([
  "printing",
  "printed",
  "delivered",
  "cancelled"
])

function round2(value: number) {
  return Math.round(value * 100) / 100
}

function parseNumber(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

async function loadUsersAndSuppliers(orders: OrderDoc[]) {
  const userUIDs = [...new Set(orders.map((order) => String(order.userUID || "")).filter(Boolean))]
  const supplierUIDs = [...new Set(orders.map((order) => String(order.supplierUID || "")).filter(Boolean))]

  const [users, suppliers] = await Promise.all([
    User.find({ firebaseUID: { $in: userUIDs } })
      .select("firebaseUID name email")
      .lean() as Promise<MinimalUser[]>,
    Supplier.find({ firebaseUID: { $in: supplierUIDs } })
      .select("firebaseUID name email approved active")
      .lean() as Promise<MinimalSupplier[]>
  ])

  const userMap = new Map<string, MinimalUser>()
  users.forEach((user) => userMap.set(String(user.firebaseUID), user))

  const supplierMap = new Map<string, MinimalSupplier>()
  suppliers.forEach((supplier) => supplierMap.set(String(supplier.firebaseUID), supplier))

  return { userMap, supplierMap }
}

async function enrichOrder(order: OrderDoc) {
  const [user, supplier] = await Promise.all([
    User.findOne({ firebaseUID: order.userUID }).select("firebaseUID name email").lean(),
    order.supplierUID
      ? Supplier.findOne({ firebaseUID: order.supplierUID })
          .select("firebaseUID name email approved active")
          .lean()
      : Promise.resolve(null)
  ])

  return {
    ...order,
    user: user || null,
    supplier: supplier || null
  }
}

export async function GET(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  await applyOrderLifecycleRules()

  const orders = (await Order.find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .lean()) as OrderDoc[]

  const { userMap, supplierMap } = await loadUsersAndSuppliers(orders)

  const rows = orders.map((order) => ({
    ...order,
    user: userMap.get(String(order.userUID || "")) || null,
    supplier: supplierMap.get(String(order.supplierUID || "")) || null
  }))

  return NextResponse.json({
    success: true,
    orders: rows
  })
}

export async function PATCH(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  await applyOrderLifecycleRules()

  const body = await req.json()
  const orderId = String(body?.orderId || "").trim()
  const nextStatus = String(body?.status || "").trim()
  const note = String(body?.note || "").trim()

  if (!orderId) {
    return NextResponse.json(
      {
        success: false,
        message: "orderId is required"
      },
      { status: 400 }
    )
  }

  const order = await Order.findById(orderId)
  if (!order) {
    return NextResponse.json(
      {
        success: false,
        message: "Order not found"
      },
      { status: 404 }
    )
  }

  const isPaid = order.paymentStatus === "paid"
  const statusProvided = Boolean(nextStatus)

  if (statusProvided) {
    const allowedStatuses = isPaid ? PAID_ADMIN_STATUSES : UNPAID_ADMIN_STATUSES
    if (!allowedStatuses.has(nextStatus)) {
      return NextResponse.json(
        {
          success: false,
          message: isPaid
            ? "For paid orders, status can only be printing/printed/delivered/cancelled"
            : "For unpaid orders, status can only be pending/accepted/awaiting_payment/cancelled"
        },
        { status: 400 }
      )
    }
  }

  const pagesProvided = body?.verifiedPages !== undefined && body?.verifiedPages !== null && body?.verifiedPages !== ""
  const finalPriceProvided = body?.finalPrice !== undefined && body?.finalPrice !== null && body?.finalPrice !== ""
  const discountPercentProvided =
    body?.discountPercent !== undefined && body?.discountPercent !== null && body?.discountPercent !== ""
  const discountAmountProvided =
    body?.discountAmount !== undefined && body?.discountAmount !== null && body?.discountAmount !== ""

  if (discountPercentProvided && discountAmountProvided) {
    return NextResponse.json(
      {
        success: false,
        message: "Use either discountPercent or discountAmount, not both"
      },
      { status: 400 }
    )
  }

  if (isPaid && (pagesProvided || finalPriceProvided || discountPercentProvided || discountAmountProvided)) {
    return NextResponse.json(
      {
        success: false,
        message: "Pricing and page count cannot be changed after payment"
      },
      { status: 409 }
    )
  }

  const now = new Date()
  const changes: string[] = []
  const previousStatus = String(order.status || "")
  const previousAmount = Number(order.finalPrice ?? order.estimatedPrice ?? 0)
  let shouldSave = false

  if (!isPaid) {
    let nextPages = Number(order.verifiedPages ?? order.pages ?? 0)

    if (pagesProvided) {
      const parsedPages = parseNumber(body.verifiedPages)
      if (!parsedPages || !Number.isInteger(parsedPages) || parsedPages < 1) {
        return NextResponse.json(
          {
            success: false,
            message: "verifiedPages must be a whole number greater than 0"
          },
          { status: 400 }
        )
      }
      nextPages = parsedPages
    }

    const pricing = await getPrintPricing()
    const baseAmount = calculatePrintPrice(nextPages, order.printType, pricing)

    let nextAmount = Number(order.finalPrice ?? order.estimatedPrice ?? baseAmount)
    let nextDiscountPercent = Number(order.discountPercent || 0)
    let nextDiscountAmount = Number(order.discountAmount || 0)

    if (pagesProvided && !finalPriceProvided && !discountPercentProvided && !discountAmountProvided) {
      nextAmount = baseAmount
      nextDiscountPercent = 0
      nextDiscountAmount = 0
    }

    if (discountPercentProvided) {
      const parsedDiscountPercent = parseNumber(body.discountPercent)
      if (parsedDiscountPercent === null || parsedDiscountPercent < 0 || parsedDiscountPercent > 100) {
        return NextResponse.json(
          {
            success: false,
            message: "discountPercent must be between 0 and 100"
          },
          { status: 400 }
        )
      }
      nextDiscountPercent = round2(parsedDiscountPercent)
      nextDiscountAmount = round2(baseAmount * (nextDiscountPercent / 100))
      nextAmount = round2(Math.max(0, baseAmount - nextDiscountAmount))
    }

    if (discountAmountProvided) {
      const parsedDiscountAmount = parseNumber(body.discountAmount)
      if (parsedDiscountAmount === null || parsedDiscountAmount < 0) {
        return NextResponse.json(
          {
            success: false,
            message: "discountAmount must be 0 or greater"
          },
          { status: 400 }
        )
      }
      nextDiscountAmount = round2(Math.min(parsedDiscountAmount, baseAmount))
      nextDiscountPercent = baseAmount > 0 ? round2((nextDiscountAmount / baseAmount) * 100) : 0
      nextAmount = round2(Math.max(0, baseAmount - nextDiscountAmount))
    }

    if (finalPriceProvided) {
      const parsedFinalPrice = parseNumber(body.finalPrice)
      if (parsedFinalPrice === null || parsedFinalPrice <= 0) {
        return NextResponse.json(
          {
            success: false,
            message: "finalPrice must be greater than 0"
          },
          { status: 400 }
        )
      }
      nextAmount = round2(parsedFinalPrice)
      nextDiscountPercent = 0
      nextDiscountAmount = 0
    }

    if (nextPages !== Number(order.verifiedPages ?? order.pages ?? 0)) {
      order.pages = nextPages
      order.verifiedPages = nextPages
      changes.push(`pages updated to ${nextPages}`)
      shouldSave = true
    }

    if (nextAmount !== previousAmount) {
      order.finalPrice = nextAmount
      changes.push(`amount updated to INR ${nextAmount.toFixed(2)}`)
      shouldSave = true
    }

    if (nextDiscountPercent !== Number(order.discountPercent || 0)) {
      order.discountPercent = nextDiscountPercent
      shouldSave = true
    }

    if (nextDiscountAmount !== Number(order.discountAmount || 0)) {
      order.discountAmount = nextDiscountAmount
      shouldSave = true
    }
  }

  if (statusProvided && nextStatus !== previousStatus) {
    order.status = nextStatus

    if (nextStatus === "delivered") {
      order.deliveredAt = now
    } else if (previousStatus === "delivered") {
      order.deliveredAt = null
    }

    if (nextStatus === "cancelled") {
      order.cancelledAt = now
    } else if (previousStatus === "cancelled") {
      order.cancelledAt = null
    }

    if (
      ["accepted", "awaiting_payment", "printing", "printed", "delivered"].includes(nextStatus) &&
      !order.acceptedAt
    ) {
      order.acceptedAt = now
    }

    changes.push(`status updated to ${nextStatus}`)
    shouldSave = true
  }

  if (note) {
    changes.push(`note: ${note}`)
    shouldSave = true
  }

  if (!shouldSave) {
    const untouchedOrder = await enrichOrder(order.toObject() as OrderDoc)
    return NextResponse.json({
      success: true,
      message: "No changes detected",
      order: untouchedOrder
    })
  }

  order.logs.push({
    message: `Admin update (${auth.email}): ${changes.join(" | ")}`,
    time: now
  })

  await order.save()

  try {
    await pusherServer.trigger(`private-user-${order.userUID}`, "order-updated", order)
  } catch (pushError) {
    console.error("PUSHER USER ADMIN ORDER UPDATE ERROR:", pushError)
  }

  try {
    if (order.supplierUID) {
      await pusherServer.trigger(`private-supplier-${order.supplierUID}`, "order-updated", order)
    }
  } catch (pushError) {
    console.error("PUSHER SUPPLIER ADMIN ORDER UPDATE ERROR:", pushError)
  }

  if (statusProvided && nextStatus !== previousStatus) {
    if (nextStatus === "cancelled") {
      sendOrderCancelledNotification(order, "admin").catch((emailError) => {
        console.error("ORDER_CANCELLED_EMAIL_ERROR:", emailError)
      })
    } else {
      sendOrderStatusNotification(order, nextStatus).catch((emailError) => {
        console.error("ORDER_STATUS_EMAIL_ERROR:", emailError)
      })
    }
  }

  const enrichedOrder = await enrichOrder(order.toObject() as OrderDoc)

  return NextResponse.json({
    success: true,
    message: "Order updated successfully",
    order: enrichedOrder
  })
}
