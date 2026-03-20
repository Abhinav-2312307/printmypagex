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

  if (typeof body.landingFeedbackVisible !== "boolean") {
    return NextResponse.json(
      {
        success: false,
        message: "landingFeedbackVisible must be a boolean"
      },
      { status: 400 }
    )
  }

  const settings = await savePlatformSettings({
    landingFeedbackVisible: body.landingFeedbackVisible
  })

  await recordActivity({
    actorType: "admin",
    actorUID: auth.uid,
    actorEmail: auth.email,
    action: "platform_settings.updated",
    entityType: "platform_settings",
    entityId: "main",
    level: "info",
    message: `Landing feedback showcase turned ${settings.landingFeedbackVisible ? "on" : "off"}`,
    metadata: {
      landingFeedbackVisible: settings.landingFeedbackVisible
    }
  })

  return NextResponse.json({
    success: true,
    message: "Platform settings updated",
    settings
  })
}
