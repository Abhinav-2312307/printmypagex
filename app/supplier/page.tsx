"use client"

import { useEffect, useState } from "react"
import { auth } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import Link from "next/link"

export default function SupplierHome(){

const [user,setUser] = useState<any>(null)

useEffect(()=>{

const unsub = onAuthStateChanged(auth,(u)=>{
setUser(u)
})

return ()=>unsub()

},[])

return(

<div className="max-w-6xl mx-auto py-16 px-6 space-y-16">

{/* Hero */}

<section className="space-y-6">

<h1 className="text-5xl font-bold text-gradient">
Welcome to the Supplier Portal
</h1>

<p className="text-white/70 text-lg max-w-2xl">
Accept printing requests from students, complete orders,
and earn money directly from your campus printing service.
Manage everything in one place.
</p>

<div className="flex gap-4 mt-6">
<Link href={user ? "/supplier/dashboard" : "/supplier/login"} className="px-6 py-3 bg-primary rounded-xl hover:scale-105 transition">
Go to Dashboard
</Link>

<Link
href="/supplier/orders"
className="px-6 py-3 border border-white/20 rounded-xl hover:bg-white/10"
>
View Orders
</Link>

</div>

</section>


{/* Features */}

<section className="grid md:grid-cols-3 gap-6">

<div className="bg-card p-8 rounded-2xl border border-white/10">

<h3 className="text-xl font-semibold mb-2">
📄 Accept Orders
</h3>

<p className="text-white/60">
View available print requests from students
and accept orders instantly.
</p>

</div>

<div className="bg-card p-8 rounded-2xl border border-white/10">

<h3 className="text-xl font-semibold mb-2">
⚡ Real-time Updates
</h3>

<p className="text-white/60">
Orders appear instantly when students upload
documents for printing.
</p>

</div>

<div className="bg-card p-8 rounded-2xl border border-white/10">

<h3 className="text-xl font-semibold mb-2">
💰 Earn Money
</h3>

<p className="text-white/60">
Get paid for each page you print
while helping students on campus.
</p>

</div>

</section>


{/* How it works */}

<section className="space-y-8">

<h2 className="text-3xl font-bold">
How the Supplier System Works
</h2>

<div className="grid md:grid-cols-4 gap-6">

<div className="bg-card p-6 rounded-xl border border-white/10">
<h4 className="font-semibold">1. Student Uploads</h4>
<p className="text-sm text-white/60">
Students upload documents they need printed.
</p>
</div>

<div className="bg-card p-6 rounded-xl border border-white/10">
<h4 className="font-semibold">2. You Accept</h4>
<p className="text-sm text-white/60">
Suppliers accept available printing orders.
</p>
</div>

<div className="bg-card p-6 rounded-xl border border-white/10">
<h4 className="font-semibold">3. Print Document</h4>
<p className="text-sm text-white/60">
Print the document according to order details.
</p>
</div>

<div className="bg-card p-6 rounded-xl border border-white/10">
<h4 className="font-semibold">4. Deliver</h4>
<p className="text-sm text-white/60">
Hand over the printed document to the student.
</p>
</div>

</div>

</section>


{/* Tips */}

<section className="bg-card p-8 rounded-2xl border border-white/10">

<h2 className="text-2xl font-bold mb-4">
Supplier Tips
</h2>

<ul className="space-y-2 text-white/70">

<li>• Keep your printer ready for quick order acceptance.</li>
<li>• Accept orders fast to increase your earnings.</li>
<li>• Make sure prints are clear and correctly formatted.</li>
<li>• Stay active to receive more order opportunities.</li>

</ul>

</section>

</div>

)

}