import { NextResponse } from "next/server"
import Razorpay from "razorpay"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { authenticateUserRequest } from "@/lib/user-auth"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"

export async function POST(req: Request) {
  try {
    const auth = await authenticateUserRequest(req)
    if (!auth.ok) return auth.response

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        {
          success: false,
          message: "Payment system not configured yet"
        },
        { status: 500 }
      )
    }

    const body = await req.json()
    const orderIds = body.orderIds as string[] | undefined
    const userUIDFromBody = body.userUID as string | undefined
    const userUID = auth.uid

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "No orders provided for batch payment"
        },
        { status: 400 }
      )
    }

    if (userUIDFromBody && userUIDFromBody !== userUID) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized payment request"
        },
        { status: 403 }
      )
    }

    await connectDB()
    await applyOrderLifecycleRules({ userUID })

    const dbOrders = await Order.find({
      _id: { $in: orderIds },
      userUID
    })

    if (dbOrders.length !== orderIds.length) {
      return NextResponse.json(
        {
          success: false,
          message: "One or more orders could not be found or do not belong to you"
        },
        { status: 404 }
      )
    }

    // Validate state of every order
    for (const order of dbOrders) {
      if (order.paymentStatus === "paid") {
        return NextResponse.json(
          {
            success: false,
            message: `Order ${order.shortId || String(order._id).slice(-8)} is already paid`
          },
          { status: 409 }
        )
      }

      if (order.paymentStatus === "refunded") {
        return NextResponse.json(
          {
            success: false,
            message: `Order ${order.shortId || String(order._id).slice(-8)} was refunded and cannot be paid`
          },
          { status: 409 }
        )
      }

      if (order.status === "cancelled") {
        return NextResponse.json(
          {
            success: false,
            message: `Order ${order.shortId || String(order._id).slice(-8)} is cancelled and cannot be paid`
          },
          { status: 409 }
        )
      }

      if (order.status !== "awaiting_payment") {
        return NextResponse.json(
          {
            success: false,
            message: `Order ${order.shortId || String(order._id).slice(-8)} is not ready for payment`
          },
          { status: 409 }
        )
      }
    }

    // Calculate total amount
    const totalPayableAmount = dbOrders.reduce((sum, order) => {
      const amount = Number(order.finalPrice ?? order.estimatedPrice ?? 0)
      return sum + (Number.isFinite(amount) ? amount : 0)
    }, 0)

    if (!Number.isFinite(totalPayableAmount) || totalPayableAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid payable amount for selected orders"
        },
        { status: 400 }
      )
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })

    const shortTs = Date.now().toString().slice(-8)
    const receipt = `rcpt_batch_${shortTs}_${orderIds.length}`.slice(0, 40)

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(totalPayableAmount * 100),
      currency: "INR",
      receipt,
      notes: {
        batchPayment: "true",
        userUID,
        orderCount: String(dbOrders.length),
        orderIds: orderIds.slice(0, 8).join(",")
      }
    })

    // Assign razorpayOrderId to all orders
    await Order.updateMany(
      { _id: { $in: orderIds }, userUID },
      { $set: { razorpayOrderId: razorpayOrder.id } }
    )

    return NextResponse.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      razorpayOrderId: razorpayOrder.id,
      orderIds,
      orderCount: dbOrders.length,
      totalPayableAmount
    })
  } catch (error) {
    console.error("BATCH PAYMENT CREATE ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to initialize batch payment"
      },
      { status: 500 }
    )
  }
}
