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

  const logs = await ActivityLog.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()

  return NextResponse.json({
    success: true,
    logs
  })
}
