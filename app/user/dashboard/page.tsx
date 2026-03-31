"use client"

import RoleGuard from "@/components/RoleGuard"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { auth } from "@/lib/firebase"
import Navbar from "@/components/Navbar"
import toast from "react-hot-toast"
import { authFetch, authUploadWithProgress, readJsonResponseSafely } from "@/lib/client-auth"
import {
  getUploadLimitErrorMessage,
  isAcceptedUploadFile,
  isPdfUploadFile,
  getUploadLimitInfo,
  UPLOAD_POLICY_HELPER_TEXT,
  requiresManualPageCount,
  UPLOAD_ACCEPT_ATTRIBUTE
} from "@/lib/upload-file"
import { prepareFileForUpload } from "@/lib/client-upload-preprocess"

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts"
import SupplierSelector, { type SupplierSelectorItem } from "@/components/SupplierSelector"
import OrderingPolicyCard from "@/components/OrderingPolicyCard"
import {
  PRINT_TYPE_CONTENT,
  PRINT_TYPE_KEYS
} from "@/lib/print-pricing"
import { usePrintPricing } from "@/lib/use-print-pricing"

type DashboardOrder = {
  createdAt: string
  status: string
  paymentStatus: string
  finalPrice?: number | null
  estimatedPrice?: number | null
}

type UserDashboardProfile = {
  name?: string
  rollNo?: string
  branch?: string
  section?: string
  year?: string | number
  phone?: string
  email?: string
  photoURL?: string
  firebasePhotoURL?: string
  displayPhotoURL?: string
}

type ChartPoint = {
  label: string
  orders: number
}

type UploadProgressState = {
  stage: "uploading" | "processing"
  startedAt: number
  loaded: number
  total: number | null
  speedBytesPerSecond: number | null
}

