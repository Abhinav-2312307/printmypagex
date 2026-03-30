import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import { recordActivity } from "@/lib/activity-log"
import {
  sendAdminMessageToUser,
  sendAdminPaymentReminderNotification
} from "@/lib/order-email"
import Order from "@/models/Order"
import Supplier from "@/models/Supplier"
import User from "@/models/User"

export const runtime = "nodejs"

type OrderDoc = {
  _id: string
  userUID?: string
  supplierUID?: string | null
  adminReminderCount?: number
  lastAdminReminderAt?: Date | null
  [key: string]: unknown
}

type MinimalUser = {
  firebaseUID: string
  name?: string
  email?: string
}

type MinimalSupplier = {
  firebaseUID: string
  name?: string
  email?: string
  approved?: boolean
  active?: boolean
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Failed to send notification email"
}

async function enrichOrder(order: OrderDoc) {
  const [user, supplier] = await Promise.all([
    User.findOne({ firebaseUID: order.userUID }).select("firebaseUID name email").lean<MinimalUser | null>(),
    order.supplierUID
      ? Supplier.findOne({ firebaseUID: order.supplierUID })
          .select("firebaseUID name email approved active")
          .lean<MinimalSupplier | null>()
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
    const action = String(body?.action || "").trim()

    if (action === "send_user_message") {
      const userUID = String(body?.userUID || "").trim()
      const subject = String(body?.subject || "").replace(/\s+/g, " ").trim()
      const message = String(body?.message || "").trim()

      if (!userUID || !subject || !message) {
        return NextResponse.json(
          {
            success: false,
            message: "userUID, subject and message are required"
          },
          { status: 400 }
        )
      }

      if (subject.length > 160) {
        return NextResponse.json(
          {
            success: false,
            message: "Subject must be 160 characters or less"
          },
          { status: 400 }
        )
      }

      if (message.length > 5000) {
        return NextResponse.json(
          {
            success: false,
            message: "Message must be 5000 characters or less"
          },
          { status: 400 }
        )
      }

      const user = await User.findOne({ firebaseUID: userUID }).lean()

      if (!user) {
        return NextResponse.json(
          {
            success: false,
            message: "User not found"
          },
          { status: 404 }
        )
      }

      if (!String(user.email || "").includes("@")) {
        return NextResponse.json(
          {
            success: false,
            message: "Selected user does not have a valid email address"
          },
          { status: 409 }
        )
      }

      await sendAdminMessageToUser({
        firebaseUID: userUID,
        subject,
        message,
        adminEmail: auth.email
      })

      await recordActivity({
        actorType: "admin",
        actorUID: auth.uid,
        actorEmail: auth.email,
        action: "user.admin_email_sent",
        entityType: "user",
        entityId: userUID,
        level: "info",
        message: `Admin sent an email to user ${user?.email || userUID}`,
        metadata: {
          firebaseUID: userUID,
          subject
        }
      })

      return NextResponse.json({
        success: true,
        message: "Message email sent successfully",
        user
      })
    }

    if (action === "send_payment_reminder") {
      const orderId = String(body?.orderId || "").trim()
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

      if (note.length > 1200) {
        return NextResponse.json(
          {
            success: false,
            message: "Reminder note must be 1200 characters or less"
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

      if (order.paymentStatus === "paid") {
        return NextResponse.json(
          {
            success: false,
            message: "Payment reminder cannot be sent for a paid order"
          },
          { status: 409 }
        )
      }

      if (String(order.status || "") !== "awaiting_payment") {
        return NextResponse.json(
          {
            success: false,
            message: "Payment reminder can only be sent for orders awaiting payment"
          },
          { status: 409 }
        )
      }

      const targetUser = await User.findOne({ firebaseUID: order.userUID })
        .select("firebaseUID name email")
        .lean()

      if (!targetUser || !String(targetUser.email || "").includes("@")) {
        return NextResponse.json(
          {
            success: false,
            message: "Selected order user does not have a valid email address"
          },
          { status: 409 }
        )
      }

      await sendAdminPaymentReminderNotification(order, {
        note,
        adminEmail: auth.email
      })

      const now = new Date()
      order.adminReminderCount = Number(order.adminReminderCount || 0) + 1
      order.lastAdminReminderAt = now
      order.logs.push({
        message: `Admin payment reminder email sent by ${auth.email}${note ? `: ${note}` : ""}`,
        time: now
      })
      await order.save()

      await recordActivity({
        actorType: "admin",
        actorUID: auth.uid,
        actorEmail: auth.email,
        action: "order.payment_reminder_sent",
        entityType: "order",
        entityId: String(order._id),
        level: "info",
        message: `Admin sent a payment reminder for order ${String(order._id).slice(-8)}`,
        metadata: {
          orderId: String(order._id),
          userUID: String(order.userUID),
          supplierUID: String(order.supplierUID || ""),
          reminderCount: Number(order.adminReminderCount || 0),
          note
        }
      })

      const enrichedOrder = await enrichOrder(order.toObject() as OrderDoc)

      return NextResponse.json({
        success: true,
        message: "Payment reminder email sent successfully",
        order: enrichedOrder
      })
    }

    return NextResponse.json(
      {
        success: false,
        message: "Unknown notification action"
      },
      { status: 400 }
    )
  } catch (error) {
    console.error("ADMIN_NOTIFICATION_EMAIL_ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: getErrorMessage(error)
      },
      { status: 500 }
    )
  }
}
