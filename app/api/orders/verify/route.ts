import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { pusherServer } from "@/lib/pusher-server"
import { sendAwaitingPaymentNotification } from "@/lib/order-email"
import { authenticateSupplierRequest } from "@/lib/supplier-auth"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"
import { calculatePrintPrice } from "@/lib/print-pricing"
import { getPrintPricing } from "@/lib/print-pricing-store"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const auth = await authenticateSupplierRequest(req)
    if (!auth.ok) return auth.response

    await connectDB()
    await applyOrderLifecycleRules()

    const body = await req.json()
    const orderId = body.orderId as string | undefined
    const supplierUIDFromBody = body.supplierUID as string | undefined
    const supplierUID = auth.uid
    const pagesValue = body.verifiedPages ?? body.pages
    const verifiedPages = Number(pagesValue)

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing order or supplier details"
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

    if (order.status === "cancelled") {
      return NextResponse.json(
        {
          success: false,
          message: "Cancelled orders cannot be verified"
        },
        { status: 409 }
      )
    }

    if (!["pending", "accepted", "awaiting_payment"].includes(String(order.status || ""))) {
      return NextResponse.json(
        {
          success: false,
          message: `Order cannot be verified from status ${String(order.status || "unknown")}`
        },
        { status: 409 }
      )
    }

    if (order.supplierUID && order.supplierUID !== supplierUID) {
      return NextResponse.json(
        {
          success: false,
          message: "You are not allowed to verify this order"
        },
        { status: 403 }
      )
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json(
        {
          success: false,
          message: "Payment already completed for this order"
        },
        { status: 409 }
      )
    }

    const pricing = await getPrintPricing()
    const finalPrice = calculatePrintPrice(verifiedPages, order.printType, pricing)

    if (!order.supplierUID) {
      order.supplierUID = supplierUID
      order.acceptedAt = new Date()
      order.logs.push({
        message: "Order accepted by supplier during verification",
        time: new Date()
      })
    }

    order.verifiedPages = verifiedPages
    order.finalPrice = finalPrice
    order.status = "awaiting_payment"
    order.logs.push({
      message: `Supplier verified ${verifiedPages} pages`,
      time: new Date()
    })

    await order.save()

    try {
      await pusherServer.trigger(
        `private-user-${order.userUID}`,
        "order-updated",
        order
      )
    } catch (pushError) {
      console.error("PUSHER NOTIFICATION ERROR:", pushError)
    }

    sendAwaitingPaymentNotification(order).catch((emailError) => {
      console.error("AWAITING_PAYMENT_EMAIL_ERROR:", emailError)
    })

    await recordActivity({
      actorType: "supplier",
      actorUID: supplierUID,
      actorEmail: auth.email,
      action: "order.verified",
      entityType: "order",
      entityId: String(order._id),
      level: "success",
      message: `Supplier verified order ${String(order._id).slice(-8)} with ${verifiedPages} pages`,
      metadata: {
        orderId: String(order._id),
        userUID: String(order.userUID),
        supplierUID,
        verifiedPages,
        finalPrice
      }
    })

    return NextResponse.json({
      success: true,
      order
    })
  } catch (error) {
    console.error("VERIFY ORDER ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to verify pages"
      },
      { status: 500 }
    )
  }
}
