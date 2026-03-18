import { NextResponse } from "next/server"
import { getPrintPricing } from "@/lib/print-pricing-store"

export const runtime = "nodejs"

export async function GET() {
  try {
    const prices = await getPrintPricing()

    return NextResponse.json({
      success: true,
      prices
    })
  } catch (error) {
    console.error("PUBLIC_PRICING_GET_ERROR:", error)

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load pricing"
      },
      { status: 500 }
    )
  }
}
