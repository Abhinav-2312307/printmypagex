"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { pusherClient } from "@/lib/pusher-client"

export default function SupplierDashboard() {

  const [orders, setOrders] = useState<any[]>([])

  const loadOrders = async () => {

    const user = auth.currentUser

    const res = await fetch(
      `/api/orders/available?supplierUID=${user?.uid}`
    )

    const data = await res.json()

    setOrders(data.orders || [])
  }

  useEffect(() => {

    loadOrders()

    const channel = pusherClient.subscribe("orders")

    // 🔥 NEW ORDER EVENT
    channel.bind("new-order", function (data: any) {
      setOrders(prev => [data, ...prev])
    })

    // 🔥 REMOVE WHEN ACCEPTED
    channel.bind("order-accepted", function (data: any) {
      setOrders(prev =>
        prev.filter(order => order._id !== data.orderId)
      )
    })

    return () => {
      pusherClient.unsubscribe("orders")
    }

  }, [])

  const acceptOrder = async (id: string) => {

    const user = auth.currentUser

    await fetch("/api/orders/accept", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        orderId: id,
        supplierUID: user?.uid
      })
    })
  }

  return (
    <div style={{ padding: "40px" }}>

      <h1>Supplier Dashboard</h1>
      <h2>Available Orders</h2>

      {orders.map(order => (

        <div key={order._id} style={{
          border: "1px solid #444",
          padding: "20px",
          marginBottom: "10px"
        }}>

          <p>Pages: {order.pages}</p>
          <p>Print Type: {order.printType}</p>
          <p>Estimated Price: ₹{order.estimatedPrice}</p>

          <button onClick={() => acceptOrder(order._id)}>
            Accept Order
          </button>

        </div>

      ))}

    </div>
  )
}