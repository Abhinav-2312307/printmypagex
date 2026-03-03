import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"

export async function GET(req:Request){

await connectDB()

const {searchParams} = new URL(req.url)

const firebaseUID = searchParams.get("firebaseUID")

const supplier = await Supplier.findOne({
firebaseUID
})

return NextResponse.json({
success:true,
supplier
})

}