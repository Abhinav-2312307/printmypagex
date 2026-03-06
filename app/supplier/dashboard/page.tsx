"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { pusherClient } from "@/lib/pusher-client"

import {
ResponsiveContainer,
LineChart,
Line,
XAxis,
YAxis,
Tooltip,
CartesianGrid
} from "recharts"

export default function SupplierDashboard() {

const [orders,setOrders] = useState<any[]>([])
const [uid,setUid] = useState<string | null>(null)
const [selectedOrder,setSelectedOrder] = useState<any>(null)
const [supplier,setSupplier] = useState<any>(null)
const [duration,setDuration] = useState("7d")
const [showProfile,setShowProfile] = useState(false)

const loadOrders = async(uid:string)=>{

const res = await fetch(
`/api/orders/available?supplierUID=${uid}`
)

const data = await res.json()

setOrders(data.orders || [])

}

const loadSupplier = async(uid:string)=>{

const res = await fetch(`/api/supplier/me?firebaseUID=${uid}`)

const data = await res.json()

setSupplier(data.supplier)

}

useEffect(()=>{

const unsubscribe = onAuthStateChanged(auth,(user)=>{

if(!user) return

setUid(user.uid)

loadOrders(user.uid)

loadSupplier(user.uid)

})

return ()=>unsubscribe()

},[])


useEffect(()=>{

const channel = pusherClient.subscribe("orders")

channel.bind("new-order",(data:any)=>{
setOrders(prev=>[data,...prev])
})

channel.bind("order-accepted",(data:any)=>{
setOrders(prev=>prev.filter(o=>o._id!==data.orderId))
})

return ()=>{
pusherClient.unsubscribe("orders")
}

},[])


const acceptOrder = async(id:string)=>{

if(!uid) return

await fetch("/api/orders/accept",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
orderId:id,
supplierUID:uid
})
})

}


const chartData = orders.map((o,i)=>({
day:`Day ${i+1}`,
orders:1,
revenue:o.estimatedPrice
}))


