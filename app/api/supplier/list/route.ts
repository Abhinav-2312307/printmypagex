import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"

export async function GET() {

  await connectDB()

  const suppliers = await Supplier.find({
    approved: true,
    active: true
  }).select("firebaseUID name branch year")

  return NextResponse.json({
    success: true,
    suppliers
  })
}