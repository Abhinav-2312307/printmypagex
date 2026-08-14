import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import {
  getPlatformSettings,
  savePlatformSettings,
  type PlatformSettingsSnapshot
} from "@/lib/platform-settings"
import { recordActivity } from "@/lib/activity-log"

export async function GET(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const settings = await getPlatformSettings()

  return NextResponse.json({
    success: true,
    settings
  })
}

export async function PUT(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const body = (await req.json().catch(() => ({}))) as Partial<PlatformSettingsSnapshot>

  const updates: Partial<PlatformSettingsSnapshot> = {}
  const changeDescriptions: string[] = []

  // Validate landingFeedbackVisible
  if (body.landingFeedbackVisible !== undefined) {
    if (typeof body.landingFeedbackVisible !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          message: "landingFeedbackVisible must be a boolean"
        },
        { status: 400 }
      )
    }
    updates.landingFeedbackVisible = body.landingFeedbackVisible
    changeDescriptions.push(
      `Landing feedback showcase turned ${body.landingFeedbackVisible ? "on" : "off"}`
    )
  }

  // Validate pendingAutoCancelHours
  if (body.pendingAutoCancelHours !== undefined) {
    const parsed = Number(body.pendingAutoCancelHours)
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json(
        {
          success: false,
          message: "pendingAutoCancelHours must be at least 1"
        },
        { status: 400 }
      )
    }
    updates.pendingAutoCancelHours = Math.round(parsed)
    changeDescriptions.push(
      `Pending auto-cancel set to ${updates.pendingAutoCancelHours} hours`
    )
  }

  // Validate paymentAutoCancelHours
  if (body.paymentAutoCancelHours !== undefined) {
    const parsed = Number(body.paymentAutoCancelHours)
    if (!Number.isFinite(parsed) || parsed < 1) {
      return NextResponse.json(
        {
          success: false,
          message: "paymentAutoCancelHours must be at least 1"
        },
        { status: 400 }
      )
    }
    updates.paymentAutoCancelHours = Math.round(parsed)
    changeDescriptions.push(
      `Payment auto-cancel set to ${updates.paymentAutoCancelHours} hours`
    )
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      {
        success: false,
        message: "No valid settings provided"
      },
      { status: 400 }
    )
  }

  // Merge with existing settings so unchanged fields are preserved
  const current = await getPlatformSettings()
  const merged = { ...current, ...updates }

  const settings = await savePlatformSettings(merged)

  await recordActivity({
    actorType: "admin",
    actorUID: auth.uid,
    actorEmail: auth.email,
    action: "platform_settings.updated",
    entityType: "platform_settings",
    entityId: "main",
    level: "info",
    message: changeDescriptions.join(" | ") || "Platform settings updated",
    metadata: {
      landingFeedbackVisible: settings.landingFeedbackVisible,
      pendingAutoCancelHours: settings.pendingAutoCancelHours,
      paymentAutoCancelHours: settings.paymentAutoCancelHours
    }
  })

  return NextResponse.json({
    success: true,
    message: "Platform settings updated",
    settings
  })
}
