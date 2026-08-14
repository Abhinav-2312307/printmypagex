import { connectDB } from "@/lib/mongodb"
import PlatformSettings from "@/models/PlatformSettings"

export type PlatformSettingsSnapshot = {
  landingFeedbackVisible: boolean
  pendingAutoCancelHours: number
  paymentAutoCancelHours: number
  updatedAt: string | null
}

type PlatformSettingsDoc = {
  landingFeedbackVisible?: boolean
  pendingAutoCancelHours?: number
  paymentAutoCancelHours?: number
  updatedAt?: Date | string | null
}

const DEFAULT_PENDING_AUTO_CANCEL_HOURS = 72
const DEFAULT_PAYMENT_AUTO_CANCEL_HOURS = 24
const MIN_AUTO_CANCEL_HOURS = 1

export const defaultPlatformSettings: PlatformSettingsSnapshot = {
  landingFeedbackVisible: true,
  pendingAutoCancelHours: DEFAULT_PENDING_AUTO_CANCEL_HOURS,
  paymentAutoCancelHours: DEFAULT_PAYMENT_AUTO_CANCEL_HOURS,
  updatedAt: null
}

function sanitizeHours(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < MIN_AUTO_CANCEL_HOURS) {
    return fallback
  }
  return Math.round(parsed)
}

function sanitizePlatformSettings(
  value: Partial<PlatformSettingsSnapshot> | PlatformSettingsDoc | null | undefined
): PlatformSettingsSnapshot {
  return {
    landingFeedbackVisible: value?.landingFeedbackVisible !== false,
    pendingAutoCancelHours: sanitizeHours(
      value?.pendingAutoCancelHours,
      DEFAULT_PENDING_AUTO_CANCEL_HOURS
    ),
    paymentAutoCancelHours: sanitizeHours(
      value?.paymentAutoCancelHours,
      DEFAULT_PAYMENT_AUTO_CANCEL_HOURS
    ),
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
      landingFeedbackVisible: sanitized.landingFeedbackVisible,
      pendingAutoCancelHours: sanitized.pendingAutoCancelHours,
      paymentAutoCancelHours: sanitized.paymentAutoCancelHours
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  ).lean<PlatformSettingsDoc | null>()

  return sanitizePlatformSettings(doc)
}
