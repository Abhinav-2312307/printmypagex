"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"
import RoleGuard from "@/components/RoleGuard"
import { pusherClient } from "@/lib/pusher-client"
import toast from "react-hot-toast"
import { onAuthStateChanged } from "firebase/auth"
import ProfileCard from "@/components/ProfileCard"
import ProfileAvatar from "@/components/ProfileAvatar"
import { authFetch } from "@/lib/client-auth"
import OwnerBadge from "@/components/OwnerBadge"
import { isOwnerEmail } from "@/lib/owner-access"

type SupplierProfile = {
name?: string
email?: string
phone?: string
rollNo?: string
branch?: string
year?: string | number
photoURL?: string
firebasePhotoURL?: string
displayPhotoURL?: string
isOwner?: boolean
}

type UserOrder = {
_id: string
supplierUID?: string | null
status: string
paymentStatus: string
printType?: string
pages?: number
verifiedPages?: number
estimatedPrice?: number
finalPrice?: number | null
fileURL?: string
duplex?: boolean
instruction?: string
alternatePhone?: string
createdAt: string
acceptedAt?: string | null
paidAt?: string | null
deliveredAt?: string | null
supplierName?: string | null
supplierIsOwner?: boolean
supplierProfile?: SupplierProfile | null
}

type OrderUpdate = Partial<UserOrder> & {
_id: string
}

type RazorpayResponse = {
razorpay_order_id: string
razorpay_payment_id: string
razorpay_signature: string
}

type RazorpayInstance = {
open: ()=>void
}

type RazorpayConstructor = new(options:{
key: string
amount: number
currency: string
name: string
description: string
order_id: string
handler: (response: RazorpayResponse)=>Promise<void>
prefill: {
name: string
email: string
}
theme: {
color: string
}
modal: {
ondismiss: ()=>void
}
})=>RazorpayInstance

declare global {
interface Window {
Razorpay?: RazorpayConstructor
}
}

export default function UserOrders() {

const [orders,setOrders] = useState<UserOrder[]>([])
const [loading,setLoading] = useState(true)
const [selectedOrder,setSelectedOrder] = useState<UserOrder | null>(null)
const [paying,setPaying] = useState(false)
const [showSupplierPeek,setShowSupplierPeek] = useState(false)
const [showSupplierCard,setShowSupplierCard] = useState(false)

useEffect(()=>{

const unsubscribe = onAuthStateChanged(auth,async(user)=>{

if(!user){
setLoading(false)
return
}

try{

const res = await authFetch(`/api/orders/user?firebaseUID=${user.uid}`)
const data = await res.json()

setOrders(data.orders || [])

}catch{

toast.error("Failed to load orders")

}

setLoading(false)

})

return ()=>unsubscribe()

},[])

useEffect(()=>{

const user = auth.currentUser
if(!user) return

const channel = pusherClient.subscribe(`private-user-${user.uid}`)

	channel.bind("order-updated",(updatedOrder:OrderUpdate)=>{

setOrders(prev =>
prev.map(order =>
order._id===updatedOrder._id
? {
...order,
...updatedOrder,
supplierName: updatedOrder.supplierName ?? order.supplierName,
supplierProfile: updatedOrder.supplierProfile ?? order.supplierProfile
}
: order
)
)

	setSelectedOrder((prev:UserOrder | null) =>
	prev && prev._id===updatedOrder._id
	? {
	...prev,
...updatedOrder,
supplierName: updatedOrder.supplierName ?? prev.supplierName,
supplierProfile: updatedOrder.supplierProfile ?? prev.supplierProfile
}
: prev
)

toast.success("Order status updated")

})

return ()=>{
pusherClient.unsubscribe(`private-user-${user.uid}`)
}

},[])



const getStatusColor=(status:string)=>{

if(status==="pending")
return "bg-yellow-500/20 text-yellow-400 border border-yellow-400/30"

if(status==="accepted")
return "bg-blue-500/20 text-blue-400 border border-blue-400/30"

if(status==="awaiting_payment")
return "bg-orange-500/20 text-orange-400 border border-orange-400/30"

if(status==="printing")
return "bg-purple-500/20 text-purple-400 border border-purple-400/30"

if(status==="printed")
return "bg-indigo-500/20 text-indigo-400 border border-indigo-400/30"

if(status==="delivered")
return "bg-green-500/20 text-green-400 border border-green-400/30"

if(status==="cancelled")
return "bg-red-500/20 text-red-400 border border-red-400/30"

return "bg-gray-500/20 text-gray-400 border border-gray-400/20"

}

const formatStatus = (status:string)=>
status.replace(/_/g," ").toUpperCase()



const cancelOrder = async(orderId:string)=>{

const res = await authFetch("/api/orders/cancel",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({orderId})
})

if(!res.ok){
const data = await res.json().catch(()=>({}))
toast.error(data.message || "Failed to cancel order")
return
}

toast.success("Order cancelled")

setOrders(prev =>
prev.map(o =>
o._id===orderId ? {...o,status:"cancelled"} : o
)
)

setSelectedOrder(null)

}

