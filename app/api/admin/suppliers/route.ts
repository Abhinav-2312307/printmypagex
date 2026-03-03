import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"

export async function GET(){

await connectDB()

const suppliers = await Supplier.find({
approved:false
})

return NextResponse.json({
suppliers
})

}