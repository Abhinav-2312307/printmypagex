import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"

export async function POST(req:Request){

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

const supplier = await Supplier.findOneAndUpdate(
{firebaseUID:body.firebaseUID},
{active:body.active},
{new:true}
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
