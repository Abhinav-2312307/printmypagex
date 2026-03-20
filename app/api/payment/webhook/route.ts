import crypto from "crypto"
import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { pusherServer } from "@/lib/pusher-server"
import { sendPaymentReceivedNotifications } from "@/lib/order-email"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      return NextResponse.json(
        {
          success: false,
          message: "Webhook not configured"
        },
        { status: 500 }
      )
    }

    const signature = req.headers.get("x-razorpay-signature")
    const rawBody = await req.text()

    if (!signature) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing webhook signature"
        },
        { status: 400 }
      )
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex")

    const expectedBuffer = Buffer.from(expectedSignature, "hex")
    const receivedBuffer = Buffer.from(signature, "hex")

    const validSignature =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer)

    if (!validSignature) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid webhook signature"
        },
        { status: 400 }
      )
    }

    const payload = JSON.parse(rawBody)

    if (payload.event !== "payment.captured") {
      return NextResponse.json({ success: true, message: "Event ignored" })
    }

    const payment = payload.payload?.payment?.entity
    if (!payment?.order_id || !payment?.id) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid webhook payload"
        },
        { status: 400 }
      )
    }

    await connectDB()
    await applyOrderLifecycleRules()

    const order = await Order.findOne({
      razorpayOrderId: payment.order_id
    })

    if (!order) {
      return NextResponse.json({ success: true, message: "Order not found, ignored" })
    }

    if (order.status === "cancelled" && order.paymentStatus !== "paid") {
      order.logs.push({
        message: "Payment webhook ignored because order was already cancelled",
        time: new Date()
      })
      await order.save()
      await recordActivity({
        actorType: "system",
        action: "payment.webhook_ignored",
        entityType: "order",
        entityId: String(order._id),
        level: "warning",
        message: `Ignored captured payment webhook for cancelled order ${String(order._id).slice(-8)}`,
        metadata: {
          orderId: String(order._id),
          razorpayOrderId: String(payment.order_id),
          razorpayPaymentId: String(payment.id)
        }
      })
      return NextResponse.json({ success: true, message: "Cancelled order payment ignored" })
    }

    if (order.paymentStatus !== "paid") {
      order.paymentStatus = "paid"
      order.razorpayPaymentId = payment.id
      order.paidAt = new Date()
      if (order.status === "awaiting_payment" || order.status === "accepted") {
        order.status = "printing"
        order.logs.push({
          message: "Payment captured, order moved to printing",
          time: new Date()
        })
      }
      order.logs.push({
        message: "Payment captured via webhook",
        time: new Date()
      })
      await order.save()

      try {
        await pusherServer.trigger(`private-user-${order.userUID}`, "order-updated", order)
      } catch (pushError) {
        console.error("PUSHER USER WEBHOOK UPDATE ERROR:", pushError)
      }

      try {
        if (order.supplierUID) {
          await pusherServer.trigger(`private-supplier-${order.supplierUID}`, "order-updated", order)
        }
      } catch (pushError) {
        console.error("PUSHER SUPPLIER WEBHOOK UPDATE ERROR:", pushError)
      }

      sendPaymentReceivedNotifications(order).catch((emailError) => {
        console.error("PAYMENT_RECEIVED_EMAIL_ERROR:", emailError)
      })

      await recordActivity({
        actorType: "system",
        action: "payment.webhook_captured",
        entityType: "order",
        entityId: String(order._id),
        level: "success",
        message: `Webhook captured payment for order ${String(order._id).slice(-8)}`,
        metadata: {
          orderId: String(order._id),
          userUID: String(order.userUID),
          supplierUID: String(order.supplierUID || ""),
          razorpayOrderId: String(payment.order_id),
          razorpayPaymentId: String(payment.id)
        }
      })
    }

    return NextResponse.json({ success: true, message: "Webhook processed" })
  } catch (error) {
    console.error("PAYMENT WEBHOOK ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Webhook processing failed"
      },
      { status: 500 }
    )
  }
}
