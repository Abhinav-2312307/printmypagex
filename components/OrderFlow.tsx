"use client"

import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

gsap.registerPlugin(ScrollTrigger)

const steps=[
"Create Order",
"Order Accepted",
"Payment",
"Printing Starts",
"Delivered"
]

export default function OrderFlow(){

const container=useRef<HTMLDivElement>(null)

useEffect(()=>{

const cards = gsap.utils.toArray(".flow-card")

cards.forEach((card:any,i)=>{

gsap.from(card,{
opacity:0,
y:100,
duration:0.8,
ease:"power3.out",
scrollTrigger:{
trigger:card,
start:"top 85%"
}
})

})

},[])

return(

<section className="py-40">

<h2 className="text-4xl font-bold text-center mb-24">
How Printing Works
</h2>

<div
ref={container}
className="relative max-w-4xl mx-auto"
>

<div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-gradient-to-b from-indigo-400 to-cyan-400"/>

{steps.map((step,i)=>{

const left=i%2===0

return(

<div
key={i}
className={`flow-card flex ${left?"justify-start":"justify-end"} mb-20`}
>

<div className="w-[45%] backdrop-blur-xl bg-white/60 dark:bg-white/5 border border-gray-200 dark:border-white/20 rounded-xl p-6 shadow-xl">

<h3 className="text-lg font-semibold text-indigo-400 mb-1">
{step}
</h3>

<p className="text-gray-500">
Step {i+1}
</p>

</div>

</div>

)

})}

</div>

</section>

)
}