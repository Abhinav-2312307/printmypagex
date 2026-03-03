import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { pusherServer } from "@/lib/pusher-server"

export async function POST(req: Request) {

  await connectDB()

  const body = await req.json()

  const { orderId, supplierUID } = body

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: "pending",
      supplierUID: null
    },
    {
      supplierUID: supplierUID,
      status: "accepted"
    },
    { new: true }
  )

  if (!order) {
    return NextResponse.json({
      success: false,
      message: "Order already accepted"
    })
  }

  // 🔥 BROADCAST REMOVAL
  await pusherServer.trigger("orders", "order-accepted", {
    orderId
  })

  return NextResponse.json({
    success: true,
    order
  })
}