import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { pusherServer } from "@/lib/pusher-server"
import { sendOrderStatusNotification } from "@/lib/order-email"
import { authenticateSupplierRequest } from "@/lib/supplier-auth"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function POST(req:Request){
try{
const auth = await authenticateSupplierRequest(req)
if (!auth.ok) return auth.response
const supplierUID = auth.uid

await connectDB()
await applyOrderLifecycleRules({ supplierUID })

const body = await req.json()
const { orderId, status } = body
const supplierUIDFromBody = body.supplierUID as string | undefined

if(!orderId || !status){
return NextResponse.json(
{
success:false,
message:"Missing update details"
},
{ status:400 }
)
}

if(supplierUIDFromBody && supplierUIDFromBody !== supplierUID){
return NextResponse.json(
{
success:false,
message:"Unauthorized supplier"
},
{ status:403 }
)
}

const order = await Order.findById(orderId)

if(!order){
return NextResponse.json(
{
success:false,
message:"Order not found"
},
{ status:404 }
)
}

const previousStatus = String(order.status || "")

if(order.supplierUID !== supplierUID){
return NextResponse.json(
{
success:false,
message:"You are not allowed to update this order"
},
{ status:403 }
)
}

const allowedNext: Record<string, string[]> = {
awaiting_payment:["printing"],
printing:["printed"],
printed:["delivered"]
}

const nextStates = allowedNext[previousStatus] || []
if(!nextStates.includes(status)){
return NextResponse.json(
{
success:false,
message:`Cannot move order from ${previousStatus} to ${status}`
},
{ status:409 }
)
}

if(status === "printing" && order.paymentStatus !== "paid"){
return NextResponse.json(
{
success:false,
message:"Order must be paid before printing starts"
},
{ status:409 }
)
}

order.status = status

if(status === "delivered"){
order.deliveredAt = new Date()
}

order.logs.push({
message:`Supplier updated status to ${status}`,
time:new Date()
})

await order.save()

await recordActivity({
actorType:"supplier",
actorUID:supplierUID,
actorEmail:auth.email,
action:"order.status_updated",
entityType:"order",
entityId:String(order._id),
level:"info",
message:`Supplier moved order ${String(order._id).slice(-8)} from ${previousStatus} to ${status}`,
metadata:{
orderId:String(order._id),
userUID:String(order.userUID),
supplierUID,
previousStatus,
nextStatus:status,
paymentStatus:String(order.paymentStatus || "")
}
})

try{
await pusherServer.trigger(`private-user-${order.userUID}`,"order-updated",order)
}catch(pushError){
console.error("PUSHER USER STATUS UPDATE ERROR:",pushError)
}

try{
if(order.supplierUID){
await pusherServer.trigger(`private-supplier-${order.supplierUID}`,"order-updated",order)
}
}catch(pushError){
console.error("PUSHER SUPPLIER STATUS UPDATE ERROR:",pushError)
}

sendOrderStatusNotification(order, status).catch((emailError) => {
console.error("ORDER_STATUS_EMAIL_ERROR:", emailError)
})

return NextResponse.json({
success:true,
order
})
}catch(error){
console.error("ORDER STATUS UPDATE ERROR:",error)
return NextResponse.json(
{
success:false,
message:"Failed to update order status"
},
{ status:500 }
)
}

}
