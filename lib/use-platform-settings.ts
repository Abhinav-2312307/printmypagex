"use client"

import { useEffect, useState } from "react"
import { MAX_FILES_PER_ORDER } from "@/lib/upload-file"

export type PublicPlatformSettings = {
  maxFilesPerOrder: number
  maxSupplierDiscountPercent: number
  landingFeedbackVisible: boolean
}

const DEFAULT_SETTINGS: PublicPlatformSettings = {
  maxFilesPerOrder: MAX_FILES_PER_ORDER,
  maxSupplierDiscountPercent: 50,
  landingFeedbackVisible: true
}

export function usePlatformSettings() {
  const [settings, setSettings] = useState<PublicPlatformSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true

    async function loadSettings() {
      try {
        const res = await fetch("/api/platform-settings", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()

        if (active && data?.settings) {
          setSettings({
            maxFilesPerOrder: Number(data.settings.maxFilesPerOrder) || MAX_FILES_PER_ORDER,
            maxSupplierDiscountPercent: Number(data.settings.maxSupplierDiscountPercent) || 50,
            landingFeedbackVisible: data.settings.landingFeedbackVisible ?? true
          })
        }
      } catch {
        // Fallback to default
      } finally {
        if (active) {
          setLoaded(true)
        }
      }
    }

    loadSettings().catch(() => {})

    return () => {
      active = false
    }
  }, [])

  return {
    settings,
    maxFilesPerOrder: settings.maxFilesPerOrder,
    maxSupplierDiscountPercent: settings.maxSupplierDiscountPercent,
    landingFeedbackVisible: settings.landingFeedbackVisible,
    loaded
  }
}
