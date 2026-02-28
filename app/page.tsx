"use client"

import Instructions from "@/components/Instructions"
import Pricing from "@/components/Pricing"
import OrderForm from "@/components/OrderForm"
import Contact from "@/components/Contact"

export default function Home() {
  return (
    <>
      <Instructions />

      <div className="welcome-section">
        <h1 className="welcome-text">Welcome to PrintMyPage</h1>
      </div>

      <div className="main-content visible">
        <Pricing />
        <OrderForm />
        <Contact />
      </div>
    </>
  )
}