return(

<div className="max-w-6xl mx-auto p-8 space-y-10">

{/* HEADER */}

<div className="flex justify-between items-center">

<h1 className="text-4xl font-bold">
Supplier Dashboard
</h1>

<button
onClick={()=>setShowProfile(true)}
className="px-4 py-2 bg-primary rounded-lg"
>
View Profile
</button>

</div>


{/* FILTER */}

<div className="flex gap-3">

<button
onClick={()=>setDuration("7d")}
className="px-4 py-2 bg-card rounded-lg"
>
7 Days
</button>

<button
onClick={()=>setDuration("30d")}
className="px-4 py-2 bg-card rounded-lg"
>
30 Days
</button>

<button
onClick={()=>setDuration("90d")}
className="px-4 py-2 bg-card rounded-lg"
>
90 Days
</button>

</div>


{/* STATS */}

<div className="grid md:grid-cols-4 gap-6">

<div className="bg-card p-6 rounded-xl">
<p className="text-gray-400">Total Orders</p>
<h2 className="text-3xl font-bold">
{orders.length}
</h2>
</div>

<div className="bg-card p-6 rounded-xl">
<p className="text-gray-400">Pending</p>
<h2 className="text-3xl font-bold">
{orders.length}
</h2>
</div>

<div className="bg-card p-6 rounded-xl">
<p className="text-gray-400">Revenue</p>
<h2 className="text-3xl font-bold">
₹{orders.reduce((a,b)=>a+b.estimatedPrice,0)}
</h2>
</div>

<div className="bg-card p-6 rounded-xl">
<p className="text-gray-400">Avg Order</p>
<h2 className="text-3xl font-bold">
₹{orders.length?Math.round(orders.reduce((a,b)=>a+b.estimatedPrice,0)/orders.length):0}
</h2>
</div>

</div>


{/* ORDERS GRAPH */}

<div className="bg-card p-6 rounded-xl">

<h2 className="text-xl mb-4">
Orders Trend
</h2>

<ResponsiveContainer width="100%" height={300}>

<LineChart data={chartData}>

<CartesianGrid strokeDasharray="3 3" />

<XAxis dataKey="day" />

<YAxis />

<Tooltip />

<Line
type="monotone"
dataKey="orders"
stroke="#6366f1"
strokeWidth={3}
/>

</LineChart>

</ResponsiveContainer>

</div>


{/* REVENUE GRAPH */}

<div className="bg-card p-6 rounded-xl">

<h2 className="text-xl mb-4">
Revenue
</h2>

<ResponsiveContainer width="100%" height={300}>

<LineChart data={chartData}>

<CartesianGrid strokeDasharray="3 3" />

<XAxis dataKey="day" />

<YAxis />

<Tooltip />

<Line
type="monotone"
dataKey="revenue"
stroke="#22c55e"
strokeWidth={3}
/>

</LineChart>

</ResponsiveContainer>

</div>


{/* AVAILABLE ORDERS */}

<div>

<h2 className="text-2xl font-semibold mb-6">
Available Orders
</h2>

{orders.length===0 &&(

<p className="text-gray-400">
No orders available
</p>

)}

{orders.map(order=>(

<div
key={order._id}
className="bg-card border border-white/10 rounded-xl p-5 mb-4"
>

<p>Pages: {order.pages}</p>

<p>Print Type: {order.printType}</p>

<p>Estimated Price: ₹{order.estimatedPrice}</p>

<div className="flex gap-3 mt-4">

<button
onClick={()=>{
console.log(order)
setSelectedOrder(order)
}}
className="px-4 py-2 bg-white/10 rounded-lg"
>
View Details
</button>

<button
onClick={()=>acceptOrder(order._id)}
className="px-4 py-2 bg-primary rounded-lg"
>
Accept
</button>

</div>

</div>

))}

</div>


{/* ORDER DETAILS MODAL */}

{selectedOrder && (

<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

<div className="bg-card p-8 rounded-2xl w-[520px] max-h-[85vh] overflow-y-auto space-y-6 shadow-xl border border-white/10">

<div className="flex justify-between items-center">
<h2 className="text-2xl font-semibold">
Order Details
</h2>

<button
onClick={()=>setSelectedOrder(null)}
className="text-gray-400 hover:text-white"
>
✕
</button>
</div>

<div className="grid grid-cols-2 gap-4 text-sm">

<div>
<p className="text-gray-400">User</p>
<p className="font-medium">{selectedOrder.userName || "-"}</p>
</div>

<div>
<p className="text-gray-400">Class</p>
<p className="font-medium">{selectedOrder.class || "-"}</p>
</div>

<div>
<p className="text-gray-400">Roll No</p>
<p className="font-medium">{selectedOrder.rollNo || "-"}</p>
</div>

<div>
<p className="text-gray-400">Phone</p>
<p className="font-medium">{selectedOrder.phone || "-"}</p>
</div>

<div>
<p className="text-gray-400">Alternate Phone</p>
<p className="font-medium">{selectedOrder.alternatePhone || "-"}</p>
</div>

<div>
<p className="text-gray-400">Pages</p>
<p className="font-medium">{selectedOrder.pages}</p>
</div>

<div>
<p className="text-gray-400">Print Type</p>
<p className="font-medium">
{selectedOrder.printType === "bw" ? "Black & White" : "Color"}
</p>
</div>

<div>
<p className="text-gray-400">Estimated Price</p>
<p className="font-medium">₹{selectedOrder.estimatedPrice}</p>
</div>

</div>

<div>
<p className="text-gray-400">Duplex</p>
<p className="font-medium">
{selectedOrder.duplex ? "Yes" : "No"}
</p>
</div>

{selectedOrder.instruction && (

<div>
<p className="text-gray-400 text-sm mb-1">
Instructions
</p>

<div className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm">
{selectedOrder.instruction}
</div>

</div>

)}

<div className="flex gap-3 pt-2">

<a
href={selectedOrder.fileURL}
target="_blank"
className="flex-1 text-center bg-white/10 hover:bg-white/20 py-2 rounded-lg transition"
>
Preview File
</a>

<a
href={selectedOrder.fileURL}
download
className="flex-1 text-center bg-primary py-2 rounded-lg"
>
Download File
</a>

</div>

<button
onClick={()=>setSelectedOrder(null)}
className="w-full mt-2 text-gray-400 hover:text-white text-sm"
>
Close
</button>

</div>

</div>

)}

{showProfile && supplier &&(

<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">

<div className="bg-card p-8 rounded-xl w-[450px] space-y-4">

<h2 className="text-2xl font-bold mb-4">
Supplier Profile
</h2>

<p><b>Name:</b> {supplier.name}</p>
<p><b>Email:</b> {supplier.email}</p>
<p><b>Phone:</b> {supplier.phone}</p>
<p><b>Branch:</b> {supplier.branch}</p>
<p><b>Year:</b> {supplier.year}</p>
<p><b>Roll No:</b> {supplier.rollNo}</p>
<p><b>Status:</b> {supplier.approved ? "Approved" : "Pending"}</p>

<button
onClick={()=>setShowProfile(false)}
className="mt-6 bg-primary px-4 py-2 rounded-lg"
>
Close
</button>

</div>

</div>

)}

</div>

)

}