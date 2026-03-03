import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"

export async function POST(req:Request){

await connectDB()

const body = await req.json()

const supplier = await Supplier.findOneAndUpdate(
{firebaseUID:body.firebaseUID},
{active:body.active},
{new:true}
)

return NextResponse.json({
success:true,
supplier
})

}