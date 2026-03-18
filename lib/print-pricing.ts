export type PrintType = "bw" | "color" | "glossy"

export type PrintPricing = Record<PrintType, number>

type PricingPlanContent = {
  title: string
  shortLabel: string
  description: string
  features: string[]
}

export const PRINT_TYPE_KEYS: PrintType[] = ["bw", "color", "glossy"]

export const DEFAULT_PRINT_PRICING: PrintPricing = {
  bw: 2,
  color: 5,
  glossy: 15
}

export const PRINT_TYPE_CONTENT: Record<PrintType, PricingPlanContent> = {
  bw: {
    title: "Black & White",
    shortLabel: "Black & White",
    description: "Standard document printing",
    features: ["A4 printing", "Clear text quality", "Fast processing"]
  },
  color: {
    title: "Color Print",
    shortLabel: "Color",
    description: "High quality color prints",
    features: ["Color graphics", "Charts & diagrams", "Project reports"]
  },
  glossy: {
    title: "Glossy Print",
    shortLabel: "Glossy",
    description: "Premium glossy printing",
    features: ["Photos", "Posters", "Presentation covers"]
  }
}

function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function normalizePrintPricing(
  raw: Partial<Record<PrintType, unknown>> | null | undefined
): PrintPricing {
  return PRINT_TYPE_KEYS.reduce((acc, key) => {
    const parsed = Number(raw?.[key])
    acc[key] = Number.isFinite(parsed) && parsed > 0 ? round2(parsed) : DEFAULT_PRINT_PRICING[key]
    return acc
  }, { ...DEFAULT_PRINT_PRICING })
}

export function parsePrintPricingInput(
  raw: Partial<Record<PrintType, unknown>> | null | undefined
): { pricing: PrintPricing | null; error: string | null } {
  const nextPricing = {} as PrintPricing

  for (const key of PRINT_TYPE_KEYS) {
    const parsed = Number(raw?.[key])

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return {
        pricing: null,
        error: `${PRINT_TYPE_CONTENT[key].title} price must be greater than 0`
      }
    }

    nextPricing[key] = round2(parsed)
  }

  return {
    pricing: nextPricing,
    error: null
  }
}

export function getPriceForPrintType(
  printType: unknown,
  pricing: PrintPricing = DEFAULT_PRINT_PRICING
) {
  if (printType === "color" || printType === "glossy" || printType === "bw") {
    return pricing[printType]
  }

  return pricing.bw
}

export function calculatePrintPrice(
  pages: number,
  printType: unknown,
  pricing: PrintPricing = DEFAULT_PRINT_PRICING
) {
  if (!Number.isFinite(pages) || pages <= 0) {
    return 0
  }

  return round2(pages * getPriceForPrintType(printType, pricing))
}

export function formatPricePerPage(price: number) {
  return `₹${round2(price)} / page`
}

export function getPricingPlans(pricing: PrintPricing) {
  return PRINT_TYPE_KEYS.map((key) => ({
    key,
    ...PRINT_TYPE_CONTENT[key],
    price: pricing[key],
    priceLabel: formatPricePerPage(pricing[key])
  }))
}
