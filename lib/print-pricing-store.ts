import "server-only"

import { connectDB } from "@/lib/mongodb"
import PricingSettings from "@/models/PricingSettings"
import {
  DEFAULT_PRINT_PRICING,
  normalizePrintPricing,
  type PrintPricing
} from "@/lib/print-pricing"

type PricingSettingsRecord = {
  prices?: Partial<PrintPricing>
}

const DEFAULT_PRICING_KEY = "default"

export async function getPrintPricing(): Promise<PrintPricing> {
  await connectDB()

  const doc = await PricingSettings.findOneAndUpdate(
    { key: DEFAULT_PRICING_KEY },
    {
      $setOnInsert: {
        key: DEFAULT_PRICING_KEY,
        prices: DEFAULT_PRINT_PRICING
      }
    },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true
    }
  ).lean<PricingSettingsRecord | null>()

  return normalizePrintPricing(doc?.prices)
}

export async function savePrintPricing(pricing: PrintPricing): Promise<PrintPricing> {
  await connectDB()

  const doc = await PricingSettings.findOneAndUpdate(
    { key: DEFAULT_PRICING_KEY },
    {
      $set: {
        key: DEFAULT_PRICING_KEY,
        prices: pricing
      }
    },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true
    }
  ).lean<PricingSettingsRecord | null>()

  return normalizePrintPricing(doc?.prices ?? pricing)
}
