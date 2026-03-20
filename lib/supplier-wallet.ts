import Order from "@/models/Order"
import SupplierPayoutRequest from "@/models/SupplierPayoutRequest"
import {
  roundCurrency,
  summarizeDeliveredRevenue
} from "@/lib/revenue"

type DeliveredOrderAmount = {
  finalPrice?: number | null
  estimatedPrice?: number | null
}

export type SupplierWalletSummary = {
  grossDeliveredRevenue: number
  razorpayFees: number
  gstOnFees: number
  netRevenue: number
  totalClaimed: number
  pendingRequested: number
  availableToClaim: number
}

export async function getSupplierWalletSummary(supplierUID: string): Promise<SupplierWalletSummary> {
  const [deliveredOrders, payoutAgg] = await Promise.all([
    Order.find({
      supplierUID,
      status: "delivered",
      paymentStatus: "paid"
    })
      .select("finalPrice estimatedPrice")
      .lean<DeliveredOrderAmount[]>(),
    SupplierPayoutRequest.aggregate<{ _id: string; total: number }>([
      {
        $match: {
          supplierUID,
          status: { $in: ["pending", "approved"] }
        }
      },
      {
        $group: {
          _id: "$status",
          total: { $sum: "$amount" }
        }
      }
    ])
  ])

  const deliveredRevenue = summarizeDeliveredRevenue(deliveredOrders)
  const grossDeliveredRevenue = deliveredRevenue.grossRevenue
  const razorpayFees = deliveredRevenue.razorpayFees
  const gstOnFees = deliveredRevenue.gstOnFees
  const netRevenue = deliveredRevenue.netRevenue

  const totalClaimed = roundCurrency(
    payoutAgg.find((item) => item._id === "approved")?.total || 0
  )

  const pendingRequested = roundCurrency(
    payoutAgg.find((item) => item._id === "pending")?.total || 0
  )

  const availableToClaim = roundCurrency(Math.max(0, netRevenue - totalClaimed - pendingRequested))

  return {
    grossDeliveredRevenue,
    razorpayFees,
    gstOnFees,
    netRevenue,
    totalClaimed,
    pendingRequested,
    availableToClaim
  }
}
