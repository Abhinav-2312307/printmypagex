"use client"

import { useState, useEffect, useRef, type FormEvent } from "react"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"
import RoleGuard from "@/components/RoleGuard"
import toast from "react-hot-toast"
import { authFetch, authUploadWithProgress, readJsonResponseSafely } from "@/lib/client-auth"
import {
  getUploadLimitErrorMessage,
  isAcceptedUploadFile,
  isPdfUploadFile,
  getUploadLimitInfo,
  UPLOAD_POLICY_HELPER_TEXT,
  requiresManualPageCount,
  UPLOAD_ACCEPT_ATTRIBUTE,
  MAX_FILES_PER_ORDER
} from "@/lib/upload-file"
import { prepareFileForUpload } from "@/lib/client-upload-preprocess"
import SupplierSelector, { type SupplierSelectorItem } from "@/components/SupplierSelector"
import OrderingPolicyCard from "@/components/OrderingPolicyCard"
import {
  PRINT_TYPE_CONTENT,
  PRINT_TYPE_KEYS
} from "@/lib/print-pricing"
import { usePrintPricing } from "@/lib/use-print-pricing"

type FileEntry = {
  id: string
  file: File
  pageCount: string
  pdfPassword: string
  needsPdfPassword: boolean
  detectedPages: number | null
}

type UploadProgressState = {
  stage: "uploading" | "processing"
  startedAt: number
  loaded: number
  total: number | null
  speedBytesPerSecond: number | null
}

