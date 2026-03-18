import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"
import { authenticateUserRequest } from "@/lib/user-auth"

export async function POST(req:Request){
const auth = await authenticateUserRequest(req, {
requireProfile: false,
requireActive: false
})
if (!auth.ok) return auth.response

await connectDB()

const body = await req.json()

if(!body.firebaseUID || typeof body.active !== "boolean"){
return NextResponse.json(
{
success:false,
message:"Missing or invalid data"
},
{ status:400 }
)
}

if(body.firebaseUID !== auth.uid){
return NextResponse.json(
{
success:false,
message:"Unauthorized UID"
},
{ status:403 }
)
}

const supplier = await Supplier.findOneAndUpdate(
{firebaseUID:body.firebaseUID},
{active:body.active},
{returnDocument:"after"}
)

if(!supplier){
return NextResponse.json(
{
success:false,
message:"Supplier not found"
},
{ status:404 }
)
}

return NextResponse.json({
success:true,
supplier
})

}
