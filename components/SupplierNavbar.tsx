"use client"

import Link from "next/link"
import { signOut, onAuthStateChanged } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { useRouter } from "next/navigation"
import { useEffect,useState } from "react"

export default function SupplierNavbar(){

const router = useRouter()
const [user,setUser] = useState<any>(null)

useEffect(()=>{

const unsub = onAuthStateChanged(auth,(u)=>{
setUser(u)
})

return ()=>unsub()

},[])

const logout = async()=>{
 await signOut(auth)
 router.push("/supplier")
}

return(

<nav className="w-full border-b border-white/10 bg-black/40 backdrop-blur-xl">

<div className="max-w-6xl mx-auto flex justify-between items-center p-4">

<h1 className="text-xl font-bold text-gradient">
PrintMyPage
</h1>

<div className="flex gap-6 items-center">

{user ? (

<>

<Link href="/supplier/dashboard">Dashboard</Link>
<Link href="/supplier/orders">Orders</Link>
<Link href="/supplier/accepted">Accepted</Link>
<Link href="/supplier/profile">Profile</Link>

<button
onClick={logout}
className="px-4 py-2 rounded-xl bg-red-500/80 hover:bg-red-500"
>
Logout
</button>

</>

) : (

<>

<Link href="/supplier/login">Login</Link>
<Link href="/supplier/register">Register</Link>

</>

)}

</div>

</div>

</nav>

)

}