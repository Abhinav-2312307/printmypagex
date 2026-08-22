import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import Order from "@/models/Order"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"
import { pusherServer } from "@/lib/pusher-server"
import { recordActivity } from "@/lib/activity-log"
import { sendOrderRefundNotification } from "@/lib/order-email"
import Razorpay from "razorpay"

export async function POST(req: Request) {
  try {
    const auth = await authenticateAdminRequest(req)
    if (!auth.ok) return auth.response

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({
        success: false,
        message: "Payment system not configured yet"
      }, { status: 500 })
    }

    const body = await req.json()
    const orderId = body.orderId as string | undefined

    if (!orderId) {
      return NextResponse.json({
        success: false,
        message: "Missing order details"
      }, { status: 400 })
    }

    await applyOrderLifecycleRules()

    const dbOrder = await Order.findById(orderId)

    if (!dbOrder) {
      return NextResponse.json({
        success: false,
        message: "Order not found"
      }, { status: 404 })
    }

    if (dbOrder.paymentStatus !== "paid") {
      return NextResponse.json({
        success: false,
        message: "Order is not paid"
      }, { status: 409 })
    }

    if (!dbOrder.razorpayPaymentId) {
      return NextResponse.json({
        success: false,
        message: "Order does not have a Razorpay payment ID"
      }, { status: 409 })
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })

    const payableAmount = Number(dbOrder.finalPrice ?? dbOrder.estimatedPrice ?? 0)

    try {
      await razorpay.payments.refund(dbOrder.razorpayPaymentId, {
        amount: Math.round(payableAmount * 100)
      })
    } catch (refundError: any) {
      console.error("RAZORPAY REFUND ERROR:", refundError)
      return NextResponse.json({
        success: false,
        message: refundError?.error?.description || "Failed to process refund with Razorpay"
      }, { status: 500 })
    }

    const now = new Date()
    dbOrder.paymentStatus = "refunded"
    dbOrder.logs.push({
      message: `Admin initiated full refund of INR ${payableAmount.toFixed(2)} (${auth.email})`,
      time: now
    })

    await dbOrder.save()

    await recordActivity({
      actorType: "admin",
      actorUID: auth.uid,
      actorEmail: auth.email,
      action: "order.admin_refunded",
      entityType: "order",
      entityId: String(dbOrder._id),
      level: "warning",
      message: `Admin refunded order ${String(dbOrder._id).slice(-8)}`,
      metadata: {
        orderId: String(dbOrder._id),
        userUID: String(dbOrder.userUID),
        supplierUID: String(dbOrder.supplierUID || ""),
        amount: payableAmount
      }
    })

    sendOrderRefundNotification(dbOrder, payableAmount).catch((emailError) => {
      console.error("ORDER_REFUND_EMAIL_ERROR:", emailError)
    })

    try {
      await pusherServer.trigger(`private-user-${dbOrder.userUID}`, "order-updated", dbOrder)
    } catch (pushError) {
      console.error("PUSHER USER ADMIN REFUND ERROR:", pushError)
    }

    try {
      if (dbOrder.supplierUID) {
        await pusherServer.trigger(`private-supplier-${dbOrder.supplierUID}`, "order-updated", dbOrder)
      }
    } catch (pushError) {
      console.error("PUSHER SUPPLIER ADMIN REFUND ERROR:", pushError)
    }

    // Return the updated order. We might need a leaner object, but this matches order PATCH behavior roughly
    return NextResponse.json({
      success: true,
      message: "Refund initiated successfully",
      order: dbOrder
    })

  } catch (error) {
    console.error("ADMIN REFUND ERROR:", error)
    return NextResponse.json({
      success: false,
      message: "Internal server error"
    }, { status: 500 })
  }
}
