import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import Order from "@/models/Order"
import { connectDB } from "@/lib/mongodb"

export async function GET(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const shortId = searchParams.get("shortId")

  if (!shortId) {
    return NextResponse.json({ success: false, message: "shortId is required" }, { status: 400 })
  }

  try {
    await connectDB()
    const order = await Order.findOne({ shortId }).lean()

    if (!order) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      orderId: String(order._id)
    })
  } catch (error) {
    console.error("ADMIN_ORDER_SEARCH_ERROR:", error)
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 })
  }
}
