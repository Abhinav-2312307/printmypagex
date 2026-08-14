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

type NumericSettingRule = {
  key: keyof PlatformSettingsSnapshot
  label: string
  min: number
  max?: number
  unit: string
}

const NUMERIC_RULES: NumericSettingRule[] = [
  { key: "pendingAutoCancelHours", label: "Pending auto-cancel", min: 1, unit: "hours" },
  { key: "paymentAutoCancelHours", label: "Payment auto-cancel", min: 1, unit: "hours" },
  { key: "orderBurstMaxRequests", label: "Burst max requests", min: 1, unit: "requests" },
  { key: "orderBurstBlockMinutes", label: "Burst block duration", min: 1, unit: "minutes" },
  { key: "orderDailyMaxRequests", label: "Daily max requests", min: 1, unit: "requests" },
  { key: "orderDailyBlockHours", label: "Daily block duration", min: 1, unit: "hours" },
  { key: "maxFilesPerOrder", label: "Max files per order", min: 1, max: 10, unit: "files" },
  { key: "maxSupplierDiscountPercent", label: "Max supplier discount", min: 0, max: 100, unit: "%" }
]

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

  // Validate all numeric settings
  for (const rule of NUMERIC_RULES) {
    const rawValue = body[rule.key]
    if (rawValue !== undefined) {
      const parsed = Number(rawValue)
      if (!Number.isFinite(parsed) || parsed < rule.min) {
        return NextResponse.json(
          {
            success: false,
            message: `${rule.label} must be at least ${rule.min}`
          },
          { status: 400 }
        )
      }
      if (rule.max !== undefined && parsed > rule.max) {
        return NextResponse.json(
          {
            success: false,
            message: `${rule.label} must be at most ${rule.max}`
          },
          { status: 400 }
        )
      }
      const rounded = Math.round(parsed)
      ;(updates as Record<string, unknown>)[rule.key] = rounded
      changeDescriptions.push(`${rule.label} set to ${rounded} ${rule.unit}`)
    }
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
    metadata: { ...settings }
  })

  return NextResponse.json({
    success: true,
    message: "Platform settings updated",
    settings
  })
}
