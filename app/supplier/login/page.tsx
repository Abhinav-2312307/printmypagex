"use client"

import { auth, provider } from "@/lib/firebase"
import { signInWithPopup, onAuthStateChanged } from "firebase/auth"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function SupplierLogin(){

const router = useRouter()

useEffect(()=>{

const unsub = onAuthStateChanged(auth,(user)=>{

if(user){
router.push("/supplier/dashboard")
}
else{
router.push("/supplier/login")
}

})

return ()=>unsub()

},[router])


const login = async()=>{

const result = await signInWithPopup(auth,provider)

const user = result.user

const res = await fetch(
`/api/supplier/me?firebaseUID=${user.uid}`
)

const data = await res.json()

if(!data.supplier){
alert("You are not registered as supplier")
return
}

if(!data.supplier.approved){
alert("Admin has not approved you yet")
return
}

window.location.href="/supplier/dashboard"

}

return(

<div className="min-h-screen flex items-center justify-center">

<div className="bg-card p-10 rounded-2xl w-[400px] text-center space-y-6">

<h1 className="text-3xl font-bold">
Supplier Login
</h1>

<p className="text-white/70">
Login to access supplier dashboard
</p>

<button
onClick={login}
className="w-full py-3 bg-primary rounded-xl hover:scale-105"
>
Login with Google
</button>

</div>

</div>

)

}