import { connectDB } from "@/lib/mongodb"
import PlatformSettings from "@/models/PlatformSettings"

export type PlatformSettingsSnapshot = {
  landingFeedbackVisible: boolean
  updatedAt: string | null
}

type PlatformSettingsDoc = {
  landingFeedbackVisible?: boolean
  updatedAt?: Date | string | null
}

export const defaultPlatformSettings: PlatformSettingsSnapshot = {
  landingFeedbackVisible: true,
  updatedAt: null
}

function sanitizePlatformSettings(
  value: Partial<PlatformSettingsSnapshot> | PlatformSettingsDoc | null | undefined
): PlatformSettingsSnapshot {
  return {
    landingFeedbackVisible: value?.landingFeedbackVisible !== false,
    updatedAt: value?.updatedAt ? new Date(value.updatedAt).toISOString() : null
  }
}

export async function getPlatformSettings(): Promise<PlatformSettingsSnapshot> {
  await connectDB()

  const doc = (await PlatformSettings.findOne({ key: "main" }).lean()) as PlatformSettingsDoc | null

  if (!doc) {
    return defaultPlatformSettings
  }

  return sanitizePlatformSettings(doc)
}

export async function savePlatformSettings(
  value: Partial<PlatformSettingsSnapshot>
): Promise<PlatformSettingsSnapshot> {
  await connectDB()

  const sanitized = sanitizePlatformSettings(value)

  const doc = await PlatformSettings.findOneAndUpdate(
    { key: "main" },
    {
      key: "main",
      landingFeedbackVisible: sanitized.landingFeedbackVisible
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  ).lean<PlatformSettingsDoc | null>()

  return sanitizePlatformSettings(doc)
}
