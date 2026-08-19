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

<h3 className="text-lg font-semibold mb-1 group-hover:text-indigo-400 transition">
Quick Chat
</h3>

<a
href="https://wa.me/919793404007"
target="_blank"
rel="noopener noreferrer"
className="
inline-flex items-center gap-2.5
mt-1 px-4 py-2
rounded-xl
backdrop-blur-xl
bg-white/5
border border-white/10
text-gray-400
hover:text-white
hover:border-indigo-400/40
hover:bg-white/10
hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]
hover:scale-[1.03]
hover:-translate-y-[1px]
active:scale-[0.98]
transition-all duration-300
ease-[cubic-bezier(.34,1.56,.64,1)]
group/wa
text-sm
"
>

{/* WhatsApp icon with subtle green accent */}
<svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 shrink-0 transition-transform duration-300 group-hover/wa:rotate-[-8deg]">
<path
d="M12 2C6.48 2 2 6.24 2 11.38c0 2.72 1.36 5.16 3.5 6.82L4.6 22l4.08-2.1c1 .28 2.14.44 3.32.44 5.52 0 10-4.24 10-9.38S17.52 2 12 2Z"
className="fill-emerald-400/80 group-hover/wa:fill-emerald-400 transition-colors duration-300"
/>
<path
d="M16.5 14.2c-.42-.22-2.52-1.24-2.92-1.38-.4-.15-.68-.22-.96.22-.28.43-1.12 1.38-1.37 1.67-.25.28-.5.24-.93.03-.42-.22-1.8-.67-3.43-2.12-1.27-1.13-2.12-2.53-2.37-2.96-.25-.43-.03-.66.19-.87.2-.2.42-.5.64-.75.2-.25.28-.43.42-.71.15-.28.07-.53-.03-.75-.1-.21-.96-2.32-1.32-3.18-.35-.84-.7-.73-.96-.74h-.56c-.25 0-.66.1-1 .46-.35.36-1.32 1.28-1.32 3.13s1.35 3.63 1.54 3.88c.19.25 2.65 4.04 6.42 5.67.9.39 1.6.62 2.14.8.9.28 1.72.24 2.37.15.72-.1 2.23-.91 2.55-1.79.31-.88.31-1.64.22-1.79-.1-.16-.38-.25-.8-.46Z"
fill="white"
/>
</svg>

<span className="font-medium tracking-wide">
DM on WhatsApp
</span>

<span className="text-[10px] text-gray-600 group-hover/wa:text-gray-400 transition-colors">
↗
</span>

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