const loadRazorpayScript = async()=>{
	if(window.Razorpay) return true

return new Promise<boolean>((resolve)=>{
const script = document.createElement("script")
script.src = "https://checkout.razorpay.com/v1/checkout.js"
script.onload = ()=>resolve(true)
script.onerror = ()=>resolve(false)
document.body.appendChild(script)
})
}

const payNow = async(order:UserOrder)=>{

const user = auth.currentUser
if(!user){
toast.error("Please login again")
return
}

if(paying) return
setPaying(true)

try{

const isLoaded = await loadRazorpayScript()
if(!isLoaded){
toast.error("Failed to load payment gateway")
setPaying(false)
return
}

const createRes = await authFetch("/api/payment/create",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
orderId:order._id,
userUID:user.uid
})
})

const createData = await createRes.json()

if(!createRes.ok || !createData.success){
toast.error(createData.message || "Payment initialization failed")
setPaying(false)
return
}

const Razorpay = window.Razorpay

if(!Razorpay){
toast.error("Payment gateway unavailable")
setPaying(false)
return
}

const razorpay = new Razorpay({
key:createData.key,
amount:createData.amount,
currency:createData.currency,
name:"PrintMyPage",
description:`Payment for Order ${order._id}`,
order_id:createData.razorpayOrderId,
handler: async(response:RazorpayResponse)=>{

const verifyRes = await authFetch("/api/payment/verify",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
orderId:order._id,
userUID:user.uid,
razorpay_order_id:response.razorpay_order_id,
razorpay_payment_id:response.razorpay_payment_id,
razorpay_signature:response.razorpay_signature
})
})

const verifyData = await verifyRes.json()

if(!verifyRes.ok || !verifyData.success){
toast.error(verifyData.message || "Payment verification failed")
setPaying(false)
return
}

	toast.success("Payment successful")

	setOrders(prev =>
	prev.map((o)=>
	o._id===order._id ? verifyData.order : o
	)
	)

	setSelectedOrder((prev:UserOrder | null)=>
	prev && prev._id===order._id ? verifyData.order : prev
	)

setPaying(false)

},
prefill:{
name:user.displayName || "",
email:user.email || ""
},
theme:{
color:"#4f46e5"
},
modal:{
ondismiss: ()=>{
setPaying(false)
}
}
})

razorpay.open()

}catch{
toast.error("Payment failed")
setPaying(false)
}

}

const downloadReceipt = async(orderId:string)=>{
const user = auth.currentUser
if(!user){
toast.error("Please login again")
return
}

try{
const res = await authFetch(
`/api/payment/receipt?orderId=${orderId}&userUID=${user.uid}`
)

if(!res.ok){
const data = await res.json().catch(()=>({}))
toast.error(data.message || "Failed to download receipt")
return
}

const blob = await res.blob()
const url = URL.createObjectURL(blob)
const anchor = document.createElement("a")
anchor.href = url
anchor.download = `receipt-${orderId}.doc`
document.body.appendChild(anchor)
anchor.click()
anchor.remove()
URL.revokeObjectURL(url)
}catch{
toast.error("Failed to download receipt")
}
}



const totalOrders = orders.length
const selectedSupplierProfile = selectedOrder?.supplierProfile
const selectedSupplierIsOwner = Boolean(
selectedOrder?.supplierIsOwner ||
selectedSupplierProfile?.isOwner ||
isOwnerEmail(selectedSupplierProfile?.email)
)



