"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, signOut } from "firebase/auth"

export default function Navbar() {

  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
    })

    return () => unsubscribe()
  }, [])

  return (
    <nav className="flex justify-between items-center px-8 py-6 border-b border-gray-800">

      <Link href="/" className="text-2xl font-bold text-primary">
        PrintMyPage
      </Link>

      <div className="flex items-center gap-6">

        <Link href="/pricing" className="hover:text-primary">
          Pricing
        </Link>

        <Link href="/contact" className="hover:text-primary">
          Contact
        </Link>

        <Link href="/supplier/register" className="hover:text-primary">
          Supplier
        </Link>
        <Link href="/user/login">
          Login
        </Link>
        <Link href="/user/register">
          Register
        </Link>

        {user ? (
          <>
            <Link
              href="/user/dashboard"
              className="px-4 py-2 bg-primary text-black rounded-lg font-semibold"
            >
              Dashboard
            </Link>

            <button
              onClick={() => signOut(auth)}
              className="text-red-400"
            >
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/user/login"
            className="px-4 py-2 bg-primary text-black rounded-lg font-semibold"
          >
            Login
          </Link>
        )}

      </div>
    </nav>
  )
}
