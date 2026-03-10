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

<main className="bg-white dark:bg-black text-gray-900 dark:text-white overflow-x-hidden">

<SmoothScroll/>
<CursorDepth/>
<Navbar/>

{/* HERO */}

<section className="relative py-40 text-center px-6">

<HeroBackground/>

<h1 className="relative text-6xl md:text-7xl font-bold">

Your Campus Print Partner

<br/>

<span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">

Fast. Simple. Reliable.

</span>

</h1>

<p className="mt-6 text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
Upload your documents today, pick up your prints tomorrow on campus.
</p>

<div className="mt-10 flex justify-center gap-6 flex-wrap">

<Link
href="/user/dashboard"
className="px-8 py-4 rounded-2xl backdrop-blur-xl bg-white/70 dark:bg-white/10 border border-white/20 hover:scale-105 transition"
>
Start Printing
</Link>

<Link
href="/supplier"
className="px-8 py-4 rounded-2xl border border-white/20 backdrop-blur-xl hover:bg-indigo-500 hover:text-white transition"
>
Become Supplier
</Link>

</div>

</section>


{/* FEATURES */}

<section className="py-32">

<h2 className="text-4xl font-bold text-center mb-20">
Why PrintMyPage
</h2>

<div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-10 px-6">

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

<section className="py-32">

<h2 className="text-4xl font-bold text-center mb-16">
Pricing
</h2>

<div className="flex justify-center gap-10 flex-wrap">

{[
{type:"Black & White",price:"₹2/page"},
{type:"Color",price:"₹5/page"},
{type:"Glossy",price:"₹15/page"}
].map((item,i)=>(

<div
key={i}
className="backdrop-blur-xl bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-3xl p-10 w-64 text-center shadow-xl hover:scale-105 transition"
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

<section className="py-40 text-center">

<h2 className="text-4xl font-bold mb-6">
Start Printing Today
</h2>

<p className="text-gray-500 mb-8">
Fast campus printing in seconds.
</p>

<Link
href="/user/dashboard"
className="px-10 py-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white hover:scale-105 transition"
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