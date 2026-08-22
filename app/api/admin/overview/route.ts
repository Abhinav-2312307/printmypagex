import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import User from "@/models/User"
import Supplier from "@/models/Supplier"
import Order from "@/models/Order"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"

export async function GET(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  await applyOrderLifecycleRules()

  const [
    totalUsers,
    activeUsers,
    totalSuppliers,
    approvedSuppliers,
    activeSuppliers,
    totalOrders,
    paidOrders,
    refundedOrders,
    pendingOrders,
    revenueAgg,
    refundedAgg,
    orderStatusAgg,
    paymentTrendAgg,
    orderTrendAgg
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ active: true }),
    Supplier.countDocuments({}),
    Supplier.countDocuments({ approved: true }),
    Supplier.countDocuments({ active: true }),
    Order.countDocuments({}),
    Order.countDocuments({ paymentStatus: "paid" }),
    Order.countDocuments({ paymentStatus: "refunded" }),
    Order.countDocuments({
      status: { $in: ["pending", "accepted", "awaiting_payment", "printing", "printed"] }
    }),
    Order.aggregate([
      {
        $match: {
          paymentStatus: "paid"
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: {
              $cond: [
                { $ifNull: ["$finalPrice", false] },
                "$finalPrice",
                "$estimatedPrice"
              ]
            }
          }
        }
      }
    ]),
    Order.aggregate([
      {
        $match: {
          paymentStatus: "refunded"
        }
      },
      {
        $group: {
          _id: null,
          totalRefunded: {
            $sum: {
              $cond: [
                { $ifNull: ["$finalPrice", false] },
                "$finalPrice",
                "$estimatedPrice"
              ]
            }
          }
        }
      }
    ]),
    Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]),
    Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
          paidAt: { $ne: null }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$paidAt" },
            month: { $month: "$paidAt" },
            day: { $dayOfMonth: "$paidAt" }
          },
          amount: {
            $sum: {
              $cond: [
                { $ifNull: ["$finalPrice", false] },
                "$finalPrice",
                "$estimatedPrice"
              ]
            }
          }
        }
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1
        }
      },
      { $limit: 30 }
    ]),
    Order.aggregate([
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          orders: { $sum: 1 }
        }
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.day": 1
        }
      },
      { $limit: 30 }
    ])
  ])

  const paymentTrend = paymentTrendAgg.map((item) => ({
    date: `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`,
    amount: item.amount || 0
  }))

  const orderTrend = orderTrendAgg.map((item) => ({
    date: `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`,
    orders: item.orders || 0
  }))

  const statusBreakdown = orderStatusAgg.map((item) => ({
    status: item._id,
    count: item.count
  }))

  const netRevenue = revenueAgg[0]?.totalRevenue || 0
  const totalRefunded = refundedAgg[0]?.totalRefunded || 0
  const grossRazorpayRevenue = netRevenue + totalRefunded

  return NextResponse.json({
    success: true,
    stats: {
      totalUsers,
      activeUsers,
      totalSuppliers,
      approvedSuppliers,
      activeSuppliers,
      totalOrders,
      paidOrders,
      refundedOrders,
      pendingOrders,
      grossRazorpayRevenue,
      totalRefunded,
      netRevenue,
      totalRevenue: netRevenue
    },
    charts: {
      statusBreakdown,
      paymentTrend,
      orderTrend
    }
  })
}
