"use client"

import { useState, useEffect, useRef } from "react"
import { auth } from "@/lib/firebase"
import { signOut, onAuthStateChanged, type User } from "firebase/auth"
import { useRouter, usePathname } from "next/navigation"
import toast from "react-hot-toast"
import { authFetch } from "@/lib/client-auth"
import { useTheme } from "next-themes"

type SupplierProfile = {
  firebaseUID: string
  name?: string
  email?: string
  phone?: string
  rollNo?: string
  branch?: string
  year?: string
  active?: boolean
  photoURL?: string
  firebasePhotoURL?: string
  displayPhotoURL?: string
}

export default function SupplierNavbar() {

const router = useRouter()
const pathname = usePathname()
const dropdownRef = useRef<HTMLDivElement>(null)

const {theme,setTheme} = useTheme()

const [user,setUser] = useState<User | null>(null)
const [supplier,setSupplier] = useState<SupplierProfile | null>(null)

const [open,setOpen] = useState(false)
const [showProfile,setShowProfile] = useState(false)
const [togglingActive,setTogglingActive] = useState(false)

const [mounted,setMounted] = useState(false)

const [isEditingProfile,setIsEditingProfile] = useState(false)
const [savingProfile,setSavingProfile] = useState(false)

const [photoFile,setPhotoFile] = useState<File | null>(null)
const [photoPreview,setPhotoPreview] = useState("")

const [profileForm,setProfileForm] = useState({
name:"",
rollNo:"",
phone:""
})

useEffect(()=>{setMounted(true)},[])

useEffect(()=>{
const unsub = onAuthStateChanged(auth,(u)=>{
setUser(u)

if(!u){
setSupplier(null)
setOpen(false)
}
})
return ()=>unsub()
},[])

const refreshSupplier = async(uid:string)=>{
const res = await authFetch(`/api/supplier/me?firebaseUID=${uid}`)
const data = await res.json()
setSupplier(data.supplier || null)
}

useEffect(()=>{
if(!user){
setSupplier(null)
return
}
refreshSupplier(user.uid)
},[user])

const logout = async()=>{
await signOut(auth)
router.push("/supplier")
}

const toggleActive = async()=>{
if(!user || !supplier || togglingActive) return
setTogglingActive(true)

try{

const res = await authFetch("/api/supplier/toggle-active",{
method:"POST",
headers:{"Content-Type":"application/json"},
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
toast.success(data.supplier.active ? "Supplier Activated":"Supplier Deactivated")

}catch{
toast.error("Failed to update active status")
}
finally{
setTogglingActive(false)
}
}

const openProfile = ()=>{
if(!supplier) return

setProfileForm({
name:supplier.name || "",
rollNo:supplier.rollNo || "",
phone:supplier.phone || ""
})

setPhotoPreview(
supplier.displayPhotoURL ||
supplier.photoURL ||
supplier.firebasePhotoURL ||
""
)

setPhotoFile(null)
setIsEditingProfile(false)
setShowProfile(true)
}

useEffect(()=>{

const handleClickOutside=(event:MouseEvent)=>{
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

const resolvedNavbarPhoto =
supplier?.displayPhotoURL ||
supplier?.photoURL ||
supplier?.firebasePhotoURL ||
""

const userInitial =
user?.displayName?.charAt(0)?.toUpperCase() ||
user?.email?.charAt(0)?.toUpperCase() ||
"U"

return(
<>

<div className="h-28 md:h-32"/>

<div className="w-full flex justify-center fixed top-6 z-50">

<nav className="flex items-center justify-between px-12 py-4 w-[95%] max-w-[1400px] rounded-3xl backdrop-blur-3xl bg-white/70 dark:bg-black/40 border border-gray-200 dark:border-white/20 shadow-[0_8px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] hover:scale-[1.01] transition-all duration-300">

<h1
className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent cursor-pointer"
onClick={()=>router.push("/supplier")}
>
PrintMyPage
</h1>

<div className="flex items-center gap-6">

{/* Primary Navigation */}

{user ? (

<button
onClick={()=>router.push(pathname === "/supplier/orders" ? "/supplier/dashboard":"/supplier/orders")}
className="group relative flex items-center gap-2 px-5 py-2 rounded-full border border-gray-300 dark:border-white/20 bg-white/80 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white transition-all duration-300 hover:bg-gray-200 dark:hover:bg-white/10"
>

<span className="transition-all duration-300 group-hover:translate-x-[2px]">

{pathname === "/supplier/orders" ? "Dashboard":"Orders"}

</span>

</button>

) : (

<button
onClick={()=>router.push("/supplier/orders")}
className="group relative flex items-center gap-2 px-5 py-2 rounded-full border border-gray-300 dark:border-white/20 bg-white/80 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white transition-all duration-300 hover:bg-gray-200 dark:hover:bg-white/10"
>

<span className="transition-all duration-300 group-hover:translate-x-[2px]">
Orders
</span>

</button>

)}

{pathname === "/supplier" && (
<button
onClick={()=>router.push("/supplier/faq")}
className="group relative flex items-center gap-2 px-5 py-2 rounded-full border border-indigo-300/20 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white transition-all duration-300 hover:scale-[1.03]"
>

<span className="transition-all duration-300 group-hover:translate-x-[2px]">
Guide
</span>

</button>
)}

{!user && (

<div className="flex items-center gap-3">

<button
onClick={()=>router.push("/supplier/login")}
className="px-4 py-2 rounded-full border border-gray-300 dark:border-white/20 bg-white/80 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10 transition"
>
Login
</button>

<button
onClick={()=>router.push("/supplier/register")}
className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:scale-105 transition"
>
Sign Up
</button>

</div>

)}

{/* Theme Toggle */}

<button
onClick={()=>setTheme(theme==="dark"?"light":"dark")}
className="group relative flex justify-center items-center overflow-visible cursor-pointer"
>

<div className="w-6 h-6 relative scale-75">

{mounted && theme === "dark" && (
<div className="absolute -top-8 left-1/2 -translate-x-1/2 w-10 h-10 bg-yellow-400/30 blur-xl rounded-full animate-pulse"/>
)}

<div
className={`w-6 h-6 absolute duration-500
${mounted && theme === "dark"
? "bg-neutral-50 shadow-[0_-6px_12px_rgba(255,200,0,0.4),0_-18px_40px_rgba(255,200,0,0.55),0_-30px_70px_rgba(255,200,0,0.35)]"
: "bg-neutral-200 shadow-none"}
`}
>

<div className="w-6 h-6 bg-neutral-50 shadow-inner shadow-yellow-200"/>
<div className="w-6 h-6 bg-neutral-50 absolute -bottom-3 rounded-full [transform:rotateX(80deg)]"/>

<div
className={`w-6 h-6 absolute -top-3 rounded-full border-2 [transform:rotateX(80deg)]
${mounted && theme === "dark"
? "bg-yellow-400 border-yellow-300"
: "bg-gray-300 border-gray-400"}
`}
></div>

</div>

<svg
className={`absolute duration-500 rounded-full -top-3 left-[2px] w-4 h-4
${mounted && theme === "dark"
? "fill-yellow-300 animate-[pulse_1.8s_ease-in-out_infinite]"
: "fill-gray-400"}
`}
viewBox="0 0 100 100"
>
<path d="M59.5,20.5a3.9,3.9,0,0,0-2.5-2,4.3,4.3,0,0,0-3.3.5,11.9,11.9,0,0,0-3.2,3.5,26,26,0,0,0-2.3,4.4,76.2,76.2,0,0,0-3.3,10.8,120.4,120.4,0,0,0-2.4,14.2,11.4,11.4,0,0,1-3.8-4.2c-1.3-2.7-1.5-6.1-1.5-10.5a4,4,0,0,0-2.5-3.7,3.8,3.8,0,0,0-4.3.9,27.7,27.7,0,1,0,39.2,0"/>
</svg>

</div>

</button>

{/* Profile */}

{user && (

<div className="relative" ref={dropdownRef}>

<div
onClick={()=>setOpen(!open)}
className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center cursor-pointer text-black font-bold shadow-lg hover:scale-105 transition overflow-hidden"
>

{resolvedNavbarPhoto
? <img src={resolvedNavbarPhoto} className="w-full h-full object-cover"/>
: userInitial}

</div>

{open && (

<div className="absolute right-0 mt-4 w-72 bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 space-y-4">

<div className="text-sm text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-white/10 pb-2 break-all">
{user?.email}
</div>

<button
onClick={()=>{setOpen(false);openProfile()}}
className="block w-full text-left hover:text-indigo-400 transition"
>
View Profile
</button>

<div className="flex items-center justify-between py-2">

<p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
{supplier?.active ? "Active":"Inactive"}
</p>

<label className="relative inline-flex items-center cursor-pointer">

<input
type="checkbox"
checked={supplier?.active || false}
onChange={toggleActive}
className="sr-only peer"
/>

<div className="peer ring-0 bg-rose-400 rounded-full outline-none duration-300 after:duration-500 w-12 h-12 shadow-md peer-checked:bg-emerald-500 peer-focus:outline-none after:content-['✖️'] after:rounded-full after:absolute after:h-10 after:w-10 after:bg-gray-50 after:top-1 after:left-1 after:flex after:justify-center after:items-center peer-hover:after:scale-75 peer-checked:after:content-['✔️'] after:-rotate-180 peer-checked:after:rotate-0"/>

</label>

</div>

<button
onClick={logout}
className="group flex items-center justify-start w-11 h-11
bg-gradient-to-br from-rose-500 to-red-600
rounded-full cursor-pointer relative overflow-hidden
transition-all duration-300
shadow-lg hover:w-32 hover:rounded-xl
border border-white/20 backdrop-blur-md
hover:shadow-[0_6px_25px_rgba(255,0,80,0.45)]"
>

<div className="flex items-center justify-center w-full transition-all duration-300 group-hover:justify-start group-hover:px-3">

<svg className="w-4 h-4 text-white" viewBox="0 0 512 512" fill="currentColor">
<path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9z"/>
</svg>

</div>

<div className="absolute right-5 transform translate-x-full opacity-0 text-white text-sm font-semibold transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">

Logout

</div>

</button>

</div>

)}

</div>

)}

</div>

</nav>

</div>
{showProfile && supplier && (

<div className="fixed inset-0 z-[100] flex items-center justify-center">

{/* background blur */}

<div
className="absolute inset-0 bg-black/30 backdrop-blur-xl"
onClick={()=>setShowProfile(false)}
/>


{/* glass card */}

<div className="relative w-[540px] max-w-[95%]
bg-white/70 dark:bg-white/10
backdrop-blur-3xl
border border-white/40 dark:border-white/20
rounded-3xl
p-10
shadow-[0_20px_60px_rgba(0,0,0,0.25)]
dark:shadow-[0_20px_60px_rgba(0,0,0,0.6)]
animate-[scale-in_0.25s_ease]
">

{/* title */}

<h2 className="text-2xl font-semibold mb-8 text-center">
Supplier Profile
</h2>


{/* profile photo */}

<div className="flex justify-center mb-8">

{photoPreview ? (

<img
src={photoPreview}
alt={supplier.name || "Supplier"}
className="w-28 h-28 rounded-full object-cover
border border-white/40
shadow-xl"
/>

) : (

<div className="w-28 h-28 rounded-full
bg-gradient-to-br from-indigo-500 to-cyan-500
flex items-center justify-center
text-4xl font-bold text-black shadow-xl">

{(supplier?.name || user?.email || "S").charAt(0).toUpperCase()}

</div>

)}

</div>


{/* upload photo */}

{isEditingProfile && (

<div className="mb-6">

<label className="text-sm text-gray-500 dark:text-gray-400 mb-2 block">
Upload Profile Photo
</label>

<input
type="file"
accept="image/*"
onChange={(e)=>setPhotoFile(e.target.files?.[0] || null)}
className="input w-full"
/>

</div>

)}


{/* profile fields */}

<div className="space-y-5 text-sm">

{/* name */}

<div>

<p className="text-gray-500 dark:text-gray-400 mb-1">
Name
</p>

<input
value={profileForm.name}
onChange={(e)=>setProfileForm(prev=>({...prev,name:e.target.value}))}
readOnly={!isEditingProfile}
className={`input w-full ${!isEditingProfile ? "opacity-80":""}`}
/>

</div>


{/* email */}

<div>

<p className="text-gray-500 dark:text-gray-400 mb-1">
Email
</p>

<input
value={supplier.email || ""}
readOnly
className="input w-full opacity-70"
/>

</div>


{/* phone */}

<div>

<p className="text-gray-500 dark:text-gray-400 mb-1">
Phone
</p>

<input
value={profileForm.phone}
onChange={(e)=>setProfileForm(prev=>({...prev,phone:e.target.value.replace(/\D/g,"")}))}
readOnly={!isEditingProfile}
className={`input w-full ${!isEditingProfile ? "opacity-80":""}`}
/>

</div>


{/* branch + year */}

<div className="grid grid-cols-2 gap-4">

<div>

<p className="text-gray-500 dark:text-gray-400 mb-1">
Branch
</p>

<input
value={supplier.branch || ""}
readOnly
className="input w-full opacity-70"
/>

</div>


<div>

<p className="text-gray-500 dark:text-gray-400 mb-1">
Year
</p>

<input
value={supplier.year || ""}
readOnly
className="input w-full opacity-70"
/>

</div>

</div>


{/* roll */}

<div>

<p className="text-gray-500 dark:text-gray-400 mb-1">
Roll No
</p>

<input
value={profileForm.rollNo}
onChange={(e)=>setProfileForm(prev=>({...prev,rollNo:e.target.value.replace(/\D/g,"")}))}
readOnly={!isEditingProfile}
className={`input w-full ${!isEditingProfile ? "opacity-80":""}`}
/>

</div>


{/* status */}

<div className="flex items-center justify-between pt-2">

<p className="text-gray-500 dark:text-gray-400">
Status
</p>

<span className={`text-sm font-medium
${supplier.active
? "text-emerald-500"
: "text-rose-500"
}`}>
{supplier.active ? "Active":"Inactive"}
</span>

</div>

</div>


{/* buttons */}

<div className="mt-10 flex flex-col gap-3">

{!isEditingProfile ? (

<button
onClick={()=>setIsEditingProfile(true)}
className="w-full
bg-gradient-to-r from-indigo-500 to-cyan-500
text-white
py-2 rounded-xl
hover:scale-[1.02]
hover:shadow-[0_6px_25px_rgba(80,120,255,0.45)]
transition-all duration-300"
>

Edit Profile

</button>

) : (

<>

<button
onClick={()=>{}}
disabled={savingProfile}
className="w-full
bg-gradient-to-r from-indigo-500 to-cyan-500
text-white
py-2 rounded-xl
hover:scale-[1.02]
transition-all duration-300
disabled:opacity-60"
>

{savingProfile ? "Saving..." : "Save Changes"}

</button>

<button
onClick={()=>{
setIsEditingProfile(false)

setProfileForm({
name:supplier.name || "",
rollNo:supplier.rollNo || "",
phone:supplier.phone || ""
})

setPhotoFile(null)

setPhotoPreview(
supplier.displayPhotoURL ||
supplier.photoURL ||
supplier.firebasePhotoURL ||
""
)

}}
className="w-full
bg-white/40 dark:bg-white/10
hover:bg-white/60 dark:hover:bg-white/20
py-2 rounded-xl
transition"
>

Cancel

</button>

</>

)}

<button
onClick={()=>setShowProfile(false)}
className="w-full
bg-white/40 dark:bg-white/10
hover:bg-white/60 dark:hover:bg-white/20
py-2 rounded-xl
transition"
>

Close

</button>

</div>

</div>

</div>

)}
</>

)
}
