"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { onAuthStateChanged, signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import {
  Activity,
  AlertTriangle,
  CreditCard,
  Download,
  Eye,
  LogOut,
  RefreshCcw,
  Search,
  Store,
  Users,
  Wallet,
  Wrench
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts"
import { auth } from "@/lib/firebase"
import CandleThemeToggle from "@/components/CandleThemeToggle"
import HeroBackground from "@/components/HeroBackground"
import CursorDepth from "@/components/CursorDepth"
import FeedbackPanel, { type AdminFeedback } from "@/components/admin/FeedbackPanel"
import FaqManager from "@/components/admin/FaqManager"
import StatusToggle from "@/components/admin/StatusToggle"
import {
  DEFAULT_PRINT_PRICING,
  PRINT_TYPE_CONTENT,
  PRINT_TYPE_KEYS,
  formatPricePerPage,
  normalizePrintPricing,
  type PrintPricing,
  type PrintType
} from "@/lib/print-pricing"
import {
  defaultFaqContentSnapshot,
  type FAQContentSnapshot
} from "@/lib/faq-content"
import {
  calculateRevenueBreakdownFromGross,
  getOrderCollectedAmount,
  roundCurrency
} from "@/lib/revenue"

type Tab =
  | "overview"
  | "users"
  | "suppliers"
  | "orders"
  | "pricing"
  | "payments"
  | "payouts"
  | "feedback"
  | "faqs"
  | "logs"
  | "danger"

type OverviewResponse = {
  stats: {
    totalUsers: number
    activeUsers: number
    totalSuppliers: number
    approvedSuppliers: number
    activeSuppliers: number
    totalOrders: number
    paidOrders: number
    pendingOrders: number
    totalRevenue: number
  }
  charts: {
    statusBreakdown: Array<{ status: string; count: number }>
    paymentTrend: Array<{ date: string; amount: number }>
    orderTrend: Array<{ date: string; orders: number }>
  }
}

type UserRole = "USER" | "SUPPLIER" | "ADMIN"

type AdminUser = {
  _id?: string
  firebaseUID?: string
  name?: string
  email?: string
  phone?: string
  rollNo?: string
  branch?: string
  section?: string
  year?: number
  photoURL?: string
  firebasePhotoURL?: string
  role: UserRole
  approved?: boolean
  active?: boolean
  orderCount?: number
  paidCount?: number
  totalSpent?: number
  createdAt?: string
}

type AdminSupplier = {
  _id?: string
  firebaseUID?: string
  name?: string
  email?: string
  phone?: string
  rollNo?: string
  branch?: string
  year?: string
  photoURL?: string
  firebasePhotoURL?: string
  approved?: boolean
  active?: boolean
  createdAt?: string
  ordersHandled?: number
  paidOrders?: number
  grossDeliveredRevenue?: number
  razorpayFees?: number
  gstOnFees?: number
  netRevenue?: number
  totalClaimed?: number
  pendingRequested?: number
  walletBalance?: number
  availableToClaim?: number
}

type AdminOrder = {
  _id: string
  userUID: string
  supplierUID?: string | null
  requestType?: "global" | "specific"
  alternatePhone?: string
  duplex?: boolean
  instruction?: string
  printType?: "bw" | "color" | "glossy"
  fileURL?: string
  pdfPasswordRequired?: boolean
  pdfPassword?: string
  pages?: number
  verifiedPages?: number | null
  estimatedPrice?: number
  finalPrice?: number | null
  discountPercent?: number
  discountAmount?: number
  paymentStatus: "unpaid" | "paid" | string
  razorpayOrderId?: string | null
  razorpayPaymentId?: string | null
  paidAt?: string | null
  status: string
  acceptedAt?: string | null
  deliveredAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  user?: { name?: string; email?: string } | null
  supplier?: { name?: string; email?: string; approved?: boolean; active?: boolean } | null
}

type PaymentLog = {
  orderId: string
  userUID: string
  user?: { name?: string; email?: string } | null
  amount: number
  paymentStatus: string
  status?: string
  razorpayOrderId?: string | null
  razorpayPaymentId?: string | null
  paidAt?: string | null
  createdAt?: string
}

type AdminPayoutRequest = {
  _id: string
  supplierUID: string
  amount: number
  status: "pending" | "approved" | "rejected"
  note?: string
  createdAt: string
  processedAt?: string | null
  supplier?: { name?: string; email?: string; phone?: string } | null
}

type AdminActivityLog = {
  _id?: string
  actorType?: string
  actorUID?: string
  actorEmail?: string
  action: string
  entityType: string
  entityId?: string
  level?: "info" | "success" | "warning" | "error" | string
  message: string
  metadata?: Record<string, unknown>
  createdAt: string
}

type PlatformSettings = {
  landingFeedbackVisible: boolean
  updatedAt?: string | null
}

type ClearDbResponse = {
  deleted: {
    users: number
    suppliers: number
    orders: number
  }
}

type AdminResponse = {
  message?: string
  success?: boolean
}

type PricingResponse = {
  prices: PrintPricing
  message?: string
}

type SpotlightResult = {
  key: string
  kind: "user" | "supplier" | "order" | "payment" | "payout"
  title: string
  subtitle: string
  meta: string
}

type WorkspaceFilter =
  | "all"
  | "pending"
  | "accepted"
  | "awaiting_payment"
  | "printing"
  | "printed"
  | "delivered"
  | "cancelled"
  | "paid"
  | "unpaid"

type OrdersWorkspace = {
  type: "user" | "supplier"
  id: string
  name: string
  email?: string
  photoURL?: string
}

const CHART_COLORS = ["#22d3ee", "#fb7185", "#34d399", "#f59e0b", "#818cf8", "#f87171", "#c084fc"]

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return "Request failed"
}

