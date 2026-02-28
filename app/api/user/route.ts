import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import User from "@/models/User"

export async function GET(req: Request) {

await connectDB()

const { searchParams } = new URL(req.url)

const firebaseUID = searchParams.get("firebaseUID")

const user = await User.findOne({ firebaseUID })

return NextResponse.json({
success:true,
user
})

}