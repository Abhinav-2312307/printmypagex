import crypto from "crypto"
import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { pusherServer } from "@/lib/pusher-server"
import { sendPaymentReceivedNotifications } from "@/lib/order-email"
import { authenticateUserRequest } from "@/lib/user-auth"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const auth = await authenticateUserRequest(req)
    if (!auth.ok) return auth.response

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment verification not configured"
        },
        { status: 500 }
      )
    }

    const body = await req.json()
    const {
      orderId,
      userUID: userUIDFromBody,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = body
    const userUID = auth.uid

    if (
      !orderId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing payment verification fields"
        },
        { status: 400 }
      )
    }

    if (userUIDFromBody && userUIDFromBody !== userUID) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized verification request"
        },
        { status: 403 }
      )
    }

    await connectDB()
    await applyOrderLifecycleRules({ userUID })

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

    if (order.userUID !== userUID) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized verification request"
        },
        { status: 403 }
      )
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json({
        success: true,
        message: "Order already paid",
        order
      })
    }

    if (order.status === "cancelled") {
      return NextResponse.json(
        {
          success: false,
          message: "Order is cancelled and payment cannot be verified"
        },
        { status: 409 }
      )
    }

    if (order.razorpayOrderId && order.razorpayOrderId !== razorpay_order_id) {
      return NextResponse.json(
        {
          success: false,
          message: "Razorpay order mismatch"
        },
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
        {
          success: false,
          message: "Payment signature verification failed"
        },
        { status: 400 }
      )
    }

    order.paymentStatus = "paid"
    order.razorpayOrderId = razorpay_order_id
    order.razorpayPaymentId = razorpay_payment_id
    order.razorpaySignature = razorpay_signature
    order.paidAt = new Date()
    if (order.status === "awaiting_payment" || order.status === "accepted") {
      order.status = "printing"
      order.logs.push({
        message: "Payment received, order moved to printing",
        time: new Date()
      })
    }
    order.logs.push({
      message: "Payment verified successfully",
      time: new Date()
    })

    await order.save()

    try {
      await pusherServer.trigger(`private-user-${order.userUID}`, "order-updated", order)
    } catch (pushError) {
      console.error("PUSHER USER PAYMENT UPDATE ERROR:", pushError)
    }

    try {
      if (order.supplierUID) {
        await pusherServer.trigger(`private-supplier-${order.supplierUID}`, "order-updated", order)
      }
    } catch (pushError) {
      console.error("PUSHER SUPPLIER PAYMENT UPDATE ERROR:", pushError)
    }

    sendPaymentReceivedNotifications(order).catch((emailError) => {
      console.error("PAYMENT_RECEIVED_EMAIL_ERROR:", emailError)
    })

    await recordActivity({
      actorType: "user",
      actorUID: userUID,
      actorEmail: auth.email,
      action: "payment.verified",
      entityType: "order",
      entityId: String(order._id),
      level: "success",
      message: `Payment verified for order ${String(order._id).slice(-8)}`,
      metadata: {
        orderId: String(order._id),
        userUID,
        supplierUID: String(order.supplierUID || ""),
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        amount: Number(order.finalPrice ?? order.estimatedPrice ?? 0)
      }
    })

    return NextResponse.json({
      success: true,
      message: "Payment verified",
      order
    })
  } catch (error) {
    console.error("PAYMENT VERIFY ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Payment verification failed"
      },
      { status: 500 }
    )
  }
}
