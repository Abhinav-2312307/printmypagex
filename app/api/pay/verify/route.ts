import crypto from "crypto"
import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { pusherServer } from "@/lib/pusher-server"
import { sendPaymentReceivedNotifications } from "@/lib/order-email"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    if (!process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { success: false, message: "Payment verification system not configured" },
        { status: 500 }
      )
    }

    const body = await req.json()
    const {
      orderId,
      token,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = body

    if (
      !orderId ||
      !token ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return NextResponse.json(
        { success: false, message: "Missing payment verification parameters" },
        { status: 400 }
      )
    }

    await connectDB()
    const order = await Order.findById(orderId)

    if (!order) {
      return NextResponse.json(
        { success: false, message: "Order not found" },
        { status: 404 }
      )
    }

    if (!order.paymentToken || order.paymentToken !== token) {
      return NextResponse.json(
        { success: false, message: "Invalid or unauthorized payment token" },
        { status: 403 }
      )
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json({
        success: true,
        message: "Order already paid",
        orderId: String(order._id),
        shortId: order.shortId
      })
    }

    if (order.razorpayOrderId && order.razorpayOrderId !== razorpay_order_id) {
      return NextResponse.json(
        { success: false, message: "Razorpay order ID mismatch" },
        { status: 400 }
      )
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex")

    const generatedBuffer = Buffer.from(generatedSignature, "hex")
    const receivedBuffer = Buffer.from(String(razorpay_signature), "hex")

    const validSignature =
      generatedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(generatedBuffer, receivedBuffer)

    if (!validSignature) {
      return NextResponse.json(
        { success: false, message: "Payment signature verification failed" },
        { status: 400 }
      )
    }

    const now = new Date()
    order.paymentStatus = "paid"
    order.status = "printing"
    order.paidAt = now
    order.cancelledAt = null
    order.razorpayOrderId = razorpay_order_id
    order.razorpayPaymentId = razorpay_payment_id
    order.razorpaySignature = razorpay_signature

    order.logs.push({
      message: `Payment of INR ${Number(order.finalPrice ?? order.estimatedPrice ?? 0).toFixed(2)} received via direct payment link (Payment ID: ${razorpay_payment_id})`,
      time: now
    })
    order.logs.push({
      message: "Order moved to printing queue",
      time: now
    })

    await order.save()

    try {
      await pusherServer.trigger(`private-user-${order.userUID}`, "order-updated", order)
    } catch (pushErr) {
      console.error("PUSHER USER PAYMENT LINK UPDATE ERROR:", pushErr)
    }

    if (order.supplierUID) {
      try {
        await pusherServer.trigger(`private-supplier-${order.supplierUID}`, "order-updated", order)
      } catch (pushErr) {
        console.error("PUSHER SUPPLIER PAYMENT LINK UPDATE ERROR:", pushErr)
      }
    }

    sendPaymentReceivedNotifications(order).catch((emailError) => {
      console.error("PAYMENT_LINK_EMAIL_ERROR:", emailError)
    })

    await recordActivity({
      actorType: "user",
      actorUID: order.userUID,
      action: "payment.verified_via_link",
      entityType: "order",
      entityId: String(order._id),
      level: "success",
      message: `Payment verified via direct payment link for order ${order.shortId || String(order._id).slice(-8)}`,
      req,
      metadata: {
        orderId: String(order._id),
        userUID: order.userUID,
        supplierUID: String(order.supplierUID || ""),
        razorpayPaymentId: razorpay_payment_id,
        viaLink: true
      }
    })

    return NextResponse.json({
      success: true,
      message: "Payment verified successfully",
      orderId: String(order._id),
      shortId: order.shortId || String(order._id).slice(-8)
    })
  } catch (error) {
    console.error("VERIFY_PAY_LINK_ERROR:", error)
    return NextResponse.json(
      { success: false, message: "Payment verification failed" },
      { status: 500 }
    )
  }
}
