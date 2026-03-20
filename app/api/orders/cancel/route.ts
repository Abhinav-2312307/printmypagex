import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { pusherServer } from "@/lib/pusher-server"
import { sendOrderCancelledNotification } from "@/lib/order-email"
import { authenticateUserRequest } from "@/lib/user-auth"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function POST(req:Request){
const auth = await authenticateUserRequest(req)
if (!auth.ok) return auth.response

await connectDB()

const body = await req.json()

if(!body?.orderId){
return NextResponse.json(
{
success:false,
message:"Missing orderId"
},
{ status:400 }
)
}

const order = await Order.findById(body.orderId)

if(!order){
return NextResponse.json({success:false},{ status:404 })
}

if(order.userUID !== auth.uid){
return NextResponse.json(
{
success:false,
message:"Unauthorized cancellation request"
},
{ status:403 }
)
}

if(order.paymentStatus==="paid"){
return NextResponse.json({
success:false,
message:"Paid orders cannot be cancelled"
},{ status:409 })
}

if(order.status==="cancelled"){
return NextResponse.json({
success:false,
message:"Order is already cancelled"
},{ status:409 })
}

order.status="cancelled"
order.cancelledAt=new Date()

order.logs.push({
message:"Order cancelled by user",
time:new Date()
})

await order.save()

await recordActivity({
actorType:"user",
actorUID:auth.uid,
actorEmail:auth.email,
action:"order.cancelled_by_user",
entityType:"order",
entityId:String(order._id),
level:"warning",
message:`User cancelled order ${String(order._id).slice(-8)}`,
metadata:{
orderId:String(order._id),
userUID:auth.uid,
supplierUID:String(order.supplierUID || ""),
paymentStatus:String(order.paymentStatus || "")
}
})

try{
await pusherServer.trigger(`private-user-${order.userUID}`,"order-updated",order)
}catch(pushError){
console.error("PUSHER USER CANCEL ERROR:",pushError)
}

try{
if(order.supplierUID){
await pusherServer.trigger(`private-supplier-${order.supplierUID}`,"order-updated",order)
}
}catch(pushError){
console.error("PUSHER SUPPLIER CANCEL ERROR:",pushError)
}

sendOrderCancelledNotification(order, "user").catch((emailError) => {
console.error("ORDER_CANCELLED_EMAIL_ERROR:", emailError)
})

return NextResponse.json({
success:true
})

}
