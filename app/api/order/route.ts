import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"

export async function GET(req: Request) {

  await connectDB()

  const { searchParams } = new URL(req.url)

  const firebaseUID = searchParams.get("firebaseUID")

  const orders = await Order.find({ firebaseUID }).sort({ createdAt:-1 })

  return NextResponse.json({
    success:true,
    orders
  })

}