type UploadResponseData = {
  code?: string
  copies?: number
  error?: string
  estimatedPrice?: number
  order?: DashboardOrder
  pages?: number
  requiresPdfPassword?: boolean
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

export default function UserDashboard() {

  const [orders, setOrders] = useState<DashboardOrder[]>([])
  const [userData, setUserData] = useState<UserDashboardProfile | null>(null)
  const [suppliers, setSuppliers] = useState<SupplierSelectorItem[]>([])
  const [loading, setLoading] = useState(true)

  const [duration, setDuration] = useState("week")

  const [submitting, setSubmitting] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [isEditingProfile, setIsEditingProfile] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState("")
  const [profileForm, setProfileForm] = useState({
    name: "",
    rollNo: "",
    branch: "",
    section: "",
    year: "",
    phone: ""
  })

  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState("")
  const [copies, setCopies] = useState("1")
  const [pdfPassword, setPdfPassword] = useState("")
  const [needsPdfPassword, setNeedsPdfPassword] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [alternatePhone, setAlternatePhone] = useState("")
  const [printType, setPrintType] = useState("bw")

  const [requestType, setRequestType] = useState("global")
  const [supplier, setSupplier] = useState("")

  const [duplex, setDuplex] = useState(false)
  const [spiralBinding, setSpiralBinding] = useState(false)
  const [instruction, setInstruction] = useState("")
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
  const isPdfFile = isPdfUploadFile(file)
  const showPdfPasswordField = isPdfFile && (needsPdfPassword || pdfPassword.length > 0)

  useEffect(() => {

    const unsubscribe = auth.onAuthStateChanged(async (user) => {

      if (!user) {
        setLoading(false)
        return
      }

      try {

        const [userRes, orderRes, supRes] = await Promise.all([
          authFetch(`/api/user/details?firebaseUID=${user.uid}`),
          authFetch(`/api/orders/user?firebaseUID=${user.uid}`),
          authFetch("/api/supplier/list")
        ])

        const userJson = await userRes.json()
        const orderJson = await orderRes.json()
        const supJson = await supRes.json()

        if (!userJson.user) {

          window.location.href="/complete-profile"
          return

        }

        setUserData(userJson.user)
        setOrders(orderJson.orders || [])
        setSuppliers(supJson.suppliers || [])

      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }

    })

    return () => unsubscribe()

  }, [])

  const openProfileModal = () => {
    if (!userData) return

    setProfileForm({
      name: String(userData.name || ""),
      rollNo: String(userData.rollNo || ""),
      branch: String(userData.branch || ""),
      section: String(userData.section || ""),
      year: String(userData.year || ""),
      phone: String(userData.phone || "")
    })
    setPhotoPreview(
      String(
        userData.displayPhotoURL ||
        userData.photoURL ||
        userData.firebasePhotoURL ||
        auth.currentUser?.photoURL ||
        ""
      )
    )
    setPhotoFile(null)
    setIsEditingProfile(false)
    setShowProfile(true)
  }

  function generateChartData(orders: DashboardOrder[], duration: string): ChartPoint[] {

    const grouped: Record<string, number> = {}

    orders.forEach(order=>{

      const date = new Date(order.createdAt)

      let key=""

      if(duration==="day") key=`${date.getHours()}:00`
      if(duration==="week") key=date.toLocaleDateString("en-US",{weekday:"short"})
      if(duration==="month") key=date.getDate().toString()
      if(duration==="year") key=date.toLocaleDateString("en-US",{month:"short"})
      if(duration==="all") key=`${date.getFullYear()}-${date.getMonth()+1}`

      grouped[key]=(grouped[key]||0)+1

    })

    return Object.keys(grouped).map(k=>({
      label:k,
      orders:grouped[k]
    }))

  }

  const chartData = generateChartData(orders,duration)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>)=>{

    e.preventDefault()

    if(!file){
      toast.error("Nice try. But invisible files are not supported yet 😌")
      return
    }

    if(!isAcceptedUploadFile(file)){
      toast.error("Upload PDF, DOC, DOCX, PNG, JPG or JPEG files only.")
      return
    }

    const uploadLimit = getUploadLimitInfo(file)

    if(file.size > uploadLimit.maxBytes){
      toast.error(getUploadLimitErrorMessage(file))
      return
    }

    let manualPageCount = ""

    if(requiresManualPageCount(file)){
      const parsedPageCount = Number.parseInt(pageCount,10)

      if(!Number.isInteger(parsedPageCount) || parsedPageCount < 1){
        toast.error("Enter a valid page count for DOC or DOCX files.")
        return
      }

      manualPageCount = String(parsedPageCount)
    }

    if(isPdfFile && needsPdfPassword && !pdfPassword){
      toast.error("Enter the PDF password to continue with this locked file.")
      return
    }

    const parsedCopies = Number(copies)

    if(!Number.isInteger(parsedCopies) || parsedCopies < 1){
      toast.error("Enter a valid number of copies.")
      return
    }

    const user = auth.currentUser
    if(!user) return

    if(requestType==="specific" && !supplier){
      toast.error("Select a supplier first.")
      return
    }

    try {
      const { file: uploadFile, wasCompressed } = await prepareFileForUpload(file)

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

      formData.append("file", uploadFile)
      formData.append("originalFileName", file.name)
      formData.append("originalFileType", file.type)
      formData.append("printType", printType)
      formData.append("firebaseUID", user.uid)

      formData.append("requestType", requestType)
      formData.append("supplier", supplier)
      formData.append("copies", String(parsedCopies))

      formData.append("alternatePhone", alternatePhone)
      formData.append("duplex", String(duplex))
      formData.append("spiralBinding", String(spiralBinding))
      formData.append("instruction", instruction)

      if (manualPageCount) {
        formData.append("pageCount", manualPageCount)
      }

      if (isPdfFile && pdfPassword) {
        formData.append("pdfPassword", pdfPassword)
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

      const { data, rawText } = await readJsonResponseSafely<UploadResponseData>(res)
      const uploadErrorMessage =
        data?.error ||
        (res.status === 413
          ? getUploadLimitErrorMessage(file)
          : rawText.trim() || "Upload failed")

      if (!res.ok || !data || data.error) {
        if (data?.requiresPdfPassword) {
          setNeedsPdfPassword(true)
        }
        toast.error(uploadErrorMessage)
        return
      }

      toast.success(
        `${wasCompressed ? "Large image compressed automatically. " : ""}Pages: ${data.pages} | Copies: ${data.copies ?? parsedCopies} | Estimated Price: ₹${data.estimatedPrice}`
      )

      const nextOrder = data.order
      if (nextOrder) {
        setOrders((prev) => [nextOrder, ...prev])
      }

      setFile(null)
      setPageCount("")
      setCopies("1")
      setPdfPassword("")
      setNeedsPdfPassword(false)
      if(fileInputRef.current){
        fileInputRef.current.value = ""
      }
      setInstruction("")
      setAlternatePhone("")
      setDuplex(false)
      setSpiralBinding(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setSubmitting(false)
      setUploadProgress(null)
    }

  }

  const handleProfilePhotoChange = (selectedFile: File | null) => {
    setPhotoFile(selectedFile)
    if (!selectedFile) {
      setPhotoPreview(
        String(
          userData?.displayPhotoURL ||
          userData?.photoURL ||
          userData?.firebasePhotoURL ||
          auth.currentUser?.photoURL ||
          ""
        )
      )
      return
    }

    const localUrl = URL.createObjectURL(selectedFile)
    setPhotoPreview(localUrl)
  }

  const saveUserProfile = async () => {
    const user = auth.currentUser
    if (!user || !userData) {
      toast.error("Please login again")
      return
    }

    if (!profileForm.name.trim()) {
      toast.error("Name is required")
      return
    }

    if (!/^\d+$/.test(profileForm.rollNo.trim())) {
      toast.error("Roll number must be numeric")
      return
    }

    if (!/^[A-Za-z ]+$/.test(profileForm.branch.trim())) {
      toast.error("Branch must contain only text")
      return
    }

    if (!/^[A-Za-z0-9-]+$/.test(profileForm.section.trim())) {
      toast.error("Section must contain only letters, numbers or '-'")
      return
    }

    const yearNumber = Number(profileForm.year)
    if (!Number.isInteger(yearNumber) || yearNumber < 1 || yearNumber > 8) {
      toast.error("Year must be a number between 1 and 8")
      return
    }

    if (!/^\d{10,15}$/.test(profileForm.phone.trim())) {
      toast.error("Phone must be 10 to 15 digits")
      return
    }

    setSavingProfile(true)

    try {
      let nextPhotoURL = String(
        userData.displayPhotoURL || userData.photoURL || userData.firebasePhotoURL || ""
      )

      if (photoFile) {
        const photoFormData = new FormData()
        photoFormData.append("file", photoFile)
        photoFormData.append("firebaseUID", user.uid)

        const photoRes = await authFetch("/api/user/upload-photo", {
          method: "POST",
          body: photoFormData
        })

        const photoData = await photoRes.json()

        if (!photoRes.ok || !photoData.success) {
          toast.error(photoData.message || "Failed to upload profile photo")
          setSavingProfile(false)
          return
        }

        nextPhotoURL = String(photoData.photoURL || nextPhotoURL)
      }

      const res = await authFetch("/api/user/update-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          firebaseUID: user.uid,
          name: profileForm.name.trim(),
          rollNo: profileForm.rollNo.trim(),
          branch: profileForm.branch.trim(),
          section: profileForm.section.trim(),
          year: yearNumber,
          phone: profileForm.phone.trim()
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to update profile")
        setSavingProfile(false)
        return
      }

      const nextUser = {
        ...data.user,
        photoURL: nextPhotoURL,
        displayPhotoURL: nextPhotoURL
      }

      setUserData(nextUser)
      setPhotoPreview(nextPhotoURL)
      setPhotoFile(null)
      setIsEditingProfile(false)
      toast.success("Profile updated")
    } catch {
      toast.error("Failed to update profile")
    }

    setSavingProfile(false)
  }

  const totalOrders=orders.length
  const pending=orders.filter(o=>o.status==="pending").length
  const completed=orders.filter(o=>o.status==="delivered").length

  const totalSpent=orders.reduce(
    (acc,o)=>o.paymentStatus==="paid"
      ? acc + (o.finalPrice || o.estimatedPrice || 0)
      : acc,
    0
  )

  if(loading) return null

  return (

<RoleGuard role="USER">

<div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-sky-100 text-gray-900 dark:from-black dark:via-[#0f0f1a] dark:to-[#12122a] dark:text-white">

<Navbar
logoHref="/"
navButtons={[
{
label:"My Orders",
href:"/user/orders",
variant:"orders",
badge:totalOrders
}
]}
onProfileClick={openProfileModal}
/>

<div className="px-4 sm:px-6 md:px-16 py-10 md:py-14 space-y-10 md:space-y-16">

{/* STATS */}

<div className="grid gap-4 sm:gap-6 md:grid-cols-4 md:gap-8">

{[
{label:"Total Orders",value:totalOrders},
{label:"Pending",value:pending},
{label:"Completed",value:completed},
{label:"Total Spent",value:`₹${totalSpent}`}
].map((stat,i)=>(

<div
key={i}
className="bg-card p-5 sm:p-6 md:p-8 rounded-3xl shadow-2xl"
>

<p className="text-gray-400 text-sm mb-2">{stat.label}</p>
<h2 className="text-3xl md:text-4xl font-bold">{stat.value}</h2>

</div>

))}

</div>

<OrderingPolicyCard />

{/* CREATE ORDER */}

<div className="bg-card backdrop-blur-none p-5 sm:p-7 md:p-10 rounded-3xl shadow-xl">

<div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
<div>
<h2 className="text-2xl font-semibold">
Create New Order
</h2>
<p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
Live print rates update from the admin portal and are applied during order estimation and verification.
</p>
</div>

<div className="flex flex-wrap gap-2">
{PRINT_TYPE_KEYS.map((key)=>(
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

{!showForm && (

<button
onClick={()=>setShowForm(true)}
className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:scale-105 transition"
>

Start Printing

</button>

)}

{showForm && (

<form onSubmit={handleSubmit} className="space-y-6 mt-6">

<div className="grid md:grid-cols-3 gap-6">
<input value={userData?.name || ""} readOnly className="input"/>
<input value={userData?.rollNo || ""} readOnly className="input"/>
<input value={userData?.phone || ""} readOnly className="input"/>
</div>

<input
placeholder="Alternate Mobile Number"
value={alternatePhone}
onChange={(e)=>setAlternatePhone(e.target.value)}
className="input w-full"
/>

<select
value={printType}
onChange={(e)=>setPrintType(e.target.value)}
className="input w-full"
>
{PRINT_TYPE_KEYS.map((key)=>(
<option key={key} value={key}>
{PRINT_TYPE_CONTENT[key].shortLabel} (₹{pricing[key]})
</option>
))}
</select>

<select
value={requestType}
onChange={(e)=>setRequestType(e.target.value)}
className="input w-full"
>
<option value="global">⚡ Global Request (Fastest)</option>
<option value="specific">Choose Specific Supplier</option>
</select>

{requestType === "global" && (
<p className="text-sm text-gray-400">
⚡ Your order will be visible to all suppliers. The fastest one will accept it.
</p>
)}

	{requestType === "specific" && (

	<div className="space-y-3">
	<p className="text-sm text-slate-600 dark:text-slate-300">
	Choose a supplier. Owner accounts appear with a special highlighted profile.
	</p>

	<SupplierSelector
	suppliers={suppliers}
	value={supplier}
	onChange={setSupplier}
	/>
	</div>

	)}

<div className="flex items-center gap-3">
<input
type="checkbox"
checked={duplex}
onChange={()=>setDuplex(!duplex)}
/>
<span>Duplex Printing</span>
</div>

<div className="flex items-center gap-3">
<input
type="checkbox"
checked={spiralBinding}
onChange={()=>setSpiralBinding(!spiralBinding)}
/>
<span>Spiral Binding (+₹{pricing.spiralBinding})</span>
</div>

<textarea
placeholder="Instructions for supplier..."
value={instruction}
onChange={(e)=>setInstruction(e.target.value)}
className="input w-full h-24"
/>

<div>
<label className="block mb-2 text-sm text-gray-400">
No. of Copies
</label>
<input
type="number"
min="1"
required
placeholder="Copies"
value={copies}
onChange={(e)=>setCopies(e.target.value.replace(/\D/g,""))}
className="input w-32"
/>
</div>

<input
ref={fileInputRef}
type="file"
required
accept={UPLOAD_ACCEPT_ATTRIBUTE}
onChange={(e)=>{
const selectedFile = e.target.files?.[0] || null
setFile(selectedFile)
setPdfPassword("")
setNeedsPdfPassword(false)

if(!requiresManualPageCount(selectedFile)){
setPageCount("")
}
}}
/>

<p className="text-xs text-gray-400">
{UPLOAD_POLICY_HELPER_TEXT}
</p>

{showPdfPasswordField && (
<div className="space-y-2">
<label className="block text-sm text-gray-400">
PDF Password
</label>
<input
type="password"
value={pdfPassword}
onChange={(e)=>setPdfPassword(e.target.value)}
placeholder="Enter the password used to open this PDF"
className="input w-full"
/>
<p className="text-xs text-gray-400">
We use this to read the locked PDF page count and store it with the order so the supplier can open the same file.
</p>
</div>
)}

{isPdfFile && !showPdfPasswordField && (
<p className="text-xs text-gray-400">
If this PDF is locked, submit once and we will ask for the password before creating the order.
</p>
)}

{requiresManualPageCount(file) && (
<input
type="number"
min="1"
required
placeholder="Enter total pages in document"
value={pageCount}
onChange={(e)=>setPageCount(e.target.value.replace(/\D/g,""))}
className="input w-full"
/>
)}

<button
type="submit"
disabled={submitting}
className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:scale-105 transition disabled:opacity-50"
>
{submitting
? uploadProgress?.stage === "processing"
  ? "Finalizing order..."
  : uploadPercent !== null
    ? `Uploading ${uploadPercent}%...`
    : "Uploading..."
: "Submit Order"}
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
className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-[width] duration-300"
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

)}

</div>

{/* ORDER ACTIVITY */}

<div className="bg-card p-5 sm:p-7 md:p-10 rounded-3xl shadow-xl">

<h2 className="text-2xl font-semibold mb-6">
Order Activity
</h2>

<div className="flex gap-3 mb-6 flex-wrap">

{["day","week","month","year","all"].map(d=>(

<button
key={d}
onClick={()=>setDuration(d)}
className={`px-4 py-2 rounded-lg border ${
duration===d
?"bg-indigo-500 border-indigo-500"
:"border-gray-300 text-gray-600 dark:border-white/20 dark:text-gray-300"
}`}
>
{d.toUpperCase()}
</button>

))}

</div>

{orders.length>0 ? (

<ResponsiveContainer width="100%" height={320}>

<AreaChart data={chartData}>

<CartesianGrid strokeDasharray="3 3" stroke="#333"/>

<XAxis dataKey="label"/>

<YAxis/>

<Tooltip/>

<Area
type="monotone"
dataKey="orders"
stroke="#6366f1"
fill="#6366f1"
fillOpacity={0.25}
/>

</AreaChart>

</ResponsiveContainer>

) : (

<p className="text-gray-400">No activity yet.</p>

)}

</div>

</div>

{/* PROFILE MODAL */}

{showProfile && (

<div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">

<div className="bg-card rounded-3xl p-5 sm:p-8 md:p-10 w-full max-w-[560px] relative">

<button
onClick={()=>setShowProfile(false)}
className="absolute top-4 right-4"
>
✕
</button>

<h2 className="text-2xl mb-6">My Profile</h2>

<div className="flex justify-center mb-6">
{photoPreview ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={photoPreview}
alt={userData?.name || "User"}
className="w-24 h-24 rounded-full object-cover border border-white/20"
/>
) : (
<div className="w-24 h-24 rounded-full bg-indigo-500/30 border border-indigo-300/30 flex items-center justify-center text-3xl font-bold text-indigo-100">
{String(userData?.name || "U").charAt(0).toUpperCase()}
</div>
)}
</div>

{isEditingProfile && (
<div className="mb-5">
<label className="text-sm text-gray-400 mb-1 block">Upload Profile Photo</label>
<input
type="file"
accept="image/*"
onChange={(e)=>handleProfilePhotoChange(e.target.files?.[0] || null)}
className="input w-full"
/>
</div>
)}

<div className="space-y-4 text-gray-700 dark:text-gray-300">
<div>
<p className="text-gray-400">Name</p>
<input
value={profileForm.name}
onChange={(e)=>setProfileForm((prev)=>({...prev,name:e.target.value}))}
readOnly={!isEditingProfile}
className={`input w-full ${!isEditingProfile ? "opacity-80" : ""}`}
/>
</div>

<div>
<p className="text-gray-400">Email</p>
<input
value={String(userData?.email || auth.currentUser?.email || "")}
readOnly
className="input w-full opacity-70"
/>
</div>

<div className="grid md:grid-cols-2 gap-4">
<div>
<p className="text-gray-400">Roll No</p>
<input
value={profileForm.rollNo}
onChange={(e)=>setProfileForm((prev)=>({...prev,rollNo:e.target.value.replace(/\D/g,"")}))}
readOnly={!isEditingProfile}
className={`input w-full ${!isEditingProfile ? "opacity-80" : ""}`}
/>
</div>

<div>
<p className="text-gray-400">Phone</p>
<input
value={profileForm.phone}
onChange={(e)=>setProfileForm((prev)=>({...prev,phone:e.target.value.replace(/\D/g,"")}))}
readOnly={!isEditingProfile}
className={`input w-full ${!isEditingProfile ? "opacity-80" : ""}`}
/>
</div>
</div>

<div className="grid md:grid-cols-3 gap-4">
<div>
<p className="text-gray-400">Branch</p>
<input
value={profileForm.branch}
onChange={(e)=>setProfileForm((prev)=>({...prev,branch:e.target.value}))}
readOnly={!isEditingProfile}
className={`input w-full ${!isEditingProfile ? "opacity-80" : ""}`}
/>
</div>

<div>
<p className="text-gray-400">Section</p>
<input
value={profileForm.section}
onChange={(e)=>setProfileForm((prev)=>({...prev,section:e.target.value}))}
readOnly={!isEditingProfile}
className={`input w-full ${!isEditingProfile ? "opacity-80" : ""}`}
/>
</div>

<div>
<p className="text-gray-400">Year</p>
<input
value={profileForm.year}
onChange={(e)=>setProfileForm((prev)=>({...prev,year:e.target.value.replace(/\D/g,"")}))}
readOnly={!isEditingProfile}
className={`input w-full ${!isEditingProfile ? "opacity-80" : ""}`}
/>
</div>
</div>
</div>

<div className="mt-7 flex flex-col gap-3">
{!isEditingProfile ? (
<button
onClick={()=>setIsEditingProfile(true)}
className="w-full bg-indigo-500 hover:bg-indigo-600 transition py-2 rounded-lg"
>
Edit Profile
</button>
) : (
<>
<button
onClick={saveUserProfile}
disabled={savingProfile}
className="w-full bg-indigo-500 hover:bg-indigo-600 transition py-2 rounded-lg disabled:opacity-60"
>
{savingProfile ? "Saving..." : "Save Changes"}
</button>
<button
onClick={()=>{
setIsEditingProfile(false)
setProfileForm({
name: String(userData?.name || ""),
rollNo: String(userData?.rollNo || ""),
branch: String(userData?.branch || ""),
section: String(userData?.section || ""),
year: String(userData?.year || ""),
phone: String(userData?.phone || "")
})
setPhotoFile(null)
setPhotoPreview(
String(
userData?.displayPhotoURL ||
userData?.photoURL ||
userData?.firebasePhotoURL ||
auth.currentUser?.photoURL ||
""
)
)
}}
className="w-full bg-white/10 hover:bg-white/20 transition py-2 rounded-lg"
>
Cancel
</button>
</>
)}
</div>

</div>

</div>

)}

</div>

</RoleGuard>

)

}
