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
      orderIds,
      userUID: userUIDFromBody,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = body
    const userUID = auth.uid

    if (
      !orderIds ||
      !Array.isArray(orderIds) ||
      orderIds.length === 0 ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing batch payment verification fields"
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

    await connectDB()
    await applyOrderLifecycleRules({ userUID })

    const orders = await Order.find({
      _id: { $in: orderIds },
      userUID
    })

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No orders found to verify"
        },
        { status: 404 }
      )
    }

    const verifiedOrders = []
    const now = new Date()

    for (const order of orders) {
      // If already marked paid, collect and continue
      if (order.paymentStatus === "paid") {
        verifiedOrders.push(order)
        continue
      }

      if (order.paymentStatus === "refunded" || order.status === "cancelled") {
        continue
      }

      order.paymentStatus = "paid"
      order.razorpayOrderId = razorpay_order_id
      order.razorpayPaymentId = razorpay_payment_id
      order.razorpaySignature = razorpay_signature
      order.paidAt = now

      if (order.status === "awaiting_payment" || order.status === "accepted") {
        order.status = "printing"
        order.logs.push({
          message: "Payment received (batch payment), order moved to printing",
          time: now
        })
      }

      order.logs.push({
        message: "Payment verified successfully via batch payment",
        time: now
      })

      await order.save()
      verifiedOrders.push(order)

      try {
        await pusherServer.trigger(`private-user-${order.userUID}`, "order-updated", order)
      } catch (pushError) {
        console.error("PUSHER USER BATCH PAYMENT UPDATE ERROR:", pushError)
      }

      try {
        if (order.supplierUID) {
          await pusherServer.trigger(`private-supplier-${order.supplierUID}`, "order-updated", order)
        }
      } catch (pushError) {
        console.error("PUSHER SUPPLIER BATCH PAYMENT UPDATE ERROR:", pushError)
      }

      sendPaymentReceivedNotifications(order).catch((emailError) => {
        console.error("PAYMENT_RECEIVED_EMAIL_ERROR:", emailError)
      })

      await recordActivity({
        actorType: "user",
        actorUID: userUID,
        actorEmail: auth.email,
        action: "payment.batch_verified",
        entityType: "order",
        entityId: String(order._id),
        level: "success",
        message: `Batch payment verified for order ${String(order._id).slice(-8)}`,
        req,
        metadata: {
          orderId: String(order._id),
          userUID,
          supplierUID: String(order.supplierUID || ""),
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          amount: Number(order.finalPrice ?? order.estimatedPrice ?? 0),
          batchCount: orders.length
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `Batch payment verified for ${verifiedOrders.length} orders`,
      orders: verifiedOrders
    })
  } catch (error) {
    console.error("BATCH PAYMENT VERIFY ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Batch payment verification failed"
      },
      { status: 500 }
    )
  }
}
