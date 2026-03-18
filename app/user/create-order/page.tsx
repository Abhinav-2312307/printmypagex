"use client"

import { useState, useEffect, useRef, type FormEvent } from "react"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"
import RoleGuard from "@/components/RoleGuard"
import toast from "react-hot-toast"
import { authFetch, authUploadWithProgress } from "@/lib/client-auth"
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

type UploadProgressState = {
  stage: "uploading" | "processing"
  startedAt: number
  loaded: number
  total: number | null
  speedBytesPerSecond: number | null
}

type UploadResponseData = {
  error?: string
  estimatedPrice?: number
  pages?: number
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"

  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function formatElapsedTime(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function getUploadProgressPercent(progress: UploadProgressState | null) {
  if (!progress?.total || progress.total <= 0) {
    return progress?.stage === "processing" ? 100 : null
  }

  return Math.min(100, Math.round((progress.loaded / progress.total) * 100))
}

export default function CreateOrderPage() {

  const [file, setFile] = useState<File | null>(null)
  const [printType, setPrintType] = useState("bw")
  const [requestType, setRequestType] = useState("global")
  const [supplier, setSupplier] = useState("")
  const [pageCount, setPageCount] = useState("")
  const [instruction, setInstruction] = useState("")
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [suppliers, setSuppliers] = useState<SupplierSelectorItem[]>([])
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState | null>(null)
  const [elapsedUploadTime, setElapsedUploadTime] = useState(0)
  const { pricing } = usePrintPricing()
  const uploadStartedAt = uploadProgress?.startedAt ?? null

  useEffect(() => {
    if (uploadStartedAt === null) {
      setElapsedUploadTime(0)
      return
    }

    const syncElapsedTime = () => {
      setElapsedUploadTime(Date.now() - uploadStartedAt)
    }

    syncElapsedTime()
    const timer = window.setInterval(syncElapsedTime, 500)

    return () => {
      window.clearInterval(timer)
    }
  }, [uploadStartedAt])

  const uploadPercent = getUploadProgressPercent(uploadProgress)

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
    const startedAt = Date.now()
    let lastLoaded = 0
    let lastMeasuredAt = startedAt
    let lastSpeedBytesPerSecond: number | null = null
    setUploadProgress({
      stage: "uploading",
      startedAt,
      loaded: 0,
      total: null,
      speedBytesPerSecond: null
    })

    const formData = new FormData()
    const fallbackEmail = user.email || user.providerData?.[0]?.email || ""

    formData.append("file", file)
    formData.append("printType", printType)
    formData.append("firebaseUID", user.uid)
    formData.append("userEmail", fallbackEmail)
    formData.append("requestType", requestType)
    formData.append("supplier", supplier)
    formData.append("instruction", instruction.trim())

    if (manualPageCount) {
      formData.append("pageCount", manualPageCount)
    }

    try {
      const res = await authUploadWithProgress(
        "/api/upload",
        {
          method: "POST",
          body: formData
        },
        {
          onUploadProgress: ({ loaded, total }) => {
            const now = Date.now()
            const elapsedSinceLastMeasure = now - lastMeasuredAt

            if (elapsedSinceLastMeasure > 0) {
              const nextSpeed = ((loaded - lastLoaded) * 1000) / elapsedSinceLastMeasure

              if (Number.isFinite(nextSpeed) && nextSpeed > 0) {
                lastSpeedBytesPerSecond = nextSpeed
              }
            }

            lastLoaded = loaded
            lastMeasuredAt = now
            setUploadProgress({
              stage: "uploading",
              startedAt,
              loaded,
              total,
              speedBytesPerSecond: lastSpeedBytesPerSecond
            })
          },
          onUploadComplete: () => {
            setUploadProgress((current) => {
              if (!current) {
                return {
                  stage: "processing",
                  startedAt,
                  loaded: lastLoaded,
                  total: lastLoaded || null,
                  speedBytesPerSecond: null
                }
              }

              const completedBytes = current.total ?? current.loaded

              return {
                ...current,
                stage: "processing",
                loaded: completedBytes,
                total: current.total ?? (completedBytes || null),
                speedBytesPerSecond: null
              }
            })
          }
        }
      )

      const data = await res.json() as UploadResponseData

      if (!res.ok || data.error) {
        toast.error(data.error || "Upload failed")
        return
      }

      toast.success(`Pages: ${data.pages} | Estimated Price: ₹${data.estimatedPrice}`)
      setFile(null)
      setPageCount("")
      setInstruction("")
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setSubmitting(false)
      setUploadProgress(null)
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

            <div>
              <label className="block mb-2 text-sm text-gray-400">
                Instructions for Supplier
              </label>
              <textarea
                value={instruction}
                maxLength={500}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Any binding, print quality, page-side, or delivery note..."
                className="w-full rounded-lg border border-gray-700 bg-dark p-3 min-h-28"
              />
              <p className="mt-2 text-xs text-gray-400">
                Optional. Visible to the supplier. {instruction.length}/500
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary text-black rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {submitting
                ? uploadProgress?.stage === "processing"
                  ? "Finalizing order..."
                  : uploadPercent !== null
                    ? `Uploading ${uploadPercent}%...`
                    : "Uploading..."
                : "Create Order"}
            </button>

            {submitting && uploadProgress && (
              <div
                aria-live="polite"
                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800 dark:text-white">
                    {uploadProgress.stage === "uploading"
                      ? "Uploading your file"
                      : "Upload complete. Creating your order"}
                  </p>
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    {uploadPercent !== null ? `${uploadPercent}%` : "LIVE"}
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${uploadPercent ?? 8}%` }}
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-300">
                  <span>
                    {uploadProgress.total
                      ? `${formatBytes(uploadProgress.loaded)} / ${formatBytes(uploadProgress.total)}`
                      : `${formatBytes(uploadProgress.loaded)} uploaded`}
                  </span>
                  <span>
                    {uploadProgress.stage === "uploading"
                      ? uploadProgress.speedBytesPerSecond
                        ? `${formatBytes(uploadProgress.speedBytesPerSecond)}/s`
                        : "Measuring speed..."
                      : "Counting pages and saving order..."}
                  </span>
                  <span>{formatElapsedTime(elapsedUploadTime)}</span>
                </div>
              </div>
            )}

            </form>

          </div>
        </div>

      </div>

    </RoleGuard>
  )
}
