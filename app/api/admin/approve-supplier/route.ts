import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"

export async function POST(req:Request){

await connectDB()

const body = await req.json()

await Supplier.findByIdAndUpdate(body.id,{
approved:true,
active:true
})

return NextResponse.json({
success:true
})

}