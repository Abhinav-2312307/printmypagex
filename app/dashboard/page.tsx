"use client"

import OrderForm from "@/components/OrderForm"
import Instructions from "@/components/Instructions"
import Pricing from "@/components/Pricing"
import Contact from "@/components/Contact"
import Link from "next/link"

export default function Dashboard() {

return (

<div>

<nav className="navbar">
<div className="nav-left">PrintMyPage</div>

<div className="nav-right">
<Link href="/orders">My Orders</Link>
<Link href="/profile">My Profile</Link>
<Link href="/">Instructions</Link>
</div>
</nav>

<div className="container">

<section className="hero">

<h1>Print Your Documents Easily</h1>
<p>Upload PDF and get it printed from PSIT PrintMyPage</p>

</section>

<OrderForm/>

<Pricing/>

<Instructions/>

<Contact/>

</div>

</div>

)

}