"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { isOwnerEmail } from "@/lib/owner-access"
import { authFetch } from "@/lib/client-auth"
import { hasUserRole } from "@/lib/user-roles"

export default function RoleGuard({
  children,
  role
}:{
  children: React.ReactNode
  role: "USER" | "SUPPLIER" | "ADMIN"
}) {

  const [loading,setLoading] = useState(true)
  const router = useRouter()

  useEffect(()=>{

    const unsubscribe = onAuthStateChanged(auth, async (user)=>{

      if(!user){
        router.replace("/user/login")
        return
      }

      if (isOwnerEmail(user.email)) {
        setLoading(false)
        return
      }

      try{

        const res = await authFetch(`/api/user/details?firebaseUID=${user.uid}`)
        const data = await res.json()

        if(!data.user){
          await signOut(auth)
          router.replace("/user/login")
          return
        }

        if(!hasUserRole(data.user, role)){
          if (role === "USER" && hasUserRole(data.user, "SUPPLIER")) {
            router.replace("/user")
            return
          }

          router.replace("/user/login")
          return
        }

        if (data.user.active === false || data.user.approved === false) {
          await signOut(auth)
          router.replace("/user/login")
          return
        }

        setLoading(false)

      }catch{
        await signOut(auth).catch(() => {})
        router.replace("/user/login")
      }

    })

    return ()=>unsubscribe()

  },[role, router])

  if(loading){
    return(
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Verifying access...</p>
      </div>
    )
  }

  return <>{children}</>
}
