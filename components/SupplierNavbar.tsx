"use client"

import { useState,useEffect,useRef } from "react"
import { auth } from "@/lib/firebase"
import { signOut,onAuthStateChanged } from "firebase/auth"
import { useRouter,usePathname } from "next/navigation"
import toast from "react-hot-toast"

export default function SupplierNavbar(){

const router = useRouter()
const pathname = usePathname()

const [user,setUser] = useState<any>(null)
const [supplier,setSupplier] = useState<any>(null)
const [open,setOpen] = useState(false)
const [showProfile,setShowProfile] = useState(false)
const [togglingActive,setTogglingActive] = useState(false)

const dropdownRef = useRef<HTMLDivElement>(null)


/* AUTH LISTENER */

useEffect(()=>{

const unsub = onAuthStateChanged(auth,(u)=>{
setUser(u)
})

return ()=>unsub()

},[])


/* LOAD SUPPLIER DATA */

useEffect(()=>{

if(!user) return

const loadSupplier = async()=>{

const res = await fetch(`/api/supplier/me?firebaseUID=${user.uid}`)
const data = await res.json()

setSupplier(data.supplier)

}

loadSupplier()

},[user])


/* LOGOUT */

const logout = async()=>{
await signOut(auth)
router.push("/supplier")
}


/* TOGGLE ACTIVE */

const toggleActive = async()=>{

if(!user || !supplier || togglingActive) return

setTogglingActive(true)

try{

const res = await fetch("/api/supplier/toggle-active",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
firebaseUID:user.uid,
active:!supplier.active
})
})

const data = await res.json()

if(!res.ok || !data.success){
toast.error(data.message || "Failed to update status")
return
}

setSupplier(data.supplier)

toast.success(
data.supplier.active
? "Supplier Activated"
: "Supplier Deactivated"
)

}catch{

toast.error("Failed to update active status")

}finally{

setTogglingActive(false)

}

}


/* CLOSE DROPDOWN ON OUTSIDE CLICK */

useEffect(()=>{

const handleClickOutside = (event:MouseEvent)=>{

if(
dropdownRef.current &&
!dropdownRef.current.contains(event.target as Node)
){
setOpen(false)
}

}

document.addEventListener("mousedown",handleClickOutside)

return ()=>document.removeEventListener("mousedown",handleClickOutside)

},[])


const userInitial =
user?.displayName?.charAt(0)?.toUpperCase() ||
user?.email?.charAt(0)?.toUpperCase() ||
"U"


return(

<>

<nav className="w-full border-b border-white/10 bg-black/50 backdrop-blur-2xl sticky top-0 z-50">

<div className="max-w-7xl mx-auto flex items-center justify-between px-12 py-6">

{/* LOGO */}

<h1
onClick={()=>router.push("/supplier")}
className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent cursor-pointer"
>
PrintMyPage
</h1>


<div className="flex items-center gap-12">


{/* NOT LOGGED IN */}

{!user && (

<>

<button
onClick={()=>router.push("/supplier/login")}
className="text-gray-300 hover:text-white transition"
>
Login
</button>

<button
onClick={()=>router.push("/supplier/register")}
className="px-4 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 transition"
>
Register
</button>

</>

)}


{/* LOGGED IN */}

{user && (

<>

{/* LANDING PAGE */}

{pathname === "/supplier" && (

<button
onClick={()=>router.push("/supplier/dashboard")}
className="text-gray-300 hover:text-white transition"
>
Dashboard
</button>

)}


{/* DASHBOARD */}

{pathname === "/supplier/dashboard" && (

<button
onClick={()=>router.push("/supplier/orders")}
className="text-gray-300 hover:text-white transition"
>
My Orders
</button>

)}


{/* ORDERS */}

{pathname === "/supplier/orders" && (

<button
onClick={()=>router.push("/supplier/dashboard")}
className="text-gray-300 hover:text-white transition"
>
Dashboard
</button>

)}


{/* AVATAR */}

<div className="relative" ref={dropdownRef}>

<div
onClick={()=>setOpen(!open)}
className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-bold text-black cursor-pointer shadow-lg hover:scale-105 transition"
>
{userInitial}
</div>


{/* DROPDOWN */}

{open && (

<div className="absolute right-0 mt-5 w-72 bg-[#0b1220] border border-white/10 rounded-xl shadow-2xl p-4 space-y-4">

<div className="text-sm text-gray-400 border-b border-white/10 pb-3 break-all">
{user?.email}
</div>


<button
onClick={()=>{
setOpen(false)
setShowProfile(true)
}}
className="block w-full text-left hover:text-indigo-400 transition"
>
View Profile
</button>


{/* ACTIVE TOGGLE */}

<div className={`flex items-center justify-between py-2 ${togglingActive ? "opacity-60 pointer-events-none" : ""}`}>

<p className="text-sm text-gray-300 font-medium">
{supplier?.active ? "Active" : "Inactive"}
</p>


<label className="relative inline-flex items-center cursor-pointer">

<input
type="checkbox"
checked={supplier?.active || false}
onChange={toggleActive}
className="sr-only peer"
/>

<div className="peer ring-0 bg-rose-400 rounded-full outline-none duration-300 after:duration-500 w-12 h-12 shadow-md peer-checked:bg-emerald-500 peer-focus:outline-none after:content-['✖️'] after:rounded-full after:absolute after:outline-none after:h-10 after:w-10 after:bg-gray-50 after:top-1 after:left-1 after:flex after:justify-center after:items-center peer-hover:after:scale-75 peer-checked:after:content-['✔️'] after:-rotate-180 peer-checked:after:rotate-0">
</div>

</label>

</div>


<hr className="border-white/10"/>


<button
onClick={logout}
className="block w-full text-left text-red-400 hover:text-red-300 transition"
>
Logout
</button>

</div>

)}

</div>

</>

)}

</div>

</div>

</nav>


{/* PROFILE MODAL */}

{showProfile && supplier &&(

<div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50">

<div className="bg-gradient-to-b from-[#0f172a] to-[#020617] border border-white/10 rounded-2xl p-8 w-[450px] shadow-2xl">

<h2 className="text-2xl font-semibold mb-6">
Supplier Profile
</h2>


<div className="space-y-5 text-sm">

<div>
<p className="text-gray-400">Name</p>
<p className="font-medium">{supplier.name}</p>
</div>

<div>
<p className="text-gray-400">Email</p>
<p className="font-medium">{supplier.email}</p>
</div>

<div>
<p className="text-gray-400">Phone</p>
<p className="font-medium">{supplier.phone}</p>
</div>

<div className="grid grid-cols-2 gap-4">

<div>
<p className="text-gray-400">Branch</p>
<p className="font-medium">{supplier.branch}</p>
</div>

<div>
<p className="text-gray-400">Year</p>
<p className="font-medium">{supplier.year}</p>
</div>

</div>

<div>
<p className="text-gray-400">Roll No</p>
<p className="font-medium">{supplier.rollNo}</p>
</div>

<div>
<p className="text-gray-400">Status</p>
<p className="font-medium">
{supplier.active ? "Active":"Inactive"}
</p>
</div>

</div>


<button
onClick={()=>setShowProfile(false)}
className="mt-8 w-full bg-indigo-500 hover:bg-indigo-600 transition py-2 rounded-lg"
>
Close
</button>

</div>

</div>

)}

</>

)

}