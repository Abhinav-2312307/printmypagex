"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import toast from "react-hot-toast"
import { pusherClient } from "@/lib/pusher-client"
import SupplierGuard from "@/components/SupplierGuard"

type SupplierOrderDetail = {
  _id: string
  status: string
  paymentStatus: string
  createdAt: string
  pages?: number
  verifiedPages?: number | null
  userName?: string
  phone?: string
  class?: string
  rollNo?: string
  printType?: string
  estimatedPrice?: number
  finalPrice?: number | null
  fileURL?: string
}

export default function SupplierOrders(){

const [orders,setOrders] = useState<SupplierOrderDetail[]>([])
const [available,setAvailable] = useState<SupplierOrderDetail[]>([])
const [loading,setLoading] = useState(true)
const [selectedOrder,setSelectedOrder] = useState<SupplierOrderDetail | null>(null)
const [uid,setUid] = useState<string | null>(null)
const [filter,setFilter] = useState("pending")
const [verifiedPages,setVerifiedPages] = useState<number>(0)

async function loadOrders(uid:string){

try{

const res1 = await fetch(`/api/orders/available?supplierUID=${uid}`)
const data1 = await res1.json()

const res2 = await fetch(`/api/orders/supplier?supplierUID=${uid}`)
const data2 = await res2.json()

setAvailable(data1.orders || [])
setOrders(data2.orders || [])

}catch{

toast.error("Failed to load orders")

}

setLoading(false)

}

useEffect(()=>{

const unsubscribe = onAuthStateChanged(auth,(user)=>{

if(!user) return

fetch("/api/supplier/sync-email",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body: JSON.stringify({
firebaseUID:user.uid,
email:user.email || user.providerData?.[0]?.email || ""
})
}).catch(()=>{})

setUid(user.uid)
loadOrders(user.uid)

})

return ()=>unsubscribe()

},[])

useEffect(()=>{

if(!uid) return

const channel = pusherClient.subscribe(`supplier-${uid}`)

channel.bind("order-updated",(updatedOrder:SupplierOrderDetail)=>{

setOrders(prev =>
prev.map(order =>
order._id===updatedOrder._id ? updatedOrder : order
)
)

setAvailable(prev =>
prev.map(order =>
order._id===updatedOrder._id ? updatedOrder : order
)
)

setSelectedOrder((prev)=>
prev && prev._id===updatedOrder._id ? updatedOrder : prev
)

})

return ()=>{
pusherClient.unsubscribe(`supplier-${uid}`)
}

},[uid])


const acceptOrder = async(id:string)=>{

if(!uid) return

try{

const res = await fetch("/api/orders/accept",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
orderId:id,
supplierUID:uid
})
})

const data = await res.json()

if(!res.ok || !data.success){
toast.error(data.message || "Failed to accept order")
return
}

toast.success("Order accepted")

setAvailable(prev=>prev.filter(o=>o._id!==id))

loadOrders(uid)

}catch{
toast.error("Failed to accept order")
}

}


const cancelOrder = async(orderId:string)=>{

if(!uid) return

try{

await fetch("/api/orders/supplier-cancel",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
orderId,
supplierUID:uid
})
})

toast.success("Order cancelled")

loadOrders(uid)

}catch{

toast.error("Failed to cancel order")

}

}


const updateOrderStatus = async(orderId:string,status:"printing"|"printed"|"delivered")=>{

if(!uid) return

try{

const res = await fetch("/api/orders/update-status",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
orderId,
status,
supplierUID:uid
})
})

const data = await res.json()

if(!res.ok || !data.success){
toast.error(data.message || "Failed to update status")
return
}

toast.success(`Order marked as ${status}`)
await loadOrders(uid)

if(selectedOrder && selectedOrder._id===orderId){
setSelectedOrder(data.order)
}

}catch{
toast.error("Failed to update status")
}

}

/* NEW: VERIFY PAGES */

const verifyPages = async(orderId:string)=>{

if(!uid){
toast.error("Supplier not authenticated")
return
}

if(!Number.isFinite(verifiedPages) || verifiedPages<=0){
toast.error("Enter verified pages")
return
}

try{

const res = await fetch("/api/orders/verify",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
orderId,
supplierUID:uid,
verifiedPages
})
})

const data = await res.json()

if(!res.ok || !data.success){
toast.error(data.message || "Failed to verify pages")
return
}

toast.success("Pages verified")

await loadOrders(uid)

setSelectedOrder(null)

}catch{
toast.error("Failed to verify pages")
}

}


