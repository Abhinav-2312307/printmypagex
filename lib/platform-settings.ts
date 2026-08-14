import { connectDB } from "@/lib/mongodb"
import PlatformSettings from "@/models/PlatformSettings"

export type PlatformSettingsSnapshot = {
  landingFeedbackVisible: boolean
  pendingAutoCancelHours: number
  paymentAutoCancelHours: number
  orderBurstMaxRequests: number
  orderBurstBlockMinutes: number
  orderDailyMaxRequests: number
  orderDailyBlockHours: number
  maxFilesPerOrder: number
  maxSupplierDiscountPercent: number
  updatedAt: string | null
}

type PlatformSettingsDoc = {
  landingFeedbackVisible?: boolean
  pendingAutoCancelHours?: number
  paymentAutoCancelHours?: number
  orderBurstMaxRequests?: number
  orderBurstBlockMinutes?: number
  orderDailyMaxRequests?: number
  orderDailyBlockHours?: number
  maxFilesPerOrder?: number
  maxSupplierDiscountPercent?: number
  updatedAt?: Date | string | null
}

const DEFAULT_PENDING_AUTO_CANCEL_HOURS = 72
const DEFAULT_PAYMENT_AUTO_CANCEL_HOURS = 24
const DEFAULT_ORDER_BURST_MAX_REQUESTS = 15
const DEFAULT_ORDER_BURST_BLOCK_MINUTES = 15
const DEFAULT_ORDER_DAILY_MAX_REQUESTS = 20
const DEFAULT_ORDER_DAILY_BLOCK_HOURS = 24
const DEFAULT_MAX_FILES_PER_ORDER = 5
const DEFAULT_MAX_SUPPLIER_DISCOUNT_PERCENT = 50
const MIN_AUTO_CANCEL_HOURS = 1

export const defaultPlatformSettings: PlatformSettingsSnapshot = {
  landingFeedbackVisible: true,
  pendingAutoCancelHours: DEFAULT_PENDING_AUTO_CANCEL_HOURS,
  paymentAutoCancelHours: DEFAULT_PAYMENT_AUTO_CANCEL_HOURS,
  orderBurstMaxRequests: DEFAULT_ORDER_BURST_MAX_REQUESTS,
  orderBurstBlockMinutes: DEFAULT_ORDER_BURST_BLOCK_MINUTES,
  orderDailyMaxRequests: DEFAULT_ORDER_DAILY_MAX_REQUESTS,
  orderDailyBlockHours: DEFAULT_ORDER_DAILY_BLOCK_HOURS,
  maxFilesPerOrder: DEFAULT_MAX_FILES_PER_ORDER,
  maxSupplierDiscountPercent: DEFAULT_MAX_SUPPLIER_DISCOUNT_PERCENT,
  updatedAt: null
}

function sanitizePositiveInt(value: unknown, fallback: number, min = 1): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback
  }
  return Math.round(parsed)
}

function sanitizePercent(value: unknown, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return fallback
  }
  return Math.round(parsed)
}

function sanitizePlatformSettings(
  value: Partial<PlatformSettingsSnapshot> | PlatformSettingsDoc | null | undefined
): PlatformSettingsSnapshot {
  return {
    landingFeedbackVisible: value?.landingFeedbackVisible !== false,
    pendingAutoCancelHours: sanitizePositiveInt(
      value?.pendingAutoCancelHours,
      DEFAULT_PENDING_AUTO_CANCEL_HOURS,
      MIN_AUTO_CANCEL_HOURS
    ),
    paymentAutoCancelHours: sanitizePositiveInt(
      value?.paymentAutoCancelHours,
      DEFAULT_PAYMENT_AUTO_CANCEL_HOURS,
      MIN_AUTO_CANCEL_HOURS
    ),
    orderBurstMaxRequests: sanitizePositiveInt(
      value?.orderBurstMaxRequests,
      DEFAULT_ORDER_BURST_MAX_REQUESTS
    ),
    orderBurstBlockMinutes: sanitizePositiveInt(
      value?.orderBurstBlockMinutes,
      DEFAULT_ORDER_BURST_BLOCK_MINUTES
    ),
    orderDailyMaxRequests: sanitizePositiveInt(
      value?.orderDailyMaxRequests,
      DEFAULT_ORDER_DAILY_MAX_REQUESTS
    ),
    orderDailyBlockHours: sanitizePositiveInt(
      value?.orderDailyBlockHours,
      DEFAULT_ORDER_DAILY_BLOCK_HOURS
    ),
    maxFilesPerOrder: sanitizePositiveInt(
      value?.maxFilesPerOrder,
      DEFAULT_MAX_FILES_PER_ORDER
    ),
    maxSupplierDiscountPercent: sanitizePercent(
      value?.maxSupplierDiscountPercent,
      DEFAULT_MAX_SUPPLIER_DISCOUNT_PERCENT
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
      paymentAutoCancelHours: sanitized.paymentAutoCancelHours,
      orderBurstMaxRequests: sanitized.orderBurstMaxRequests,
      orderBurstBlockMinutes: sanitized.orderBurstBlockMinutes,
      orderDailyMaxRequests: sanitized.orderDailyMaxRequests,
      orderDailyBlockHours: sanitized.orderDailyBlockHours,
      maxFilesPerOrder: sanitized.maxFilesPerOrder,
      maxSupplierDiscountPercent: sanitized.maxSupplierDiscountPercent
    },
    {
      upsert: true,
      returnDocument: "after",
      setDefaultsOnInsert: true
    }
  ).lean<PlatformSettingsDoc | null>()

  return sanitizePlatformSettings(doc)
}
