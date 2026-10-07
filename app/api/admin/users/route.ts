import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import User from "@/models/User"
import Order from "@/models/Order"
import SubmissionRateLimit from "@/models/SubmissionRateLimit"
import { normalizeTextFragment, hashValue } from "@/lib/submission-protection"

type UserDoc = {
  firebaseUID?: string
  [key: string]: unknown
}

export async function GET(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const users = (await User.find({})
    .sort({ createdAt: -1 })
    .lean()) as UserDoc[]

  const orderStats = await Order.aggregate<{
    _id: string
    orderCount: number
    totalSpent: number
    paidCount: number
  }>([
    {
      $group: {
        _id: "$userUID",
        orderCount: { $sum: 1 },
        totalSpent: {
          $sum: {
            $cond: [
              { $eq: ["$paymentStatus", "paid"] },
              {
                $cond: [{ $ifNull: ["$finalPrice", false] }, "$finalPrice", "$estimatedPrice"]
              },
              0
            ]
          }
        },
        paidCount: {
          $sum: {
            $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0]
          }
        }
      }
    }
  ])

  const statsMap = new Map<string, { orderCount: number; totalSpent: number; paidCount: number }>()
  for (const stat of orderStats) {
    statsMap.set(String(stat._id), {
      orderCount: stat.orderCount || 0,
      totalSpent: stat.totalSpent || 0,
      paidCount: stat.paidCount || 0
    })
  }

  const now = new Date()
  const activeRateLimitBlocks = await SubmissionRateLimit.find({
    blockedUntil: { $gt: now }
  }).lean()

  const blockedMap = new Map<string, { blockedUntil: string; reason: string }>()
  for (const block of activeRateLimitBlocks) {
    const until = block.blockedUntil ? new Date(block.blockedUntil).toISOString() : null
    if (!until) continue
    const scopeStr = String(block.scope || "")
    const reason = scopeStr.includes("burst")
      ? "Burst rate limit exceeded (rapid order submissions)"
      : scopeStr.includes("daily")
      ? "Daily order submission limit exceeded"
      : "Order creation rate limit reached"

    const data = { blockedUntil: until, reason }
    if (block.userUID) {
      blockedMap.set(String(block.userUID).toLowerCase().trim(), data)
    }
    if (block.identifierRaw) {
      blockedMap.set(String(block.identifierRaw).toLowerCase().trim(), data)
    }
    if (block.identifierHash) {
      blockedMap.set(String(block.identifierHash), data)
    }
  }

  const rows = users.map((user) => {
    const uid = String(user.firebaseUID || "")
    const normalizedUID = normalizeTextFragment(uid)
    const burstHash = hashValue(`order-create-user:order-user-burst:${normalizedUID}`)
    const dailyHash = hashValue(`order-create-user:order-user-daily:${normalizedUID}`)

    const blockInfo =
      (normalizedUID ? blockedMap.get(normalizedUID) : null) ||
      blockedMap.get(burstHash) ||
      blockedMap.get(dailyHash) ||
      null

    const stats = statsMap.get(uid) || {
      orderCount: 0,
      totalSpent: 0,
      paidCount: 0
    }

    return {
      ...user,
      orderCount: stats.orderCount,
      totalSpent: stats.totalSpent,
      paidCount: stats.paidCount,
      isRateLimited: Boolean(blockInfo),
      rateLimitBlockedUntil: blockInfo?.blockedUntil || null,
      rateLimitReason: blockInfo?.reason || null
    }
  })

  return NextResponse.json({
    success: true,
    users: rows
  })
}
