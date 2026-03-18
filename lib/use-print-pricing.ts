"use client"

import { useEffect, useState } from "react"
import {
  DEFAULT_PRINT_PRICING,
  normalizePrintPricing,
  type PrintPricing,
  type PrintType
} from "@/lib/print-pricing"

type PricingResponse = {
  prices?: Partial<Record<PrintType, number>>
}

export function usePrintPricing() {
  const [pricing, setPricing] = useState<PrintPricing>(DEFAULT_PRINT_PRICING)
  const [pricingLoaded, setPricingLoaded] = useState(false)

  useEffect(() => {
    let active = true

    async function loadPricing() {
      try {
        const res = await fetch("/api/pricing", { cache: "no-store" })
        const data = (await res.json()) as PricingResponse

        if (!active) return
        setPricing(normalizePrintPricing(data.prices))
      } catch {
        if (!active) return
        setPricing(DEFAULT_PRINT_PRICING)
      } finally {
        if (active) {
          setPricingLoaded(true)
        }
      }
    }

    loadPricing().catch(() => {})

    return () => {
      active = false
    }
  }, [])

  return { pricing, pricingLoaded, setPricing }
}
