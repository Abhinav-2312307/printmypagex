import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import Supplier from "@/models/Supplier"
import { pusherServer } from "@/lib/pusher-server"

export async function POST(req: Request) {

  await connectDB()

  const body = await req.json()

  const { orderId, supplierUID } = body

  const supplier = await Supplier.findOne({
    firebaseUID: supplierUID
  })

  if (!supplier) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier not registered"
      },
      { status: 403 }
    )
  }

  if (!supplier.approved) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier not approved"
      },
      { status: 403 }
    )
  }

  if (!supplier.active) {
    return NextResponse.json(
      {
        success: false,
        message: "Supplier is inactive"
      },
      { status: 403 }
    )
  }

  const order = await Order.findOneAndUpdate(
    {
      _id: orderId,
      status: "pending",
      $or: [
        { supplierUID: null },
        { supplierUID: supplierUID }
      ]
    },
    {
      supplierUID: supplierUID,
      status: "accepted",
      acceptedAt: new Date(),
      $push: {
        logs: {
          message: "Order accepted by supplier",
          time: new Date()
        }
      }
    },
    { new: true }
  )

  if (!order) {
    return NextResponse.json({
      success: false,
      message: "Order already accepted"
    })
  }

  await pusherServer.trigger("orders", "order-accepted", {
    orderId
  })

  return NextResponse.json({
    success: true,
    order
  })
}
