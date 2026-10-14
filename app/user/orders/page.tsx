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
import { getTotalPrintablePages } from "@/lib/print-pricing"

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

type OrderFileEntry = {
  fileURL?: string
  fileOriginalName?: string
  fileMimeType?: string
  pages?: number
  verifiedPages?: number | null
}

type UserOrder = {
_id: string
shortId?: string
supplierUID?: string | null
status: string
paymentStatus: string
  printType?: string
  pages?: number
  copies?: number
  verifiedPages?: number
estimatedPrice?: number
finalPrice?: number | null
fileURL?: string
fileOriginalName?: string
files?: OrderFileEntry[]
duplex?: boolean
spiralBinding?: boolean
instruction?: string
alternatePhone?: string
pdfPasswordRequired?: boolean
pdfPassword?: string
createdAt: string
acceptedAt?: string | null
paidAt?: string | null
cancelledAt?: string | null
refundedAt?: string | null
razorpayPaymentId?: string | null
razorpayRefundId?: string | null
refundRRN?: string | null
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
const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([])
const [payingBatch, setPayingBatch] = useState(false)
const [showSupplierPeek,setShowSupplierPeek] = useState(false)
const [showSupplierCard,setShowSupplierCard] = useState(false)

useEffect(() => {
  setSelectedOrderIds(prev =>
    prev.filter(id => orders.some(o => o._id === id && o.status === "awaiting_payment" && o.paymentStatus === "unpaid"))
  )
}, [orders])

useEffect(() => {
  if (selectedOrder || showSupplierCard) {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }
}, [selectedOrder, showSupplierCard])

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

const payableOrders = orders.filter(
  (o) => o.status === "awaiting_payment" && o.paymentStatus === "unpaid"
)
const selectedOrders = payableOrders.filter((o) =>
  selectedOrderIds.includes(o._id)
)
const selectedOrdersTotalAmount = selectedOrders.reduce(
  (sum, o) => sum + Number(o.finalPrice ?? o.estimatedPrice ?? 0),
  0
)
const allPayableSelected =
  payableOrders.length > 0 &&
  payableOrders.every((o) => selectedOrderIds.includes(o._id))

const toggleSelectOrder = (orderId: string) => {
  setSelectedOrderIds((prev) =>
    prev.includes(orderId)
      ? prev.filter((id) => id !== orderId)
      : [...prev, orderId]
  )
}

const toggleSelectAll = () => {
  if (allPayableSelected) {
    setSelectedOrderIds([])
  } else {
    setSelectedOrderIds(payableOrders.map((o) => o._id))
  }
}

const payBatch = async () => {
  const user = auth.currentUser
  if (!user) {
    toast.error("Please login again")
    return
  }

  if (selectedOrderIds.length === 0) {
    toast.error("Please select at least one order to pay")
    return
  }

  if (paying || payingBatch) return
  setPayingBatch(true)

  try {
    const isLoaded = await loadRazorpayScript()
    if (!isLoaded) {
      toast.error("Failed to load payment gateway")
      setPayingBatch(false)
      return
    }

    const createRes = await authFetch("/api/payment/batch/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        orderIds: selectedOrderIds,
        userUID: user.uid
      })
    })

    const createData = await createRes.json()
    if (!createRes.ok || !createData.success) {
      toast.error(createData.message || "Batch payment initialization failed")
      setPayingBatch(false)
      return
    }

    const Razorpay = window.Razorpay
    if (!Razorpay) {
      toast.error("Payment gateway unavailable")
      setPayingBatch(false)
      return
    }

    const razorpay = new Razorpay({
      key: createData.key,
      amount: createData.amount,
      currency: createData.currency,
      name: "PrintMyPage",
      description: `Batch Payment for ${selectedOrderIds.length} orders`,
      order_id: createData.razorpayOrderId,
      handler: async (response: RazorpayResponse) => {
        try {
          const verifyRes = await authFetch("/api/payment/batch/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              orderIds: selectedOrderIds,
              userUID: user.uid,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          })

          const verifyData = await verifyRes.json()
          if (!verifyRes.ok || !verifyData.success) {
            toast.error(verifyData.message || "Payment verification failed")
            setPayingBatch(false)
            return
          }

          toast.success(
            `Payment successful! ${verifyData.orders?.length || selectedOrderIds.length} orders updated.`
          )

          const updatedOrdersMap = new Map<string, UserOrder>(
            (verifyData.orders || []).map((o: UserOrder) => [o._id, o])
          )
          setOrders((prev) =>
            prev.map((o) => updatedOrdersMap.get(o._id) || o)
          )

          setSelectedOrder((prev: UserOrder | null) =>
            prev && updatedOrdersMap.has(prev._id)
              ? (updatedOrdersMap.get(prev._id) as UserOrder)
              : prev
          )

          setSelectedOrderIds([])
        } catch {
          toast.error(
            "Batch payment verification encountered an issue. Orders will be synced shortly."
          )
        } finally {
          setPayingBatch(false)
        }
      },
      prefill: {
        name: user.displayName || "",
        email: user.email || ""
      },
      theme: {
        color: "#10b981"
      },
      modal: {
        ondismiss: () => {
          setPayingBatch(false)
        }
      }
    })

    razorpay.open()
  } catch {
    toast.error("Batch payment failed")
    setPayingBatch(false)
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
const selectedSupplierPreview = showSupplierPeek && !showSupplierCard
? selectedSupplierProfile
: null



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

<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-10 md:mb-12">

<div className="bg-card p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl flex flex-col justify-between">
<div>
<p className="text-gray-400 text-sm">
Total Orders
</p>
<h2 className="text-4xl md:text-5xl font-bold mt-2 text-gradient">
{totalOrders}
</h2>
</div>
<p className="text-xs text-gray-500 mt-4">
All lifetime print jobs submitted by you.
</p>
</div>

{payableOrders.length > 0 ? (
<div className="bg-card p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent flex flex-col justify-between">
<div>
<div className="flex items-center justify-between">
<p className="text-emerald-400 text-sm font-semibold flex items-center gap-2">
<span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
Ready for Payment
</p>
<span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-1 rounded-full border border-emerald-500/30">
{payableOrders.length} {payableOrders.length === 1 ? "Order" : "Orders"}
</span>
</div>
<p className="text-gray-400 text-xs mt-1.5">
Select multiple orders below or use the button below to pay them all at once in a single transaction.
</p>
</div>

<div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-white/10">
<button
type="button"
onClick={toggleSelectAll}
className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition text-gray-200"
>
{allPayableSelected ? "Deselect All" : `Select All Ready (${payableOrders.length})`}
</button>
{selectedOrderIds.length > 0 && (
<span className="text-xs text-emerald-400 font-semibold">
{selectedOrderIds.length} selected • ₹{selectedOrdersTotalAmount}
</span>
)}
</div>
</div>
) : (
<div className="bg-card p-5 sm:p-7 md:p-8 rounded-3xl shadow-xl flex flex-col justify-between">
<div>
<p className="text-gray-400 text-sm">Payment Status</p>
<h3 className="text-2xl font-bold mt-2 text-emerald-400">All Caught Up ✨</h3>
</div>
<p className="text-xs text-gray-500 mt-4">
No pending payments awaiting your approval.
</p>
</div>
)}

</div>

)}



