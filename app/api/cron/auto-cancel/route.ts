import { NextResponse } from "next/server"
import Order from "@/models/Order"
import { connectDB } from "@/lib/mongodb"
import { getPlatformSettings } from "@/lib/platform-settings"
import { recordActivity } from "@/lib/activity-log"

export async function GET(req: Request) {
  // In production, ensure this is protected using a cron secret header
  const authHeader = req.headers.get("authorization")
  // You would ideally use VERCEL_CRON_SECRET but we'll leave it open for now or add a basic check.
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.CRON_SECRET) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
  }

  try {
    await connectDB()
    const settings = await getPlatformSettings()
    const pendingAutoCancelHours = settings.pendingAutoCancelHours || 72
    const paymentAutoCancelHours = settings.paymentAutoCancelHours || 24

    const pendingCutoff = new Date(Date.now() - pendingAutoCancelHours * 60 * 60 * 1000)
    const paymentCutoff = new Date(Date.now() - paymentAutoCancelHours * 60 * 60 * 1000)

    // Find stale pending orders
    const stalePendingOrders = await Order.find({
      status: "pending",
      createdAt: { $lt: pendingCutoff }
    })

    // Find stale awaiting_payment orders
    const stalePaymentOrders = await Order.find({
      status: "awaiting_payment",
      updatedAt: { $lt: paymentCutoff }, // assuming updatedAt represents when it entered awaiting_payment
      paymentStatus: { $ne: "paid" }
    })

    let cancelledCount = 0

    // Process pending cancellations
    for (const order of stalePendingOrders) {
      order.status = "cancelled"
      order.cancelledAt = new Date()
      order.logs.push({
        message: `Order auto-cancelled after ${pendingAutoCancelHours} hours without acceptance`,
        time: new Date()
      })
      await order.save()
      cancelledCount++

      await recordActivity({
        actorType: "system",
        action: "order.auto_cancelled.pending",
        entityType: "order",
        entityId: String(order._id),
        level: "warning",
        message: `Order ${String(order._id).slice(-8)} auto-cancelled (unaccepted for ${pendingAutoCancelHours}h)`,
        metadata: {
          orderId: String(order._id),
          userUID: String(order.userUID)
        }
      })
    }

    // Process payment cancellations
    for (const order of stalePaymentOrders) {
      order.status = "cancelled"
      order.cancelledAt = new Date()
      order.logs.push({
        message: `Order auto-cancelled after ${paymentAutoCancelHours} hours without payment`,
        time: new Date()
      })
      await order.save()
      cancelledCount++

      await recordActivity({
        actorType: "system",
        action: "order.auto_cancelled.payment",
        entityType: "order",
        entityId: String(order._id),
        level: "warning",
        message: `Order ${String(order._id).slice(-8)} auto-cancelled (unpaid for ${paymentAutoCancelHours}h)`,
        metadata: {
          orderId: String(order._id),
          userUID: String(order.userUID),
          supplierUID: String(order.supplierUID)
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: `Auto-cancelled ${cancelledCount} stale orders.`,
      pendingCutoff,
      paymentCutoff,
      cancelledCount
    })
  } catch (error) {
    console.error("CRON_AUTO_CANCEL_ERROR:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
