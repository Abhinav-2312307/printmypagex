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

function sanitizeAvatarUrl(value: unknown) {
const url = String(value || "").trim()

if(!url || url === "null" || url === "undefined"){
return ""
}

return url
}

export default function SupplierNavbar() {

const router = useRouter()
const pathname = usePathname()
const dropdownRef = useRef<HTMLDivElement>(null)
const mobileMenuRef = useRef<HTMLDivElement>(null)

const {theme,setTheme} = useTheme()

const [user,setUser] = useState<User | null>(null)
const [supplier,setSupplier] = useState<SupplierProfile | null>(null)

const [open,setOpen] = useState(false)
const [mobileMenuOpen,setMobileMenuOpen] = useState(false)
const [showProfile,setShowProfile] = useState(false)
const [togglingActive,setTogglingActive] = useState(false)

const [mounted,setMounted] = useState(false)

const [isEditingProfile,setIsEditingProfile] = useState(false)
const [savingProfile,setSavingProfile] = useState(false)
const [failedAvatarUrl,setFailedAvatarUrl] = useState("")
const [failedProfilePhotoUrl,setFailedProfilePhotoUrl] = useState("")

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
	setMobileMenuOpen(false)
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

	useEffect(()=>{
	setOpen(false)
	setMobileMenuOpen(false)
	},[pathname])

	const logout = async()=>{
	setOpen(false)
	setMobileMenuOpen(false)
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

	setOpen(false)
	setMobileMenuOpen(false)

	setProfileForm({
	name:supplier.name || "",
rollNo:supplier.rollNo || "",
phone:supplier.phone || ""
})

setPhotoPreview(
sanitizeAvatarUrl(
supplier.displayPhotoURL ||
supplier.photoURL ||
supplier.firebasePhotoURL ||
""
)
)

setPhotoFile(null)
setIsEditingProfile(false)
setShowProfile(true)
}

useEffect(()=>{

	const handleClickOutside=(event:MouseEvent)=>{
	const target = event.target as Node

	if(dropdownRef.current && !dropdownRef.current.contains(target)){
	setOpen(false)
	}

	if(mobileMenuRef.current && !mobileMenuRef.current.contains(target)){
	setMobileMenuOpen(false)
	}
	}

document.addEventListener("mousedown",handleClickOutside)

return ()=>document.removeEventListener("mousedown",handleClickOutside)

},[])

const resolvedNavbarPhoto =
sanitizeAvatarUrl(
supplier?.displayPhotoURL ||
supplier?.photoURL ||
supplier?.firebasePhotoURL ||
""
)

	const userInitial =
	supplier?.name?.charAt(0)?.toUpperCase() ||
	user?.displayName?.charAt(0)?.toUpperCase() ||
	user?.email?.charAt(0)?.toUpperCase() ||
	"U"

	const primaryNavHref =
	pathname === "/supplier/orders" ? "/supplier/dashboard" : "/supplier/orders"

	const primaryNavLabel =
	pathname === "/supplier/orders" ? "Dashboard" : "Orders"

	const primaryNavDescription =
	pathname === "/supplier/orders"
	? "Return to supplier hub"
	: "Track available requests"

	const handleRoute = (href:string)=>{
	setOpen(false)
	setMobileMenuOpen(false)
	router.push(href)
	}

const saveSupplierProfile = async()=>{
const currentUser = auth.currentUser

if(!currentUser || !supplier){
toast.error("Please login again")
return
}

if(!profileForm.name.trim() || !/^[A-Za-z ]+$/.test(profileForm.name.trim())){
toast.error("Name must contain only text")
return
}

if(!/^\d+$/.test(profileForm.rollNo.trim())){
toast.error("Roll number must be numeric")
return
}

if(!/^\d{10,15}$/.test(profileForm.phone.trim())){
toast.error("Phone must be 10 to 15 digits")
return
}

setSavingProfile(true)

try{

let nextPhotoURL = sanitizeAvatarUrl(
supplier.displayPhotoURL ||
supplier.photoURL ||
supplier.firebasePhotoURL ||
""
)

if(photoFile){
const photoFormData = new FormData()
photoFormData.append("file",photoFile)
photoFormData.append("firebaseUID",currentUser.uid)

const photoRes = await authFetch("/api/supplier/upload-photo",{
method:"POST",
body:photoFormData
})

const photoData = await photoRes.json()

if(!photoRes.ok || !photoData.success){
toast.error(photoData.message || "Failed to upload profile photo")
setSavingProfile(false)
return
}

nextPhotoURL = sanitizeAvatarUrl(photoData.photoURL || nextPhotoURL)
}

const res = await authFetch("/api/supplier/update-profile",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
firebaseUID:currentUser.uid,
name:profileForm.name.trim(),
rollNo:profileForm.rollNo.trim(),
phone:profileForm.phone.trim()
})
})

