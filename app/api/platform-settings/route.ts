import { NextResponse } from "next/server"
import { getPlatformSettings } from "@/lib/platform-settings"

export const runtime = "nodejs"

export async function GET() {
  try {
    const settings = await getPlatformSettings()

    return NextResponse.json({
      success: true,
      settings: {
        maxFilesPerOrder: settings.maxFilesPerOrder || 5,
        maxSupplierDiscountPercent: settings.maxSupplierDiscountPercent ?? 50,
        landingFeedbackVisible: settings.landingFeedbackVisible ?? true
      }
    })
  } catch (error) {
    console.error("PUBLIC_PLATFORM_SETTINGS_GET_ERROR:", error)

    return NextResponse.json({
      success: true,
      settings: {
        maxFilesPerOrder: 5,
        maxSupplierDiscountPercent: 50,
        landingFeedbackVisible: true
      }
    })
  }
}
