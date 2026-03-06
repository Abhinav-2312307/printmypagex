"use client"

import { useEffect,useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { useRouter } from "next/navigation"

export default function SupplierGuard({
children
}:{
children:React.ReactNode
}){

const [loading,setLoading] = useState(true)
const router = useRouter()

useEffect(()=>{

const unsub = onAuthStateChanged(auth,async(user)=>{

if(!user){
setLoading(false)
router.push("/supplier/login")
return
}

const res = await fetch(
`/api/supplier/me?firebaseUID=${user.uid}`
)

const data = await res.json()

if(!data.supplier){
setLoading(false)
router.push("/supplier/register")
return
}

if(!data.supplier.approved){
setLoading(false)
router.push("/supplier")
return
}

setLoading(false)

})

return ()=>unsub()

},[router])

if(loading){
return(

<div className="flex items-center justify-center min-h-screen">

<p className="text-gray-400">
Loading dashboard...
</p>

</div>

)
}

return <>{children}</>

}