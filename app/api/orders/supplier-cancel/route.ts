import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { pusherServer } from "@/lib/pusher-server"
import { sendOrderCancelledNotification } from "@/lib/order-email"
import { authenticateSupplierRequest } from "@/lib/supplier-auth"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function POST(req: Request){
const auth = await authenticateSupplierRequest(req)
if (!auth.ok) return auth.response

await connectDB()

const body = await req.json()

const { orderId } = body
const supplierUIDFromBody = body.supplierUID as string | undefined
const supplierUID = auth.uid

if(!orderId){
return NextResponse.json(
{
success:false,
message:"Missing order details"
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

const order = await Order.findOne({
  _id: orderId
})

if(!order){
return NextResponse.json(
{
success:false,
message:"Order not found"
},
{ status:404 }
)
}

/* only supplier who owns order can cancel */

if(order.supplierUID !== supplierUID){
return NextResponse.json(
{
success:false,
message:"You are not allowed to cancel this order"
},
{ status:403 }
)
}

/* cannot cancel paid order */

if(order.paymentStatus === "paid"){
return NextResponse.json({
success:false,
message:"Cannot cancel paid order"
},{ status:409 })
}

if(order.status === "cancelled"){
return NextResponse.json({
success:false,
message:"Order is already cancelled"
},{ status:409 })
}

order.status = "cancelled"
order.cancelledAt = new Date()

order.logs.push({
message:"Order cancelled by supplier",
time:new Date()
})

await order.save()

await recordActivity({
actorType:"supplier",
actorUID:supplierUID,
actorEmail:auth.email,
action:"order.cancelled_by_supplier",
entityType:"order",
entityId:String(order._id),
level:"warning",
message:`Supplier cancelled order ${String(order._id).slice(-8)}`,
metadata:{
orderId:String(order._id),
userUID:String(order.userUID),
supplierUID,
paymentStatus:String(order.paymentStatus || "")
}
})

/* realtime update for user */

try{
await pusherServer.trigger(
`private-user-${order.userUID}`,
"order-updated",
order
)
}catch(pushError){
console.error("PUSHER USER SUPPLIER CANCEL ERROR:",pushError)
}

sendOrderCancelledNotification(order, "supplier").catch((emailError) => {
console.error("ORDER_CANCELLED_EMAIL_ERROR:", emailError)
})

return NextResponse.json({
success:true,
order
})

}