const getStatusColor = (status:string)=>{

if(status==="pending")
return "bg-yellow-500/20 text-yellow-400 border border-yellow-400/30"

if(status==="accepted")
return "bg-blue-500/20 text-blue-400 border border-blue-400/30"

if(status==="awaiting_payment")
return "bg-orange-500/20 text-orange-400 border border-orange-400/30"

if(status==="printing")
return "bg-indigo-500/20 text-indigo-400 border border-indigo-400/30"

if(status==="printed")
return "bg-green-500/20 text-green-400 border border-green-400/30"

if(status==="delivered")
return "bg-purple-500/20 text-purple-400 border border-purple-400/30"

return "bg-gray-500/20 text-gray-400 border border-gray-400/20"

}


let displayOrders:SupplierOrderDetail[]=[]

if(filter==="pending") displayOrders=available
if(filter==="accepted") displayOrders=orders.filter(o=>o.status==="accepted")
if(filter==="awaiting_payment") displayOrders=orders.filter(o=>o.status==="awaiting_payment")
if(filter==="printing") displayOrders=orders.filter(o=>o.status==="printing")
if(filter==="paid") displayOrders=orders.filter(o=>o.paymentStatus==="paid")
if(filter==="printed") displayOrders=orders.filter(o=>o.status==="printed")
if(filter==="delivered") displayOrders=orders.filter(o=>o.status==="delivered")

if(filter==="all"){
const map = new Map()
;[...available,...orders].forEach(order=>{
map.set(order._id,order)
})
displayOrders = Array.from(map.values())
}


