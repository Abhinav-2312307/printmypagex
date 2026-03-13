"use client"

import Navbar from "@/components/Navbar"
import SmoothScroll from "@/components/SmoothScroll"
import FeatureCard from "@/components/FeatureCard"
import OrderFlow from "@/components/OrderFlow"
import HeroBackground from "@/components/HeroBackground"
import Link from "next/link"
import CursorDepth from "@/components/CursorDepth"
export default function Home(){

return(

<main className="bg-transparent dark:bg-black text-gray-900 dark:text-white overflow-x-hidden">

<SmoothScroll/>
<CursorDepth/>
<Navbar
navButtons={[
{
label:"Pricing",
href:"/pricing",
variant:"glass"
},
{
label:"FAQ + Flow",
href:"/faq",
variant:"accent"
},
{
label:"Contact",
href:"/contact",
variant:"contact"
}
]}/>

{/* HERO */}

<section className="relative px-6 py-24 text-center sm:py-32 md:py-40">

<HeroBackground/>

<h1 className="relative text-4xl font-bold leading-tight sm:text-6xl md:text-7xl">

Your Campus Print Partner

<br/>

<span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">

Fast. Simple. Reliable.

</span>

</h1>

<p className="mx-auto mt-6 max-w-xl text-sm text-gray-600 dark:text-gray-400 sm:text-base">
Upload your documents today, pick up your prints tomorrow on campus.
</p>

<div className="mt-10 flex flex-wrap justify-center gap-4 sm:gap-6">

<Link
href="/user/dashboard"
className="rounded-2xl border border-white/20 bg-white/70 px-6 py-3 backdrop-blur-xl transition hover:scale-105 dark:bg-white/10 sm:px-8 sm:py-4"
>
Start Printing
</Link>

<Link
href="/supplier"
className="rounded-2xl border border-white/20 px-6 py-3 backdrop-blur-xl transition hover:bg-indigo-500 hover:text-white sm:px-8 sm:py-4"
>
Become Supplier
</Link>

</div>

</section>


{/* FEATURES */}

<section className="py-20 md:py-32">

<h2 className="mb-14 text-center text-3xl font-bold md:mb-20 md:text-4xl">
Why PrintMyPage
</h2>

<div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3 md:gap-10">

<FeatureCard
title="Instant Matching"
desc="Your order instantly reaches all campus suppliers — or choose your favorite ❤️ one."
direction="left"
/>

<FeatureCard
title="Live Tracking"
desc="Track the print progress in real time."
direction="bottom"
/>

<FeatureCard
title="Affordable Printing"
desc="Transparent campus pricing."
direction="right"
/>

</div>

</section>


{/* ORDER FLOW */}

<OrderFlow/>


{/* PRICING */}

<section className="py-20 md:py-32">

<h2 className="mb-12 text-center text-3xl font-bold md:mb-16 md:text-4xl">
Pricing
</h2>

<div className="flex flex-wrap justify-center gap-6 md:gap-10">

{[
{type:"Black & White",price:"₹2/page"},
{type:"Color",price:"₹5/page"},
{type:"Glossy",price:"₹15/page"}
].map((item,i)=>(

<div
key={i}
className="w-full max-w-[16rem] rounded-3xl border border-gray-200 bg-white/60 p-7 text-center shadow-xl backdrop-blur-xl transition hover:scale-105 dark:border-white/20 dark:bg-white/5 sm:p-10 md:w-64"
>

<h3 className="text-xl font-semibold mb-3">
{item.type}
</h3>

<p className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
{item.price}
</p>

</div>

))}

</div>

</section>


{/* CTA */}

<section className="py-24 text-center md:py-40">

<h2 className="mb-6 text-3xl font-bold md:text-4xl">
Start Printing Today
</h2>

<p className="text-gray-500 mb-8">
Fast campus printing in seconds.
</p>

<Link
href="/user/dashboard"
className="rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-8 py-3 text-white transition hover:scale-105 sm:px-10 sm:py-4"
>
Create Order
</Link>

</section>


<footer className="border-t border-gray-200 dark:border-gray-800 py-10 text-center text-gray-500">

© {new Date().getFullYear()} PrintMyPage

</footer>

</main>

)
}
