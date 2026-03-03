"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"
import AuthGuard from "@/components/AuthGuard"
import { pusherClient } from "@/lib/pusher-client"
import toast from "react-hot-toast"

export default function UserOrders() {

  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  useEffect(() => {

    const fetchOrders = async () => {

      const user = auth.currentUser
      if (!user) return

      try {
        const res = await fetch(`/api/orders/user?firebaseUID=${user.uid}`)
        const data = await res.json()
        setOrders(data.orders || [])
      } catch (err) {
        toast.error("Failed to load orders")
      }

      setLoading(false)
    }

    fetchOrders()

  }, [])

  // 🔥 Real-time updates
  useEffect(() => {

    const user = auth.currentUser
    if (!user) return

    const channel = pusherClient.subscribe(`user-${user.uid}`)

    channel.bind("order-updated", (updatedOrder: any) => {

      setOrders(prev =>
        prev.map(order =>
          order._id === updatedOrder._id ? updatedOrder : order
        )
      )

      toast.success("Order status updated")
    })

    return () => {
      pusherClient.unsubscribe(`user-${user.uid}`)
    }

  }, [])

  const getStatusColor = (status: string) => {

    if (status === "pending")
      return "bg-yellow-500/20 text-yellow-400 border border-yellow-400/30"

    if (status === "accepted")
      return "bg-blue-500/20 text-blue-400 border border-blue-400/30"

    if (status === "completed")
      return "bg-green-500/20 text-green-400 border border-green-400/30"

    return "bg-gray-500/20 text-gray-400 border border-gray-400/20"
  }

  const totalOrders = orders.length

  return (

    <AuthGuard>

      <Navbar />

      <div className="px-6 md:px-16 py-16">

        <h1 className="text-4xl font-bold mb-10 text-gradient">
          My Orders
        </h1>

        {/* 🔥 Order Count Card */}
        {!loading && (
          <div className="bg-card p-8 rounded-3xl mb-12 shadow-xl">
            <p className="text-gray-400 text-sm">Total Orders</p>
            <h2 className="text-5xl font-bold mt-2 text-gradient">
              {totalOrders}
            </h2>
          </div>
        )}

        {/* 🔥 Skeleton Loader */}
        {loading && (
          <div className="grid md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card p-8 rounded-3xl animate-pulse">
                <div className="h-6 bg-gray-700 rounded w-1/2 mb-6"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-700 rounded"></div>
                  <div className="h-4 bg-gray-700 rounded"></div>
                  <div className="h-4 bg-gray-700 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 🔥 Empty State */}
        {!loading && orders.length === 0 && (
          <div className="bg-card p-10 rounded-2xl text-center">
            <p className="text-gray-400">
              You haven't placed any orders yet.
            </p>
          </div>
        )}

        {/* 🔥 Orders Grid */}
        <div className="grid md:grid-cols-2 gap-8">

          {orders.map((order) => (

            <div
              key={order._id}
              className="bg-card p-8 rounded-3xl transition duration-300 hover:scale-[1.02] hover:border-indigo-500/40 shadow-xl"
            >

              <div className="flex justify-between items-center mb-6">

                <p className="text-2xl font-bold text-gradient">
                  {(order.printType || "bw").toUpperCase()} Print
                </p>

                <span
                  className={`px-4 py-1 text-xs rounded-full font-semibold tracking-wide ${getStatusColor(order.status)} shadow-md`}
                >
                  {(order.status || "pending").toUpperCase()}
                </span>

              </div>

              <div className="space-y-3 text-gray-300 text-sm">

                <div className="flex justify-between">
                  <span>Pages</span>
                  <span className="font-semibold text-white">
                    {order.pages || 1}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Estimated</span>
                  <span className="font-semibold text-white">
                    ₹{order.estimatedPrice || 0}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Payment</span>
                  <span className="font-semibold text-white">
                    {(order.paymentStatus || "unpaid").toUpperCase()}
                  </span>
                </div>

                {order.createdAt && (
                  <div className="flex justify-between text-gray-500 text-xs mt-4">
                    <span>Placed On</span>
                    <span>
                      {new Date(order.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

              </div>

              <button
                onClick={() => setSelectedOrder(order)}
                className="mt-6 text-indigo-400 hover:text-indigo-300 text-sm font-medium"
              >
                View Details →
              </button>

            </div>

          ))}

        </div>

        {/* 🔥 Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">

            <div className="bg-card w-full max-w-lg p-8 rounded-3xl shadow-2xl">

              <h2 className="text-2xl font-bold mb-6 text-gradient">
                Order Details
              </h2>

              <div className="space-y-4 text-gray-300 text-sm">

                <p>Pages: {selectedOrder.pages}</p>
                <p>Print Type: {selectedOrder.printType}</p>
                <p>Status: {selectedOrder.status}</p>
                <p>Estimated Price: ₹{selectedOrder.estimatedPrice}</p>
                <p>Payment: {selectedOrder.paymentStatus}</p>

                {selectedOrder.fileURL && (
                  <a
                    href={selectedOrder.fileURL}
                    target="_blank"
                    className="text-indigo-400 hover:text-indigo-300 underline"
                  >
                    View Uploaded File
                  </a>
                )}

              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="mt-8 bg-primary px-6 py-2 rounded-xl text-black font-semibold hover:opacity-90"
              >
                Close
              </button>

            </div>

          </div>
        )}

      </div>

    </AuthGuard>
  )
}