<div className="grid md:grid-cols-2 gap-4 sm:gap-6 md:gap-8">

{orders.map(order=>{
const isPayable = order.status === "awaiting_payment" && order.paymentStatus === "unpaid"
const isSelected = selectedOrderIds.includes(order._id)

return (
<div
key={order._id}
className={`bg-card p-5 sm:p-6 md:p-8 rounded-3xl transition shadow-xl relative overflow-hidden ${
isSelected
? "ring-2 ring-emerald-400 border-emerald-400/60 shadow-emerald-500/10 scale-[1.01]"
: "hover:scale-[1.01]"
}`}
>


<div className="flex justify-between items-start mb-6 gap-3">

<div>
<p className="text-2xl font-bold text-gradient">
{(order.printType || "bw").toUpperCase()} Print
</p>
</div>

<div className="flex flex-col items-end gap-2">
<span
className={`px-4 py-1 text-xs rounded-full font-semibold tracking-wide ${getStatusColor(order.status)}`}
>
{formatStatus(order.status)}
</span>

{isPayable && (
<label
onClick={(e)=>e.stopPropagation()}
className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition select-none ${
isSelected
? "bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20"
: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
}`}
>
<input
type="checkbox"
checked={isSelected}
onChange={()=>toggleSelectOrder(order._id)}
className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-0 cursor-pointer accent-black"
/>
<span>{isSelected ? "Selected" : "Select to Pay"}</span>
</label>
)}
</div>

</div>


<div className="space-y-3 text-gray-600 dark:text-gray-300 text-sm">

<div className="flex justify-between">
<span>Pages / Copy</span>
<span className="font-semibold text-gray-900 dark:text-white">
{order.verifiedPages ?? order.pages}
</span>
</div>

<div className="flex justify-between">
<span>Copies</span>
<span className="font-semibold text-gray-900 dark:text-white">
{order.copies ?? 1}
</span>
</div>

<div className="flex justify-between">
<span>Total Print Pages</span>
<span className="font-semibold text-gray-900 dark:text-white">
{getTotalPrintablePages(order.verifiedPages ?? order.pages ?? 0, order.copies)}
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

{order.shortId && (
<div className="flex justify-between text-gray-500 text-xs mt-2">
<span>Order ID</span>
<span className="font-mono bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded">
{order.shortId}
</span>
</div>
)}

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
disabled={paying || payingBatch}
className="mt-4 w-full bg-green-500 px-4 py-2 rounded-xl font-semibold disabled:opacity-60"
>
{paying ? "Processing..." : `Pay Now ₹${order.finalPrice ?? order.estimatedPrice}`}
</button>
)}


</div>
)
})}

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

{selectedOrder.shortId && (
<p className="text-gray-500 font-mono text-xs">ID: {selectedOrder.shortId}</p>
)}

<p>Pages Per Copy: {selectedOrder.verifiedPages ?? selectedOrder.pages}</p>
<p>Copies: {selectedOrder.copies ?? 1}</p>
<p>Total Print Pages: {getTotalPrintablePages(selectedOrder.verifiedPages ?? selectedOrder.pages ?? 0, selectedOrder.copies)}</p>
<p>Print Type: {selectedOrder.printType}</p>
<p>Estimated Price: ₹{selectedOrder.estimatedPrice}</p>

<p>Final Price: ₹{selectedOrder.finalPrice || "Not calculated"}</p>

<p>Amount Payable: ₹{selectedOrder.finalPrice ?? selectedOrder.estimatedPrice}</p>

<p>Duplex: {selectedOrder.duplex ? "Yes":"No"}</p>

<p>Spiral Binding: {selectedOrder.spiralBinding ? "Yes" : "No"}</p>

<p>Instruction: {selectedOrder.instruction || "None"}</p>

<p>Alternate Phone: {selectedOrder.alternatePhone || "None"}</p>

{selectedOrder.pdfPasswordRequired ? (
<p>
PDF Password: {selectedOrder.pdfPassword || "Saved for the supplier once the order is assigned."}
</p>
) : null}

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

	{selectedSupplierPreview && (
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
	name={selectedSupplierPreview.name || selectedOrder.supplierName || "Supplier"}
	photoURL={selectedSupplierPreview.displayPhotoURL || selectedSupplierPreview.photoURL || selectedSupplierPreview.firebasePhotoURL}
	alt={selectedSupplierPreview.name || selectedOrder.supplierName || "Supplier"}
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
	{selectedSupplierPreview.name || selectedOrder.supplierName}
	</p>
	<OwnerBadge email={selectedSupplierPreview.email} isOwner={selectedSupplierIsOwner} className="text-[9px]" label="Platform Owner"/>
	</div>
	<p className={`text-sm ${selectedSupplierIsOwner ? "text-amber-50/88" : "text-gray-300"}`}>
	{selectedSupplierPreview.email || "No email"}
	</p>
	<p className={`text-sm ${selectedSupplierIsOwner ? "text-amber-100/78" : "text-gray-300"}`}>
	{selectedSupplierPreview.phone || "No phone"}
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

{/* Files Section */}
{selectedOrder.files && selectedOrder.files.length > 0 ? (
  <div className="space-y-2">
    <p className="text-sm font-medium text-gray-400">Files ({selectedOrder.files.length}):</p>
    {selectedOrder.files.map((file: OrderFileEntry, idx: number) => (
      <div key={idx} className="flex items-center justify-between gap-2 rounded-lg border border-gray-700 bg-dark/30 px-3 py-2">
        <div className="min-w-0">
          <p className="text-sm truncate">{file.fileOriginalName || `File ${idx + 1}`}</p>
          <p className="text-xs text-gray-400">
            {file.verifiedPages ?? file.pages ?? 0} pages
          </p>
        </div>
        {file.fileURL && (
          <a
            href={file.fileURL}
            target="_blank"
            className="shrink-0 text-xs text-indigo-400 underline"
          >
            View
          </a>
        )}
      </div>
    ))}
  </div>
) : selectedOrder.fileURL ? (
  <a
    href={selectedOrder.fileURL}
    target="_blank"
    className="text-indigo-400 underline"
  >
    View Uploaded File
  </a>
) : null}

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
done:selectedOrder.paymentStatus==="paid" || selectedOrder.paymentStatus==="refunded"
},

...(selectedOrder.paymentStatus === "refunded" ? [{
title:"Refunded",
time:selectedOrder.cancelledAt || selectedOrder.paidAt || null,
done:true
}] : []),

{
title:"Printing",
time:selectedOrder.paidAt || null,
done:["printing","printed","delivered"].includes(selectedOrder.status) && selectedOrder.paymentStatus !== "refunded" && selectedOrder.status !== "cancelled"
},

{
title:"Printed",
time:null,
done:["printed","delivered"].includes(selectedOrder.status) && selectedOrder.paymentStatus !== "refunded" && selectedOrder.status !== "cancelled"
},

{
title:"Delivered",
time:selectedOrder.deliveredAt || null,
done:selectedOrder.status==="delivered" && selectedOrder.paymentStatus !== "refunded"
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



{selectedOrder.paymentStatus === "refunded" && (
  <div className="mt-6 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm space-y-3">
    <div className="flex items-center justify-between">
      <span className="font-semibold text-blue-400">Refund & Bank Reference Details</span>
      <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">Refund Initiated</span>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
      {selectedOrder.razorpayRefundId && (
        <div className="bg-black/30 p-2.5 rounded-xl border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-gray-400">Razorpay Refund ID</p>
            <p className="font-mono text-white mt-0.5">{selectedOrder.razorpayRefundId}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(selectedOrder.razorpayRefundId!)
              toast.success("Refund ID copied!")
            }}
            className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-gray-300"
          >
            Copy
          </button>
        </div>
      )}

      {selectedOrder.razorpayPaymentId && (
        <div className="bg-black/30 p-2.5 rounded-xl border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-gray-400">Original Payment ID</p>
            <p className="font-mono text-white mt-0.5">{selectedOrder.razorpayPaymentId}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(selectedOrder.razorpayPaymentId!)
              toast.success("Payment ID copied!")
            }}
            className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-gray-300"
          >
            Copy
          </button>
        </div>
      )}

      {selectedOrder.refundRRN && (
        <div className="bg-black/30 p-2.5 rounded-xl border border-white/10 flex items-center justify-between sm:col-span-2">
          <div>
            <p className="text-gray-400">Bank UTR / RRN Reference</p>
            <p className="font-mono text-white mt-0.5">{selectedOrder.refundRRN}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(selectedOrder.refundRRN!)
              toast.success("UTR/RRN copied!")
            }}
            className="text-xs bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-gray-300"
          >
            Copy
          </button>
        </div>
      )}
    </div>

    <p className="text-xs text-blue-300/80 leading-relaxed pt-1">
      💡 <strong>How to complain/trace with your bank:</strong> Most refunds reflect within 5-7 business days. If delayed beyond 7 business days, contact your bank support and provide the <strong>Razorpay Refund ID ({selectedOrder.razorpayRefundId || "listed above"})</strong> or <strong>Payment ID ({selectedOrder.razorpayPaymentId || "listed above"})</strong> to trace your credit.
    </p>
  </div>
)}

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

{selectedOrderIds.length > 0 && (
<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-xl bg-slate-900/95 dark:bg-[#121626]/95 backdrop-blur-xl border border-emerald-500/40 text-white p-4 sm:p-5 rounded-3xl shadow-2xl shadow-black/50 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-5">
<div className="flex items-center gap-3.5 w-full sm:w-auto">
<div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg shrink-0">
{selectedOrderIds.length}
</div>
<div>
<div className="flex items-center gap-2">
<span className="text-sm font-semibold text-white">
{selectedOrderIds.length} {selectedOrderIds.length === 1 ? "order" : "orders"} selected
</span>
<span className="text-[11px] text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full font-medium">
Batch Pay
</span>
</div>
<p className="text-xl font-bold text-emerald-400 mt-0.5">
Total: ₹{selectedOrdersTotalAmount}
</p>
</div>
</div>

<div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
<button
type="button"
onClick={()=>setSelectedOrderIds([])}
disabled={paying || payingBatch}
className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/10 hover:bg-white/15 transition disabled:opacity-50"
>
Clear
</button>
<button
type="button"
onClick={payBatch}
disabled={paying || payingBatch}
className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold text-black bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 shadow-lg shadow-emerald-500/30 transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
>
{payingBatch ? (
<>
<span className="inline-block w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></span>
Processing...
</>
) : (
<>
Pay All ({selectedOrderIds.length}) • ₹{selectedOrdersTotalAmount}
</>
)}
</button>
</div>
</div>
)}

</div>

</div>

    </RoleGuard>

)

}
