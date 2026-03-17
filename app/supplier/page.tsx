"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged, type User } from "firebase/auth"
import Link from "next/link"
import HeroBackground from "@/components/HeroBackground"
import ScrollParallax from "@/components/ScrollParallax"

export default function SupplierHome(){

const [user,setUser] = useState<User | null>(null)

useEffect(()=>{

const unsub = onAuthStateChanged(auth,(u)=>{
setUser(u)
})

return ()=>unsub()

},[])

return(

<main className="bg-transparent dark:bg-black text-gray-900 dark:text-white overflow-x-hidden">

<ScrollParallax/>

{/* HERO */}

<section className="relative py-40 px-6 text-center
bg-gradient-to-b
from-sky-50
via-indigo-50/40
to-cyan-50/60
dark:from-black
dark:via-black
dark:to-black">

<HeroBackground/>

<h1 className="relative text-6xl md:text-7xl font-bold">

Supplier Portal

<br/>

<span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">

Print. Earn. Grow.

</span>

</h1>

<p className="mt-6 text-gray-600 dark:text-gray-400 max-w-2xl mx-auto text-lg">
Accept student printing requests, complete orders, and earn money
while helping your campus community print documents easily.
</p>

<div className="mt-12 flex justify-center gap-6 flex-wrap">

<Link
href={user ? "/supplier/dashboard" : "/supplier/login"}
className="px-10 py-4 rounded-2xl
bg-white/90 dark:bg-white/10
border border-gray-200 dark:border-white/20
backdrop-blur-xl
hover:scale-105
hover:shadow-[0_6px_20px_rgba(80,120,255,0.35)]
hover:shadow-[0_8px_30px_rgba(80,120,255,0.35)]
transition-all duration-300"
>

Go to Dashboard

</Link>

<Link
href="/supplier/orders"
className="px-10 py-4 rounded-2xl
bg-white/80 dark:bg-white/5
border border-gray-200 dark:border-white/20
backdrop-blur-xl
hover:bg-indigo-500
hover:text-white
hover:scale-105
hover:shadow-[0_6px_20px_rgba(80,120,255,0.35)]
hover:shadow-[0_8px_30px_rgba(80,120,255,0.35)]
transition-all duration-300"
>

View Orders

</Link>

</div>

</section>


{/* FEATURES */}

<section className="py-32">

<h2 className="text-4xl font-bold text-center mb-20">
Supplier Features
</h2>

<div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10 px-6">

{[
{
title:"Accept Orders",
icon:"📄",
desc:"Receive print requests from students across campus and accept them instantly."
},
{
title:"Real-time Requests",
icon:"⚡",
desc:"Orders appear immediately when students upload documents."
},
{
title:"Earn from Printing",
icon:"💰",
desc:"Get paid for each page printed while helping students."
}
].map((item,i)=>(

<div
key={i}
className="group
backdrop-blur-xl
bg-white/90 dark:bg-white/5
border border-gray-200 dark:border-white/20
rounded-3xl
p-10
shadow-[0_10px_35px_rgba(0,0,0,0.08)]
dark:shadow-none
hover:scale-[1.05]
hover:-translate-y-1
hover:shadow-[0_10px_40px_rgba(80,120,255,0.25)]
transition-all duration-500"
>

<div className="text-4xl mb-4">
{item.icon}
</div>

<h3 className="text-xl font-semibold mb-3">
{item.title}
</h3>

<p className="text-gray-600 dark:text-gray-400">
{item.desc}
</p>

</div>

))}

</div>

</section>


{/* HOW IT WORKS */}

<section className="py-32">

<h2 className="text-4xl font-bold text-center mb-20">
How the Supplier System Works
</h2>

<div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8 px-6">

{[
{
step:"1",
title:"Student Uploads",
desc:"Students upload documents they need printed."
},
{
step:"2",
title:"You Accept",
desc:"Suppliers accept the available printing request."
},
{
step:"3",
title:"Print Document",
desc:"Print the document according to the order details."
},
{
step:"4",
title:"Deliver",
desc:"Hand the printed document to the student on campus."
}
].map((item,i)=>(

<div
key={i}
className="relative group
backdrop-blur-xl
bg-white/90 dark:bg-white/5
border border-gray-200 dark:border-white/20
rounded-3xl
p-8
shadow-[0_10px_35px_rgba(0,0,0,0.08)]
dark:shadow-none
hover:scale-[1.06]
hover:-translate-y-2
hover:shadow-[0_10px_40px_rgba(80,120,255,0.25)]
transition-all duration-500"
>

<div className="absolute -top-5 left-6 w-10 h-10 rounded-full
bg-gradient-to-r from-indigo-400 to-cyan-400
flex items-center justify-center
text-black font-bold shadow-lg">

{item.step}

</div>

<h4 className="font-semibold mt-4 mb-2">
{item.title}
</h4>

<p className="text-sm text-gray-600 dark:text-gray-400">
{item.desc}
</p>

</div>

))}

</div>

</section>


{/* TIPS */}

<section className="py-32 px-6">

<div className="max-w-4xl mx-auto
backdrop-blur-xl
bg-white/90 dark:bg-white/5
border border-gray-200 dark:border-white/20
rounded-3xl
p-12
shadow-[0_10px_35px_rgba(0,0,0,0.08)]
dark:shadow-none
hover:shadow-[0_10px_40px_rgba(80,120,255,0.25)]
transition-all duration-500">

<h2 className="text-3xl font-bold mb-6">
Supplier Tips
</h2>

<ul className="space-y-3 text-gray-600 dark:text-gray-400 text-lg">

<li>• Keep your printer ready for quick order acceptance.</li>
<li>• Accept orders fast to increase earnings.</li>
<li>• Always verify document settings before printing.</li>
<li>• Stay active to receive more opportunities.</li>
<li>• Provide clean and properly aligned prints.</li>

</ul>

</div>

</section>


{/* CTA */}

<section className="py-40 text-center">

<h2 className="text-4xl font-bold mb-6">
Start Accepting Orders
</h2>

<p className="text-gray-500 mb-8">
Turn your printer into a campus business.
</p>

<Link
href={user ? "/supplier/dashboard" : "/supplier/login"}
className="px-12 py-5 rounded-2xl
bg-gradient-to-r from-indigo-500 to-cyan-500
text-white
hover:scale-105
hover:shadow-[0_6px_20px_rgba(80,120,255,0.35)]
hover:shadow-[0_10px_35px_rgba(80,120,255,0.4)]
transition-all duration-300"
>

Become a Supplier

</Link>

</section>


<footer className="border-t border-gray-200 dark:border-gray-800 py-10 text-center text-gray-500">

© {new Date().getFullYear()} PrintMyPage Supplier Portal

</footer>

</main>

)

}
