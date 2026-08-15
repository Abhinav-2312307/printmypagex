import { connectDB } from "@/lib/mongodb"
import ActivityLog from "@/models/ActivityLog"

export type ActivityActorType = "admin" | "user" | "supplier" | "system" | "public"
export type ActivityLevel = "info" | "success" | "warning" | "error"

export type ActivityPayload = {
  actorType?: ActivityActorType
  actorUID?: string | null
  actorEmail?: string | null
  action: string
  entityType: string
  entityId?: string | null
  level?: ActivityLevel
  message: string
  metadata?: Record<string, unknown>
  req?: Request
}

export async function recordActivity(payload: ActivityPayload) {
  try {
    await connectDB()

    let ipAddress = ""
    let userAgent = ""

    if (payload.req) {
      ipAddress = payload.req.headers.get("x-forwarded-for") || 
                  payload.req.headers.get("x-real-ip") || 
                  "unknown"
      userAgent = payload.req.headers.get("user-agent") || "unknown"
    }

    const metadata = {
      ...(payload.metadata || {}),
      ...(payload.req ? { ipAddress, userAgent } : {})
    }

    await ActivityLog.create({
      actorType: payload.actorType || "system",
      actorUID: String(payload.actorUID || ""),
      actorEmail: String(payload.actorEmail || ""),
      action: payload.action,
      entityType: payload.entityType,
      entityId: String(payload.entityId || ""),
      level: payload.level || "info",
      message: payload.message,
      metadata
    })
  } catch (error) {
    console.error("ACTIVITY_LOG_WRITE_ERROR:", error)
  }
}
