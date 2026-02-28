"use client"

import { useState } from "react"
import { auth } from "@/lib/firebase"

export default function CreateOrderPage() {

  const [file, setFile] = useState<File | null>(null)
  const [printType, setPrintType] = useState("bw")

  const handleSubmit = async (e:any) => {

    e.preventDefault()

    if (!file) {
      alert("Please upload a file")
      return
    }

    const user = auth.currentUser

    if (!user) {
      alert("Please login first")
      return
    }

    const formData = new FormData()

    formData.append("file", file)
    formData.append("printType", printType)
    formData.append("firebaseUID", user.uid)

    const res = await fetch("/api/upload", {
      method:"POST",
      body:formData
    })

    const data = await res.json()

    alert(`Pages: ${data.pages} | Price: ₹${data.price}`)
  }

  return (

    <div className="create-order-container">

      <div className="order-card">

        <h1>Create Print Order</h1>

        <form onSubmit={handleSubmit}>

          <input
            type="file"
            className="file-input"
            onChange={(e)=>setFile(e.target.files?.[0] || null)}
          />

          <select
            className="print-select"
            value={printType}
            onChange={(e)=>setPrintType(e.target.value)}
          >

            <option value="bw">Black & White (₹2)</option>
            <option value="color">Color (₹5)</option>
            <option value="glossy">Glossy (₹15)</option>

          </select>

          <button className="order-btn" type="submit">
            Create Order
          </button>

        </form>

      </div>

    </div>

  )
}