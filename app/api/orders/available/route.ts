import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"

export async function GET(req:Request){

await connectDB()

const {searchParams} = new URL(req.url)

const supplierUID = searchParams.get("supplierUID")

const orders = await Order.find({

status:"pending",

$or:[
{requestType:"global"},
{supplierUID:supplierUID}
]

}).sort({createdAt:-1})

return NextResponse.json({
success:true,
orders
})

}