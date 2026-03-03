"use client"

import AuthGuard from "@/components/AuthGuard"
import Navbar from "@/components/Navbar"
import Link from "next/link"

export default function UserDashboard() {

  return (
    <AuthGuard>

      <Navbar />

      <div className="max-w-6xl mx-auto py-16 px-8">

        <h1 className="text-4xl font-bold mb-8">
          Dashboard
        </h1>

        <div className="grid md:grid-cols-2 gap-8">

          <Link
            href="/user/create-order"
            className="bg-card p-8 rounded-2xl hover:scale-105 transition"
          >
            <h3 className="text-xl font-semibold text-primary">
              Create Order
            </h3>
          </Link>

          <Link
            href="/user/orders"
            className="bg-card p-8 rounded-2xl hover:scale-105 transition"
          >
            <h3 className="text-xl font-semibold text-primary">
              My Orders
            </h3>
          </Link>

        </div>

      </div>

    </AuthGuard>
  )
}