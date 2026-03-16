"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, signOut } from "firebase/auth"
import {
  resolveUserPortalDestination,
  USER_ROLE_PROMPT_MESSAGE
} from "@/lib/portal-access"

export default function UserEntryRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!active) {
        return
      }

      if (!user) {
        router.replace("/user/login")
        return
      }

      try {
        const destination = await resolveUserPortalDestination({
          uid: user.uid,
          email: user.email || user.providerData?.[0]?.email || "",
          photoURL: user.photoURL || "",
          confirmSupplierPromotion: () => window.confirm(USER_ROLE_PROMPT_MESSAGE)
        })

        if (!active) {
          return
        }

        router.replace(destination)
      } catch {
        await signOut(auth).catch(() => {})

        if (!active) {
          return
        }

        router.replace("/user/login")
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400">Redirecting...</p>
    </div>
  )
}
