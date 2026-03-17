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

CS3C – CS3H (Hidden Goals)

<br/>

No fixed location 😅  
Usually sprinting between lectures trying to secure the last bench seat.

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
