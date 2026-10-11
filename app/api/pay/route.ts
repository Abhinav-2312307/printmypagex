import { NextResponse } from "next/server"
import Razorpay from "razorpay"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import User from "@/models/User"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"

export const runtime = "nodejs"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const orderId = String(searchParams.get("orderId") || "").trim()
    const token = String(searchParams.get("token") || "").trim()

    if (!orderId || !token) {
      return NextResponse.json(
        { success: false, message: "Missing order ID or payment token" },
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
        { success: false, message: "Invalid or unauthorized payment link" },
        { status: 403 }
      )
    }

    if (order.paymentStatus === "paid") {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        order: {
          id: String(order._id),
          shortId: order.shortId || String(order._id).slice(-8),
          status: order.status,
          paymentStatus: order.paymentStatus,
          paidAt: order.paidAt,
          amount: Number(order.finalPrice ?? order.estimatedPrice ?? 0),
          pages: order.verifiedPages ?? order.pages ?? 0,
          copies: order.copies || 1,
          printType: order.printType
        }
      })
    }

    if (order.paymentStatus === "refunded") {
      return NextResponse.json(
        { success: false, message: "This order has been refunded" },
        { status: 410 }
      )
    }

    const now = Date.now()
    const expiresAtMs = order.paymentExpiresAt ? new Date(order.paymentExpiresAt).getTime() : 0
    const isExpired = expiresAtMs > 0 && expiresAtMs <= now

    if (isExpired) {
      return NextResponse.json(
        {
          success: false,
          expired: true,
          message: "This payment link has expired. Please contact support or the administrator for an extension."
        },
        { status: 410 }
      )
    }

    const user = await User.findOne({ firebaseUID: order.userUID }).select("name phone").lean()
    const payableAmount = Number(order.finalPrice ?? order.estimatedPrice ?? 0)

    let customerDisplayName = "Customer"
    if (user?.name) {
      const parts = user.name.trim().split(" ")
      customerDisplayName = parts[0] + (parts.length > 1 ? ` ${parts[1][0]}.` : "")
    }

    const fileSummary = Array.isArray(order.files) && order.files.length > 0
      ? order.files.map((f: any) => ({
          name: f.fileOriginalName || "Document.pdf",
          pages: f.verifiedPages ?? f.pages ?? 1
        }))
      : [
          {
            name: order.fileOriginalName || "Document.pdf",
            pages: order.verifiedPages ?? order.pages ?? 1
          }
        ]

    return NextResponse.json({
      success: true,
      order: {
        id: String(order._id),
        shortId: order.shortId || String(order._id).slice(-8),
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentExpiresAt: order.paymentExpiresAt,
        pages: order.verifiedPages ?? order.pages ?? 0,
        copies: order.copies || 1,
        printType: order.printType,
        duplex: Boolean(order.duplex),
        spiralBinding: Boolean(order.spiralBinding),
        instruction: order.instruction || "",
        amount: payableAmount,
        customerName: customerDisplayName,
        files: fileSummary
      }
    })
  } catch (error) {
    console.error("GET_PAY_DETAILS_ERROR:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { success: false, message: "Payment system not configured" },
        { status: 500 }
      )
    }

    const body = await req.json()
    const orderId = String(body?.orderId || "").trim()
    const token = String(body?.token || "").trim()

    if (!orderId || !token) {
      return NextResponse.json(
        { success: false, message: "orderId and token are required" },
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
      return NextResponse.json(
        { success: false, message: "Order already paid" },
        { status: 409 }
      )
    }

    if (order.paymentStatus === "refunded") {
      return NextResponse.json(
        { success: false, message: "Order has been refunded" },
        { status: 409 }
      )
    }

    const now = Date.now()
    const expiresAtMs = order.paymentExpiresAt ? new Date(order.paymentExpiresAt).getTime() : 0
    if (expiresAtMs > 0 && expiresAtMs <= now) {
      return NextResponse.json(
        { success: false, message: "Payment link has expired" },
        { status: 410 }
      )
    }

    const payableAmount = Number(order.finalPrice ?? order.estimatedPrice ?? 0)
    if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "Invalid payable amount" },
        { status: 400 }
      )
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    })

    const shortOrderId = String(order._id).slice(-8)
    const shortTs = Date.now().toString().slice(-6)
    const receipt = `link_${shortOrderId}_${shortTs}`.slice(0, 40)

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(payableAmount * 100),
      currency: "INR",
      receipt,
      notes: {
        orderId: String(order._id),
        userUID: order.userUID,
        viaLink: "true"
      }
    })

    order.razorpayOrderId = razorpayOrder.id
    await order.save()

    return NextResponse.json({
      success: true,
      key: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      razorpayOrderId: razorpayOrder.id
    })
  } catch (error) {
    console.error("CREATE_PAY_LINK_ORDER_ERROR:", error)
    return NextResponse.json(
      { success: false, message: "Failed to initialize payment gateway" },
      { status: 500 }
    )
  }
}
