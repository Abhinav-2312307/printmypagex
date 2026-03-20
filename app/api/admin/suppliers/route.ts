import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"
import Order from "@/models/Order"
import SupplierPayoutRequest from "@/models/SupplierPayoutRequest"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import {
  createEmptyRevenueBreakdown,
  addRevenueBreakdowns,
  calculateRevenueBreakdownFromGross,
  getOrderCollectedAmount,
  roundCurrency,
  type RevenueBreakdown
} from "@/lib/revenue"

type SupplierDoc = {
  _id: string
  firebaseUID?: string
  [key: string]: unknown
}

type DeliveredOrderDoc = {
  supplierUID?: string | null
  finalPrice?: number | null
  estimatedPrice?: number | null
}

export async function GET(req: Request){
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  await connectDB()

  const suppliers = (await Supplier.find({})
    .sort({ createdAt: -1 })
    .lean()) as SupplierDoc[]

  const [deliveredOrders, orderStats, payoutStats] = await Promise.all([
    Order.find({
      supplierUID: { $ne: null },
      status: "delivered",
      paymentStatus: "paid"
    })
      .select("supplierUID finalPrice estimatedPrice")
      .lean<DeliveredOrderDoc[]>(),
    Order.aggregate<{
      _id: string
      ordersHandled: number
      paidOrders: number
    }>([
      {
        $match: {
          supplierUID: { $ne: null }
        }
      },
      {
        $group: {
          _id: "$supplierUID",
          ordersHandled: { $sum: 1 },
          paidOrders: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0]
            }
          }
        }
      }
    ]),
    SupplierPayoutRequest.aggregate<{
      _id: { supplierUID: string; status: string }
      total: number
    }>([
      {
        $group: {
          _id: {
            supplierUID: "$supplierUID",
            status: "$status"
          },
          total: { $sum: "$amount" }
        }
      }
    ])
  ])

  const deliveredMap = new Map<string, RevenueBreakdown>()
  deliveredOrders.forEach((order) => {
    const supplierUID = String(order.supplierUID || "")
    if (!supplierUID) return

    const current = deliveredMap.get(supplierUID) || createEmptyRevenueBreakdown()
    const next = calculateRevenueBreakdownFromGross(getOrderCollectedAmount(order))

    deliveredMap.set(supplierUID, addRevenueBreakdowns(current, next))
  })

  const orderMap = new Map<string, { ordersHandled: number; paidOrders: number }>()
  orderStats.forEach((stat) => {
    orderMap.set(String(stat._id), {
      ordersHandled: stat.ordersHandled || 0,
      paidOrders: stat.paidOrders || 0
    })
  })

  const payoutMap = new Map<string, { approved: number; pending: number }>()
  payoutStats.forEach((stat) => {
    const supplierUID = String(stat._id.supplierUID)
    const current = payoutMap.get(supplierUID) || { approved: 0, pending: 0 }

    if (stat._id.status === "approved") {
      current.approved = roundCurrency(current.approved + (stat.total || 0))
    }

    if (stat._id.status === "pending") {
      current.pending = roundCurrency(current.pending + (stat.total || 0))
    }

    payoutMap.set(supplierUID, current)
  })

  const rows = suppliers.map((supplier) => {
    const supplierUID = String(supplier.firebaseUID || "")
    const deliveredRevenue = deliveredMap.get(supplierUID) || createEmptyRevenueBreakdown()
    const grossDeliveredRevenue = deliveredRevenue.grossRevenue
    const razorpayFees = deliveredRevenue.razorpayFees
    const gstOnFees = deliveredRevenue.gstOnFees
    const netRevenue = deliveredRevenue.netRevenue

    const payout = payoutMap.get(supplierUID) || { approved: 0, pending: 0 }
    const walletBalance = roundCurrency(Math.max(0, netRevenue - payout.approved))
    const availableToClaim = roundCurrency(Math.max(0, walletBalance - payout.pending))

    const order = orderMap.get(supplierUID) || { ordersHandled: 0, paidOrders: 0 }

    return {
      ...supplier,
      ordersHandled: order.ordersHandled,
      paidOrders: order.paidOrders,
      grossDeliveredRevenue,
      razorpayFees,
      gstOnFees,
      netRevenue,
      totalClaimed: payout.approved,
      pendingRequested: payout.pending,
      walletBalance,
      availableToClaim
    }
  })

  return NextResponse.json({
    success: true,
    suppliers: rows
  })

}
