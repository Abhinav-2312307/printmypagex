import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import User from "@/models/User"
import { authenticateUserRequest } from "@/lib/user-auth"

type UserRecord = {
  [key: string]: unknown
}

export async function GET(req: Request) {
const auth = await authenticateUserRequest(req, {
requireProfile: false,
requireActive: false
})
if (!auth.ok) return auth.response

await connectDB()

const { searchParams } = new URL(req.url)

const firebaseUID = searchParams.get("firebaseUID")

if (!firebaseUID) {
return NextResponse.json({
success:false,
message:"Missing firebaseUID"
},{ status:400 })
}

if (firebaseUID !== auth.uid) {
return NextResponse.json({
success:false,
message:"Unauthorized UID"
},{ status:403 })
}

const user = await User.findOne({ firebaseUID }).lean<UserRecord | null>()

return NextResponse.json({
success:true,
user
})

}
