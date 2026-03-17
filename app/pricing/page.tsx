import Navbar from "@/components/Navbar"

export default function PricingPage() {

const plans = [
{
title:"Black & White",
price:"₹2 / page",
desc:"Standard document printing",
features:[
"A4 printing",
"Clear text quality",
"Fast processing"
]
},
{
title:"Color Print",
price:"₹5 / page",
desc:"High quality color prints",
features:[
"Color graphics",
"Charts & diagrams",
"Project reports"
]
},
{
title:"Glossy Print",
price:"₹15 / page",
desc:"Premium glossy printing",
features:[
"Photos",
"Posters",
"Presentation covers"
]
}
]

return (

<div className="min-h-screen bg-gradient-to-br from-white via-gray-100 to-gray-200 dark:from-black dark:via-[#0b0b15] dark:to-black text-black dark:text-white">

<Navbar/>

<div className="max-w-7xl mx-auto px-6 py-24">

<h1 className="text-5xl font-bold text-center mb-6 bg-gradient-to-r from-indigo-400 to-purple-500 bg-clip-text text-transparent">
Simple Transparent Pricing
</h1>

<p className="text-center text-gray-600 dark:text-gray-400 mb-20 text-lg">
No hidden fees. Pay only for what you print.
</p>

<div className="grid md:grid-cols-3 gap-10">

{plans.map((plan,i)=>(
<div
key={i}
className="relative group backdrop-blur-xl bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-3xl p-10 shadow-xl hover:shadow-2xl transition duration-500 hover:scale-105 overflow-hidden"
>

{/* gradient glow */}
<div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 blur-2xl"></div>

<div className="relative z-10">

<h2 className="text-2xl font-semibold mb-2">
{plan.title}
</h2>

<p className="text-4xl font-bold text-indigo-500 mb-4">
{plan.price}
</p>

<p className="text-gray-600 dark:text-gray-400 mb-6">
{plan.desc}
</p>

<ul className="space-y-3 text-sm mb-8">

{plan.features.map((f,j)=>(
<li key={j} className="flex items-center gap-2">
<span className="text-green-400">✔</span>
{f}
</li>
))}

</ul>

</div>

</div>
))}

</div>

</div>

</div>

)
}
