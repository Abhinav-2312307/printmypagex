"use client"

import { useState, useEffect, useRef } from "react"
import { auth } from "@/lib/firebase"
import { signOut, onAuthStateChanged, User } from "firebase/auth"
import { useRouter } from "next/navigation"
import { useTheme } from "next-themes"
import ProfileCard from "@/components/ProfileCard"
export default function Navbar() {

const router = useRouter()
const dropdownRef = useRef<HTMLDivElement>(null)

const [open,setOpen] = useState(false)
const [user,setUser] = useState<User | null>(null)
const [mounted,setMounted] = useState(false)

const {theme,setTheme} = useTheme()
const [showProfile,setShowProfile] = useState(false)
useEffect(()=>{
setMounted(true)
},[])

useEffect(()=>{
const unsubscribe = onAuthStateChanged(auth,(u)=>{
setUser(u)
})
return ()=>unsubscribe()
},[])

const userInitial =
user?.displayName?.charAt(0)?.toUpperCase() ||
user?.email?.charAt(0)?.toUpperCase() ||
"U"

const logout = async ()=>{
await signOut(auth)
router.push("/")
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

return(

<>

{/* Spacer so content doesn't hide behind navbar */}
<div className="h-28 md:h-32"/>

<div className="w-full flex justify-center fixed top-6 z-50">

<nav className="flex items-center justify-between px-12 py-4 w-[95%] max-w-[1400px] rounded-3xl backdrop-blur-3xl bg-white/70 dark:bg-black/40 border border-gray-200 dark:border-white/20 shadow-[0_8px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)] hover:scale-[1.01] transition-all duration-300">

{/* Logo */}

<h1
className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent cursor-pointer"
onClick={()=>router.push("/")}
>
PrintMyPage
</h1>

<div className="flex items-center gap-6">

{/* Pricing */}

<button
onClick={()=>router.push("/pricing")}
className="group relative flex items-center gap-2 px-5 py-2 rounded-full border border-gray-300 dark:border-white/20 bg-white/80 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-gray-200 hover:text-black dark:hover:text-white transition-all duration-300 hover:bg-gray-200 dark:hover:bg-white/10"
>

<span className="transition-all duration-300 group-hover:translate-x-[2px]">
Pricing
</span>

<svg
className="w-4 h-4 transition-all duration-300 group-hover:rotate-90 group-hover:translate-x-[3px]"
viewBox="0 0 16 19"
>
<path
d="M7 18C7 18.5523 7.44772 19 8 19C8.55228 19 9 18.5523 9 18H7ZM8.70711 0.292893C8.31658 -0.0976311 7.68342 -0.0976311 7.29289 0.292893L0.928932 6.65685C0.538408 7.04738 0.538408 7.68054 0.928932 8.07107C1.31946 8.46159 1.95262 8.46159 2.34315 8.07107L8 2.41421L13.6569 8.07107C14.0474 8.46159 14.6805 8.46159 15.0711 8.07107C15.4616 7.68054 15.4616 7.04738 15.0711 6.65685L8.70711 0.292893ZM9 18L9 1H7L7 18H9Z"
fill="currentColor"
/>
</svg>

</button>

{/* Contact */}

<button
onClick={()=>router.push("/contact")}
className="cursor-pointer relative
bg-white/80 dark:bg-white/5
backdrop-blur-md
border border-gray-300 dark:border-white/20
py-2 rounded-full min-w-[8.5rem] min-h-[2.8rem]
group flex items-center justify-start
hover:bg-emerald-400 dark:hover:bg-emerald-500
transition-all duration-[0.6s]
text-gray-700 dark:text-white"
>

<div className="absolute flex px-1 py-0.5 justify-start items-center inset-0">

<div className="w-[0%] group-hover:w-full transition-all duration-[0.8s]" />

<div className="rounded-full flex justify-center items-center h-full aspect-square bg-emerald-400 transition-all group-hover:bg-black dark:group-hover:bg-white">

<div className="size-[0.8rem] text-black dark:text-black group-hover:text-white dark:group-hover:text-black group-hover:-rotate-45 transition-all">

<svg viewBox="0 0 16 16">
<path fill="currentColor" d="M12.175 9H0V7H12.175L6.575 1.4L8 0L16 8L8 16L6.575 14.6L12.175 9Z"/>
</svg>

</div>
</div>
</div>

<div className="pl-[3.4rem] pr-[1.1rem] group-hover:pl-[1.1rem] group-hover:pr-[3.4rem]
transition-all
group-hover:text-black
dark:group-hover:text-white">
Contacts
</div>

</button>

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

{/* Auth */}

{user ? (

<div className="relative" ref={dropdownRef}>

<div
onClick={()=>setOpen(!open)}
className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center cursor-pointer text-black font-bold shadow-lg hover:scale-105 transition"
>
{userInitial}
</div>

{open && (

<div className="absolute right-0 mt-4 w-64 bg-white/80 dark:bg-white/10 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl p-4 space-y-4 z-50">

<div className="text-sm text-gray-700 dark:text-gray-300 border-b border-gray-300 dark:border-white/10 pb-2 break-all">
{user?.email}
</div>

<button
onClick={()=>{
setShowProfile(true)
setOpen(false)
}}
className="block w-full text-left hover:text-indigo-400 transition"
>
View Profile
</button>

<button onClick={()=>router.push("/user/orders")} className="block w-full text-left hover:text-indigo-400 transition">
My Orders
</button>

<button onClick={logout}
className="group flex items-center justify-start w-11 h-11
bg-gradient-to-br from-rose-500 to-red-600
rounded-full cursor-pointer relative overflow-hidden
transition-all duration-300
shadow-lg hover:w-32 hover:rounded-xl
active:translate-x-[1px] active:translate-y-[1px]
border border-white/20 backdrop-blur-md
hover:shadow-[0_6px_25px_rgba(255,0,80,0.45)]"
>

<div className="flex items-center justify-center w-full transition-all duration-300 group-hover:justify-start group-hover:px-3">

<svg className="w-4 h-4 text-white" viewBox="0 0 512 512" fill="currentColor">
<path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9z"/>
</svg>

</div>

<div className="absolute right-5 transform translate-x-full opacity-0
text-white text-sm font-semibold
transition-all duration-300
group-hover:translate-x-0 group-hover:opacity-100">

Logout

</div>

</button>

</div>

)}

</div>

) : (

<div className="flex items-center gap-3">

<button
onClick={()=>router.push("/user/login")}
className="px-4 py-2 rounded-full border border-gray-300 dark:border-white/20 bg-white/80 dark:bg-white/5 backdrop-blur-md text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10 transition"
>
Sign In
</button>

<button
onClick={()=>router.push("/user/register")}
className="px-4 py-2 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:scale-105 transition"
>
Register
</button>

</div>

)}

</div>

</nav>

</div>

{/* Profile Modal */}
{showProfile && user &&(

<div className="fixed inset-0 z-[100] flex items-center justify-center">

{/* background overlay */}
<div
className="absolute inset-0 bg-black/40 backdrop-blur-md"
onClick={()=>setShowProfile(false)}
/>

{/* modal */}
<div className="relative z-10 w-[520px] max-w-[95%]">

<ProfileCard
title="My Profile"
profile={{
name: user.displayName || "User",
email: user.email || "",
phone: user.phoneNumber || "",
rollNo: "2301640100018",
branch: "CSE",
section: "CS3C",
year: "3",
displayPhotoURL: user.photoURL || ""
}}
/>

</div>

</div>

)}

</>
)
}