return(
<SupplierGuard>
<div className="px-6 md:px-20 xl:px-32 py-16">

<h1 className="text-4xl font-bold mb-14 text-gradient">
Supplier Orders
</h1>


<div className="flex gap-4 mb-12 flex-wrap">

{[
["pending","Pending"],
["accepted","Accepted"],
["awaiting_payment","Awaiting Payment"],
["printing","Printing"],
["paid","Paid"],
["printed","Printed"],
["delivered","Delivered"],
["all","All Orders"]
].map(([key,label])=>(

<button
key={key}
onClick={()=>setFilter(key)}
className={`px-5 py-2 rounded-xl border transition ${
filter===key
? "bg-indigo-500/20 border-indigo-400 text-indigo-300"
: "border-white/10 text-gray-400 hover:text-white"
}`}
>
{label}
</button>

))}

</div>


{!loading &&(

<div className="bg-card p-10 rounded-3xl mb-16 shadow-xl border border-white/10">

<p className="text-gray-400 text-sm">
Total Orders
</p>

<h2 className="text-5xl font-bold mt-2 text-gradient">
{displayOrders.length}
</h2>

</div>

)}


<div className="grid lg:grid-cols-2 gap-12">

{displayOrders.map(order=>(

<div
key={order._id}
className="bg-card p-10 rounded-3xl border border-white/10 hover:scale-[1.02] transition shadow-xl"
>

<div className="flex justify-between items-center mb-6">

<p className="text-2xl font-bold text-gradient">
{(order.printType || "bw").toUpperCase()} Print
</p>

<span
className={`px-5 py-1.5 text-xs rounded-full font-semibold tracking-wide ${getStatusColor(order.status)}`}
>
{order.status.toUpperCase()}
</span>

</div>


<div className="space-y-3 text-gray-300 text-sm">

<div className="flex justify-between">
<span>Pages</span>
<span className="font-semibold text-white">
{order.verifiedPages || order.pages}
</span>
</div>

<div className="flex justify-between">
<span>Amount</span>
<span className="font-semibold text-white">
₹{order.finalPrice ?? order.estimatedPrice}
</span>
</div>

<div className="flex justify-between">
<span>Payment</span>
<span className="font-semibold text-white">
{order.paymentStatus.toUpperCase()}
</span>
</div>

<div className="flex justify-between text-gray-500 text-xs mt-4">

<span>Placed On</span>

<span>
{new Date(order.createdAt).toLocaleDateString()}
</span>

</div>

</div>


<div className="flex items-center gap-6 mt-6">

<button
onClick={()=>{
setSelectedOrder(order)
setVerifiedPages(order.verifiedPages ?? order.pages ?? 0)
}}
className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
>
View Details →
</button>

<div className="flex gap-4">

{order.status==="pending" &&(

<button
onClick={()=>acceptOrder(order._id)}
className="bg-primary px-6 py-2 rounded-xl text-black font-semibold"
>
Accept
</button>

)}

{order.status==="awaiting_payment" && order.paymentStatus==="paid" &&(
<button
onClick={()=>updateOrderStatus(order._id,"printing")}
className="bg-indigo-500 px-6 py-2 rounded-xl font-semibold"
>
Start Printing
</button>
)}

{order.status==="printing" &&(
<button
onClick={()=>updateOrderStatus(order._id,"printed")}
className="bg-green-500 px-6 py-2 rounded-xl font-semibold"
>
Mark Printed
</button>
)}

{order.status==="printed" &&(
<button
onClick={()=>updateOrderStatus(order._id,"delivered")}
className="bg-purple-500 px-6 py-2 rounded-xl font-semibold"
>
Mark Delivered
</button>
)}

{order.paymentStatus==="unpaid" && order.status!=="cancelled" &&(

<button
onClick={()=>cancelOrder(order._id)}
className="bg-red-500 px-6 py-2 rounded-xl font-semibold"
>
Cancel
</button>

)}

</div>

</div>

</div>

))}

</div>


{/* MODAL */}

{selectedOrder &&(

<div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">

<div className="bg-card w-full max-w-5xl p-10 rounded-3xl shadow-2xl border border-white/10">

<div className="grid md:grid-cols-2 gap-12">


<div className="space-y-4 text-sm">

<h2 className="text-2xl font-bold text-gradient">
Order Details
</h2>

<p>User: {selectedOrder.userName}</p>
<p>Phone: {selectedOrder.phone}</p>
<p>Class: {selectedOrder.class}</p>
<p>Roll No: {selectedOrder.rollNo}</p>

<p>
Pages:
<input
type="number"
value={verifiedPages}
onChange={(e)=>setVerifiedPages(Number(e.target.value))}
className="ml-3 bg-black border border-white/20 px-2 py-1 w-20 rounded"
/>
</p>

<p>Print Type: {selectedOrder.printType}</p>

<p>
Estimated Price: ₹{selectedOrder.estimatedPrice}
</p>

<p>
Updated Final Price (Preview): ₹{verifiedPages > 0
? (selectedOrder.printType === "color"
? verifiedPages * 5
: selectedOrder.printType === "glossy"
? verifiedPages * 15
: verifiedPages * 2)
: "Enter pages"}
</p>

<p>
Final Price: ₹{selectedOrder.finalPrice ?? "Not calculated"}
</p>

{selectedOrder.finalPrice && (
<p>
Final Price: ₹{selectedOrder.finalPrice}
</p>
)}

<p>Status: {selectedOrder.status}</p>
<p>Payment: {selectedOrder.paymentStatus}</p>

<p>
Created:
{new Date(selectedOrder.createdAt).toLocaleString()}
</p>

{selectedOrder.fileURL &&(

<a
href={selectedOrder.fileURL}
target="_blank"
className="text-indigo-400 underline"
>
Preview Uploaded File
</a>

)}

</div>


<div>

<h3 className="text-xl font-semibold mb-8">
Order Timeline
</h3>

<div className="space-y-8">

{[
{title:"Order Placed",done:true},
{title:"Accepted",done:selectedOrder.status!=="pending"},
{title:"Awaiting Payment",done:["awaiting_payment","printing","printed","delivered"].includes(selectedOrder.status)},
{title:"Printing",done:["printing","printed","delivered"].includes(selectedOrder.status)},
{title:"Printed",done:["printed","delivered"].includes(selectedOrder.status)},
{title:"Delivered",done:selectedOrder.status==="delivered"}
].map((step,i)=>{

const active = step.done

return(

<div key={i} className="flex items-start gap-4">

<div
className={`w-4 h-4 rounded-full mt-1
${active
? "bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.9)]"
: "bg-gray-600"
}`}
/>

<p className={`${active?"text-white":"text-gray-400"}`}>
{step.title}
</p>

</div>

)

})}

</div>

</div>

</div>


<div className="flex gap-4 mt-8">

<button
onClick={()=>verifyPages(selectedOrder._id)}
className="bg-green-500 px-6 py-2 rounded-xl font-semibold"
>
Verify Pages
</button>

{selectedOrder.status==="awaiting_payment" && selectedOrder.paymentStatus==="paid" &&(
<button
onClick={()=>updateOrderStatus(selectedOrder._id,"printing")}
className="bg-indigo-500 px-6 py-2 rounded-xl font-semibold"
>
Start Printing
</button>
)}

{selectedOrder.status==="printing" &&(
<button
onClick={()=>updateOrderStatus(selectedOrder._id,"printed")}
className="bg-green-500 px-6 py-2 rounded-xl font-semibold"
>
Mark Printed
</button>
)}

{selectedOrder.status==="printed" &&(
<button
onClick={()=>updateOrderStatus(selectedOrder._id,"delivered")}
className="bg-purple-500 px-6 py-2 rounded-xl font-semibold"
>
Mark Delivered
</button>
)}

<button
onClick={()=>setSelectedOrder(null)}
className="bg-primary px-6 py-2 rounded-xl text-black font-semibold"
>
Close
</button>

</div>

</div>

</div>

)}

</div>
</SupplierGuard>
)

}