function formatCurrency(value: number | null | undefined) {
  return `INR ${Number(value || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2
  })}`
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function formatStatus(status: string | null | undefined) {
  return String(status || "unknown").replace(/_/g, " ").toUpperCase()
}

function hasQueryMatch(query: string, fields: Array<string | number | null | undefined>) {
  if (!query) return true
  const normalized = query.toLowerCase()
  return fields.some((field) => String(field || "").toLowerCase().includes(normalized))
}

function csvEscape(value: unknown) {
  const raw = String(value ?? "")
  const escaped = raw.replace(/"/g, '""')
  return `"${escaped}"`
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return

  const headers = Object.keys(rows[0])
  const content = [
    headers.map((header) => csvEscape(header)).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))
  ].join("\n")

  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function getStatusBadge(status: string) {
  const normalized = status.toLowerCase()

  if (["delivered", "paid", "approved", "active"].includes(normalized)) {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
  }

  if (["pending", "awaiting_payment", "printing", "printed", "accepted", "unpaid"].includes(normalized)) {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30"
  }

  if (["rejected", "cancelled", "disapproved", "inactive"].includes(normalized)) {
    return "bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30"
  }

  return "bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/30"
}

function copyText(value: string) {
  if (!value) return
  navigator.clipboard.writeText(value).catch(() => {})
}

function resolveProfilePhoto(primary?: string, fallback?: string) {
  return String(primary || fallback || "")
}

function getNameInitial(name?: string, email?: string) {
  return String(name || email || "U").charAt(0).toUpperCase()
}

function getActivityLevelBadge(level: string | null | undefined) {
  const normalized = String(level || "info").toLowerCase()

  if (normalized === "success") {
    return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
  }

  if (normalized === "warning") {
    return "bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30"
  }

  if (normalized === "error") {
    return "bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30"
  }

  return "bg-cyan-500/15 text-cyan-700 dark:text-cyan-200 border border-cyan-500/30"
}

function formatActivityActor(log: Pick<AdminActivityLog, "actorType" | "actorEmail" | "actorUID">) {
  if (log.actorEmail) return log.actorEmail
  if (log.actorUID) return log.actorUID
  return String(log.actorType || "system").toUpperCase()
}

function getOrderStatusOptions(paymentStatus: string, currentStatus?: string) {
  const options =
    paymentStatus === "paid"
      ? ["printing", "printed", "delivered", "cancelled"]
      : ["pending", "accepted", "awaiting_payment", "cancelled"]

  if (currentStatus && !options.includes(currentStatus)) {
    return [currentStatus, ...options]
  }

  return options
}

export default function AdminPortalPage() {
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)

  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null)

  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [suppliers, setSuppliers] = useState<AdminSupplier[]>([])
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [payments, setPayments] = useState<PaymentLog[]>([])
  const [payoutRequests, setPayoutRequests] = useState<AdminPayoutRequest[]>([])
  const [feedbacks, setFeedbacks] = useState<AdminFeedback[]>([])
  const [activityLogs, setActivityLogs] = useState<AdminActivityLog[]>([])
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>({
    landingFeedbackVisible: true,
    updatedAt: null
  })
  const [faqContent, setFaqContent] = useState<FAQContentSnapshot>(defaultFaqContentSnapshot)
  const [pricing, setPricing] = useState<PrintPricing>(DEFAULT_PRINT_PRICING)
  const [pricingForm, setPricingForm] = useState<Record<PrintType, string>>({
    bw: String(DEFAULT_PRINT_PRICING.bw),
    color: String(DEFAULT_PRINT_PRICING.color),
    glossy: String(DEFAULT_PRINT_PRICING.glossy)
  })

  const [adminEmail, setAdminEmail] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)

  const [confirmPhrase, setConfirmPhrase] = useState("")
  const [confirmOwnerEmail, setConfirmOwnerEmail] = useState("")

  const [busyAction, setBusyAction] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [spotlightQuery, setSpotlightQuery] = useState("")

  const [userQuery, setUserQuery] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState<"ALL" | UserRole>("ALL")
  const [userApprovalFilter, setUserApprovalFilter] = useState<"ALL" | "APPROVED" | "PENDING">("ALL")
  const [userActivityFilter, setUserActivityFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")

  const [supplierQuery, setSupplierQuery] = useState("")
  const [supplierApprovalFilter, setSupplierApprovalFilter] = useState<"ALL" | "APPROVED" | "PENDING">("ALL")
  const [supplierActivityFilter, setSupplierActivityFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")

  const [orderQuery, setOrderQuery] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState<"ALL" | AdminOrder["status"]>("ALL")
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<"ALL" | "paid" | "unpaid">("ALL")
  const [orderAssignmentFilter, setOrderAssignmentFilter] = useState<"ALL" | "assigned" | "unassigned">("ALL")

  const [paymentQuery, setPaymentQuery] = useState("")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<"ALL" | "paid" | "unpaid">("ALL")

  const [payoutQuery, setPayoutQuery] = useState("")
  const [payoutStatusFilter, setPayoutStatusFilter] = useState<"ALL" | "pending" | "approved" | "rejected">("ALL")
  const [payoutNotes, setPayoutNotes] = useState<Record<string, string>>({})
  const [logQuery, setLogQuery] = useState("")
  const [logLevelFilter, setLogLevelFilter] = useState<"ALL" | "info" | "success" | "warning" | "error">("ALL")

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [selectedSupplier, setSelectedSupplier] = useState<AdminSupplier | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null)
  const [orderEditForm, setOrderEditForm] = useState({
    status: "",
    verifiedPages: "",
    finalPrice: "",
    discountPercent: "",
    discountAmount: "",
    note: ""
  })
  const [showControlHub, setShowControlHub] = useState(false)

  const [ordersWorkspace, setOrdersWorkspace] = useState<OrdersWorkspace | null>(null)
  const [workspaceFilter, setWorkspaceFilter] = useState<WorkspaceFilter>("all")
  const [workspaceOrderDetail, setWorkspaceOrderDetail] = useState<AdminOrder | null>(null)

  const isBusyAction = useCallback((...keys: string[]) => keys.includes(busyAction), [busyAction])

  const adminFetch = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const currentUser = auth.currentUser
    if (!currentUser) {
      throw new Error("No signed-in admin")
    }

    const idToken = await currentUser.getIdToken(true)
    const res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
        ...(init?.headers || {})
      }
    })

    const data = (await res.json()) as AdminResponse & T

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        await signOut(auth).catch(() => {})
        window.location.href = "/admin/login"
        throw new Error("Session expired. Please login again.")
      }
      throw new Error(data.message || "Request failed")
    }

    return data
  }, [])

  const loadAll = useCallback(async () => {
    const [
      overviewRes,
      usersRes,
      suppliersRes,
      ordersRes,
      pricingRes,
      paymentsRes,
      payoutsRes,
      feedbacksRes,
      faqsRes,
      logsRes,
      settingsRes
    ] = await Promise.all([
      adminFetch<OverviewResponse>("/api/admin/overview"),
      adminFetch<{ users: AdminUser[] }>("/api/admin/users"),
      adminFetch<{ suppliers: AdminSupplier[] }>("/api/admin/suppliers"),
      adminFetch<{ orders: AdminOrder[] }>("/api/admin/orders"),
      adminFetch<PricingResponse>("/api/admin/pricing"),
      adminFetch<{ payments: PaymentLog[] }>("/api/admin/payments"),
      adminFetch<{ requests: AdminPayoutRequest[] }>("/api/admin/payout-requests"),
      adminFetch<{ feedbacks: AdminFeedback[] }>("/api/admin/feedback"),
      adminFetch<{ content: FAQContentSnapshot }>("/api/admin/faqs"),
      adminFetch<{ logs: AdminActivityLog[] }>("/api/admin/logs?limit=300"),
      adminFetch<{ settings: PlatformSettings }>("/api/admin/platform-settings")
    ])

    setOverview(overviewRes)
    setUsers(usersRes.users || [])
    setSuppliers(suppliersRes.suppliers || [])
    setOrders(ordersRes.orders || [])
    const nextPricing = normalizePrintPricing(pricingRes.prices)
    setPricing(nextPricing)
    setPricingForm({
      bw: String(nextPricing.bw),
      color: String(nextPricing.color),
      glossy: String(nextPricing.glossy)
    })
    setPayments(paymentsRes.payments || [])
    setPayoutRequests(payoutsRes.requests || [])
    setFeedbacks(feedbacksRes.feedbacks || [])
    setActivityLogs(logsRes.logs || [])
    setPlatformSettings(settingsRes.settings || { landingFeedbackVisible: true, updatedAt: null })
    setFaqContent(faqsRes.content || defaultFaqContentSnapshot)
    setLastSyncedAt(new Date())
  }, [adminFetch])

  const refreshAll = useCallback(
    async (silent = false) => {
      if (!silent) {
        setMessage("")
        setError("")
      }

      setRefreshing(true)

      try {
        await loadAll()
        if (!silent) {
          setMessage("Admin data synced successfully")
        }
      } catch (caughtError) {
        if (!silent) {
          setError(getErrorMessage(caughtError))
        }
      } finally {
        setRefreshing(false)
      }
    },
    [loadAll]
  )

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "/admin/login"
        return
      }

      setAdminEmail(user.email || "")

      try {
        await loadAll()
      } catch (caughtError) {
        setError(getErrorMessage(caughtError))
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [loadAll])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refreshAll(true).catch(() => {})
    }, 60000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshAll])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)

    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  useEffect(() => {
    if (!selectedOrder) {
      setOrderEditForm({
        status: "",
        verifiedPages: "",
        finalPrice: "",
        discountPercent: "",
        discountAmount: "",
        note: ""
      })
      return
    }

    setOrderEditForm({
      status: String(selectedOrder.status || ""),
      verifiedPages: String(selectedOrder.verifiedPages ?? selectedOrder.pages ?? ""),
      finalPrice: String(selectedOrder.finalPrice ?? selectedOrder.estimatedPrice ?? ""),
      discountPercent: selectedOrder.discountPercent ? String(selectedOrder.discountPercent) : "",
      discountAmount: selectedOrder.discountAmount ? String(selectedOrder.discountAmount) : "",
      note: ""
    })
  }, [selectedOrder])

  const logout = async () => {
    await signOut(auth)
    window.location.href = "/admin/login"
  }

  const saveFaqContent = async (nextContent: FAQContentSnapshot) => {
    try {
      setBusyAction("save-faqs")
      setMessage("")
      setError("")

      const response = await adminFetch<{ content: FAQContentSnapshot; message?: string }>("/api/admin/faqs", {
        method: "PUT",
        body: JSON.stringify(nextContent)
      })

      setFaqContent(response.content || defaultFaqContentSnapshot)
      setMessage(response.message || "FAQ content updated")
      setLastSyncedAt(new Date())
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    } finally {
      setBusyAction("")
    }
  }

  const setLandingFeedbackVisible = async (nextVisible: boolean) => {
    try {
      setBusyAction("toggle-landing-feedback")
      setMessage("")
      setError("")

      const response = await adminFetch<{ settings: PlatformSettings; message?: string }>("/api/admin/platform-settings", {
        method: "PUT",
        body: JSON.stringify({
          landingFeedbackVisible: nextVisible
        })
      })

      setPlatformSettings(response.settings || { landingFeedbackVisible: nextVisible, updatedAt: null })
      await loadAll()
      setMessage(response.message || `Landing feedback showcase turned ${nextVisible ? "on" : "off"}`)
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    } finally {
      setBusyAction("")
    }
  }

  const savePricing = async () => {
    const nextPricing = {} as PrintPricing

    for (const key of PRINT_TYPE_KEYS) {
      const parsed = Number(pricingForm[key])

      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError(`${PRINT_TYPE_CONTENT[key].title} price must be greater than 0`)
        return
      }

      nextPricing[key] = parsed
    }

    try {
      setBusyAction("save-pricing")
      setMessage("")
      setError("")

      const response = await adminFetch<PricingResponse>("/api/admin/pricing", {
        method: "PUT",
        body: JSON.stringify({
          prices: nextPricing
        })
      })

      const normalizedPricing = normalizePrintPricing(response.prices)

      setPricing(normalizedPricing)
      setPricingForm({
        bw: String(normalizedPricing.bw),
        color: String(normalizedPricing.color),
        glossy: String(normalizedPricing.glossy)
      })
      setMessage(response.message || "Pricing updated successfully")
      setLastSyncedAt(new Date())
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    } finally {
      setBusyAction("")
    }
  }

  const runUserAction = async (firebaseUID: string, action: string, role?: string) => {
    try {
      setBusyAction(`${action}-${firebaseUID}`)
      setError("")
      const response = await adminFetch<{ success: boolean; user?: AdminUser }>("/api/admin/user-action", {
        method: "POST",
        body: JSON.stringify({ firebaseUID, action, role })
      })

      if (response.user) {
        setSelectedUser((prev) =>
          prev?.firebaseUID === firebaseUID
            ? {
                ...prev,
                ...response.user
              }
            : prev
        )
      }

      await loadAll()
      setMessage("User updated successfully")
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    } finally {
      setBusyAction("")
    }
  }

  const runSupplierAction = async (firebaseUID: string, action: string) => {
    try {
      setBusyAction(`${action}-${firebaseUID}`)
      setError("")
      const response = await adminFetch<{ success: boolean; supplier?: AdminSupplier }>("/api/admin/supplier-action", {
        method: "POST",
        body: JSON.stringify({ firebaseUID, action })
      })

      if (response.supplier) {
        setSelectedSupplier((prev) =>
          prev?.firebaseUID === firebaseUID
            ? {
                ...prev,
                ...response.supplier
              }
            : prev
        )
      }

      await loadAll()
      setMessage("Supplier updated successfully")
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    } finally {
      setBusyAction("")
    }
  }

  const runPayoutAction = async (requestId: string, action: "approve" | "reject") => {
    try {
      setBusyAction(`${action}-${requestId}`)
      setError("")

      await adminFetch<{ success: boolean }>("/api/admin/payout-requests", {
        method: "POST",
        body: JSON.stringify({
          requestId,
          action,
          note: payoutNotes[requestId] || ""
        })
      })

      await loadAll()
      setMessage(`Payout request ${action}d successfully`)
      setPayoutNotes((prev) => ({ ...prev, [requestId]: "" }))
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    } finally {
      setBusyAction("")
    }
  }

  const runOrderUpdate = async () => {
    if (!selectedOrder) return

    const payload: Record<string, unknown> = {
      orderId: selectedOrder._id
    }

    if (orderEditForm.status && orderEditForm.status !== selectedOrder.status) {
      payload.status = orderEditForm.status
    }

    const paymentDone = selectedOrder.paymentStatus === "paid"

    if (!paymentDone) {
      const currentPages = Number(selectedOrder.verifiedPages ?? selectedOrder.pages ?? 0)
      const currentAmount = Number(selectedOrder.finalPrice ?? selectedOrder.estimatedPrice ?? 0)
      const currentDiscountPercent = Number(selectedOrder.discountPercent || 0)
      const currentDiscountAmount = Number(selectedOrder.discountAmount || 0)

      const pagesText = orderEditForm.verifiedPages.trim()
      if (pagesText) {
        const parsedPages = Number(pagesText)
        if (!Number.isInteger(parsedPages) || parsedPages < 1) {
          setError("Verified pages must be a whole number greater than 0")
          return
        }

        if (parsedPages !== currentPages) {
          payload.verifiedPages = parsedPages
        }
      }

      const finalPriceText = orderEditForm.finalPrice.trim()
      if (finalPriceText) {
        const parsedFinalPrice = Number(finalPriceText)
        if (!Number.isFinite(parsedFinalPrice) || parsedFinalPrice <= 0) {
          setError("Final amount must be greater than 0")
          return
        }

        if (parsedFinalPrice !== currentAmount) {
          payload.finalPrice = parsedFinalPrice
        }
      }

      const discountPercentText = orderEditForm.discountPercent.trim()
      const discountAmountText = orderEditForm.discountAmount.trim()

      if (discountPercentText && discountAmountText) {
        setError("Use either discount percent or discount amount, not both")
        return
      }

      if (discountPercentText) {
        const parsedDiscountPercent = Number(discountPercentText)
        if (!Number.isFinite(parsedDiscountPercent) || parsedDiscountPercent < 0 || parsedDiscountPercent > 100) {
          setError("Discount percent must be between 0 and 100")
          return
        }

        if (parsedDiscountPercent !== currentDiscountPercent) {
          payload.discountPercent = parsedDiscountPercent
        }
      }

      if (discountAmountText) {
        const parsedDiscountAmount = Number(discountAmountText)
        if (!Number.isFinite(parsedDiscountAmount) || parsedDiscountAmount < 0) {
          setError("Discount amount must be 0 or greater")
          return
        }

        if (parsedDiscountAmount !== currentDiscountAmount) {
          payload.discountAmount = parsedDiscountAmount
        }
      }
    }

    const trimmedNote = orderEditForm.note.trim()
    if (trimmedNote) {
      payload.note = trimmedNote
    }

    if (Object.keys(payload).length === 1) {
      setMessage("No order changes to save")
      return
    }

    try {
      setBusyAction(`order-update-${selectedOrder._id}`)
      setError("")

      const response = await adminFetch<{ success: boolean; message?: string; order: AdminOrder }>(
        "/api/admin/orders",
        {
          method: "PATCH",
          body: JSON.stringify(payload)
        }
      )

      const updatedOrder = response.order

      setOrders((prev) =>
        prev.map((item) => (item._id === updatedOrder._id ? updatedOrder : item))
      )
      setSelectedOrder(updatedOrder)
      setWorkspaceOrderDetail((prev) =>
        prev && prev._id === updatedOrder._id ? updatedOrder : prev
      )

      setMessage(response.message || "Order updated successfully")
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    } finally {
      setBusyAction("")
    }
  }

  const clearDatabase = async () => {
    try {
      setBusyAction("clear-db")
      setError("")

      const data = await adminFetch<ClearDbResponse>("/api/admin/database/clear", {
        method: "POST",
        body: JSON.stringify({
          confirmText: confirmPhrase,
          ownerEmail: confirmOwnerEmail
        })
      })

      setMessage(
        `Database cleared. Deleted users: ${data.deleted.users}, suppliers: ${data.deleted.suppliers}, orders: ${data.deleted.orders}`
      )
      setConfirmPhrase("")
      setConfirmOwnerEmail("")
      await loadAll()
    } catch (caughtError) {
      setError(getErrorMessage(caughtError))
    } finally {
      setBusyAction("")
    }
  }

  const openOrdersWorkspace = useCallback((workspace: OrdersWorkspace) => {
    setOrdersWorkspace(workspace)
    setWorkspaceFilter("all")
    setWorkspaceOrderDetail(null)
  }, [])

  const orderById = useMemo(() => {
    const map = new Map<string, AdminOrder>()
    orders.forEach((order) => {
      map.set(String(order._id), order)
    })
    return map
  }, [orders])

  const userOrdersMap = useMemo(() => {
    const map = new Map<string, AdminOrder[]>()
    orders.forEach((order) => {
      const key = String(order.userUID || "")
      if (!key) return
      const current = map.get(key) || []
      current.push(order)
      map.set(key, current)
    })
    return map
  }, [orders])

  const supplierOrdersMap = useMemo(() => {
    const map = new Map<string, AdminOrder[]>()
    orders.forEach((order) => {
      const key = String(order.supplierUID || "")
      if (!key) return
      const current = map.get(key) || []
      current.push(order)
      map.set(key, current)
    })
    return map
  }, [orders])

  const pendingPayoutAmount = useMemo(
    () => payoutRequests.filter((request) => request.status === "pending").reduce((sum, request) => sum + Number(request.amount || 0), 0),
    [payoutRequests]
  )

  const staleOrders = useMemo(() => {
    const now = Date.now()
    return orders.filter((order) => {
      if (["delivered", "cancelled"].includes(order.status)) return false
      const createdAt = new Date(order.createdAt).getTime()
      if (Number.isNaN(createdAt)) return false
      const hours = (now - createdAt) / (1000 * 60 * 60)
      return hours >= 24
    })
  }, [orders])

  const unassignedOrders = useMemo(
    () => orders.filter((order) => !order.supplierUID && order.status === "pending"),
    [orders]
  )

  const inactiveUsers = useMemo(() => users.filter((user) => user.active === false), [users])
  const inactiveSuppliers = useMemo(() => suppliers.filter((supplier) => supplier.active === false), [suppliers])

  const alerts = useMemo(() => {
    return [
      {
        label: "Stale Orders (>24h)",
        value: staleOrders.length,
        severity: staleOrders.length > 0 ? "warning" : "ok"
      },
      {
        label: "Unassigned Pending Orders",
        value: unassignedOrders.length,
        severity: unassignedOrders.length > 0 ? "warning" : "ok"
      },
      {
        label: "Pending Payout Queue",
        value: payoutRequests.filter((request) => request.status === "pending").length,
        severity: payoutRequests.some((request) => request.status === "pending") ? "warning" : "ok"
      },
      {
        label: "Inactive Accounts",
        value: inactiveUsers.length + inactiveSuppliers.length,
        severity: inactiveUsers.length + inactiveSuppliers.length > 0 ? "attention" : "ok"
      }
    ]
  }, [inactiveSuppliers.length, inactiveUsers.length, payoutRequests, staleOrders.length, unassignedOrders.length])

  const queueBoard = useMemo(() => {
    const buckets: Record<string, number> = {
      pending: 0,
      accepted: 0,
      awaiting_payment: 0,
      printing: 0,
      printed: 0,
      delivered: 0,
      cancelled: 0
    }

    orders.forEach((order) => {
      if (buckets[order.status] !== undefined) {
        buckets[order.status] += 1
      }
    })

    return Object.entries(buckets).map(([key, value]) => ({
      key,
      label: formatStatus(key),
      value
    }))
  }, [orders])

  const spotlightResults = useMemo(() => {
    const query = spotlightQuery.trim().toLowerCase()
    if (!query || query.length < 2) return [] as SpotlightResult[]

    const userHits = users
      .filter((user) =>
        hasQueryMatch(query, [user.name, user.email, user.firebaseUID, user.phone, user.rollNo, user.branch, user.section])
      )
      .slice(0, 3)
      .map((user) => ({
        key: `user-${user.firebaseUID || user._id}`,
        kind: "user" as const,
        title: user.name || "Unknown user",
        subtitle: user.email || String(user.firebaseUID || "-"),
        meta: `Role ${user.role}`
      }))

    const supplierHits = suppliers
      .filter((supplier) =>
        hasQueryMatch(query, [supplier.name, supplier.email, supplier.firebaseUID, supplier.phone, supplier.rollNo, supplier.branch])
      )
      .slice(0, 3)
      .map((supplier) => ({
        key: `supplier-${supplier.firebaseUID || supplier._id}`,
        kind: "supplier" as const,
        title: supplier.name || "Unknown supplier",
        subtitle: supplier.email || String(supplier.firebaseUID || "-"),
        meta: supplier.approved ? "Approved" : "Pending approval"
      }))

    const orderHits = orders
      .filter((order) =>
        hasQueryMatch(query, [
          order._id,
          order.user?.name,
          order.user?.email,
          order.supplier?.name,
          order.status,
          order.paymentStatus
        ])
      )
      .slice(0, 4)
      .map((order) => ({
        key: `order-${order._id}`,
        kind: "order" as const,
        title: `Order ${String(order._id).slice(-8)}`,
        subtitle: `${order.user?.name || "Unknown"} • ${formatStatus(order.status)}`,
        meta: formatCurrency(order.finalPrice ?? order.estimatedPrice)
      }))

    const paymentHits = payments
      .filter((payment) =>
        hasQueryMatch(query, [payment.orderId, payment.user?.name, payment.user?.email, payment.razorpayPaymentId, payment.paymentStatus])
      )
      .slice(0, 2)
      .map((payment) => ({
        key: `payment-${payment.orderId}`,
        kind: "payment" as const,
        title: `Payment ${String(payment.orderId).slice(-8)}`,
        subtitle: payment.user?.name || payment.user?.email || payment.userUID,
        meta: `${formatCurrency(payment.amount)} • ${formatStatus(payment.paymentStatus)}`
      }))

    const payoutHits = payoutRequests
      .filter((request) =>
        hasQueryMatch(query, [request._id, request.supplier?.name, request.supplier?.email, request.supplierUID, request.status])
      )
      .slice(0, 2)
      .map((request) => ({
        key: `payout-${request._id}`,
        kind: "payout" as const,
        title: `Payout ${String(request._id).slice(-8)}`,
        subtitle: request.supplier?.name || request.supplierUID,
        meta: `${formatCurrency(request.amount)} • ${formatStatus(request.status)}`
      }))

    return [...userHits, ...supplierHits, ...orderHits, ...paymentHits, ...payoutHits]
  }, [orders, payments, payoutRequests, spotlightQuery, suppliers, users])

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase()

    return users.filter((user) => {
      if (userRoleFilter !== "ALL" && user.role !== userRoleFilter) return false

      if (userApprovalFilter === "APPROVED" && user.approved !== true) return false
      if (userApprovalFilter === "PENDING" && user.approved !== false) return false

      if (userActivityFilter === "ACTIVE" && user.active !== true) return false
      if (userActivityFilter === "INACTIVE" && user.active !== false) return false

      return hasQueryMatch(query, [
        user.name,
        user.email,
        user.firebaseUID,
        user.phone,
        user.rollNo,
        user.branch,
        user.section,
        user.role
      ])
    })
  }, [userQuery, userRoleFilter, userApprovalFilter, userActivityFilter, users])

  const filteredSuppliers = useMemo(() => {
    const query = supplierQuery.trim().toLowerCase()

    return suppliers.filter((supplier) => {
      if (supplierApprovalFilter === "APPROVED" && supplier.approved !== true) return false
      if (supplierApprovalFilter === "PENDING" && supplier.approved !== false) return false

      if (supplierActivityFilter === "ACTIVE" && supplier.active !== true) return false
      if (supplierActivityFilter === "INACTIVE" && supplier.active !== false) return false

      return hasQueryMatch(query, [
        supplier.name,
        supplier.email,
        supplier.firebaseUID,
        supplier.phone,
        supplier.rollNo,
        supplier.branch,
        supplier.year
      ])
    })
  }, [supplierActivityFilter, supplierApprovalFilter, supplierQuery, suppliers])

  const filteredOrders = useMemo(() => {
    const query = orderQuery.trim().toLowerCase()

    return orders.filter((order) => {
      if (orderStatusFilter !== "ALL" && order.status !== orderStatusFilter) return false
      if (orderPaymentFilter !== "ALL" && order.paymentStatus !== orderPaymentFilter) return false

      if (orderAssignmentFilter === "assigned" && !order.supplierUID) return false
      if (orderAssignmentFilter === "unassigned" && order.supplierUID) return false

      return hasQueryMatch(query, [
        order._id,
        order.user?.name,
        order.user?.email,
        order.userUID,
        order.supplier?.name,
        order.supplierUID,
        order.status,
        order.paymentStatus,
        order.requestType,
        order.printType
      ])
    })
  }, [orderAssignmentFilter, orderPaymentFilter, orderQuery, orderStatusFilter, orders])

  const filteredPayments = useMemo(() => {
    const query = paymentQuery.trim().toLowerCase()

    return payments.filter((payment) => {
      if (paymentStatusFilter !== "ALL" && payment.paymentStatus !== paymentStatusFilter) return false

      return hasQueryMatch(query, [
        payment.orderId,
        payment.user?.name,
        payment.user?.email,
        payment.userUID,
        payment.paymentStatus,
        payment.razorpayPaymentId,
        payment.razorpayOrderId
      ])
    })
  }, [paymentQuery, paymentStatusFilter, payments])

  const filteredPayouts = useMemo(() => {
    const query = payoutQuery.trim().toLowerCase()

    return payoutRequests.filter((request) => {
      if (payoutStatusFilter !== "ALL" && request.status !== payoutStatusFilter) return false

      return hasQueryMatch(query, [
        request._id,
        request.supplierUID,
        request.supplier?.name,
        request.supplier?.email,
        request.status,
        request.amount
      ])
    })
  }, [payoutQuery, payoutRequests, payoutStatusFilter])

  const filteredActivityLogs = useMemo(() => {
    const query = logQuery.trim().toLowerCase()

    return activityLogs.filter((log) => {
      if (logLevelFilter !== "ALL" && String(log.level || "info") !== logLevelFilter) return false

      return hasQueryMatch(query, [
        log.message,
        log.action,
        log.entityType,
        log.entityId,
        log.actorEmail,
        log.actorUID,
        log.actorType
      ])
    })
  }, [activityLogs, logLevelFilter, logQuery])

  const userPanelMetrics = useMemo(() => {
    if (!selectedUser?.firebaseUID) return null

    const relatedOrders = userOrdersMap.get(String(selectedUser.firebaseUID)) || []
    const paidOrders = relatedOrders.filter((order) => order.paymentStatus === "paid")
    const deliveredOrders = relatedOrders.filter((order) => order.status === "delivered")
    const cancelledOrders = relatedOrders.filter((order) => order.status === "cancelled")
    const activeOrders = relatedOrders.filter((order) => !["delivered", "cancelled"].includes(order.status))
    const spend = paidOrders.reduce(
      (sum, order) => sum + Number(order.finalPrice ?? order.estimatedPrice ?? 0),
      0
    )

    return {
      orderCount: relatedOrders.length,
      paidCount: paidOrders.length,
      deliveredCount: deliveredOrders.length,
      cancelledCount: cancelledOrders.length,
      activeCount: activeOrders.length,
      spend,
      averageOrderValue: relatedOrders.length ? spend / relatedOrders.length : 0,
      latestOrder: relatedOrders[0] || null
    }
  }, [selectedUser, userOrdersMap])

  const supplierPanelMetrics = useMemo(() => {
    if (!selectedSupplier?.firebaseUID) return null

    const relatedOrders = supplierOrdersMap.get(String(selectedSupplier.firebaseUID)) || []
    const revenue = relatedOrders
      .filter((order) => order.status === "delivered" && order.paymentStatus === "paid")
      .reduce(
        (sum, order) =>
          roundCurrency(
            sum + calculateRevenueBreakdownFromGross(getOrderCollectedAmount(order)).netRevenue
          ),
        0
      )

    return {
      orderCount: relatedOrders.length,
      deliveredCount: relatedOrders.filter((order) => order.status === "delivered").length,
      paidCount: relatedOrders.filter((order) => order.paymentStatus === "paid").length,
      activeOrders: relatedOrders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
      awaitingPaymentCount: relatedOrders.filter((order) => order.status === "awaiting_payment").length,
      printingCount: relatedOrders.filter((order) => ["printing", "printed"].includes(order.status)).length,
      cancelledCount: relatedOrders.filter((order) => order.status === "cancelled").length,
      revenue,
      latestOrder: relatedOrders[0] || null
    }
  }, [selectedSupplier, supplierOrdersMap])

  const workspaceOrdersBase = useMemo(() => {
    if (!ordersWorkspace) return [] as AdminOrder[]

    if (ordersWorkspace.type === "user") {
      return userOrdersMap.get(ordersWorkspace.id) || []
    }

    return supplierOrdersMap.get(ordersWorkspace.id) || []
  }, [ordersWorkspace, supplierOrdersMap, userOrdersMap])

  const workspaceOrders = useMemo(() => {
    if (workspaceFilter === "all") return workspaceOrdersBase
    if (workspaceFilter === "paid") return workspaceOrdersBase.filter((order) => order.paymentStatus === "paid")
    if (workspaceFilter === "unpaid") return workspaceOrdersBase.filter((order) => order.paymentStatus !== "paid")
    return workspaceOrdersBase.filter((order) => order.status === workspaceFilter)
  }, [workspaceFilter, workspaceOrdersBase])

  const workspaceStats = useMemo(() => {
    if (!workspaceOrdersBase.length) {
      return {
        total: 0,
        paid: 0,
        unpaid: 0,
        active: 0,
        delivered: 0,
        cancelled: 0,
        revenue: 0
      }
    }

    return {
      total: workspaceOrdersBase.length,
      paid: workspaceOrdersBase.filter((order) => order.paymentStatus === "paid").length,
      unpaid: workspaceOrdersBase.filter((order) => order.paymentStatus !== "paid").length,
      active: workspaceOrdersBase.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
      delivered: workspaceOrdersBase.filter((order) => order.status === "delivered").length,
      cancelled: workspaceOrdersBase.filter((order) => order.status === "cancelled").length,
      revenue: workspaceOrdersBase.reduce(
        (sum, order) => sum + Number(order.finalPrice ?? order.estimatedPrice ?? 0),
        0
      )
    }
  }, [workspaceOrdersBase])

  const topCards = useMemo(() => {
    if (!overview) return []

    return [
      {
        label: "Total Users",
        value: overview.stats.totalUsers,
        meta: `${overview.stats.activeUsers} active`,
        icon: <Users className="w-4 h-4" />
      },
      {
        label: "Suppliers",
        value: overview.stats.totalSuppliers,
        meta: `${overview.stats.approvedSuppliers} approved`,
        icon: <Store className="w-4 h-4" />
      },
      {
        label: "Orders",
        value: overview.stats.totalOrders,
        meta: `${overview.stats.pendingOrders} in progress`,
        icon: <Activity className="w-4 h-4" />
      },
      {
        label: "Collected Revenue",
        value: formatCurrency(overview.stats.totalRevenue),
        meta: `${overview.stats.paidOrders} paid orders`,
        icon: <CreditCard className="w-4 h-4" />
      },
      {
        label: "Pending Payout Amount",
        value: formatCurrency(pendingPayoutAmount),
        meta: `${payoutRequests.filter((request) => request.status === "pending").length} requests`,
        icon: <Wallet className="w-4 h-4" />
      },
      {
        label: "Stale Orders",
        value: staleOrders.length,
        meta: "Older than 24 hours",
        icon: <AlertTriangle className="w-4 h-4" />
      }
    ]
  }, [overview, payoutRequests, pendingPayoutAmount, staleOrders.length])

  const recentActivity = useMemo(() => {
    if (activityLogs.length) {
      return activityLogs.slice(0, 8).map((log, index) => ({
        id: log._id || `${log.action}-${index}`,
        title: log.message,
        subtitle: `${formatActivityActor(log)} • ${formatDateTime(log.createdAt)}`,
        level:
          log.level === "success"
            ? "good"
            : log.level === "warning" || log.level === "error"
              ? "risk"
              : "neutral"
      }))
    }

    const items = [
      ...orders.slice(0, 6).map((order) => ({
        id: `order-${order._id}`,
        title: `Order ${String(order._id).slice(-8)} moved to ${formatStatus(order.status)}`,
        subtitle: `${order.user?.name || order.userUID} • ${formatDateTime(order.createdAt)}`,
        level: order.status === "cancelled" ? "risk" : "neutral"
      })),
      ...payments.slice(0, 3).map((payment) => ({
        id: `payment-${payment.orderId}`,
        title: `Payment ${formatStatus(payment.paymentStatus)} for ${String(payment.orderId).slice(-8)}`,
        subtitle: `${formatCurrency(payment.amount)} • ${formatDateTime(payment.paidAt || payment.createdAt || "")}`,
        level: payment.paymentStatus === "paid" ? "good" : "neutral"
      }))
    ]

    return items.slice(0, 8)
  }, [activityLogs, orders, payments])

  const tabs: Array<{ value: Tab; label: string }> = [
    { value: "overview", label: "Overview" },
    { value: "users", label: "Users" },
    { value: "suppliers", label: "Suppliers" },
    { value: "orders", label: "Orders" },
    { value: "pricing", label: "Pricing" },
    { value: "payments", label: "Payments" },
    { value: "payouts", label: "Payouts" },
    { value: "feedback", label: "Feedback" },
    { value: "faqs", label: "FAQs" },
    { value: "logs", label: "Logs" },
    { value: "danger", label: "Danger" }
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white flex items-center justify-center px-4">
        <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/10 border border-gray-200 dark:border-white/20 rounded-3xl px-8 py-6 text-center">
          <p className="text-xs uppercase tracking-[0.22em] text-indigo-500 dark:text-cyan-300">Admin Boot Sequence</p>
          <p className="mt-2">Loading secure command center...</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-white dark:bg-black text-gray-900 dark:text-white overflow-x-hidden">
      <CursorDepth />

      <div className="h-28 md:h-32" />

      <div className="w-full flex justify-center fixed top-6 z-50">
        <nav className="flex items-center justify-between px-6 md:px-12 py-4 w-[95%] max-w-[1450px] rounded-3xl backdrop-blur-3xl bg-white/70 dark:bg-black/40 border border-gray-200 dark:border-white/20 shadow-[0_8px_40px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
          <h1
            className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent cursor-pointer"
            onClick={() => router.push("/")}
          >
            PrintMyPage
          </h1>

          <div className="hidden lg:flex items-center gap-3">
            <button
              onClick={() => setShowControlHub(true)}
              className="group relative flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 dark:border-white/20 bg-white/80 dark:bg-white/5 backdrop-blur-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10"
            >
              <Wrench className="w-4 h-4" />
              Control Hub
            </button>
            <button
              onClick={() => refreshAll(false)}
              className="group relative flex items-center gap-2 px-4 py-2 rounded-full border border-gray-300 dark:border-white/20 bg-white/80 dark:bg-white/5 backdrop-blur-md text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10"
              disabled={refreshing}
            >
              <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Syncing" : "Refresh"}
            </button>
          </div>

          <div className="flex items-center gap-4">
            <label className="hidden md:flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span>Auto Sync</span>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(event) => setAutoRefresh(event.target.checked)}
                className="accent-indigo-500"
              />
            </label>

            <CandleThemeToggle />

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-black font-semibold"
              >
                {String(adminEmail || "A").charAt(0).toUpperCase()}
              </button>

              {menuOpen ? (
                <div className="absolute right-0 mt-3 w-72 backdrop-blur-2xl bg-white/80 dark:bg-black/60 border border-gray-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
                  <p className="text-sm break-all border-b border-gray-200 dark:border-white/10 pb-2">
                    {adminEmail || "Admin"}
                  </p>

                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      router.push("/")
                    }}
                    className="w-full text-left text-sm hover:text-indigo-500"
                  >
                    Open Landing Page
                  </button>

                  <button
                    onClick={logout}
                    className="w-full flex items-center gap-2 text-left text-rose-500 hover:text-rose-400 text-sm"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </nav>
      </div>

      <section className="relative pt-6 pb-16 px-4 md:px-8">
        <HeroBackground />

        <div className="relative max-w-[1450px] mx-auto space-y-6">
          <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-4">
            <div
              className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-6 md:p-8"
              data-depth="22"
            >
              <p className="text-xs uppercase tracking-[0.24em] text-indigo-500 dark:text-cyan-300">
                Technician Control Layer
              </p>
              <h2 className="text-3xl md:text-4xl font-bold mt-3">
                Admin Command Center
              </h2>
              <p className="mt-3 text-gray-600 dark:text-gray-300 max-w-2xl">
                Monitor live platform health, inspect users and suppliers, handle payout operations, and manage lifecycle risks from one unified console.
              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-sm">
                <span className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/20 bg-white/70 dark:bg-white/5">
                  Last Sync: {lastSyncedAt ? lastSyncedAt.toLocaleTimeString() : "-"}
                </span>
                <span className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/20 bg-white/70 dark:bg-white/5">
                  {autoRefresh ? "Auto sync every 60s" : "Manual sync mode"}
                </span>
              </div>
            </div>

            <div
              className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-6 space-y-4"
              data-depth="38"
            >
              <p className="text-sm font-semibold flex items-center gap-2">
                <Search className="w-4 h-4" />
                Global Spotlight Search
              </p>

              <div className="relative">
                <input
                  value={spotlightQuery}
                  onChange={(event) => setSpotlightQuery(event.target.value)}
                  placeholder="Search user, supplier, order id, payment id..."
                  className="w-full px-4 py-3 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                />
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {spotlightResults.length > 0 ? (
                  spotlightResults.map((result) => (
                    <button
                      key={result.key}
                      className="w-full text-left px-3 py-2 rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                      onClick={() => {
                        if (result.kind === "user") {
                          const picked = users.find((user) => {
                            const id = user.firebaseUID || user._id
                            return result.key === `user-${id}`
                          })
                          if (picked) {
                            setActiveTab("users")
                            setSelectedUser(picked)
                          }
                          return
                        }

                        if (result.kind === "supplier") {
                          const picked = suppliers.find((supplier) => {
                            const id = supplier.firebaseUID || supplier._id
                            return result.key === `supplier-${id}`
                          })
                          if (picked) {
                            setActiveTab("suppliers")
                            setSelectedSupplier(picked)
                          }
                          return
                        }

                        if (result.kind === "order") {
                          const orderId = result.key.replace("order-", "")
                          const picked = orderById.get(orderId)
                          if (picked) {
                            setActiveTab("orders")
                            setSelectedOrder(picked)
                          }
                          return
                        }

                        if (result.kind === "payment") {
                          setActiveTab("payments")
                          setPaymentQuery(result.key.replace("payment-", ""))
                          return
                        }

                        setActiveTab("payouts")
                        setPayoutQuery(result.key.replace("payout-", ""))
                      }}
                    >
                      <p className="text-sm font-medium">{result.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">{result.subtitle}</p>
                      <p className="text-[11px] text-indigo-500 dark:text-cyan-300 mt-1">{result.meta}</p>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {spotlightQuery.length < 2 ? "Type at least 2 characters to search." : "No matches found."}
                  </p>
                )}
              </div>
            </div>
          </div>

          {error ? (
            <div className="px-4 py-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300 text-sm">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="px-4 py-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 text-sm">
              {message}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-4 py-2 rounded-full border transition text-sm ${
                  activeTab === tab.value
                    ? "bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-transparent"
                    : "bg-white/70 dark:bg-white/5 border-gray-200 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "overview" && overview ? (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {topCards.map((card) => (
                  <div
                    key={card.label}
                    className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">{card.label}</p>
                      <span className="w-8 h-8 rounded-full bg-indigo-500/15 text-indigo-500 dark:text-cyan-300 flex items-center justify-center">
                        {card.icon}
                      </span>
                    </div>
                    <p className="text-2xl font-semibold mt-3">{card.value}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{card.meta}</p>
                  </div>
                ))}
              </div>

              <div className="grid xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-5">
                  <h3 className="text-lg font-semibold mb-4">Order Throughput</h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overview.charts.orderTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#64748b33" />
                        <XAxis dataKey="date" stroke="#94a3b8" hide={overview.charts.orderTrend.length > 12} />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="orders" stroke="#6366f1" strokeWidth={2.5} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-5">
                  <h3 className="text-lg font-semibold mb-4">Risk Monitor</h3>
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <div
                        key={alert.label}
                        className={`rounded-2xl border px-4 py-3 ${
                          alert.severity === "ok"
                            ? "border-emerald-500/30 bg-emerald-500/10"
                            : alert.severity === "attention"
                              ? "border-cyan-500/30 bg-cyan-500/10"
                              : "border-amber-500/30 bg-amber-500/10"
                        }`}
                      >
                        <p className="text-sm font-medium">{alert.label}</p>
                        <p className="text-xl font-semibold mt-1">{alert.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid xl:grid-cols-3 gap-4">
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-5 h-[360px]">
                  <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.charts.paymentTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#64748b33" />
                      <XAxis dataKey="date" stroke="#94a3b8" hide={overview.charts.paymentTrend.length > 12} />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip />
                      <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-5 h-[360px]">
                  <h3 className="text-lg font-semibold mb-4">Status Distribution</h3>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={overview.charts.statusBreakdown}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={110}
                        label
                      >
                        {overview.charts.statusBreakdown.map((entry, index) => (
                          <Cell key={`${entry.status}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-5">
                  <h3 className="text-lg font-semibold mb-4">Queue Board</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {queueBoard.map((item) => (
                      <div key={item.key} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{item.label}</p>
                        <p className="text-2xl font-semibold mt-1">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-lg font-semibold">Recent Platform Activity</h3>
                  <button
                    onClick={() => refreshAll(false)}
                    className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 text-sm"
                  >
                    Refresh Feed
                  </button>
                </div>

                <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
                  {recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-2xl border p-3 ${
                        item.level === "good"
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : item.level === "risk"
                            ? "border-rose-500/30 bg-rose-500/10"
                            : "border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5"
                      }`}
                    >
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{item.subtitle}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "users" ? (
            <div className="space-y-4">
              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={userQuery}
                    onChange={(event) => setUserQuery(event.target.value)}
                    placeholder="Search users by name, email, UID, branch..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                  />
                </div>

                <select
                  value={userRoleFilter}
                  onChange={(event) => setUserRoleFilter(event.target.value as "ALL" | UserRole)}
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Roles</option>
                  <option value="USER">User</option>
                  <option value="SUPPLIER">Supplier</option>
                  <option value="ADMIN">Admin</option>
                </select>

                <select
                  value={userApprovalFilter}
                  onChange={(event) =>
                    setUserApprovalFilter(event.target.value as "ALL" | "APPROVED" | "PENDING")
                  }
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                </select>

                <select
                  value={userActivityFilter}
                  onChange={(event) =>
                    setUserActivityFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")
                  }
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Activity</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>

                <button
                  onClick={() =>
                    downloadCsv(
                      "admin-users.csv",
                      filteredUsers.map((user) => ({
                        name: user.name || "",
                        email: user.email || "",
                        firebaseUID: user.firebaseUID || "",
                        role: user.role,
                        approved: user.approved,
                        active: user.active,
                        orderCount: user.orderCount || 0,
                        paidCount: user.paidCount || 0,
                        totalSpent: user.totalSpent || 0,
                        createdAt: formatDateTime(user.createdAt || "")
                      }))
                    )
                  }
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl overflow-x-auto">
                <table className="w-full min-w-[1300px] text-sm">
                  <thead className="bg-gray-100/80 dark:bg-white/5">
                    <tr>
                      <th className="text-left p-3">User</th>
                      <th className="text-left p-3">Role</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Orders</th>
                      <th className="text-left p-3">Spent</th>
                      <th className="text-left p-3">Created</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, index) => (
                      <tr key={user.firebaseUID || user._id || `user-${index}`} className="border-t border-gray-200 dark:border-white/10">
                        <td className="p-3">
                          <p className="font-medium">{user.name || "-"}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 break-all">{user.email || user.firebaseUID || "-"}</p>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-1 rounded-full text-xs border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5">
                            {user.role}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(user.approved ? "approved" : "pending")}`}>
                              {user.approved ? "Approved" : "Pending"}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(user.active ? "active" : "inactive")}`}>
                              {user.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">{user.orderCount || 0}</td>
                        <td className="p-3">{formatCurrency(user.totalSpent)}</td>
                        <td className="p-3">{formatDateTime(user.createdAt || "")}</td>
                        <td className="p-3">
                          {user.firebaseUID ? (
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                onClick={() => setSelectedUser(user)}
                                className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>

                              <StatusToggle
                                title="Approval"
                                checked={Boolean(user.approved)}
                                checkedLabel="Approved"
                                uncheckedLabel="Pending"
                                busy={isBusyAction(`approve-${user.firebaseUID}`, `disapprove-${user.firebaseUID}`)}
                                onChange={(nextChecked) =>
                                  runUserAction(user.firebaseUID!, nextChecked ? "approve" : "disapprove")
                                }
                              />

                              <StatusToggle
                                title="Suspension"
                                checked={user.active === false}
                                checkedLabel="Suspended"
                                uncheckedLabel="Live"
                                busy={isBusyAction(`activate-${user.firebaseUID}`, `deactivate-${user.firebaseUID}`)}
                                onChange={(nextChecked) =>
                                  runUserAction(user.firebaseUID!, nextChecked ? "deactivate" : "activate")
                                }
                              />

                              <select
                                value={user.role}
                                onChange={(event) => runUserAction(user.firebaseUID!, "set_role", event.target.value)}
                                className="px-2 py-1 rounded-lg bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                              >
                                <option value="USER">USER</option>
                                <option value="SUPPLIER">SUPPLIER</option>
                                <option value="ADMIN">ADMIN</option>
                              </select>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === "suppliers" ? (
            <div className="space-y-4">
              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={supplierQuery}
                    onChange={(event) => setSupplierQuery(event.target.value)}
                    placeholder="Search suppliers by name, email, UID, branch..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                  />
                </div>

                <select
                  value={supplierApprovalFilter}
                  onChange={(event) =>
                    setSupplierApprovalFilter(event.target.value as "ALL" | "APPROVED" | "PENDING")
                  }
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Approval</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                </select>

                <select
                  value={supplierActivityFilter}
                  onChange={(event) =>
                    setSupplierActivityFilter(event.target.value as "ALL" | "ACTIVE" | "INACTIVE")
                  }
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Activity</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>

                <button
                  onClick={() =>
                    downloadCsv(
                      "admin-suppliers.csv",
                      filteredSuppliers.map((supplier) => ({
                        name: supplier.name || "",
                        email: supplier.email || "",
                        firebaseUID: supplier.firebaseUID || "",
                        approved: supplier.approved,
                        active: supplier.active,
                        ordersHandled: supplier.ordersHandled || 0,
                        paidOrders: supplier.paidOrders || 0,
                        netRevenue: supplier.netRevenue || 0,
                        availableToClaim: supplier.availableToClaim || 0
                      }))
                    )
                  }
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl overflow-x-auto">
                <table className="w-full min-w-[1700px] text-sm">
                  <thead className="bg-gray-100/80 dark:bg-white/5">
                    <tr>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Orders</th>
                      <th className="text-left p-3">Gross</th>
                      <th className="text-left p-3">Net</th>
                      <th className="text-left p-3">Claimed</th>
                      <th className="text-left p-3">Wallet</th>
                      <th className="text-left p-3">Available</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier, index) => (
                      <tr key={supplier.firebaseUID || supplier._id || `sup-${index}`} className="border-t border-gray-200 dark:border-white/10">
                        <td className="p-3">
                          <p className="font-medium">{supplier.name || "-"}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300 break-all">{supplier.email || supplier.firebaseUID || "-"}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(supplier.approved ? "approved" : "pending")}`}>
                              {supplier.approved ? "Approved" : "Pending"}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(supplier.active ? "active" : "inactive")}`}>
                              {supplier.active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </td>
                        <td className="p-3">{supplier.ordersHandled || 0}</td>
                        <td className="p-3">{formatCurrency(supplier.grossDeliveredRevenue)}</td>
                        <td className="p-3">{formatCurrency(supplier.netRevenue)}</td>
                        <td className="p-3">{formatCurrency(supplier.totalClaimed)}</td>
                        <td className="p-3">{formatCurrency(supplier.walletBalance)}</td>
                        <td className="p-3">{formatCurrency(supplier.availableToClaim)}</td>
                        <td className="p-3">
                          {supplier.firebaseUID ? (
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                onClick={() => setSelectedSupplier(supplier)}
                                className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>

                              <StatusToggle
                                title="Approval"
                                checked={Boolean(supplier.approved)}
                                checkedLabel="Approved"
                                uncheckedLabel="Unapproved"
                                busy={isBusyAction(`approve-${supplier.firebaseUID}`, `disapprove-${supplier.firebaseUID}`)}
                                onChange={(nextChecked) =>
                                  runSupplierAction(supplier.firebaseUID!, nextChecked ? "approve" : "disapprove")
                                }
                              />

                              <StatusToggle
                                title="Activity"
                                checked={Boolean(supplier.active)}
                                checkedLabel="Active"
                                uncheckedLabel="Inactive"
                                disabled={!supplier.approved}
                                busy={isBusyAction(`activate-${supplier.firebaseUID}`, `deactivate-${supplier.firebaseUID}`)}
                                onChange={(nextChecked) =>
                                  runSupplierAction(supplier.firebaseUID!, nextChecked ? "activate" : "deactivate")
                                }
                              />
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === "orders" ? (
            <div className="space-y-4">
              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={orderQuery}
                    onChange={(event) => setOrderQuery(event.target.value)}
                    placeholder="Search orders by id, user, supplier, status..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                  />
                </div>

                <select
                  value={orderStatusFilter}
                  onChange={(event) => setOrderStatusFilter(event.target.value as "ALL" | AdminOrder["status"])}
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Status</option>
                  {[
                    "pending",
                    "accepted",
                    "awaiting_payment",
                    "printing",
                    "printed",
                    "delivered",
                    "cancelled"
                  ].map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>

                <select
                  value={orderPaymentFilter}
                  onChange={(event) =>
                    setOrderPaymentFilter(event.target.value as "ALL" | "paid" | "unpaid")
                  }
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Payments</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>

                <select
                  value={orderAssignmentFilter}
                  onChange={(event) =>
                    setOrderAssignmentFilter(event.target.value as "ALL" | "assigned" | "unassigned")
                  }
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Assignments</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>

                <button
                  onClick={() =>
                    downloadCsv(
                      "admin-orders.csv",
                      filteredOrders.map((order) => ({
                        orderId: order._id,
                        user: order.user?.email || order.userUID,
                        supplier: order.supplier?.email || order.supplierUID || "",
                        status: order.status,
                        paymentStatus: order.paymentStatus,
                        requestType: order.requestType || "",
                        printType: order.printType || "",
                        pages: order.verifiedPages ?? order.pages ?? 0,
                        amount: order.finalPrice ?? order.estimatedPrice ?? 0,
                        createdAt: formatDateTime(order.createdAt)
                      }))
                    )
                  }
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl overflow-x-auto">
                <table className="w-full min-w-[1450px] text-sm">
                  <thead className="bg-gray-100/80 dark:bg-white/5">
                    <tr>
                      <th className="text-left p-3">Order</th>
                      <th className="text-left p-3">User</th>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Payment</th>
                      <th className="text-left p-3">Specs</th>
                      <th className="text-left p-3">Amount</th>
                      <th className="text-left p-3">Created</th>
                      <th className="text-left p-3">Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order._id} className="border-t border-gray-200 dark:border-white/10">
                        <td className="p-3 font-medium">{String(order._id).slice(-10)}</td>
                        <td className="p-3">
                          <p>{order.user?.name || "Unknown"}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">{order.user?.email || order.userUID}</p>
                        </td>
                        <td className="p-3">{order.supplier?.name || "Unassigned"}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(order.status)}`}>
                            {formatStatus(order.status)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(order.paymentStatus)}`}>
                            {formatStatus(order.paymentStatus)}
                          </span>
                        </td>
                        <td className="p-3">
                          {String(order.printType || "-").toUpperCase()} • {order.verifiedPages ?? order.pages ?? 0} pages
                        </td>
                        <td className="p-3">{formatCurrency(order.finalPrice ?? order.estimatedPrice)}</td>
                        <td className="p-3">{formatDateTime(order.createdAt)}</td>
                        <td className="p-3">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-2.5 py-1 rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === "pricing" ? (
            <div className="space-y-4">
              <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-4">
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-6">
                  <p className="text-xs uppercase tracking-[0.18em] text-indigo-500 dark:text-cyan-300">
                    Live Pricing Engine
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">Control print rates from the admin portal</h3>
                  <p className="mt-3 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
                    Changes here update new order estimates, supplier verification pricing, the public landing pricing cards, and admin-side recalculation flows.
                  </p>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    {PRINT_TYPE_KEYS.map((key) => (
                      <div
                        key={key}
                        className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-white/5 p-4"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400">{PRINT_TYPE_CONTENT[key].title}</p>
                        <p className="mt-2 text-2xl font-semibold">{formatPricePerPage(pricing[key])}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-indigo-500 dark:text-cyan-300">
                        Edit Rates
                      </p>
                      <h3 className="mt-2 text-xl font-semibold">Update per-page prices</h3>
                    </div>
                    <button
                      onClick={() =>
                        setPricingForm({
                          bw: String(pricing.bw),
                          color: String(pricing.color),
                          glossy: String(pricing.glossy)
                        })
                      }
                      className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 text-xs"
                    >
                      Reset
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    {PRINT_TYPE_KEYS.map((key) => (
                      <label key={key} className="block text-sm">
                        <span className="text-gray-600 dark:text-gray-300">{PRINT_TYPE_CONTENT[key].title}</span>
                        <div className="mt-2 flex items-center rounded-2xl border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-black/20 px-4">
                          <span className="text-sm text-gray-500 dark:text-gray-400">₹</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={pricingForm[key]}
                            onChange={(event) =>
                              setPricingForm((prev) => ({
                                ...prev,
                                [key]: event.target.value
                              }))
                            }
                            className="w-full bg-transparent px-3 py-3 outline-none"
                          />
                          <span className="text-xs text-gray-500 dark:text-gray-400">/ page</span>
                        </div>
                      </label>
                    ))}
                  </div>

                  <p className="mt-4 text-xs leading-6 text-gray-500 dark:text-gray-400">
                    Paid orders stay untouched. Unpaid order calculations use the latest rate whenever they are recalculated.
                  </p>

                  <button
                    onClick={savePricing}
                    disabled={busyAction === "save-pricing"}
                    className="mt-5 w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {busyAction === "save-pricing" ? "Saving..." : "Save Pricing"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "payments" ? (
            <div className="space-y-4">
              <div className="grid lg:grid-cols-4 gap-3">
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Payment Events</p>
                  <p className="text-2xl font-semibold mt-1">{payments.length}</p>
                </div>
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Paid</p>
                  <p className="text-2xl font-semibold mt-1">{payments.filter((item) => item.paymentStatus === "paid").length}</p>
                </div>
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Unpaid</p>
                  <p className="text-2xl font-semibold mt-1">{payments.filter((item) => item.paymentStatus !== "paid").length}</p>
                </div>
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Amount (Rows)</p>
                  <p className="text-2xl font-semibold mt-1">
                    {formatCurrency(payments.reduce((sum, item) => sum + Number(item.amount || 0), 0))}
                  </p>
                </div>
              </div>

              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={paymentQuery}
                    onChange={(event) => setPaymentQuery(event.target.value)}
                    placeholder="Search payments by order, user, razorpay id..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                  />
                </div>

                <select
                  value={paymentStatusFilter}
                  onChange={(event) =>
                    setPaymentStatusFilter(event.target.value as "ALL" | "paid" | "unpaid")
                  }
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>

                <button
                  onClick={() =>
                    downloadCsv(
                      "admin-payments.csv",
                      filteredPayments.map((payment) => ({
                        orderId: payment.orderId,
                        user: payment.user?.email || payment.userUID,
                        amount: payment.amount,
                        paymentStatus: payment.paymentStatus,
                        orderStatus: payment.status || "",
                        razorpayOrderId: payment.razorpayOrderId || "",
                        razorpayPaymentId: payment.razorpayPaymentId || "",
                        paidAt: formatDateTime(payment.paidAt || ""),
                        createdAt: formatDateTime(payment.createdAt || "")
                      }))
                    )
                  }
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl overflow-x-auto">
                <table className="w-full min-w-[1300px] text-sm">
                  <thead className="bg-gray-100/80 dark:bg-white/5">
                    <tr>
                      <th className="text-left p-3">Order</th>
                      <th className="text-left p-3">User</th>
                      <th className="text-left p-3">Amount</th>
                      <th className="text-left p-3">Payment</th>
                      <th className="text-left p-3">Order State</th>
                      <th className="text-left p-3">Gateway IDs</th>
                      <th className="text-left p-3">Paid At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr key={`${payment.orderId}-${payment.razorpayPaymentId || "n"}`} className="border-t border-gray-200 dark:border-white/10">
                        <td className="p-3 font-medium">{String(payment.orderId).slice(-10)}</td>
                        <td className="p-3">
                          <p>{payment.user?.name || payment.user?.email || payment.userUID}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">{payment.user?.email || payment.userUID}</p>
                        </td>
                        <td className="p-3">{formatCurrency(payment.amount)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(payment.paymentStatus)}`}>
                            {formatStatus(payment.paymentStatus)}
                          </span>
                        </td>
                        <td className="p-3">{formatStatus(payment.status || "-")}</td>
                        <td className="p-3 text-xs">
                          <button
                            onClick={() => copyText(String(payment.razorpayPaymentId || ""))}
                            className="block text-left hover:text-indigo-500"
                          >
                            Pay ID: {payment.razorpayPaymentId || "-"}
                          </button>
                          <button
                            onClick={() => copyText(String(payment.razorpayOrderId || ""))}
                            className="block text-left hover:text-indigo-500"
                          >
                            Ord ID: {payment.razorpayOrderId || "-"}
                          </button>
                        </td>
                        <td className="p-3">{formatDateTime(payment.paidAt || payment.createdAt || "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === "payouts" ? (
            <div className="space-y-4">
              <div className="grid lg:grid-cols-4 gap-3">
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pending Requests</p>
                  <p className="text-2xl font-semibold mt-1">{payoutRequests.filter((request) => request.status === "pending").length}</p>
                </div>
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pending Amount</p>
                  <p className="text-2xl font-semibold mt-1">{formatCurrency(pendingPayoutAmount)}</p>
                </div>
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Approved Requests</p>
                  <p className="text-2xl font-semibold mt-1">{payoutRequests.filter((request) => request.status === "approved").length}</p>
                </div>
                <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Rejected Requests</p>
                  <p className="text-2xl font-semibold mt-1">{payoutRequests.filter((request) => request.status === "rejected").length}</p>
                </div>
              </div>

              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={payoutQuery}
                    onChange={(event) => setPayoutQuery(event.target.value)}
                    placeholder="Search payout requests by id, supplier, email..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                  />
                </div>

                <select
                  value={payoutStatusFilter}
                  onChange={(event) =>
                    setPayoutStatusFilter(event.target.value as "ALL" | "pending" | "approved" | "rejected")
                  }
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>

                <button
                  onClick={() =>
                    downloadCsv(
                      "admin-payouts.csv",
                      filteredPayouts.map((request) => ({
                        requestId: request._id,
                        supplier: request.supplier?.email || request.supplierUID,
                        amount: request.amount,
                        status: request.status,
                        note: request.note || "",
                        createdAt: formatDateTime(request.createdAt),
                        processedAt: formatDateTime(request.processedAt || "")
                      }))
                    )
                  }
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl overflow-x-auto">
                <table className="w-full min-w-[1500px] text-sm">
                  <thead className="bg-gray-100/80 dark:bg-white/5">
                    <tr>
                      <th className="text-left p-3">Request</th>
                      <th className="text-left p-3">Supplier</th>
                      <th className="text-left p-3">Amount</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Requested</th>
                      <th className="text-left p-3">Processed</th>
                      <th className="text-left p-3">Note</th>
                      <th className="text-left p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayouts.map((request) => (
                      <tr key={request._id} className="border-t border-gray-200 dark:border-white/10">
                        <td className="p-3 font-medium">{String(request._id).slice(-10)}</td>
                        <td className="p-3">
                          <p>{request.supplier?.name || request.supplierUID}</p>
                          <p className="text-xs text-gray-600 dark:text-gray-300">{request.supplier?.email || "-"}</p>
                        </td>
                        <td className="p-3">{formatCurrency(request.amount)}</td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(request.status)}`}>
                            {formatStatus(request.status)}
                          </span>
                        </td>
                        <td className="p-3">{formatDateTime(request.createdAt)}</td>
                        <td className="p-3">{formatDateTime(request.processedAt || "")}</td>
                        <td className="p-3">
                          <input
                            value={payoutNotes[request._id] ?? request.note ?? ""}
                            onChange={(event) =>
                              setPayoutNotes((prev) => ({
                                ...prev,
                                [request._id]: event.target.value
                              }))
                            }
                            placeholder="Add processing note"
                            className="w-64 px-3 py-2 rounded-lg bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                          />
                        </td>
                        <td className="p-3">
                          {request.status === "pending" ? (
                            <div className="flex gap-2">
                              <button
                                disabled={busyAction === `approve-${request._id}`}
                                onClick={() => runPayoutAction(request._id, "approve")}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/90 text-white"
                              >
                                Approve
                              </button>
                              <button
                                disabled={busyAction === `reject-${request._id}`}
                                onClick={() => runPayoutAction(request._id, "reject")}
                                className="px-3 py-1.5 rounded-lg bg-rose-500/90 text-white"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {activeTab === "feedback" ? (
            <FeedbackPanel feedbacks={feedbacks} />
          ) : null}

          {activeTab === "faqs" ? (
            <FaqManager
              content={faqContent}
              saving={busyAction === "save-faqs"}
              onSave={saveFaqContent}
            />
          ) : null}

          {activeTab === "logs" ? (
            <div className="space-y-4">
              <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input
                    value={logQuery}
                    onChange={(event) => setLogQuery(event.target.value)}
                    placeholder="Search logs by message, actor, entity id, action..."
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                  />
                </div>

                <select
                  value={logLevelFilter}
                  onChange={(event) =>
                    setLogLevelFilter(event.target.value as "ALL" | "info" | "success" | "warning" | "error")
                  }
                  className="px-3 py-2.5 rounded-xl bg-white/80 dark:bg-black/30 border border-gray-200 dark:border-white/20"
                >
                  <option value="ALL">All Levels</option>
                  <option value="info">Info</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>

                <button
                  onClick={() =>
                    downloadCsv(
                      "admin-activity-logs.csv",
                      filteredActivityLogs.map((log) => ({
                        time: formatDateTime(log.createdAt),
                        level: log.level || "info",
                        actorType: log.actorType || "",
                        actor: formatActivityActor(log),
                        action: log.action,
                        entityType: log.entityType,
                        entityId: log.entityId || "",
                        message: log.message
                      }))
                    )
                  }
                  className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </button>
              </div>

              <div className="grid gap-3">
                {filteredActivityLogs.length ? (
                  filteredActivityLogs.map((log, index) => (
                    <div
                      key={log._id || `${log.action}-${index}`}
                      className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-4"
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-[11px] ${getActivityLevelBadge(log.level)}`}>
                              {String(log.level || "info").toUpperCase()}
                            </span>
                            <span className="px-2 py-1 rounded-full text-[11px] border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5">
                              {formatStatus(log.entityType)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{log.action}</span>
                          </div>

                          <p className="font-medium">{log.message}</p>

                          <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-300">
                            <span>Actor: {formatActivityActor(log)}</span>
                            <span>Time: {formatDateTime(log.createdAt)}</span>
                            {log.entityId ? (
                              <button
                                onClick={() => copyText(log.entityId || "")}
                                className="text-left hover:text-indigo-500 dark:hover:text-cyan-300"
                              >
                                Entity: {log.entityId}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="backdrop-blur-2xl bg-white/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-3xl p-6 text-sm text-gray-600 dark:text-gray-300">
                    No logs match the current filters.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "danger" ? (
            <div className="space-y-5">
              <div className="backdrop-blur-2xl bg-rose-500/10 border border-rose-500/40 rounded-3xl p-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-rose-400">Danger Zone</p>
                  <h3 className="text-2xl font-semibold mt-2">Clear Entire Database</h3>
                  <p className="text-sm mt-2 text-rose-200">
                    This permanently removes all users (except admins), all suppliers, and all orders.
                  </p>
                </div>

                <div className="space-y-3 max-w-xl">
                  <input
                    value={confirmPhrase}
                    onChange={(event) => setConfirmPhrase(event.target.value)}
                    placeholder="Type: CLEAR ENTIRE DATABASE"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-rose-500/40"
                  />

                  <input
                    value={confirmOwnerEmail}
                    onChange={(event) => setConfirmOwnerEmail(event.target.value)}
                    placeholder="Type your owner email"
                    className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-rose-500/40"
                  />

                  <button
                    disabled={busyAction === "clear-db"}
                    onClick={clearDatabase}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 text-white disabled:opacity-60"
                  >
                    {busyAction === "clear-db" ? "Clearing..." : "Clear Database"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {showControlHub ? (
        <div className="fixed inset-0 z-[135]">
          <button
            onClick={() => setShowControlHub(false)}
            className="absolute inset-0 bg-black/45 backdrop-blur-md"
            aria-label="Close control hub"
          />

          <div className="relative w-[min(980px,94vw)] mt-[8vh] mx-auto rounded-3xl border border-gray-200 dark:border-white/20 bg-white/85 dark:bg-black/80 backdrop-blur-3xl shadow-[0_20px_80px_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 dark:text-cyan-300">Control Hub</p>
                  <p className="text-sm font-semibold">Operator Quick Actions</p>
                </div>
              </div>

              <button
                onClick={() => setShowControlHub(false)}
                className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/20 bg-white/70 dark:bg-white/5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid md:grid-cols-2 xl:grid-cols-5 gap-3">
                {[
                  { label: "Auto Sync", value: autoRefresh ? "On (60s)" : "Off" },
                  { label: "Stale Orders", value: String(staleOrders.length) },
                  { label: "Pending Payouts", value: String(payoutRequests.filter((item) => item.status === "pending").length) },
                  { label: "Inactive Accounts", value: String(inactiveUsers.length + inactiveSuppliers.length) },
                  { label: "Landing Feedback", value: platformSettings.landingFeedbackVisible ? "Visible" : "Hidden" }
                ].map((card) => (
                  <div
                    key={card.label}
                    className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/5 p-4"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
                    <p className="text-xl font-semibold mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-4 md:col-span-2 xl:col-span-3">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">Landing Feedback Showcase</p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                        Control whether the public feedback strip is visible on the landing page.
                      </p>
                    </div>

                    <StatusToggle
                      title="Visibility"
                      checked={platformSettings.landingFeedbackVisible}
                      checkedLabel="Visible"
                      uncheckedLabel="Hidden"
                      busy={busyAction === "toggle-landing-feedback"}
                      onChange={setLandingFeedbackVisible}
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveTab("orders")
                    setOrderAssignmentFilter("unassigned")
                    setOrderStatusFilter("pending")
                    setShowControlHub(false)
                  }}
                  className="text-left rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  <p className="font-medium">Investigate Unassigned Queue</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Pending + Unassigned orders</p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("payouts")
                    setPayoutStatusFilter("pending")
                    setShowControlHub(false)
                  }}
                  className="text-left rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  <p className="font-medium">Review Payout Queue</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">All pending supplier payout requests</p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("suppliers")
                    setSupplierApprovalFilter("PENDING")
                    setShowControlHub(false)
                  }}
                  className="text-left rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  <p className="font-medium">Supplier Approval Desk</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Jump to pending supplier approvals</p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("pricing")
                    setShowControlHub(false)
                  }}
                  className="text-left rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  <p className="font-medium">Pricing Controls</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Adjust public and operational per-page rates</p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("users")
                    setUserActivityFilter("INACTIVE")
                    setShowControlHub(false)
                  }}
                  className="text-left rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  <p className="font-medium">Inactive User Audit</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Inspect all inactive users instantly</p>
                </button>

                <button
                  onClick={() => {
                    refreshAll(false).catch(() => {})
                    setShowControlHub(false)
                  }}
                  className="text-left rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  <p className="font-medium">Run Full Sync</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Refresh all admin datasets now</p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("logs")
                    setShowControlHub(false)
                  }}
                  className="text-left rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  <p className="font-medium">Open Activity Logs</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Inspect the latest platform events and admin actions</p>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("overview")
                    setShowControlHub(false)
                  }}
                  className="text-left rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 px-4 py-3 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                >
                  <p className="font-medium">Back to Overview</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Return to command center dashboard</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {ordersWorkspace ? (
        <div className="fixed inset-0 z-[145]">
          <button
            onClick={() => {
              setOrdersWorkspace(null)
              setWorkspaceOrderDetail(null)
            }}
            className="absolute inset-0 bg-black/55 backdrop-blur-md"
            aria-label="Close order stats workspace"
          />

          <div className="relative w-[min(1240px,95vw)] mt-[6vh] mx-auto rounded-3xl border border-gray-200 dark:border-white/20 bg-white/90 dark:bg-black/85 backdrop-blur-3xl shadow-[0_20px_80px_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>

                {ordersWorkspace.photoURL ? (
                  <img
                    src={ordersWorkspace.photoURL}
                    alt={ordersWorkspace.name}
                    className="w-10 h-10 rounded-xl object-cover border border-gray-200 dark:border-white/20"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-black font-semibold">
                    {getNameInitial(ordersWorkspace.name, ordersWorkspace.email)}
                  </div>
                )}

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 dark:text-cyan-300">
                    {ordersWorkspace.type === "user" ? "User Orders" : "Supplier Orders"} Workspace
                  </p>
                  <p className="text-sm font-semibold">{ordersWorkspace.name}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setOrdersWorkspace(null)
                  setWorkspaceOrderDetail(null)
                }}
                className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/20 bg-white/70 dark:bg-white/5 text-sm"
              >
                Close Window
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid md:grid-cols-2 xl:grid-cols-6 gap-3">
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                  <p className="text-xl font-semibold mt-1">{workspaceStats.total}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Paid</p>
                  <p className="text-xl font-semibold mt-1">{workspaceStats.paid}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Unpaid</p>
                  <p className="text-xl font-semibold mt-1">{workspaceStats.unpaid}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                  <p className="text-xl font-semibold mt-1">{workspaceStats.active}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Delivered</p>
                  <p className="text-xl font-semibold mt-1">{workspaceStats.delivered}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Amount</p>
                  <p className="text-xl font-semibold mt-1">{formatCurrency(workspaceStats.revenue)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "pending", label: "Pending" },
                  { key: "accepted", label: "Accepted" },
                  { key: "awaiting_payment", label: "Awaiting Payment" },
                  { key: "printing", label: "Printing" },
                  { key: "printed", label: "Printed" },
                  { key: "delivered", label: "Delivered" },
                  { key: "cancelled", label: "Cancelled" },
                  { key: "paid", label: "Paid" },
                  { key: "unpaid", label: "Unpaid" }
                ].map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => setWorkspaceFilter(filter.key as WorkspaceFilter)}
                    className={`px-3 py-1.5 rounded-full border text-xs ${
                      workspaceFilter === filter.key
                        ? "bg-gradient-to-r from-indigo-500 to-cyan-500 border-transparent text-white"
                        : "border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5"
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[52vh] overflow-y-auto pr-1">
                {workspaceOrders.map((order) => (
                  <div
                    key={`workspace-${order._id}`}
                    className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-white/5 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm">{String(order._id).slice(-10)}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300">{formatDateTime(order.createdAt)}</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-[11px] ${getStatusBadge(order.status)}`}>
                        {formatStatus(order.status)}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 text-gray-600 dark:text-gray-300">
                      <p>User: {order.user?.name || order.userUID}</p>
                      <p>Supplier: {order.supplier?.name || order.supplierUID || "Unassigned"}</p>
                      <p>Print: {String(order.printType || "-").toUpperCase()} • {order.verifiedPages ?? order.pages ?? 0} pages</p>
                      <p>Amount: {formatCurrency(order.finalPrice ?? order.estimatedPrice)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setWorkspaceOrderDetail(order)}
                        className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 text-xs"
                      >
                        Open Details
                      </button>
                      {order.fileURL ? (
                        <a
                          href={order.fileURL}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 text-xs"
                        >
                          File
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}

                {workspaceOrders.length === 0 ? (
                  <div className="md:col-span-2 xl:col-span-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/85 dark:bg-white/5 p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    No orders found for this filter.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {workspaceOrderDetail ? (
        <div className="fixed inset-0 z-[155]">
          <button
            onClick={() => setWorkspaceOrderDetail(null)}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-label="Close workspace order details"
          />

          <div className="relative w-[min(880px,94vw)] mt-[10vh] mx-auto rounded-3xl border border-gray-200 dark:border-white/20 bg-white/92 dark:bg-black/88 backdrop-blur-3xl shadow-[0_20px_80px_rgba(0,0,0,0.45)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500" />
                  <span className="w-3 h-3 rounded-full bg-amber-400" />
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 dark:text-cyan-300">Order Window</p>
                  <p className="text-sm font-semibold">Detailed Order Diagnostics</p>
                </div>
              </div>

              <button
                onClick={() => setWorkspaceOrderDetail(null)}
                className="px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/20 bg-white/70 dark:bg-white/5 text-sm"
              >
                Close
              </button>
            </div>

            <div className="p-5 grid md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Order ID</p>
                  <p className="font-semibold mt-1">{workspaceOrderDetail._id}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Lifecycle</p>
                  <p className="font-semibold mt-1">{formatStatus(workspaceOrderDetail.status)} • {formatStatus(workspaceOrderDetail.paymentStatus)}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pricing</p>
                  <p className="font-semibold mt-1">{formatCurrency(workspaceOrderDetail.finalPrice ?? workspaceOrderDetail.estimatedPrice)}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Pages</p>
                  <p className="font-semibold mt-1">{workspaceOrderDetail.verifiedPages ?? workspaceOrderDetail.pages ?? 0}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">User</p>
                  <p className="font-semibold mt-1">{workspaceOrderDetail.user?.name || workspaceOrderDetail.userUID}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">{workspaceOrderDetail.user?.email || workspaceOrderDetail.userUID}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Supplier</p>
                  <p className="font-semibold mt-1">{workspaceOrderDetail.supplier?.name || workspaceOrderDetail.supplierUID || "Unassigned"}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Timestamps</p>
                  <p>Created: {formatDateTime(workspaceOrderDetail.createdAt)}</p>
                  <p>Paid: {formatDateTime(workspaceOrderDetail.paidAt || "")}</p>
                  <p>Delivered: {formatDateTime(workspaceOrderDetail.deliveredAt || "")}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Instructions</p>
                  <p className="font-medium mt-1">{workspaceOrderDetail.instruction || "-"}</p>
                </div>

                {workspaceOrderDetail.pdfPasswordRequired ? (
                  <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">PDF Password</p>
                    <p className="font-medium mt-1">{workspaceOrderDetail.pdfPassword || "-"}</p>
                  </div>
                ) : null}

                {workspaceOrderDetail.fileURL ? (
                  <a
                    href={workspaceOrderDetail.fileURL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-white/10"
                  >
                    Open Uploaded File
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedUser ? (
        <div className="fixed inset-0 z-[120]">
          <button
            onClick={() => setSelectedUser(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            aria-label="Close user profile"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white/85 dark:bg-black/85 backdrop-blur-3xl border-l border-gray-200 dark:border-white/10 p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {resolveProfilePhoto(selectedUser.photoURL, selectedUser.firebasePhotoURL) ? (
                  <img
                    src={resolveProfilePhoto(selectedUser.photoURL, selectedUser.firebasePhotoURL)}
                    alt={selectedUser.name || "User"}
                    className="w-16 h-16 rounded-2xl object-cover border border-gray-200 dark:border-white/20"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-black font-bold text-xl">
                    {getNameInitial(selectedUser.name, selectedUser.email)}
                  </div>
                )}

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 dark:text-cyan-300">User Profile</p>
                  <h3 className="text-2xl font-semibold mt-1">{selectedUser.name || "Unknown user"}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 break-all">{selectedUser.email || selectedUser.firebaseUID}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-white/20 bg-white/70 dark:bg-white/5 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Role</p>
                <p className="font-semibold mt-1">{selectedUser.role}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                <p className="font-semibold mt-1">{selectedUser.phone || "-"}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Branch / Section</p>
                <p className="font-semibold mt-1">{selectedUser.branch || "-"} {selectedUser.section ? `• ${selectedUser.section}` : ""}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Roll No</p>
                <p className="font-semibold mt-1">{selectedUser.rollNo || "-"}</p>
              </div>
            </div>

            {userPanelMetrics ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Orders</p>
                  <p className="font-semibold mt-1">{userPanelMetrics.orderCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Paid Orders</p>
                  <p className="font-semibold mt-1">{userPanelMetrics.paidCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Active Orders</p>
                  <p className="font-semibold mt-1">{userPanelMetrics.activeCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Delivered</p>
                  <p className="font-semibold mt-1">{userPanelMetrics.deliveredCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cancelled</p>
                  <p className="font-semibold mt-1">{userPanelMetrics.cancelledCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Avg Order Value</p>
                  <p className="font-semibold mt-1">{formatCurrency(userPanelMetrics.averageOrderValue)}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3 col-span-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total Spend</p>
                  <p className="font-semibold mt-1">{formatCurrency(userPanelMetrics.spend)}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium">Quick Actions</p>

              <div className="flex flex-wrap gap-2">
                {selectedUser.firebaseUID ? (
                  <>
                    <button
                      onClick={() =>
                        openOrdersWorkspace({
                          type: "user",
                          id: selectedUser.firebaseUID!,
                          name: selectedUser.name || "User",
                          email: selectedUser.email || "",
                          photoURL: resolveProfilePhoto(selectedUser.photoURL, selectedUser.firebasePhotoURL)
                        })
                      }
                      className="px-3 py-2 rounded-xl border border-indigo-400/40 bg-indigo-500/15 text-indigo-500 dark:text-cyan-200 text-sm"
                    >
                      Order Stats Window
                    </button>
                    <StatusToggle
                      title="Approval"
                      checked={Boolean(selectedUser.approved)}
                      checkedLabel="Approved"
                      uncheckedLabel="Pending"
                      busy={isBusyAction(`approve-${selectedUser.firebaseUID}`, `disapprove-${selectedUser.firebaseUID}`)}
                      onChange={(nextChecked) =>
                        runUserAction(selectedUser.firebaseUID!, nextChecked ? "approve" : "disapprove")
                      }
                    />
                    <StatusToggle
                      title="Suspension"
                      checked={selectedUser.active === false}
                      checkedLabel="Suspended"
                      uncheckedLabel="Live"
                      busy={isBusyAction(`activate-${selectedUser.firebaseUID}`, `deactivate-${selectedUser.firebaseUID}`)}
                      onChange={(nextChecked) =>
                        runUserAction(selectedUser.firebaseUID!, nextChecked ? "deactivate" : "activate")
                      }
                    />
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Recent Orders</p>
              <div className="space-y-2">
                {(selectedUser.firebaseUID ? (userOrdersMap.get(selectedUser.firebaseUID) || []).slice(0, 5) : []).map((order) => (
                  <button
                    key={order._id}
                    onClick={() => setSelectedOrder(order)}
                    className="w-full text-left rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                  >
                    <p className="text-sm font-medium">{String(order._id).slice(-10)} • {formatStatus(order.status)}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{formatCurrency(order.finalPrice ?? order.estimatedPrice)} • {formatDateTime(order.createdAt)}</p>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {selectedSupplier ? (
        <div className="fixed inset-0 z-[120]">
          <button
            onClick={() => setSelectedSupplier(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            aria-label="Close supplier profile"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-xl bg-white/85 dark:bg-black/85 backdrop-blur-3xl border-l border-gray-200 dark:border-white/10 p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {resolveProfilePhoto(selectedSupplier.photoURL, selectedSupplier.firebasePhotoURL) ? (
                  <img
                    src={resolveProfilePhoto(selectedSupplier.photoURL, selectedSupplier.firebasePhotoURL)}
                    alt={selectedSupplier.name || "Supplier"}
                    className="w-16 h-16 rounded-2xl object-cover border border-gray-200 dark:border-white/20"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-black font-bold text-xl">
                    {getNameInitial(selectedSupplier.name, selectedSupplier.email)}
                  </div>
                )}

                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 dark:text-cyan-300">Supplier Profile</p>
                  <h3 className="text-2xl font-semibold mt-1">{selectedSupplier.name || "Unknown supplier"}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 break-all">{selectedSupplier.email || selectedSupplier.firebaseUID}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSupplier(null)}
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-white/20 bg-white/70 dark:bg-white/5 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Approval</p>
                <p className="font-semibold mt-1">{selectedSupplier.approved ? "Approved" : "Pending"}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Activity</p>
                <p className="font-semibold mt-1">{selectedSupplier.active ? "Active" : "Inactive"}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                <p className="font-semibold mt-1">{selectedSupplier.phone || "-"}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Branch / Year</p>
                <p className="font-semibold mt-1">{selectedSupplier.branch || "-"} {selectedSupplier.year ? `• ${selectedSupplier.year}` : ""}</p>
              </div>
            </div>

            {supplierPanelMetrics ? (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Orders handled</p>
                  <p className="font-semibold mt-1">{supplierPanelMetrics.orderCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Delivered</p>
                  <p className="font-semibold mt-1">{supplierPanelMetrics.deliveredCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Active Queue</p>
                  <p className="font-semibold mt-1">{supplierPanelMetrics.activeOrders}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Paid Orders</p>
                  <p className="font-semibold mt-1">{supplierPanelMetrics.paidCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Awaiting Payment</p>
                  <p className="font-semibold mt-1">{supplierPanelMetrics.awaitingPaymentCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">In Print</p>
                  <p className="font-semibold mt-1">{supplierPanelMetrics.printingCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cancelled</p>
                  <p className="font-semibold mt-1">{supplierPanelMetrics.cancelledCount}</p>
                </div>
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Net Revenue</p>
                  <p className="font-semibold mt-1">{formatCurrency(supplierPanelMetrics.revenue)}</p>
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Net Revenue</p>
                <p className="font-semibold mt-1">{formatCurrency(selectedSupplier.netRevenue)}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Available to Claim</p>
                <p className="font-semibold mt-1">{formatCurrency(selectedSupplier.availableToClaim)}</p>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium">Quick Actions</p>
              <div className="flex flex-wrap gap-2">
                {selectedSupplier.firebaseUID ? (
                  <>
                    <button
                      onClick={() =>
                        openOrdersWorkspace({
                          type: "supplier",
                          id: selectedSupplier.firebaseUID!,
                          name: selectedSupplier.name || "Supplier",
                          email: selectedSupplier.email || "",
                          photoURL: resolveProfilePhoto(selectedSupplier.photoURL, selectedSupplier.firebasePhotoURL)
                        })
                      }
                      className="px-3 py-2 rounded-xl border border-indigo-400/40 bg-indigo-500/15 text-indigo-500 dark:text-cyan-200 text-sm"
                    >
                      Order Stats Window
                    </button>
                    <StatusToggle
                      title="Approval"
                      checked={Boolean(selectedSupplier.approved)}
                      checkedLabel="Approved"
                      uncheckedLabel="Unapproved"
                      busy={isBusyAction(`approve-${selectedSupplier.firebaseUID}`, `disapprove-${selectedSupplier.firebaseUID}`)}
                      onChange={(nextChecked) =>
                        runSupplierAction(selectedSupplier.firebaseUID!, nextChecked ? "approve" : "disapprove")
                      }
                    />
                    <StatusToggle
                      title="Activity"
                      checked={Boolean(selectedSupplier.active)}
                      checkedLabel="Active"
                      uncheckedLabel="Inactive"
                      disabled={!selectedSupplier.approved}
                      busy={isBusyAction(`activate-${selectedSupplier.firebaseUID}`, `deactivate-${selectedSupplier.firebaseUID}`)}
                      onChange={(nextChecked) =>
                        runSupplierAction(selectedSupplier.firebaseUID!, nextChecked ? "activate" : "deactivate")
                      }
                    />
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Recent Assigned Orders</p>
              <div className="space-y-2">
                {(selectedSupplier.firebaseUID
                  ? (supplierOrdersMap.get(selectedSupplier.firebaseUID) || []).slice(0, 5)
                  : []
                ).map((order) => (
                  <button
                    key={order._id}
                    onClick={() => setSelectedOrder(order)}
                    className="w-full text-left rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3 hover:bg-gray-100 dark:hover:bg-white/10 transition"
                  >
                    <p className="text-sm font-medium">{String(order._id).slice(-10)} • {formatStatus(order.status)}</p>
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{formatCurrency(order.finalPrice ?? order.estimatedPrice)} • {formatDateTime(order.createdAt)}</p>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {selectedOrder ? (
        <div className="fixed inset-0 z-[130]">
          <button
            onClick={() => setSelectedOrder(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
            aria-label="Close order panel"
          />

          <aside className="absolute right-0 top-0 h-full w-full max-w-lg bg-white/85 dark:bg-black/85 backdrop-blur-3xl border-l border-gray-200 dark:border-white/10 p-6 overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-500 dark:text-cyan-300">Order Diagnostics</p>
                <h3 className="text-2xl font-semibold mt-2">{String(selectedOrder._id).slice(-10)}</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-9 h-9 rounded-full border border-gray-200 dark:border-white/20 bg-white/70 dark:bg-white/5 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                <p className="font-semibold mt-1">{formatStatus(selectedOrder.status)}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Payment</p>
                <p className="font-semibold mt-1">{formatStatus(selectedOrder.paymentStatus)}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
                <p className="font-semibold mt-1">{String(selectedOrder.printType || "-").toUpperCase()}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Pages</p>
                <p className="font-semibold mt-1">{selectedOrder.verifiedPages ?? selectedOrder.pages ?? 0}</p>
              </div>
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-3 col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                <p className="font-semibold mt-1">{formatCurrency(selectedOrder.finalPrice ?? selectedOrder.estimatedPrice)}</p>
              </div>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 p-4">
              <div>
                <p className="text-sm font-semibold">Order Controls</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {selectedOrder.paymentStatus === "paid"
                    ? "Paid order: status can be managed, pricing is locked."
                    : "Unpaid order: status, page count, amount, and discount can be managed."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Status
                  <select
                    value={orderEditForm.status}
                    onChange={(event) =>
                      setOrderEditForm((prev) => ({
                        ...prev,
                        status: event.target.value
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-black/30 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  >
                    {getOrderStatusOptions(selectedOrder.paymentStatus, orderEditForm.status || selectedOrder.status).map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Verified Pages
                  <input
                    type="number"
                    min="1"
                    value={orderEditForm.verifiedPages}
                    disabled={selectedOrder.paymentStatus === "paid"}
                    onChange={(event) =>
                      setOrderEditForm((prev) => ({
                        ...prev,
                        verifiedPages: event.target.value
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-black/30 px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:text-white"
                  />
                </label>

                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Final Amount (INR)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderEditForm.finalPrice}
                    disabled={selectedOrder.paymentStatus === "paid"}
                    onChange={(event) =>
                      setOrderEditForm((prev) => ({
                        ...prev,
                        finalPrice: event.target.value
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-black/30 px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:text-white"
                  />
                </label>

                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Discount %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={orderEditForm.discountPercent}
                    disabled={selectedOrder.paymentStatus === "paid"}
                    onChange={(event) =>
                      setOrderEditForm((prev) => ({
                        ...prev,
                        discountPercent: event.target.value,
                        discountAmount: event.target.value ? "" : prev.discountAmount
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-black/30 px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:text-white"
                  />
                </label>

                <label className="text-xs text-gray-500 dark:text-gray-400 col-span-2">
                  Discount Amount (INR)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={orderEditForm.discountAmount}
                    disabled={selectedOrder.paymentStatus === "paid"}
                    onChange={(event) =>
                      setOrderEditForm((prev) => ({
                        ...prev,
                        discountAmount: event.target.value,
                        discountPercent: event.target.value ? "" : prev.discountPercent
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-black/30 px-3 py-2 text-sm text-gray-900 disabled:opacity-60 dark:text-white"
                  />
                </label>
              </div>

              <label className="text-xs text-gray-500 dark:text-gray-400">
                Admin Note
                <textarea
                  value={orderEditForm.note}
                  onChange={(event) =>
                    setOrderEditForm((prev) => ({
                      ...prev,
                      note: event.target.value
                    }))
                  }
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-black/30 px-3 py-2 text-sm text-gray-900 dark:text-white"
                  placeholder="Optional note for order log"
                />
              </label>

              <button
                onClick={runOrderUpdate}
                disabled={busyAction === `order-update-${selectedOrder._id}`}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busyAction === `order-update-${selectedOrder._id}` ? "Saving..." : "Save Order Changes"}
              </button>
            </div>

            <div className="mt-5 space-y-3 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">User</p>
                <p className="font-medium">{selectedOrder.user?.name || "Unknown"}</p>
                <p className="text-gray-600 dark:text-gray-300 text-xs">{selectedOrder.user?.email || selectedOrder.userUID}</p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">Supplier</p>
                <p className="font-medium">{selectedOrder.supplier?.name || "Unassigned"}</p>
                <p className="text-gray-600 dark:text-gray-300 text-xs">{selectedOrder.supplierUID || "-"}</p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">Request Type</p>
                <p className="font-medium">{formatStatus(selectedOrder.requestType || "global")}</p>
              </div>

              <div>
                <p className="text-gray-500 dark:text-gray-400">Instruction</p>
                <p className="font-medium">{selectedOrder.instruction || "-"}</p>
              </div>

              {selectedOrder.pdfPasswordRequired ? (
                <div>
                  <p className="text-gray-500 dark:text-gray-400">PDF Password</p>
                  <p className="font-medium">{selectedOrder.pdfPassword || "-"}</p>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Created</p>
                  <p className="font-medium">{formatDateTime(selectedOrder.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-400">Paid At</p>
                  <p className="font-medium">{formatDateTime(selectedOrder.paidAt || "")}</p>
                </div>
              </div>

              {selectedOrder.fileURL ? (
                <a
                  href={selectedOrder.fileURL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-white/20 bg-white/80 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10"
                >
                  Open Uploaded File
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  )
}
