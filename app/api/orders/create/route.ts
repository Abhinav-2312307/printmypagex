import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"


export async function POST(req: Request) {

  await connectDB()

  const body = await req.json()

  const order = await Order.findOneAndUpdate(
    {
      _id: body.orderId,
      status: "pending"
    },
    {
      supplier: body.supplierUID,
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

  return NextResponse.json({
    success: true,
    order
  })
  
}