type UploadResponseData = {
  copies?: number
  error?: string
  code?: string
  estimatedPrice?: number
  pages?: number
  requiresPdfPassword?: boolean
  requiresPageCount?: boolean
  fileIndex?: number
  fileCount?: number
  filesDetail?: Array<{ name: string; pages: number }>
  orderId?: string
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

function getFileTypeLabel(file: File): string {
  if (isPdfUploadFile(file)) return "PDF"
  if (requiresManualPageCount(file)) return "DOC"
  return "IMG"
}

function getFileTypeBadgeColor(file: File): string {
  if (isPdfUploadFile(file)) return "bg-rose-500/20 text-rose-400 border-rose-500/30"
  if (requiresManualPageCount(file)) return "bg-blue-500/20 text-blue-400 border-blue-500/30"
  return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
}

let fileIdCounter = 0

export default function CreateOrderPage() {

  const [fileEntries, setFileEntries] = useState<FileEntry[]>([])
  const [printType, setPrintType] = useState("bw")
  const [requestType, setRequestType] = useState("global")
  const [supplier, setSupplier] = useState("")
  const [copies, setCopies] = useState("1")
  const [spiralBinding, setSpiralBinding] = useState(false)
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

  const handleFilesSelected = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const newFiles = Array.from(selectedFiles)
    const currentCount = fileEntries.length
    const available = MAX_FILES_PER_ORDER - currentCount
    const filesToAdd = newFiles.slice(0, available)

    if (newFiles.length > available) {
      toast.error(`You can upload up to ${MAX_FILES_PER_ORDER} files. ${newFiles.length - available} file(s) were skipped.`)
    }

    const newEntries: FileEntry[] = filesToAdd
      .filter((file) => {
        if (!isAcceptedUploadFile(file)) {
          toast.error(`"${file.name}" is not a supported file type.`)
          return false
        }
        const limit = getUploadLimitInfo(file)
        if (file.size > limit.maxBytes) {
          toast.error(`"${file.name}": ${getUploadLimitErrorMessage(file)}`)
          return false
        }
        return true
      })
      .map((file) => ({
        id: `file-${++fileIdCounter}`,
        file,
        pageCount: "",
        pdfPassword: "",
        needsPdfPassword: false,
        detectedPages: null
      }))

    setFileEntries((prev) => [...prev, ...newEntries])

    // Reset the input so the same file can be re-selected if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removeFileEntry = (id: string) => {
    setFileEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  const updateFileEntry = (id: string, updates: Partial<FileEntry>) => {
    setFileEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry
      )
    )
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {

    e.preventDefault()

    if (fileEntries.length === 0) {
      toast.error("Add at least one file to create an order 📁")
      return
    }

    // Validate each file entry
    for (let i = 0; i < fileEntries.length; i++) {
      const entry = fileEntries[i]

      if (requiresManualPageCount(entry.file)) {
        const parsedPageCount = Number.parseInt(entry.pageCount, 10)
        if (!Number.isInteger(parsedPageCount) || parsedPageCount < 1) {
          toast.error(`File ${i + 1} ("${entry.file.name}"): Enter a valid page count.`)
          return
        }
      }

      if (isPdfUploadFile(entry.file) && entry.needsPdfPassword && !entry.pdfPassword) {
        toast.error(`File ${i + 1} ("${entry.file.name}"): Enter the PDF password to continue.`)
        return
      }
    }

    const parsedCopies = Number(copies)

    if (!Number.isInteger(parsedCopies) || parsedCopies < 1) {
      toast.error("Enter a valid number of copies.")
      return
    }

    const user = auth.currentUser

    if (!user) return

    if (requestType === "specific" && !supplier) {
      toast.error("Select a supplier first.")
      return
    }

    try {
      setSubmitting(true)
      const startedAt = Date.now()
      let totalLoaded = 0
      
      setUploadProgress({
        stage: "uploading",
        startedAt,
        loaded: 0,
        total: null,
        speedBytesPerSecond: null
      })

      const fallbackEmail = user.email || user.providerData?.[0]?.email || ""
      let currentOrderId = ""
      let finalData: UploadResponseData | null = null

      for (let i = 0; i < fileEntries.length; i++) {
        const entry = fileEntries[i]
        const isFirstFile = i === 0
        const isLastFile = i === fileEntries.length - 1
        
        let lastFileLoaded = 0
        let lastMeasuredAt = Date.now()
        let lastSpeedBytesPerSecond: number | null = null

        const formData = new FormData()
        const { file: uploadFile } = await prepareFileForUpload(entry.file)
        
        formData.append("files", uploadFile)
        formData.append("originalFileNames", entry.file.name)
        formData.append("originalFileTypes", entry.file.type)
        formData.append("pageCounts", requiresManualPageCount(entry.file) ? entry.pageCount : "")
        formData.append("pdfPasswords", isPdfUploadFile(entry.file) ? entry.pdfPassword : "")
        
        if (isFirstFile) {
          formData.append("printType", printType)
          formData.append("firebaseUID", user.uid)
          formData.append("userEmail", fallbackEmail)
          formData.append("requestType", requestType)
          formData.append("supplier", supplier)
          formData.append("copies", String(parsedCopies))
          formData.append("spiralBinding", String(spiralBinding))
          formData.append("instruction", instruction.trim())
        } else {
          formData.append("appendOrderId", currentOrderId)
        }
        
        if (isLastFile) {
          formData.append("isLastFile", "true")
        }

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
                const nextSpeed = ((loaded - lastFileLoaded) * 1000) / elapsedSinceLastMeasure

                if (Number.isFinite(nextSpeed) && nextSpeed > 0) {
                  lastSpeedBytesPerSecond = nextSpeed
                }
              }

              const newTotalLoaded = totalLoaded + (loaded - lastFileLoaded)
              lastFileLoaded = loaded
              totalLoaded = newTotalLoaded
              lastMeasuredAt = now
              
              setUploadProgress({
                stage: "uploading",
                startedAt,
                loaded: totalLoaded,
                total: null, // Total is hard to estimate across files accurately here unless we precalculate
                speedBytesPerSecond: lastSpeedBytesPerSecond
              })
            },
            onUploadComplete: () => {
              setUploadProgress((current) => {
                if (!current) {
                  return {
                    stage: "processing",
                    startedAt,
                    loaded: totalLoaded,
                    total: totalLoaded || null,
                    speedBytesPerSecond: null
                  }
                }

                return {
                  ...current,
                  stage: "processing",
                  loaded: totalLoaded,
                  speedBytesPerSecond: null
                }
              })
            }
          }
        )

        const { data, rawText } = await readJsonResponseSafely<UploadResponseData>(res)
        const uploadErrorMessage =
          data?.error ||
          (res.status === 413
            ? `File ${i + 1} exceeds the size limit.`
            : rawText.trim() || `Upload failed for file ${i + 1}`)

        if (!res.ok || !data || data.error) {
          if (data?.requiresPdfPassword) {
            updateFileEntry(entry.id, { needsPdfPassword: true })
          }
          throw new Error(uploadErrorMessage)
        }

        if (isFirstFile && data.orderId) {
          currentOrderId = data.orderId
        }
        
        if (isLastFile) {
          finalData = data
        }
      }

      if (finalData) {
        toast.success(
          `Order created! ${finalData.fileCount ?? 1} file(s) | Total Pages: ${finalData.pages} | Copies: ${finalData.copies ?? parsedCopies} | ₹${finalData.estimatedPrice}`
        )
      }

      setFileEntries([])
      setCopies("1")
      setSpiralBinding(false)
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
                  Upload up to {MAX_FILES_PER_ORDER} files per order. Prices below are live admin-configured rates.
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
                <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  Spiral Binding: ₹{pricing.spiralBinding}/order
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

            {/* File Upload Zone */}
            <div>
              <label className="block mb-2 text-sm text-gray-400">
                Upload Files ({fileEntries.length}/{MAX_FILES_PER_ORDER})
              </label>

              {fileEntries.length < MAX_FILES_PER_ORDER && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={UPLOAD_ACCEPT_ATTRIBUTE}
                    onChange={(e) => handleFilesSelected(e.target.files)}
                    className="w-full bg-dark p-3 rounded-lg border border-gray-700"
                  />
                  <p className="mt-2 text-xs text-gray-400">
                    {UPLOAD_POLICY_HELPER_TEXT}
                  </p>
                </div>
              )}

              {fileEntries.length >= MAX_FILES_PER_ORDER && (
                <p className="text-xs text-amber-400 mt-1">
                  Maximum {MAX_FILES_PER_ORDER} files reached. Remove a file to add another.
                </p>
              )}
            </div>

            {/* File List */}
            {fileEntries.length > 0 && (
              <div className="space-y-3">
                {fileEntries.map((entry, index) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-gray-700 bg-dark/50 p-4 space-y-3"
                  >
                    {/* File header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getFileTypeBadgeColor(entry.file)}`}>
                          {getFileTypeLabel(entry.file)}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{entry.file.name}</p>
                          <p className="text-xs text-gray-400">{formatBytes(entry.file.size)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFileEntry(entry.id)}
                        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-gray-700 text-gray-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
                        title="Remove file"
                      >
                        ×
                      </button>
                    </div>

                    {/* Per-file page count */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-gray-400 shrink-0 w-16">Pages:</label>
                      {requiresManualPageCount(entry.file) ? (
                        <div className="flex-1">
                          <input
                            type="number"
                            min="1"
                            value={entry.pageCount}
                            onChange={(e) =>
                              updateFileEntry(entry.id, {
                                pageCount: e.target.value.replace(/\D/g, "")
                              })
                            }
                            placeholder="Enter page count"
                            className="w-full bg-dark p-2 rounded-lg border border-gray-700 text-sm"
                          />
                          <p className="mt-1 text-[10px] text-amber-400/80">
                            DOC/DOCX files require manual page count
                          </p>
                        </div>
                      ) : isPdfUploadFile(entry.file) ? (
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-xs text-emerald-400 font-medium">Auto-detected</span>
                          {entry.pageCount && (
                            <span className="text-xs text-gray-400">
                              (Override:{" "}
                              <input
                                type="number"
                                min="1"
                                value={entry.pageCount}
                                onChange={(e) =>
                                  updateFileEntry(entry.id, {
                                    pageCount: e.target.value.replace(/\D/g, "")
                                  })
                                }
                                className="w-16 bg-dark p-1 rounded border border-gray-700 text-xs inline"
                              />
                              )
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">1 page (image)</span>
                      )}
                    </div>

                    {/* Per-file PDF password */}
                    {isPdfUploadFile(entry.file) && (entry.needsPdfPassword || entry.pdfPassword.length > 0) && (
                      <div>
                        <input
                          type="password"
                          value={entry.pdfPassword}
                          onChange={(e) =>
                            updateFileEntry(entry.id, { pdfPassword: e.target.value })
                          }
                          placeholder="PDF password for this file"
                          className="w-full bg-dark p-2 rounded-lg border border-gray-700 text-sm"
                        />
                        <p className="mt-1 text-[10px] text-gray-400">
                          Used to read pages and shared with the supplier.
                        </p>
                      </div>
                    )}

                    {isPdfUploadFile(entry.file) && !entry.needsPdfPassword && entry.pdfPassword.length === 0 && (
                      <p className="text-[10px] text-gray-500">
                        Locked PDF? Submit once and we&apos;ll ask for the password.
                      </p>
                    )}
                  </div>
                ))}
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

            <label className="flex items-center gap-3 rounded-xl border border-gray-700 px-4 py-3">
              <input
                type="checkbox"
                checked={spiralBinding}
                onChange={() => setSpiralBinding((current) => !current)}
              />
              <span>Spiral Binding (+₹{pricing.spiralBinding})</span>
            </label>

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

            <div>
              <label className="block mb-2 text-sm text-gray-400">
                No. of Copies
              </label>
              <input
                type="number"
                min="1"
                required
                value={copies}
                onChange={(e) => setCopies(e.target.value.replace(/\D/g, ""))}
                placeholder="Copies"
                className="w-32 bg-dark p-3 rounded-lg border border-gray-700"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || fileEntries.length === 0}
              className="w-full py-3 bg-primary text-black rounded-xl font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {submitting
                ? uploadProgress?.stage === "processing"
                  ? "Finalizing order..."
                  : uploadPercent !== null
                    ? `Uploading ${uploadPercent}%...`
                    : "Uploading..."
                : fileEntries.length === 0
                  ? "Add files to create order"
                  : `Create Order (${fileEntries.length} file${fileEntries.length > 1 ? "s" : ""})`}
            </button>

            {submitting && uploadProgress && (
              <div
                aria-live="polite"
                className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-slate-800 dark:text-white">
                    {uploadProgress.stage === "uploading"
                      ? `Uploading ${fileEntries.length} file${fileEntries.length > 1 ? "s" : ""}`
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
