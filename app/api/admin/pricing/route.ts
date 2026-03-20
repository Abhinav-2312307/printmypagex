import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import {
  parsePrintPricingInput,
  type PrintType
} from "@/lib/print-pricing"
import { getPrintPricing, savePrintPricing } from "@/lib/print-pricing-store"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

type PricingPayload = {
  prices?: Partial<Record<PrintType, unknown>>
}

export async function GET(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  try {
    const prices = await getPrintPricing()

    return NextResponse.json({
      success: true,
      prices
    })
  } catch (error) {
    console.error("ADMIN_PRICING_GET_ERROR:", error)

    return NextResponse.json(
      {
        success: false,
        message: "Failed to load pricing"
      },
      { status: 500 }
    )
  }
}

export async function PUT(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  try {
    const body = (await req.json()) as PricingPayload
    const { pricing, error } = parsePrintPricingInput(body.prices)

    if (!pricing || error) {
      return NextResponse.json(
        {
          success: false,
          message: error || "Invalid pricing payload"
        },
        { status: 400 }
      )
    }

    const prices = await savePrintPricing(pricing)

    await recordActivity({
      actorType: "admin",
      actorUID: auth.uid,
      actorEmail: auth.email,
      action: "pricing.updated",
      entityType: "pricing",
      entityId: "default",
      level: "info",
      message: "Admin updated print pricing",
      metadata: {
        prices
      }
    })

    return NextResponse.json({
      success: true,
      message: "Pricing updated successfully",
      prices
    })
  } catch (error) {
    console.error("ADMIN_PRICING_UPDATE_ERROR:", error)

    return NextResponse.json(
      {
        success: false,
        message: "Failed to update pricing"
      },
      { status: 500 }
    )
  }
}
