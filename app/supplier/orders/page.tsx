"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import toast from "react-hot-toast"
import { pusherClient } from "@/lib/pusher-client"
import SupplierGuard from "@/components/SupplierGuard"
import ProfileCard from "@/components/ProfileCard"
import { authFetch } from "@/lib/client-auth"
import { calculatePrintPrice, getPriceForPrintType } from "@/lib/print-pricing"
import { usePrintPricing } from "@/lib/use-print-pricing"

type SupplierOrderDetail = {
  _id: string
  status: string
  paymentStatus: string
  createdAt: string
  acceptedAt?: string | null
  paidAt?: string | null
  deliveredAt?: string | null
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
  duplex?: boolean
  instruction?: string
  alternatePhone?: string
  userProfile?: {
    name?: string
    email?: string
    phone?: string
    rollNo?: string
    branch?: string
    year?: string | number
    section?: string
    photoURL?: string
    firebasePhotoURL?: string
    displayPhotoURL?: string
  }
}

export default function SupplierOrders(){

const [orders,setOrders] = useState<SupplierOrderDetail[]>([])
const [available,setAvailable] = useState<SupplierOrderDetail[]>([])
const [loading,setLoading] = useState(true)
const [selectedOrder,setSelectedOrder] = useState<SupplierOrderDetail | null>(null)
const [uid,setUid] = useState<string | null>(null)
const [filter,setFilter] = useState("pending")
const [verifiedPages,setVerifiedPages] = useState<number>(0)
const [showAcceptConfirm,setShowAcceptConfirm] = useState(false)
const { pricing } = usePrintPricing()

async function loadOrders(uid:string){

try{

const res1 = await authFetch(`/api/orders/available?supplierUID=${uid}`)
const data1 = await res1.json()

const res2 = await authFetch(`/api/orders/supplier?supplierUID=${uid}`)
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

authFetch("/api/supplier/sync-email",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body: JSON.stringify({
firebaseUID:user.uid,
email:user.email || user.providerData?.[0]?.email || "",
photoURL:user.photoURL || ""
})
}).catch(()=>{})

setUid(user.uid)
loadOrders(user.uid)

})

return ()=>unsubscribe()

},[])

useEffect(()=>{

if(!uid) return

const channel = pusherClient.subscribe(`private-supplier-${uid}`)

channel.bind("order-updated",(updatedOrder:SupplierOrderDetail)=>{

setOrders(prev =>
prev.map(order =>
order._id===updatedOrder._id
? {
...order,
...updatedOrder,
userProfile: updatedOrder.userProfile ?? order.userProfile
}
: order
)
)

setAvailable(prev =>
prev.map(order =>
order._id===updatedOrder._id
? {
...order,
...updatedOrder,
userProfile: updatedOrder.userProfile ?? order.userProfile
}
: order
)
)

setSelectedOrder((prev)=>
prev && prev._id===updatedOrder._id
? {
...prev,
...updatedOrder,
userProfile: updatedOrder.userProfile ?? prev.userProfile
}
: prev
)

})

return ()=>{
pusherClient.unsubscribe(`private-supplier-${uid}`)
}

},[uid])


const openAcceptModal = (order: SupplierOrderDetail) => {
setSelectedOrder(order)
setVerifiedPages(order.verifiedPages ?? order.pages ?? 0)
setShowAcceptConfirm(false)
}

const acceptOrder = async(id:string)=>{

if(!uid) return

if(!Number.isFinite(verifiedPages) || verifiedPages<=0){
toast.error("Please verify page count before accepting")
return
}

try{

const res = await authFetch("/api/orders/accept",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
orderId:id,
supplierUID:uid,
verifiedPages
})
})

const data = await res.json()

if(!res.ok || !data.success){
toast.error(data.message || "Failed to accept order")
return
}

toast.success("Order accepted and pages verified")

setAvailable(prev=>prev.filter(o=>o._id!==id))

loadOrders(uid)
setSelectedOrder(null)
setShowAcceptConfirm(false)

}catch{
toast.error("Failed to accept order")
}

}


