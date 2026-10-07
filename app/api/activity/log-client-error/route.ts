import { NextResponse } from "next/server"
import { authenticateUserRequest } from "@/lib/user-auth"
import { recordActivity, type ActivityLevel } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const auth = await authenticateUserRequest(req)
    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid payload" },
        { status: 400 }
      )
    }

    const action = String(body.action || "client.error").trim()
    const message = String(body.message || "An error occurred on the client").trim()
    const rawLevel = String(body.level || "error").toLowerCase()
    const level: ActivityLevel =
      rawLevel === "warning" || rawLevel === "info" || rawLevel === "success"
        ? (rawLevel as ActivityLevel)
        : "error"

    const metadata =
      body.metadata && typeof body.metadata === "object"
        ? (body.metadata as Record<string, unknown>)
        : {}

    await recordActivity({
      actorType: auth.ok ? "user" : "public",
      actorUID: auth.ok ? auth.uid : String(metadata.userUID || ""),
      actorEmail: auth.ok ? auth.email : String(metadata.userEmail || ""),
      action,
      entityType: "user_client",
      level,
      message,
      metadata,
      req
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("CLIENT_LOG_WRITE_ERROR:", error)
    return NextResponse.json(
      { success: false, message: "Failed to record log" },
      { status: 500 }
    )
  }
}
