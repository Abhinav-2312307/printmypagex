"use client"

import React, { useEffect, useState, useMemo, use } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  ShieldCheck,
  Clock,
  Printer,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Lock,
  Layers,
  Copy,
  Receipt
} from "lucide-react"

type OrderDetails = {
  id: string
  shortId: string
  status: string
  paymentStatus: string
  paymentExpiresAt?: string | null
  paidAt?: string | null
  pages: number
  copies: number
  printType: string
  duplex: boolean
  spiralBinding: boolean
  instruction?: string
  amount: number
  customerName?: string
  files?: Array<{ name: string; pages: number }>
}

type PayLinkRazorpayResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== "undefined" && (window as any).Razorpay) return Promise.resolve(true)
  return new Promise((resolve) => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function DirectPaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params)
  const orderId = resolvedParams.orderId
  const searchParams = useSearchParams()
  const token = searchParams.get("token") || ""

  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [error, setError] = useState<string>("")
  const [isExpired, setIsExpired] = useState(false)
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paying, setPaying] = useState(false)
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null)

  // Fetch order details
  useEffect(() => {
    if (!orderId || !token) {
      setError("Invalid payment link. Missing order reference or security token.")
      setLoading(false)
      return
    }

    let isMounted = true

    async function fetchOrder() {
      try {
        setLoading(true)
        setError("")
        const res = await fetch(`/api/pay?orderId=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`)
        const data = await res.json()

        if (!isMounted) return

        if (!res.ok || !data.success) {
          if (data.expired) {
            setIsExpired(true)
            setError(data.message || "This payment link has expired.")
          } else {
            setError(data.message || "Unable to retrieve order details.")
          }
          setLoading(false)
          return
        }

        if (data.alreadyPaid) {
          setAlreadyPaid(true)
          setOrder(data.order)
          setLoading(false)
          return
        }

        setOrder(data.order)
        setLoading(false)
      } catch (err) {
        if (!isMounted) return
        setError("Network error. Please check your internet connection and try again.")
        setLoading(false)
      }
    }

    fetchOrder()

    return () => {
      isMounted = false
    }
  }, [orderId, token])

  // Countdown timer
  useEffect(() => {
    if (!order?.paymentExpiresAt || alreadyPaid || paymentSuccess) return

    const expiryTime = new Date(order.paymentExpiresAt).getTime()

    const updateTimer = () => {
      const now = Date.now()
      const diff = expiryTime - now

      if (diff <= 0) {
        setTimeLeft(null)
        setIsExpired(true)
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeLeft({ hours, minutes, seconds })
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [order?.paymentExpiresAt, alreadyPaid, paymentSuccess])

  // Handle Pay Click
  const handlePay = async () => {
    if (!order || paying || isExpired || alreadyPaid) return
    setPaying(true)

    try {
      const loaded = await loadRazorpayScript()
      const RazorpayClass = (window as any).Razorpay
      if (!loaded || !RazorpayClass) {
        setError("Payment gateway failed to initialize. Please reload the page.")
        setPaying(false)
        return
      }

      const res = await fetch("/api/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, token })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.message || "Failed to create payment transaction.")
        setPaying(false)
        return
      }

      const razorpay = new RazorpayClass({
        key: data.key,
        amount: data.amount,
        currency: data.currency,
        name: "PrintMyPage",
        description: `Order #${order.shortId} Print Payment`,
        order_id: data.razorpayOrderId,
        theme: {
          color: "#4f46e5"
        },
        handler: async (response: PayLinkRazorpayResponse) => {
          try {
            const verifyRes = await fetch("/api/pay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId,
                token,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            })

            const verifyData = await verifyRes.json()

            if (!verifyRes.ok || !verifyData.success) {
              setError(verifyData.message || "Payment verification failed. Please contact support.")
              setPaying(false)
              return
            }

            setPaymentSuccess(true)
            setPaying(false)
          } catch (verifyErr) {
            setError("Error verifying transaction. Please contact support if amount was deducted.")
            setPaying(false)
          }
        },
        modal: {
          ondismiss: () => {
            setPaying(false)
          }
        }
      })

      razorpay.open()
    } catch (err) {
      setError("Something went wrong while initiating payment.")
      setPaying(false)
    }
  }

  const printTypeLabel = useMemo(() => {
    if (!order) return ""
    switch (order.printType) {
      case "bw":
        return "Black & White"
      case "color":
        return "Color Print"
      case "glossy":
        return "Glossy Print"
      default:
        return order.printType.toUpperCase()
    }
  }, [order])

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6 md:p-10">
      {/* Top Header */}
      <header className="max-w-xl mx-auto w-full flex items-center justify-between pb-6 border-b border-slate-800">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-600/40 transition">
            <Printer className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            PrintMyPage
          </span>
        </Link>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Secure Checkout</span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="max-w-xl mx-auto w-full my-auto py-8">
        {loading ? (
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-4">
            <div className="w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Verifying secure payment link...</p>
          </div>
        ) : paymentSuccess ? (
          /* Payment Confirmed State */
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Payment Successful!</h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                Thank you! Your payment of{" "}
                <span className="font-semibold text-emerald-400">₹{order?.amount.toFixed(2)}</span> has been confirmed.
              </p>
              <p className="text-slate-400 text-xs">
                Order <span className="font-mono text-slate-200">#{order?.shortId}</span> has been sent directly to the supplier queue for printing.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/user/orders"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition shadow-lg shadow-indigo-600/20"
              >
                <span>View in My Orders</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : alreadyPaid ? (
          /* Already Paid State */
          <div className="bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-6">
            <div className="w-14 h-14 bg-indigo-500/20 border border-indigo-500/40 rounded-2xl flex items-center justify-center mx-auto text-indigo-400">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Order Already Paid</h1>
              <p className="text-slate-300 text-sm">
                This order (<span className="font-mono text-indigo-400">#{order?.shortId}</span>) has already been paid and is currently in printing.
              </p>
            </div>

            <Link
              href="/user/orders"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
            >
              <span>Go to My Orders</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : isExpired ? (
          /* Expired State */
          <div className="bg-slate-900/90 border border-red-500/30 rounded-3xl p-8 sm:p-10 shadow-2xl backdrop-blur-xl text-center space-y-6">
            <div className="w-14 h-14 bg-red-500/20 border border-red-500/40 rounded-2xl flex items-center justify-center mx-auto text-red-400">
              <AlertCircle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-white tracking-tight">Payment Window Expired</h1>
              <p className="text-slate-300 text-sm leading-relaxed">
                The allotted time to complete payment for this order has expired.
              </p>
              <p className="text-slate-400 text-xs">
                Please contact our administrator or support to request a fresh payment window.
              </p>
            </div>

            <Link
              href="/user/orders"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition"
            >
              <span>Back to Orders</span>
            </Link>
          </div>
        ) : order ? (
          /* Active Order Summary & Checkout Card */
          <div className="bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6 relative overflow-hidden">
            {/* Top decorative gradient glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

            {/* Title & Greeting */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-indigo-400">
                  Direct Print Payment
                </span>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-0.5">
                  Order #{order.shortId}
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Ready for printing upon payment confirmation.
                </p>
              </div>

              {/* Order Status Badge */}
              <div className="px-3 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                Awaiting Payment
              </div>
            </div>

            {/* Countdown timer alert */}
            {timeLeft && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-800/50 text-indigo-200 text-xs">
                <Clock className="w-4 h-4 text-indigo-400 flex-shrink-0 animate-pulse" />
                <div className="flex-1">
                  <span className="font-medium">Payment window closing in: </span>
                  <span className="font-mono font-bold text-white ml-1">
                    {String(timeLeft.hours).padStart(2, "0")}h : {String(timeLeft.minutes).padStart(2, "0")}m : {String(timeLeft.seconds).padStart(2, "0")}s
                  </span>
                </div>
              </div>
            )}

            {/* Error Message if any */}
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-800/50 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Print Specification Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Print Type</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{printTypeLabel}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Pages</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{order.pages} pages</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Copies</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{order.copies} {order.copies > 1 ? "copies" : "copy"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Sides</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{order.duplex ? "Double-sided" : "Single-sided"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Binding</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{order.spiralBinding ? "Spiral Binding" : "None"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Files</span>
                <span className="font-semibold text-slate-200 mt-0.5 block">{order.files?.length || 1} file(s)</span>
              </div>
            </div>

            {/* File List Summary */}
            {order.files && order.files.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Documents Included</span>
                <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                  {order.files.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs bg-slate-800/40 border border-slate-800 px-3 py-2 rounded-xl"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <FileText className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                        <span className="truncate text-slate-300 font-medium">{file.name}</span>
                      </div>
                      <span className="text-slate-500 flex-shrink-0 text-[11px]">{file.pages} pgs</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Instructions if any */}
            {order.instruction && (
              <div className="p-3 rounded-xl bg-slate-800/30 border border-slate-800 text-xs text-slate-400">
                <span className="font-semibold text-slate-300 block mb-0.5">Special Instructions:</span>
                {order.instruction}
              </div>
            )}

            {/* Pricing Breakdown & Big Action Button */}
            <div className="pt-2 border-t border-slate-800 space-y-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-xs text-slate-400">Total Payable Amount</span>
                  <p className="text-[11px] text-slate-500">Includes all taxes and print processing</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-white tracking-tight">
                    ₹{order.amount.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={handlePay}
                disabled={paying || isExpired}
                className="w-full relative group overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 p-px font-semibold text-white shadow-xl shadow-emerald-500/10 hover:shadow-emerald-500/20 active:scale-[0.99] transition disabled:opacity-50 disabled:pointer-events-none"
              >
                <div className="relative px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-indigo-600 group-hover:from-emerald-500 group-hover:to-indigo-500 flex items-center justify-center gap-3 transition">
                  {paying ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span className="text-base font-semibold">Opening Payment Gateway...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 text-emerald-200" />
                      <span className="text-base font-bold">
                        Pay ₹{order.amount.toFixed(2)} with UPI / Cards
                      </span>
                      <ArrowRight className="w-4 h-4 text-emerald-200 group-hover:translate-x-1 transition" />
                    </>
                  )}
                </div>
              </button>

              <div className="flex items-center justify-center gap-4 text-[11px] text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Powered by Razorpay
                </span>
                <span>•</span>
                <span>Supports GPay, PhonePe, Paytm, Cards</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 text-center text-slate-400">
            {error || "Order details not available."}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-xl mx-auto w-full text-center text-xs text-slate-500 pt-4 border-t border-slate-800/60">
        <p>© {new Date().getFullYear()} PrintMyPage. All rights reserved.</p>
      </footer>
    </div>
  )
}
