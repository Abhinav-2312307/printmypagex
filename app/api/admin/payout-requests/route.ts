import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import SupplierPayoutRequest from "@/models/SupplierPayoutRequest"
import Supplier from "@/models/Supplier"
import { getSupplierWalletSummary } from "@/lib/supplier-wallet"
import { recordActivity } from "@/lib/activity-log"

export async function GET(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const requests = await SupplierPayoutRequest.find({})
    .sort({ createdAt: -1 })
    .limit(500)
    .lean()

  const supplierUIDs = [...new Set(requests.map((item) => String(item.supplierUID || "")).filter(Boolean))]

  const suppliers = await Supplier.find({ firebaseUID: { $in: supplierUIDs } })
    .select("firebaseUID name email phone")
    .lean()

  const supplierMap = new Map<string, { firebaseUID: string; name?: string; email?: string; phone?: string }>()

  suppliers.forEach((supplier) => {
    const item = supplier as { firebaseUID: string; name?: string; email?: string; phone?: string }
    supplierMap.set(String(item.firebaseUID), item)
  })

  const rows = requests.map((request) => ({
    ...request,
    supplier: supplierMap.get(String(request.supplierUID || "")) || null
  }))

  return NextResponse.json({
    success: true,
    requests: rows
  })
}

export async function POST(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const body = await req.json()

  const requestId = String(body.requestId || "").trim()
  const action = String(body.action || "").trim()
  const note = String(body.note || "").trim()

  if (!requestId || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { success: false, message: "requestId and valid action are required" },
      { status: 400 }
    )
  }

  const requestDoc = await SupplierPayoutRequest.findById(requestId)

  if (!requestDoc) {
    return NextResponse.json(
      { success: false, message: "Payout request not found" },
      { status: 404 }
    )
  }

  if (requestDoc.status !== "pending") {
    return NextResponse.json(
      { success: false, message: "Only pending requests can be processed" },
      { status: 400 }
    )
  }

  if (action === "approve") {
    const wallet = await getSupplierWalletSummary(String(requestDoc.supplierUID))

    if (requestDoc.amount > wallet.availableToClaim) {
      return NextResponse.json(
        {
          success: false,
          message: "Insufficient supplier wallet balance for this approval"
        },
        { status: 400 }
      )
    }

    requestDoc.status = "approved"
  }

  if (action === "reject") {
    requestDoc.status = "rejected"
  }

  requestDoc.note = note
  requestDoc.processedAt = new Date()
  requestDoc.processedBy = auth.uid

  await requestDoc.save()

  await recordActivity({
    actorType: "admin",
    actorUID: auth.uid,
    actorEmail: auth.email,
    action: action === "approve" ? "payout.approved" : "payout.rejected",
    entityType: "payout_request",
    entityId: String(requestDoc._id),
    level: action === "approve" ? "success" : "warning",
    message: `Admin ${action}d payout request ${String(requestDoc._id).slice(-8)}`,
    metadata: {
      requestId: String(requestDoc._id),
      supplierUID: String(requestDoc.supplierUID),
      amount: Number(requestDoc.amount || 0),
      note
    }
  })

  return NextResponse.json({
    success: true,
    request: requestDoc
  })
}