const cancelOrder = async(orderId:string)=>{

if(!uid) return

try{

const res = await authFetch("/api/orders/supplier-cancel",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
orderId,
supplierUID:uid
})
})

const data = await res.json().catch(()=>({}))

if(!res.ok || !data.success){
toast.error(data.message || "Failed to cancel order")
return
}

toast.success("Order cancelled")

loadOrders(uid)

}catch{

toast.error("Failed to cancel order")

}

}


const updateOrderStatus = async(orderId:string,status:"printing"|"printed"|"delivered")=>{

if(!uid) return

try{

const res = await authFetch("/api/orders/update-status",{
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

const res = await authFetch("/api/orders/verify",{
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

const formatStatus = (status:string)=>
status.replace(/_/g," ").toUpperCase()


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
<div className="px-4 sm:px-6 md:px-20 xl:px-32 py-10 md:py-16">

<h1 className="text-3xl md:text-4xl font-bold mb-8 md:mb-14 text-gradient">
Supplier Orders
</h1>


<div className="flex gap-2 sm:gap-3 mb-8 md:mb-12 flex-wrap">

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
? "bg-indigo-500/20 border-indigo-400 text-indigo-600 dark:text-indigo-300"
: "border-gray-300 text-gray-600 hover:text-gray-900 dark:border-white/10 dark:text-gray-400 dark:hover:text-white"
}`}
>
{label}
</button>

))}

</div>


{!loading &&(

<div className="bg-card p-6 sm:p-8 md:p-10 rounded-3xl mb-10 md:mb-16 shadow-xl">

<p className="text-gray-500 dark:text-gray-400 text-sm">
Total Orders
</p>

<h2 className="text-4xl md:text-5xl font-bold mt-2 text-gradient">
{displayOrders.length}
</h2>

</div>

)}


<div className="grid md:grid-cols-2 gap-5 sm:gap-8 lg:gap-12">

{displayOrders.map(order=>(

<div
key={order._id}
className="bg-card p-5 sm:p-7 md:p-10 rounded-3xl hover:scale-[1.02] transition shadow-xl"
>

<div className="flex justify-between items-center mb-6">

<p className="text-2xl font-bold text-gradient">
{(order.printType || "bw").toUpperCase()} Print
</p>

<span
className={`px-5 py-1.5 text-xs rounded-full font-semibold tracking-wide ${getStatusColor(order.status)}`}
>
{formatStatus(order.status)}
</span>

</div>


<div className="space-y-3 text-gray-600 dark:text-gray-300 text-sm">

<div className="flex justify-between">
<span>Pages</span>
<span className="font-semibold text-gray-900 dark:text-white">
{order.verifiedPages || order.pages}
</span>
</div>

<div className="flex justify-between">
<span>Amount</span>
<span className="font-semibold text-gray-900 dark:text-white">
₹{order.finalPrice ?? order.estimatedPrice}
</span>
</div>

<div className="flex justify-between">
<span>Payment</span>
<span className="font-semibold text-gray-900 dark:text-white">
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


<div className="mt-6 flex flex-wrap items-center gap-3 sm:gap-6">

<button
onClick={()=>{
setSelectedOrder(order)
setVerifiedPages(order.verifiedPages ?? order.pages ?? 0)
}}
className="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
>
View Details →
</button>

<div className="flex flex-wrap gap-3 sm:gap-4">

{order.status==="pending" &&(

<button
onClick={()=>openAcceptModal(order)}
className="bg-primary px-6 py-2 rounded-xl text-black font-semibold"
>
Verify & Accept
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

<div className="fixed inset-0 z-50 bg-black/70 flex justify-center items-center p-4">

<div className="bg-card w-full max-w-5xl p-4 sm:p-6 md:p-10 rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">

<div className="grid md:grid-cols-2 gap-8 md:gap-12">


<div className="space-y-4 text-sm">

<h2 className="text-2xl font-bold text-gradient">
Order Details
</h2>

{/* <p>User: {selectedOrder.userName}</p>
<p>Phone: {selectedOrder.phone}</p>
<p>Class: {selectedOrder.class}</p>
<p>Roll No: {selectedOrder.rollNo}</p> */}

{selectedOrder.userProfile && (
<ProfileCard
title="User Profile"
profile={selectedOrder.userProfile}
/>
)}

<p>
Pages:
<input
type="number"
value={verifiedPages}
onChange={(e)=>setVerifiedPages(Number(e.target.value))}
className="ml-3 w-20 rounded bg-white/80 dark:bg-black border border-gray-300 dark:border-white/20 px-2 py-1 text-gray-900 dark:text-white"
/>
</p>

<p>Print Type: {selectedOrder.printType}</p>

<p>
Current Rate: ₹{getPriceForPrintType(selectedOrder.printType, pricing)}/page
</p>

<p>
Estimated Price: ₹{selectedOrder.estimatedPrice}
</p>

<p>
Updated Final Price (Preview): ₹{verifiedPages > 0
? calculatePrintPrice(verifiedPages, selectedOrder.printType, pricing)
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

<p>Duplex: {selectedOrder.duplex ? "Yes" : "No"}</p>

<p>Instruction: {selectedOrder.instruction?.trim() || "None"}</p>

<p>Alternate Phone: {selectedOrder.alternatePhone?.trim() || "None"}</p>

<p>Status: {formatStatus(selectedOrder.status)}</p>
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
{title:"Accepted & Verified",done:selectedOrder.status!=="pending"},
{title:"Awaiting Payment",done:["awaiting_payment","printing","printed","delivered"].includes(selectedOrder.status)},
{title:"Paid",done:selectedOrder.paymentStatus==="paid"},
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

<p className={`${active?"text-gray-900 dark:text-white":"text-gray-500 dark:text-gray-400"}`}>
{step.title}
</p>

</div>

)

})}

</div>

</div>

</div>


<div className="mt-8 flex flex-wrap gap-3 sm:gap-4">

{selectedOrder.status==="pending" &&(
<button
onClick={()=>{
if(!Number.isFinite(verifiedPages) || verifiedPages<=0){
toast.error("Please verify page count first")
return
}
setShowAcceptConfirm(true)
}}
className="bg-green-500 px-6 py-2 rounded-xl font-semibold"
>
Verify Pages & Accept
</button>
)}

{["accepted","awaiting_payment"].includes(selectedOrder.status) &&
selectedOrder.paymentStatus!=="paid" &&(
<button
onClick={()=>verifyPages(selectedOrder._id)}
className="bg-green-500 px-6 py-2 rounded-xl font-semibold"
>
Update Verified Pages
</button>
)}

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
onClick={()=>{
setShowAcceptConfirm(false)
setSelectedOrder(null)
}}
className="bg-primary px-6 py-2 rounded-xl text-black font-semibold"
>
Close
</button>

</div>

</div>

</div>

)}

{showAcceptConfirm && selectedOrder && (
<div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-md flex items-center justify-center p-4">
<div className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-white/20 bg-slate-100/95 dark:bg-white/10 backdrop-blur-xl shadow-[0_12px_50px_rgba(0,0,0,0.45)] p-7">
<h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-3">
Confirm Page Verification
</h3>
<p className="text-slate-600 dark:text-gray-200 text-sm leading-relaxed">
Have you verified the page count carefully? This will accept the order with{" "}
<span className="font-semibold text-slate-900 dark:text-white">{verifiedPages}</span> pages and move it to payment.
</p>

<div className="flex gap-3 mt-6">
<button
onClick={()=>{
setShowAcceptConfirm(false)
acceptOrder(selectedOrder._id)
}}
className="flex-1 bg-green-500 hover:bg-green-400 transition px-4 py-2 rounded-xl font-semibold text-black"
>
Yes, Accept
</button>

<button
onClick={()=>setShowAcceptConfirm(false)}
className="flex-1 bg-slate-200/80 hover:bg-slate-300/80 dark:bg-white/15 dark:hover:bg-white/25 transition border border-slate-300 dark:border-white/20 px-4 py-2 rounded-xl font-semibold text-slate-800 dark:text-white"
>
No, Recheck
</button>
</div>
</div>
</div>
)}

</div>
</SupplierGuard>
)

}
