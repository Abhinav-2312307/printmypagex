"use client"

import { useEffect,useState } from "react"
import { auth } from "@/lib/firebase"

export default function OrdersPage(){

  const [orders,setOrders] = useState<any[]>([])

  useEffect(()=>{

    const loadOrders = async()=>{

      const user = auth.currentUser

      if(!user) return

      const res = await fetch(`/api/order?firebaseUID=${user.uid}`)

      const data = await res.json()

      setOrders(data.orders)

    }

    loadOrders()

  },[])

  return(

    <div className="orders-container">

      <h1>My Orders</h1>

      {orders.map((order)=>(
        <div key={order._id} className="order-card">

          <p><b>Pages:</b> {order.pages}</p>

          <p><b>Price:</b> ₹{order.price}</p>

          <p><b>Status:</b> {order.status}</p>

          <p><b>Date:</b> {new Date(order.createdAt).toLocaleString()}</p>

        </div>
      ))}

    </div>

  )
}