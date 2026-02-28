import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import User from "@/models/User"

export async function POST(req: Request){

  await connectDB()

  const body = await req.json()

  const user = await User.findOne({
    firebaseUID: body.firebaseUID
  })

  if(user){
    return NextResponse.json({
      exists: true
    })
  }

  return NextResponse.json({
    exists: false
  })
}