const data = await res.json()

if(!res.ok || !data.success){
toast.error(data.message || "Failed to update supplier profile")
setSavingProfile(false)
return
}

const nextSupplier = {
...supplier,
...data.supplier,
photoURL: nextPhotoURL || data.supplier?.photoURL || supplier.photoURL || "",
displayPhotoURL:
nextPhotoURL ||
data.supplier?.displayPhotoURL ||
data.supplier?.photoURL ||
data.supplier?.firebasePhotoURL ||
supplier.displayPhotoURL ||
supplier.photoURL ||
supplier.firebasePhotoURL ||
""
}

setSupplier(nextSupplier)
setPhotoPreview(
sanitizeAvatarUrl(
nextSupplier.displayPhotoURL ||
nextSupplier.photoURL ||
nextSupplier.firebasePhotoURL ||
""
)
)
setPhotoFile(null)
setIsEditingProfile(false)
toast.success("Profile updated")

}catch{
toast.error("Failed to update supplier profile")
}

setSavingProfile(false)
}

	return(
	<>

	<div className="h-24 md:h-32"/>

	<div className="fixed top-4 z-50 flex w-full justify-center px-3 md:top-6 md:px-0">

	<nav className="flex w-full max-w-[1400px] items-center justify-between rounded-3xl border border-gray-200 bg-white/70 px-4 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.2)] backdrop-blur-3xl transition-all duration-300 hover:scale-[1.01] dark:border-white/20 dark:bg-black/40 dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] md:px-10 md:py-4">

	<h1
	className="cursor-pointer bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-xl font-bold text-transparent md:text-2xl"
	onClick={()=>handleRoute("/supplier")}
	>
	PrintMyPage
	</h1>

	<div className="flex items-center gap-2 sm:gap-3 md:gap-6">

	<div className="hidden items-center gap-3 md:flex">

	{/* Primary Navigation */}

	{user ? (

	<button
	onClick={()=>handleRoute(primaryNavHref)}
	className="group relative"
	>

<div className="relative overflow-hidden rounded-xl bg-gradient-to-bl from-gray-900 via-gray-950 to-black p-[1px] shadow-2xl shadow-emerald-500/20">

<div className="relative flex items-center gap-3 rounded-xl bg-gray-950 px-4 py-2.5 transition-all duration-300 group-hover:bg-gray-950/50">

<div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 transition-transform duration-300 group-hover:scale-110">

<svg
stroke="currentColor"
viewBox="0 0 24 24"
fill="none"
className="h-4 w-4 text-white"
aria-hidden="true"
>
<path
d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
strokeWidth="2"
strokeLinejoin="round"
strokeLinecap="round"
/>
</svg>

<div className="absolute inset-0 rounded-lg bg-emerald-500/50 blur-sm transition-all duration-300 group-hover:blur-md" />

</div>

	<div className="flex flex-col items-start text-left leading-tight">
	<span className="text-sm font-semibold text-white">
	{primaryNavLabel}
	</span>
	<span className="text-[10px] font-medium text-emerald-400/80">
	{primaryNavDescription}
	</span>
	</div>

<div className="ml-auto flex items-center gap-1">
<div className="h-1.5 w-1.5 rounded-full bg-emerald-500 transition-transform duration-300 group-hover:scale-150" />
<div className="h-1.5 w-1.5 rounded-full bg-emerald-500/50 transition-transform duration-300 group-hover:scale-150 group-hover:delay-100" />
<div className="h-1.5 w-1.5 rounded-full bg-emerald-500/30 transition-transform duration-300 group-hover:scale-150 group-hover:delay-200" />
</div>

</div>

<div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 opacity-20 transition-opacity duration-300 group-hover:opacity-40" />

</div>

</button>

	) : (

	<button
	onClick={()=>handleRoute(primaryNavHref)}
	className="group relative"
	>

<div className="relative overflow-hidden rounded-xl bg-gradient-to-bl from-gray-900 via-gray-950 to-black p-[1px] shadow-2xl shadow-emerald-500/20">

<div className="relative flex items-center gap-3 rounded-xl bg-gray-950 px-4 py-2.5 transition-all duration-300 group-hover:bg-gray-950/50">

<div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 transition-transform duration-300 group-hover:scale-110">

<svg
stroke="currentColor"
viewBox="0 0 24 24"
fill="none"
className="h-4 w-4 text-white"
aria-hidden="true"
>
<path
d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
strokeWidth="2"
strokeLinejoin="round"
strokeLinecap="round"
/>
</svg>

<div className="absolute inset-0 rounded-lg bg-emerald-500/50 blur-sm transition-all duration-300 group-hover:blur-md" />

</div>

<div className="flex flex-col items-start text-left leading-tight">
	<span className="text-sm font-semibold text-white">
	{primaryNavLabel}
	</span>
	<span className="text-[10px] font-medium text-emerald-400/80">
	{primaryNavDescription}
	</span>
	</div>

<div className="ml-auto flex items-center gap-1">
<div className="h-1.5 w-1.5 rounded-full bg-emerald-500 transition-transform duration-300 group-hover:scale-150" />
<div className="h-1.5 w-1.5 rounded-full bg-emerald-500/50 transition-transform duration-300 group-hover:scale-150 group-hover:delay-100" />
<div className="h-1.5 w-1.5 rounded-full bg-emerald-500/30 transition-transform duration-300 group-hover:scale-150 group-hover:delay-200" />
</div>

</div>

<div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-emerald-600 opacity-20 transition-opacity duration-300 group-hover:opacity-40" />

</div>

</button>

)}

	{pathname === "/supplier" && (
	<button
	onClick={()=>handleRoute("/")}
	className="group relative flex min-h-[2.35rem] min-w-[7rem] max-w-full cursor-pointer items-center justify-start rounded-full bg-white/10 py-1.5 shadow-[inset_1px_2px_5px_#00000080] transition-[background-color] duration-[0.8s] ease-[cubic-bezier(0.510,0.026,0.368,1.016)] hover:bg-green-400 sm:min-h-[2.92rem] sm:min-w-[8.5rem] sm:py-2"
	>

<div className="absolute inset-0 flex items-center justify-start px-1 py-0.5">

<div className="w-[0%] transition-all duration-[1s] ease-[cubic-bezier(0.510,0.026,0.368,1.016)] group-hover:w-full" />

<div className="flex h-full aspect-square items-center justify-center rounded-full bg-green-400 shadow-[inset_1px_-1px_3px_0_black] transition-all duration-[1s] ease-[cubic-bezier(0.510,0.026,0.368,1.016)] group-hover:bg-black">

<div className="size-[0.75rem] text-black transition-transform duration-[1s] ease-[cubic-bezier(0.510,0.026,0.368,1.016)] group-hover:-rotate-45 group-hover:text-white sm:size-[0.8rem]">

<svg viewBox="0 0 16 16" aria-hidden="true">
<path fill="currentColor" d="M12.175 9H0V7H12.175L6.575 1.4L8 0L16 8L8 16L6.575 14.6L12.175 9Z"/>
</svg>

</div>

</div>

</div>

<div className="pl-[2.8rem] pr-[0.8rem] text-xs text-black transition-[padding] duration-[1s] ease-[cubic-bezier(0.510,0.026,0.368,1.016)] group-hover:pl-[0.8rem] group-hover:pr-[2.8rem] group-hover:text-black dark:text-white dark:group-hover:text-black sm:pl-[3.4rem] sm:pr-[1.1rem] sm:text-sm sm:group-hover:pl-[1.1rem] sm:group-hover:pr-[3.4rem]">
User Home
</div>

</button>
)}

	{pathname === "/supplier" && (
	<button
	onClick={()=>handleRoute("/supplier/faq")}
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
	onClick={()=>handleRoute("/supplier/login")}
	className="px-4 py-2 rounded-full border border-gray-300 dark:border-white/20 bg-white/80 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10 transition"
	>
Login
</button>

	<button
	onClick={()=>handleRoute("/supplier/register")}
	className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:scale-105 transition"
	>
Sign Up
</button>

	</div>

	)}

	</div>

	<div className="relative md:hidden" ref={mobileMenuRef}>
	<button
	onClick={()=>setMobileMenuOpen((prev)=>!prev)}
	className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white/80 text-gray-700 transition hover:bg-gray-200 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
	aria-label="Open supplier navigation menu"
	aria-expanded={mobileMenuOpen}
	>
	<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
	<path d="M4 7h16M4 12h16M4 17h16"/>
	</svg>
	</button>

	{mobileMenuOpen && (
	<div className="absolute right-0 z-50 mt-3 w-[18rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white/90 p-3 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0f1423]/95">
	<div className="space-y-2">
	<button
	onClick={()=>handleRoute(primaryNavHref)}
	className="flex w-full items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2.5 text-left transition hover:bg-emerald-500/15"
	>
	<div className="leading-tight">
	<p className="text-sm font-semibold text-gray-900 dark:text-white">
	{primaryNavLabel}
	</p>
	<p className="text-[11px] text-emerald-600 dark:text-emerald-300/90">
	{primaryNavDescription}
	</p>
	</div>
	<span className="text-emerald-600 dark:text-emerald-300">
	<svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
	<path d="M5 12h14M13 5l7 7-7 7"/>
	</svg>
	</span>
	</button>

	{pathname === "/supplier" && (
	<button
	onClick={()=>handleRoute("/")}
	className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
	>
	<span>User Home</span>
	<span className="text-xs text-gray-400 dark:text-gray-500">Main site</span>
	</button>
	)}

	{pathname === "/supplier" && (
	<button
	onClick={()=>handleRoute("/supplier/faq")}
	className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-200 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
	>
	<span>Guide</span>
	<span className="text-xs text-gray-400 dark:text-gray-500">FAQ</span>
	</button>
	)}
	</div>

	{!user && (
	<div className="mt-3 grid grid-cols-2 gap-2">
	<button
	onClick={()=>handleRoute("/supplier/login")}
	className="rounded-xl border border-gray-300 bg-white/80 px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-200 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
	>
	Login
	</button>
	<button
	onClick={()=>handleRoute("/supplier/register")}
	className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-3 py-2 text-sm text-white transition hover:opacity-90"
	>
	Sign Up
	</button>
	</div>
	)}
	</div>
	)}
	</div>

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
&& failedAvatarUrl !== resolvedNavbarPhoto
? <img
src={resolvedNavbarPhoto}
alt={supplier?.name || "Supplier"}
className="w-full h-full object-cover"
onError={()=>setFailedAvatarUrl(resolvedNavbarPhoto)}
/>
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

{photoPreview && failedProfilePhotoUrl !== photoPreview ? (

<img
src={photoPreview}
alt={supplier.name || "Supplier"}
className="w-28 h-28 rounded-full object-cover
border border-white/40
shadow-xl"
onError={()=>setFailedProfilePhotoUrl(photoPreview)}
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
onClick={saveSupplierProfile}
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
sanitizeAvatarUrl(
supplier.displayPhotoURL ||
supplier.photoURL ||
supplier.firebasePhotoURL ||
""
)
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
