import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import ActivityLog from "@/models/ActivityLog"

export async function GET(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const requestedLimit = Number(searchParams.get("limit") || 250)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(500, Math.max(1, Math.round(requestedLimit)))
    : 250

  const q = searchParams.get("q") || ""
  
  let filter: any = {}
  
  if (q) {
    const regex = { $regex: q, $options: "i" }
    filter = {
      $or: [
        { message: regex },
        { action: regex },
        { actorEmail: regex },
        { actorUID: regex },
        { entityId: regex },
        { "metadata.ipAddress": regex },
        { "metadata.userAgent": regex },
        { "metadata.orderId": regex },
        { "metadata.supplierUID": regex }
      ]
    }
  }

  const logs = await ActivityLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return NextResponse.json({
    success: true,
    logs
  })
}
