import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import Supplier from "@/models/Supplier"
import { pusherServer } from "@/lib/pusher-server"
import { sendAwaitingPaymentNotification } from "@/lib/order-email"
import { authenticateSupplierRequest } from "@/lib/supplier-auth"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"
import { calculatePrintPrice } from "@/lib/print-pricing"
import { getPrintPricing } from "@/lib/print-pricing-store"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const auth = await authenticateSupplierRequest(req)
  if (!auth.ok) return auth.response

  await connectDB()
  await applyOrderLifecycleRules()

  const body = await req.json()

  const orderId = body.orderId as string | undefined
  const supplierUIDFromBody = body.supplierUID as string | undefined
  const pagesValue = body.verifiedPages ?? body.pages
  const verifiedPages = Number(pagesValue)
  const supplierUID = auth.uid

  if (!orderId) {
    return NextResponse.json(
      {
        success: false,
        message: "Missing order details"
      },
      { status: 400 }
    )
  }

  if (supplierUIDFromBody && supplierUIDFromBody !== supplierUID) {
    return NextResponse.json(
      {
        success: false,
        message: "Unauthorized supplier"
      },
      { status: 403 }
    )
  }

  if (!Number.isFinite(verifiedPages) || verifiedPages <= 0) {
    return NextResponse.json(
      {
        success: false,
        message: "Verified pages must be greater than 0"
      },
      { status: 400 }
    )
  }

  const supplier = await Supplier.findOne({
    firebaseUID: supplierUID
  })

  if (!supplier) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier not registered"
      },
      { status: 403 }
    )
  }

  if (!supplier.approved) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier not approved"
      },
      { status: 403 }
    )
  }

  if (!supplier.active) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier is inactive"
      },
      { status: 403 }
    )
  }

  const orderMeta = await Order.findById(orderId).select("printType")
  if (!orderMeta) {
    return NextResponse.json(
      {
        success: false,
        message: "Order not found"
      },
      { status: 404 }
    )
  }

  const pricing = await getPrintPricing()
  const finalPrice = calculatePrintPrice(verifiedPages, orderMeta.printType, pricing)
  const now = new Date()

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: "pending",
      $or: [
        { supplierUID: null },
        { supplierUID: supplierUID }
      ]
    },
    {
      supplierUID: supplierUID,
      status: "awaiting_payment",
      acceptedAt: now,
      verifiedPages,
      finalPrice,
      $push: {
        logs: {
          $each: [
            {
              message: "Order accepted by supplier",
              time: now
            },
            {
              message: `Supplier verified ${verifiedPages} pages`,
              time: now
            }
          ]
        }
      }
    },
    { returnDocument: "after" }
  )

  if (!order) {
    return NextResponse.json({
      success: false,
      message: "Order already accepted"
    }, { status: 409 })
  }

  try {
    await pusherServer.trigger(`private-user-${order.userUID}`, "order-updated", order)
  } catch (pushError) {
    console.error("PUSHER USER ACCEPT UPDATE ERROR:", pushError)
  }

  try {
    if (order.supplierUID) {
      await pusherServer.trigger(`private-supplier-${order.supplierUID}`, "order-updated", order)
    }
  } catch (pushError) {
    console.error("PUSHER SUPPLIER ACCEPT UPDATE ERROR:", pushError)
  }

  sendAwaitingPaymentNotification(order).catch((emailError) => {
    console.error("AWAITING_PAYMENT_EMAIL_ERROR:", emailError)
  })
  console.log("ORDER_EMAIL_DEBUG: Triggered awaiting payment notification", {
    orderId: String(order._id),
    supplierUID,
    verifiedPages
  })

  await recordActivity({
    actorType: "supplier",
    actorUID: supplierUID,
    actorEmail: auth.email,
    action: "order.accepted",
    entityType: "order",
    entityId: String(order._id),
    level: "success",
    message: `Supplier accepted order ${String(order._id).slice(-8)} and verified ${verifiedPages} pages`,
    metadata: {
      orderId: String(order._id),
      userUID: String(order.userUID),
      supplierUID,
      verifiedPages,
      finalPrice: Number(order.finalPrice ?? 0)
    }
  })

  return NextResponse.json({
    success: true,
    order
  })
}