return(

    <RoleGuard role="USER">

<div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-sky-100 text-gray-900 dark:from-black dark:via-[#0f0f1a] dark:to-[#12122a] dark:text-white">

<Navbar
logoHref="/"
navButtons={[
{
label:"Back to Dashboard",
href:"/user/dashboard",
variant:"dashboardBack"
}
]}
/>

<div className="px-4 sm:px-6 md:px-16 py-10 md:py-16">


<h1 className="text-3xl md:text-4xl font-bold mb-8 md:mb-10 text-gradient">
My Orders
</h1>



{!loading &&(

<div className="bg-card p-5 sm:p-7 md:p-10 rounded-3xl mb-10 md:mb-12 shadow-xl">

<p className="text-gray-400 text-sm">
Total Orders
</p>

<h2 className="text-4xl md:text-5xl font-bold mt-2 text-gradient">
{totalOrders}
</h2>

</div>

)}



<div className="grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">

{orders.map(order=>(

<div
key={order._id}
className="bg-card p-5 sm:p-6 md:p-8 rounded-3xl hover:scale-[1.02] transition shadow-xl"
>


<div className="flex justify-between items-center mb-6">

<p className="text-2xl font-bold text-gradient">
{(order.printType || "bw").toUpperCase()} Print
</p>

<span
className={`px-4 py-1 text-xs rounded-full font-semibold tracking-wide ${getStatusColor(order.status)}`}
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


<button
onClick={()=>{
setShowSupplierPeek(false)
setShowSupplierCard(false)
setSelectedOrder(order)
}}
className="mt-6 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
>
View Details →
</button>

{order.status==="awaiting_payment" && order.paymentStatus==="unpaid" &&(
<button
onClick={()=>payNow(order)}
disabled={paying}
className="mt-4 w-full bg-green-500 px-4 py-2 rounded-xl font-semibold disabled:opacity-60"
>
{paying ? "Processing..." : `Pay Now ₹${order.finalPrice ?? order.estimatedPrice}`}
</button>
)}


</div>

))}

</div>



{selectedOrder &&(

<div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50 p-4">


<div className="bg-card w-full max-w-5xl p-4 sm:p-6 md:p-8 rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto">


<div className="grid md:grid-cols-2 gap-8 md:gap-12">


{/* LEFT DETAILS */}

<div className="space-y-4 text-sm">

<h2 className="text-2xl font-bold text-gradient">
Order Details
</h2>

<p>Pages: {selectedOrder.verifiedPages || selectedOrder.pages}</p>
<p>Print Type: {selectedOrder.printType}</p>
<p>Estimated Price: ₹{selectedOrder.estimatedPrice}</p>

<p>Final Price: ₹{selectedOrder.finalPrice || "Not calculated"}</p>

<p>Amount Payable: ₹{selectedOrder.finalPrice ?? selectedOrder.estimatedPrice}</p>

<p>Duplex: {selectedOrder.duplex ? "Yes":"No"}</p>

<p>Instruction: {selectedOrder.instruction || "None"}</p>

<p>Alternate Phone: {selectedOrder.alternatePhone || "None"}</p>

<p>Status: {formatStatus(selectedOrder.status)}</p>

<p>Payment: {selectedOrder.paymentStatus}</p>

	<div className="relative">
	<p>
	Supplier:
	{selectedOrder.supplierName ? (
	<>
	{" "}
	<button
	onMouseEnter={()=>setShowSupplierPeek(true)}
	onMouseLeave={()=>setShowSupplierPeek(false)}
	onClick={()=>setShowSupplierCard(true)}
	className={`underline underline-offset-2 ${
	selectedSupplierIsOwner
	? "font-medium text-amber-300 hover:text-amber-200"
	: "text-indigo-400 hover:text-indigo-300"
	}`}
	>
	{selectedOrder.supplierName}
	</button>
	{selectedSupplierIsOwner && (
	<span className="ml-2 inline-flex align-middle">
	<OwnerBadge email={selectedSupplierProfile?.email} isOwner={selectedSupplierIsOwner} className="text-[9px]" label="Platform Owner"/>
	</span>
	)}
	</>
	) : (
	" Not assigned"
	)}
</p>

	{showSupplierPeek && selectedOrder.supplierProfile && !showSupplierCard && (
	<div
	onMouseEnter={()=>setShowSupplierPeek(true)}
	onMouseLeave={()=>setShowSupplierPeek(false)}
	className={`absolute left-0 top-7 z-20 w-80 rounded-2xl border p-4 shadow-2xl ${
	selectedSupplierIsOwner
	? "border-amber-300/30 bg-[radial-gradient(circle_at_top_right,rgba(255,226,148,0.1),transparent_30%),linear-gradient(135deg,rgba(20,18,12,0.96),rgba(13,11,8,0.98))]"
	: "border-white/10 bg-[#101421]"
	}`}
	>
	<div className="flex items-start gap-3">
	<ProfileAvatar
	name={selectedSupplierProfile.name || selectedOrder.supplierName || "Supplier"}
	photoURL={selectedSupplierProfile.displayPhotoURL || selectedSupplierProfile.photoURL || selectedSupplierProfile.firebasePhotoURL}
	alt={selectedSupplierProfile.name || selectedOrder.supplierName || "Supplier"}
	isOwner={selectedSupplierIsOwner}
	className="h-14 w-14 shrink-0 rounded-2xl"
	initialsClassName="text-lg"
	/>

	<div className="min-w-0 flex-1">
	<p className={`mb-2 text-xs uppercase tracking-[0.25em] ${
	selectedSupplierIsOwner ? "text-amber-200/70" : "text-gray-400"
	}`}>
	Supplier Preview
	</p>
	<div className="flex flex-wrap items-center gap-2">
	<p className={`${selectedSupplierIsOwner ? "text-lg font-semibold text-amber-100" : "font-semibold text-white"}`}>
	{selectedSupplierProfile.name || selectedOrder.supplierName}
	</p>
	<OwnerBadge email={selectedSupplierProfile.email} isOwner={selectedSupplierIsOwner} className="text-[9px]" label="Platform Owner"/>
	</div>
	<p className={`text-sm ${selectedSupplierIsOwner ? "text-amber-50/88" : "text-gray-300"}`}>
	{selectedSupplierProfile.email || "No email"}
	</p>
	<p className={`text-sm ${selectedSupplierIsOwner ? "text-amber-100/78" : "text-gray-300"}`}>
	{selectedSupplierProfile.phone || "No phone"}
	</p>
	<p className={`mt-2 text-xs ${selectedSupplierIsOwner ? "text-amber-200/76" : "text-indigo-300"}`}>
	Click the name to open the full profile card.
	</p>
	</div>
	</div>
	</div>
	)}
	</div>

<p>
Created: {new Date(selectedOrder.createdAt).toLocaleString()}
</p>

<p>
Accepted:
{selectedOrder.acceptedAt
? new Date(selectedOrder.acceptedAt).toLocaleString()
: selectedOrder.supplierUID
? "Accepted (time unavailable)"
: "Not accepted yet"}
</p>

{selectedOrder.fileURL &&(

<a
href={selectedOrder.fileURL}
target="_blank"
className="text-indigo-400 underline"
>
View Uploaded File
</a>

)}

</div>



{/* TIMELINE */}

<div>

<h3 className="text-xl font-semibold mb-6 md:mb-8">
Order Timeline
</h3>


<div className="space-y-8">

{[
{
title:"Order Placed",
time:selectedOrder.createdAt,
done:true
},

{
title:"Accepted & Verified",
time:selectedOrder.acceptedAt,
done:selectedOrder.supplierUID !== null
},

{
title:"Awaiting Payment",
time:selectedOrder.acceptedAt || null,
done:["awaiting_payment","printing","printed","delivered"].includes(selectedOrder.status)
},

{
title:"Paid",
time:selectedOrder.paidAt || null,
done:selectedOrder.paymentStatus==="paid"
},

{
title:"Printing",
time:selectedOrder.paidAt || null,
done:["printing","printed","delivered"].includes(selectedOrder.status)
},

{
title:"Printed",
time:null,
done:["printed","delivered"].includes(selectedOrder.status)
},

{
title:"Delivered",
time:selectedOrder.deliveredAt || null,
done:selectedOrder.status==="delivered"
}

].map((step,i)=>{

const active = step.done

return(

<div key={i} className="flex items-start gap-4">

<div
className={`w-4 h-4 rounded-full mt-1
${active
? "bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.9)]"
: "bg-gray-600"
}
`}
/>

<div>

<p className={`${active?"text-gray-900 dark:text-white":"text-gray-500 dark:text-gray-400"}`}>
{step.title}
</p>

{step.time &&(

<p className="text-xs text-gray-500">
{new Date(step.time).toLocaleString()}
</p>

)}

</div>

</div>

)

})}

</div>

</div>

</div>



<div className="mt-8 flex flex-wrap gap-3 md:mt-10 md:gap-4">

{selectedOrder.paymentStatus==="unpaid" &&
selectedOrder.status!=="cancelled" &&(

<button
onClick={()=>cancelOrder(selectedOrder._id)}
className="bg-red-500 px-6 py-2 rounded-xl font-semibold"
>
Cancel Order
</button>

)}

{selectedOrder.paymentStatus==="unpaid" &&
selectedOrder.status==="awaiting_payment" &&(
<button
onClick={()=>payNow(selectedOrder)}
disabled={paying}
className="bg-green-500 px-6 py-2 rounded-xl font-semibold disabled:opacity-60"
>
{paying ? "Processing..." : `Pay Now ₹${selectedOrder.finalPrice ?? selectedOrder.estimatedPrice}`}
</button>
)}

{selectedOrder.paymentStatus==="paid" &&(
<button
onClick={()=>downloadReceipt(selectedOrder._id)}
className="bg-indigo-500 px-6 py-2 rounded-xl font-semibold"
>
Download Receipt (.doc)
</button>
)}

<button
onClick={()=>{
setShowSupplierPeek(false)
setShowSupplierCard(false)
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

{showSupplierCard && selectedOrder?.supplierProfile && (
<div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
<div className="bg-card w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl">
<ProfileCard
title="Supplier Profile"
profile={selectedOrder.supplierProfile}
/>
<button
onClick={()=>setShowSupplierCard(false)}
className="mt-4 w-full bg-indigo-500 px-4 py-2 rounded-xl font-semibold"
>
Close Supplier Card
</button>
</div>
</div>
)}

</div>

</div>

    </RoleGuard>

)

}
