"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"
import AuthGuard from "@/components/AuthGuard"
import { pusherClient } from "@/lib/pusher-client"
import toast from "react-hot-toast"
import { onAuthStateChanged } from "firebase/auth"

export default function UserOrders() {

const [orders,setOrders] = useState<any[]>([])
const [loading,setLoading] = useState(true)
const [selectedOrder,setSelectedOrder] = useState<any>(null)

useEffect(()=>{

const unsubscribe = onAuthStateChanged(auth,async(user)=>{

if(!user){
setLoading(false)
return
}

try{

const res = await fetch(`/api/orders/user?firebaseUID=${user.uid}`)
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

const channel = pusherClient.subscribe(`user-${user.uid}`)

channel.bind("order-updated",(updatedOrder:any)=>{

setOrders(prev =>
prev.map(order =>
order._id===updatedOrder._id ? updatedOrder : order
)
)

setSelectedOrder((prev:any) =>
prev && prev._id===updatedOrder._id ? updatedOrder : prev
)

toast.success("Order status updated")

})

return ()=>{
pusherClient.unsubscribe(`user-${user.uid}`)
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



const cancelOrder = async(orderId:string)=>{

await fetch("/api/orders/cancel",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({orderId})
})

toast.success("Order cancelled")

setOrders(prev =>
prev.map(o =>
o._id===orderId ? {...o,status:"cancelled"} : o
)
)

setSelectedOrder(null)

}



const totalOrders = orders.length



return(

<AuthGuard>

<Navbar/>

<div className="px-6 md:px-16 py-16">


<h1 className="text-4xl font-bold mb-10 text-gradient">
My Orders
</h1>



{!loading &&(

<div className="bg-card p-10 rounded-3xl mb-12 shadow-xl">

<p className="text-gray-400 text-sm">
Total Orders
</p>

<h2 className="text-5xl font-bold mt-2 text-gradient">
{totalOrders}
</h2>

</div>

)}



<div className="grid md:grid-cols-2 gap-8">

{orders.map(order=>(

<div
key={order._id}
className="bg-card p-8 rounded-3xl hover:scale-[1.02] transition shadow-xl"
>


<div className="flex justify-between items-center mb-6">

<p className="text-2xl font-bold text-gradient">
{(order.printType || "bw").toUpperCase()} Print
</p>

<span
className={`px-4 py-1 text-xs rounded-full font-semibold tracking-wide ${getStatusColor(order.status)}`}
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


<button
onClick={()=>setSelectedOrder(order)}
className="mt-6 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
>
View Details →
</button>


</div>

))}

</div>



{selectedOrder &&(

<div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">


<div className="bg-card w-full max-w-5xl p-8 rounded-3xl shadow-2xl">


<div className="grid md:grid-cols-2 gap-12">


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

<p>Status: {selectedOrder.status}</p>

<p>Payment: {selectedOrder.paymentStatus}</p>

<p>Supplier: {selectedOrder.supplierName || "Not assigned"}</p>

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

<h3 className="text-xl font-semibold mb-8">
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
title:"Accepted",
time:selectedOrder.acceptedAt,
done:selectedOrder.supplierUID !== null
},

{
title:"Paid",
time:selectedOrder.paymentStatus==="paid",
done:selectedOrder.paymentStatus==="paid"
},

{
title:"Printed",
time:selectedOrder.status==="printed",
done:["printed","delivered"].includes(selectedOrder.status)
},

{
title:"Delivered",
time:selectedOrder.status==="delivered",
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

<p className={`${active?"text-white":"text-gray-400"}`}>
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



<div className="flex gap-4 mt-10">

{selectedOrder.paymentStatus==="unpaid" &&
selectedOrder.status!=="cancelled" &&(

<button
onClick={()=>cancelOrder(selectedOrder._id)}
className="bg-red-500 px-6 py-2 rounded-xl font-semibold"
>
Cancel Order
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

</AuthGuard>

)

}
