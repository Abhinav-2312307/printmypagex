import crypto from "crypto"
import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import { recordActivity } from "@/lib/activity-log"
import { pusherServer } from "@/lib/pusher-server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import User from "@/models/User"
import Supplier from "@/models/Supplier"

export const runtime = "nodejs"

type MinimalUser = {
  firebaseUID: string
  name?: string
  email?: string
  phone?: string
}

type MinimalSupplier = {
  firebaseUID: string
  name?: string
  email?: string
  approved?: boolean
  active?: boolean
}

async function enrichOrder(order: any) {
  const [user, supplier] = await Promise.all([
    User.findOne({ firebaseUID: order.userUID }).select("firebaseUID name email phone").lean() as Promise<MinimalUser | null>,
    order.supplierUID
      ? Supplier.findOne({ firebaseUID: order.supplierUID })
          .select("firebaseUID name email approved active")
          .lean() as Promise<MinimalSupplier | null>
      : Promise.resolve(null)
  ])

  return {
    ...order,
    user: user || null,
    supplier: supplier || null
  }
}

export async function POST(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()
    const orderId = String(body?.orderId || "").trim()
    const rawHours = Number(body?.hours)
    const hours = Number.isFinite(rawHours) && rawHours > 0 ? Math.min(168, Math.max(1, Math.round(rawHours))) : 24
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

    await connectDB()

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

    if (order.paymentStatus === "paid") {
      return NextResponse.json(
        {
          success: false,
          message: "Order is already paid"
        },
        { status: 409 }
      )
    }

    if (order.paymentStatus === "refunded") {
      return NextResponse.json(
        {
          success: false,
          message: "Order has been refunded and cannot accept payments"
        },
        { status: 409 }
      )
    }

    const token = crypto.randomBytes(24).toString("hex")
    const now = new Date()
    const expiresAt = new Date(now.getTime() + hours * 60 * 60 * 1000)

    order.paymentToken = token
    order.paymentExpiresAt = expiresAt
    order.paymentLinkCreatedAt = now

    const wasCancelled = order.status === "cancelled"
    if (wasCancelled || order.status === "pending") {
      order.status = "awaiting_payment"
    }

    order.cancelledAt = null
    if (!order.acceptedAt) {
      order.acceptedAt = now
    }

    order.logs.push({
      message: `Admin generated direct payment link (valid ${hours}h until ${expiresAt.toLocaleString()}) by ${auth.email}${note ? `: ${note}` : ""}`,
      time: now
    })

    await order.save()

    try {
      await pusherServer.trigger(`private-user-${order.userUID}`, "order-updated", order)
    } catch (pushErr) {
      console.error("PUSHER LINK UPDATE ERROR:", pushErr)
    }

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "printmypage.in"
    const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https")
    const origin = req.headers.get("origin") || `${proto}://${host}`
    const paymentLink = `${origin}/pay/${order._id}?token=${token}`

    await recordActivity({
      actorType: "admin",
      actorUID: auth.uid,
      actorEmail: auth.email,
      action: "order.payment_link_generated",
      entityType: "order",
      entityId: String(order._id),
      level: "info",
      message: `Admin generated payment link (${hours}h validity) for order ${order.shortId || String(order._id).slice(-8)}`,
      req,
      metadata: {
        orderId: String(order._id),
        hours,
        expiresAt: expiresAt.toISOString(),
        wasCancelled
      }
    })

    const enriched = await enrichOrder(order.toObject())

    return NextResponse.json({
      success: true,
      paymentLink,
      paymentToken: token,
      paymentExpiresAt: expiresAt.toISOString(),
      order: enriched
    })
  } catch (error) {
    console.error("ADMIN_PAYMENT_LINK_ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Failed to generate payment link"
      },
      { status: 500 }
    )
  }
}
