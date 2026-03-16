"use client"

import { useEffect, useState } from "react"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import {
  resolveSupplierPortalDestination,
  resolveUserPortalDestination,
  USER_ROLE_PROMPT_MESSAGE
} from "@/lib/portal-access"

export default function PortalGuestGuard({
  children,
  portal
}: {
  children: React.ReactNode
  portal: "user" | "supplier"
}) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) {
        return
      }

      if (!user) {
        setChecking(false)
        return
      }

      try {
        const email = user.email || user.providerData?.[0]?.email || ""
        const photoURL = user.photoURL || ""

        const destination =
          portal === "user"
            ? await resolveUserPortalDestination({
                uid: user.uid,
                email,
                photoURL,
                confirmSupplierPromotion: () => window.confirm(USER_ROLE_PROMPT_MESSAGE)
              })
            : await resolveSupplierPortalDestination({
                uid: user.uid,
                email,
                photoURL
              })

        if (!active) {
          return
        }

        router.replace(destination)
      } catch (error) {
        console.error("PORTAL_GUEST_GUARD_ERROR:", error)
        await signOut(auth).catch(() => {})

        if (!active) {
          return
        }

        setChecking(false)
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [portal, router])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Checking session...</p>
      </div>
    )
  }

  return <>{children}</>
}
