import Navbar from "@/components/Navbar"
import ContactFormCard from "@/components/ContactFormCard"
import CreatorFooter from "@/components/CreatorFooter"

export default function ContactPage(){
const contactNavButtons = [
  {
    label: "Pricing",
    href: "/pricing",
    variant: "glass" as const
  },
  {
    label: "Feedback",
    href: "/feedback",
    variant: "contact" as const
  }
]

return(

<div className="min-h-screen bg-transparent dark:bg-black text-gray-900 dark:text-white overflow-x-hidden">

<Navbar navButtons={contactNavButtons}/>

{/* background glow */}

<div className="fixed inset-0 -z-10 pointer-events-none">

<div className="absolute top-40 left-20 w-96 h-96 bg-indigo-500/20 blur-[120px] rounded-full"/>

<div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-500/20 blur-[120px] rounded-full"/>

</div>


<div className="max-w-6xl mx-auto px-6 py-19">

{/* TITLE */}

<div className="text-center mb-16">

<h1 className="text-5xl md:text-6xl font-bold">

Contact{" "}

<span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
PrintMyPage
</span>

</h1>

<p className="mt-6 text-gray-500 dark:text-gray-400 max-w-xl mx-auto">

Questions about orders, suppliers , or some other doubt ?  
Send us a message and we&apos;ll help you out.

</p>

</div>


{/* MAIN GRID */}

<div className="grid md:grid-cols-2 gap-14 items-start">


{/* CONTACT INFO */}

<div className="
backdrop-blur-2xl
bg-white/70 dark:bg-white/5
border border-gray-200 dark:border-white/10
rounded-3xl
p-10
shadow-xl
hover:shadow-[0_25px_60px_rgba(0,0,0,0.35)]
transition-all duration-300
ease-[cubic-bezier(.34,1.56,.64,1)]
hover:scale-[1.03]
hover:-translate-y-1
active:scale-[0.98]
">
<h2 className="text-2xl font-semibold mb-8">

Contact Information

</h2>

<div className="space-y-8">

<div className="group">

<h3 className="text-lg font-semibold mb-1 group-hover:text-indigo-400 transition">
Email
</h3>

<p className="text-gray-500 dark:text-gray-400 break-all">
printmypagepsit@gmail.com
</p>

</div>


<div className="group">

<h3 className="text-lg font-semibold mb-1 group-hover:text-indigo-400 transition">
Campus Pickup
</h3>

<p className="text-gray-500 dark:text-gray-400 leading-relaxed">

CS-4D

<br/>

No fixed location 😅  
Usually sprinting between lectures trying to secure the last bench.

</p>

</div>


<div className="group">

<h3 className="text-lg font-semibold mb-1 group-hover:text-indigo-400 transition">
Support Hours
</h3>

<p className="text-gray-500 dark:text-gray-400">
9 AM – 5 PM (Campus Days)
</p>

</div>


<div className="group">

<h3 className="text-lg font-semibold mb-1 group-hover:text-green-400 transition">
Quick Chat
</h3>

<p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
DM us directly on WhatsApp for instant help
</p>

<a
href="https://wa.me/919793404007"
target="_blank"
rel="noopener noreferrer"
className="
relative
inline-flex items-center gap-3
px-5 py-3
rounded-2xl
bg-gradient-to-br from-green-400 to-emerald-500
text-white font-semibold text-sm
shadow-[0_4px_25px_rgba(37,211,102,0.35)]
hover:shadow-[0_8px_40px_rgba(37,211,102,0.55)]
hover:scale-105
hover:-translate-y-[2px]
active:scale-95
transition-all duration-300
ease-[cubic-bezier(.34,1.56,.64,1)]
group/wa
overflow-hidden
"
>

{/* Animated pulse ring behind logo */}
<span className="
absolute left-[18px]
w-9 h-9
rounded-full
bg-white/20
animate-ping
pointer-events-none
"/>

{/* Custom WhatsApp SVG Logo — rounded square style with chat bubble accent */}
<span className="
relative
w-9 h-9
flex items-center justify-center
rounded-xl
bg-white/20
backdrop-blur-sm
border border-white/30
transition-all duration-300
group-hover/wa:rotate-[8deg]
group-hover/wa:bg-white/30
shrink-0
">
<svg viewBox="0 0 32 32" fill="none" className="w-5 h-5">
{/* Outer speech-bubble shape */}
<path
d="M16 3C8.82 3 3 8.28 3 14.82c0 3.72 1.84 7.06 4.74 9.32L6.5 29l5.24-2.72c1.34.38 2.78.58 4.26.58 7.18 0 13-5.28 13-11.82S23.18 3 16 3Z"
fill="white"
fillOpacity="0.95"
/>
{/* Phone icon inside */}
<path
d="M21.36 18.73c-.58-.29-3.44-1.7-3.98-1.89-.54-.2-.93-.29-1.32.29-.39.58-1.52 1.89-1.87 2.28-.34.39-.69.33-1.27.04-.58-.29-2.46-.91-4.69-2.9-1.73-1.55-2.9-3.46-3.24-4.04-.34-.58-.04-.9.26-1.19.27-.26.58-.68.87-1.02.29-.34.39-.58.58-.97.2-.39.1-.73-.05-1.02-.15-.29-1.32-3.18-1.81-4.36-.48-1.14-.96-1-.1.32-1H9.45c-.34 0-.9.13-1.37.63s-1.8 1.76-1.8 4.29 1.84 4.97 2.1 5.31c.26.34 3.62 5.53 8.77 7.76 1.23.53 2.18.85 2.93 1.09 1.23.39 2.35.33 3.24.2.99-.15 3.05-1.25 3.48-2.45.43-1.21.43-2.24.3-2.45-.13-.22-.52-.34-1.1-.63Z"
fill="#25D366"
/>
</svg>
</span>

<span className="relative z-10 tracking-wide">
WhatsApp Us
</span>

{/* Shimmer sweep effect */}
<span className="
absolute inset-0
bg-gradient-to-r from-transparent via-white/20 to-transparent
translate-x-[-200%]
group-hover/wa:translate-x-[200%]
transition-transform duration-700
ease-out
pointer-events-none
"/>

</a>

</div>

</div>

</div>


{/* CONTACT FORM */}

<div className="flex justify-center">

<ContactFormCard/>

</div>

</div>


{/* FOOTER */}

<div className="mt-[2.9rem]">

<CreatorFooter/>
<br />
</div>

</div>

</div>


)
}
