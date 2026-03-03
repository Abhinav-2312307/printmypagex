"use client"

import { useState, useEffect } from "react"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"
import AuthGuard from "@/components/AuthGuard"
import toast from "react-hot-toast"

export default function CreateOrderPage() {

  const [file, setFile] = useState<File | null>(null)
  const [printType, setPrintType] = useState("bw")
  const [requestType, setRequestType] = useState("global")
  const [supplier, setSupplier] = useState("")

  const [suppliers, setSuppliers] = useState<any[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {

    if (requestType === "specific") {

      setLoadingSuppliers(true)

      fetch("/api/supplier/list")
        .then(res => res.json())
        .then(data => {
          setSuppliers(data.suppliers || [])
          setLoadingSuppliers(false)
        })
        .catch(() => setLoadingSuppliers(false))
    }

  }, [requestType])

  const handleSubmit = async (e: any) => {

    e.preventDefault()

    if (!file) {
      toast.error("Nice try. But invisible files are not supported yet 😌")
      return
    }

    const user = auth.currentUser

    if (!user) return

    setSubmitting(true)

    const formData = new FormData()

    formData.append("file", file)
    formData.append("printType", printType)
    formData.append("firebaseUID", user.uid)
    formData.append("requestType", requestType)
    formData.append("supplier", supplier)

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData
    })

    const data = await res.json()

    setSubmitting(false)

    if (data.error) {
      toast.error(data.error)

      return
    }
    
    toast.success(`Pages: ${data.pages} | Estimated Price: ₹${data.estimatedPrice}`)
    setFile(null)
  }

  return (
    <AuthGuard>

      <Navbar />

      <div className="flex justify-center items-center py-20 px-6">

        <div className="bg-card w-full max-w-xl p-10 rounded-2xl shadow-lg">

          <h1 className="text-3xl font-bold mb-8">
            Create Print Order
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">

            <div>
              <label className="block mb-2 text-sm text-gray-400">
                Upload File
              </label>
              <input
                type="file"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="w-full bg-dark p-3 rounded-lg border border-gray-700"
              />
            </div>

            <div>
              <label className="block mb-2 text-sm text-gray-400">
                Print Type
              </label>
              <select
                value={printType}
                onChange={(e) => setPrintType(e.target.value)}
                className="w-full bg-dark p-3 rounded-lg border border-gray-700"
              >
                <option value="bw">Black & White (₹2)</option>
                <option value="color">Color (₹5)</option>
                <option value="glossy">Glossy (₹15)</option>
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm text-gray-400">
                Request Type
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className="w-full bg-dark p-3 rounded-lg border border-gray-700"
              >
                <option value="global">Global Request</option>
                <option value="specific">Specific Supplier</option>
              </select>
            </div>

            {requestType === "specific" && (
              <div>
                <label className="block mb-2 text-sm text-gray-400">
                  Select Supplier
                </label>

                {loadingSuppliers ? (
                  <p className="text-gray-400">Loading suppliers...</p>
                ) : (
                  <select
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    required
                    className="w-full bg-dark p-3 rounded-lg border border-gray-700"
                  >
                    <option value="">
                      Select Supplier
                    </option>

                    {suppliers.map((s) => (
                      <option
                        key={s.firebaseUID}
                        value={s.firebaseUID}
                      >
                        {s.name} | {s.branch} Year {s.year}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary text-black rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Processing..." : "Create Order"}
            </button>

          </form>

        </div>

      </div>

    </AuthGuard>
  )
}