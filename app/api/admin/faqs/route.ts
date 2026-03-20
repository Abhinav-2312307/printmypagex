import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import { saveFaqContentSnapshot, getFaqContentSnapshot } from "@/lib/faq-store"
import type { FAQContentSnapshot } from "@/lib/faq-content"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const content = await getFaqContentSnapshot()

  return NextResponse.json({
    success: true,
    content
  })
}

export async function PUT(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const body = (await req.json()) as Partial<FAQContentSnapshot> | null
  const content = await saveFaqContentSnapshot(body || {})

  await recordActivity({
    actorType: "admin",
    actorUID: auth.uid,
    actorEmail: auth.email,
    action: "faq.updated",
    entityType: "faq",
    entityId: "main",
    level: "info",
    message: "Admin updated FAQ content",
    metadata: {
      userFaqCount: content.userFaqs.length,
      supplierFaqCount: content.supplierFaqs.length
    }
  })

  return NextResponse.json({
    success: true,
    message: "FAQ content updated",
    content
  })
}
