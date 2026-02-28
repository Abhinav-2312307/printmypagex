import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import User from "@/models/User"

export async function POST(req: Request) {

  await connectDB()

  const body = await req.json()

  const newUser = await User.create({
    firebaseUID: body.firebaseUID,
    name: body.name,
    rollNo: body.rollNo,
    branch: body.branch,
    year: body.year,
    section: body.section,
    phone: body.phone
  })

  return NextResponse.json({
    success: true,
    message: "Profile created successfully",
    user: newUser
  })
}