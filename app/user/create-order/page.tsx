"use client"

import { useState, useEffect, useRef, type FormEvent } from "react"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"
import RoleGuard from "@/components/RoleGuard"
import toast from "react-hot-toast"
import { authFetch } from "@/lib/client-auth"
import {
  isAcceptedUploadFile,
  requiresManualPageCount,
  UPLOAD_ACCEPT_ATTRIBUTE
} from "@/lib/upload-file"
import SupplierSelector, { type SupplierSelectorItem } from "@/components/SupplierSelector"
import OrderingPolicyCard from "@/components/OrderingPolicyCard"
import {
  PRINT_TYPE_CONTENT,
  PRINT_TYPE_KEYS
} from "@/lib/print-pricing"
import { usePrintPricing } from "@/lib/use-print-pricing"

export default function CreateOrderPage() {

  const [file, setFile] = useState<File | null>(null)
  const [printType, setPrintType] = useState("bw")
  const [requestType, setRequestType] = useState("global")
  const [supplier, setSupplier] = useState("")
  const [pageCount, setPageCount] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [suppliers, setSuppliers] = useState<SupplierSelectorItem[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { pricing } = usePrintPricing()

  useEffect(() => {
    let active = true

    if (requestType === "specific" && suppliers.length === 0) {
      authFetch("/api/supplier/list")
        .then(res => res.json())
        .then(data => {
          if (!active) return
          setSuppliers(data.suppliers || [])
          setLoadingSuppliers(false)
        })
        .catch(() => {
          if (!active) return
          setLoadingSuppliers(false)
        })
    }

    return () => {
      active = false
    }
  }, [requestType, suppliers.length])

  const handleRequestTypeChange = (nextValue: string) => {
    setRequestType(nextValue)

    if (nextValue === "specific" && suppliers.length === 0) {
      setLoadingSuppliers(true)
      return
    }

    if (nextValue !== "specific") {
      setLoadingSuppliers(false)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {

    e.preventDefault()

    if (!file) {
      toast.error("Nice try. But invisible files are not supported yet 😌")
      return
    }

    if (!isAcceptedUploadFile(file)) {
      toast.error("Upload PDF, DOC, DOCX, PNG, JPG or JPEG files only.")
      return
    }

    let manualPageCount = ""

    if (requiresManualPageCount(file)) {
      const parsedPageCount = Number.parseInt(pageCount, 10)

      if (!Number.isInteger(parsedPageCount) || parsedPageCount < 1) {
        toast.error("Enter a valid page count for DOC or DOCX files.")
        return
      }

      manualPageCount = String(parsedPageCount)
    }

    const user = auth.currentUser

    if (!user) return

    if (requestType === "specific" && !supplier) {
      toast.error("Select a supplier first.")
      return
    }

    setSubmitting(true)

    const formData = new FormData()
    const fallbackEmail = user.email || user.providerData?.[0]?.email || ""

    formData.append("file", file)
    formData.append("printType", printType)
    formData.append("firebaseUID", user.uid)
    formData.append("userEmail", fallbackEmail)
    formData.append("requestType", requestType)
    formData.append("supplier", supplier)

    if (manualPageCount) {
      formData.append("pageCount", manualPageCount)
    }

    const res = await authFetch("/api/upload", {
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
    setPageCount("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <RoleGuard role="USER">

      <Navbar />

      <div className="flex justify-center items-center py-20 px-6">

        <div className="w-full max-w-xl space-y-6">
          <OrderingPolicyCard />

          <div className="bg-card p-10 rounded-2xl shadow-lg">

            <div className="mb-8 flex flex-col gap-4">
              <div>
                <h1 className="text-3xl font-bold">
                  Create Print Order
                </h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                  The prices below are live and match the current admin-configured rates.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {PRINT_TYPE_KEYS.map((key) => (
                  <span
                    key={key}
                    className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                  >
                    {PRINT_TYPE_CONTENT[key].shortLabel}: ₹{pricing[key]}/page
                  </span>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

            <div>
              <label className="block mb-2 text-sm text-gray-400">
                Upload File
              </label>
              <input
                ref={fileInputRef}
                type="file"
                required
                accept={UPLOAD_ACCEPT_ATTRIBUTE}
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0] || null
                  setFile(selectedFile)

                  if (!requiresManualPageCount(selectedFile)) {
                    setPageCount("")
                  }
                }}
                className="w-full bg-dark p-3 rounded-lg border border-gray-700"
              />
              <p className="mt-2 text-xs text-gray-400">
                Accepted: PDF, DOC, DOCX, PNG, JPG, JPEG
              </p>
            </div>

            {requiresManualPageCount(file) && (
              <div>
                <label className="block mb-2 text-sm text-gray-400">
                  Page Count
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={pageCount}
                  onChange={(e) => setPageCount(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter total pages in document"
                  className="w-full bg-dark p-3 rounded-lg border border-gray-700"
                />
                <p className="mt-2 text-xs text-gray-400">
                  Required for DOC and DOCX because page count is entered manually.
                </p>
              </div>
            )}

            <div>
              <label className="block mb-2 text-sm text-gray-400">
                Print Type
              </label>
              <select
                value={printType}
                onChange={(e) => setPrintType(e.target.value)}
                className="w-full bg-dark p-3 rounded-lg border border-gray-700"
              >
                {PRINT_TYPE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {PRINT_TYPE_CONTENT[key].shortLabel} (₹{pricing[key]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block mb-2 text-sm text-gray-400">
                Request Type
              </label>
              <select
                value={requestType}
                onChange={(e) => handleRequestTypeChange(e.target.value)}
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
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400">
                      Owner accounts are highlighted with a premium legendary style.
                    </p>
                    <SupplierSelector
                      suppliers={suppliers}
                      value={supplier}
                      onChange={setSupplier}
                    />
                  </div>
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

      </div>

    </RoleGuard>
  )
}
