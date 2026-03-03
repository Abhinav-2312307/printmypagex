import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"

export async function POST(req: Request) {

  await connectDB()

  const body = await req.json()

  const order = await Order.findById(body.orderId)

  if (!order) {
    return NextResponse.json({ error: "Order not found" })
  }

  let pricePerPage = 2

  if (order.printType === "color") pricePerPage = 5
  if (order.printType === "glossy") pricePerPage = 15

  const finalPrice = body.pages * pricePerPage

  order.verifiedPages = body.pages
  order.finalPrice = finalPrice
  order.status = "awaiting_payment"

  await order.save()

  return NextResponse.json({
    success: true,
    order
  })
}