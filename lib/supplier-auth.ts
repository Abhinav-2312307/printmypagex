import { NextResponse } from "next/server"
import { adminAuth } from "@/lib/firebase-admin"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"

type SupplierAuthSuccess = {
  ok: true
  uid: string
  email: string
}

type SupplierAuthFailure = {
  ok: false
  response: NextResponse
}

type SupplierAuthResult = SupplierAuthSuccess | SupplierAuthFailure

type SupplierAccessRecord = {
  approved?: boolean
  active?: boolean
}

function extractBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) {
    return ""
  }
  return authHeader.slice(7).trim()
}

export async function authenticateSupplierRequest(req: Request): Promise<SupplierAuthResult> {
  try {
    const token = extractBearerToken(req)

    if (!token) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Missing supplier token" },
          { status: 401 }
        )
      }
    }

    const decoded = await adminAuth.verifyIdToken(token)

    await connectDB()
    const supplier = await Supplier.findOne({ firebaseUID: decoded.uid })
      .select("approved active")
      .lean<SupplierAccessRecord | null>()

    if (!supplier) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Supplier account not found" },
          { status: 403 }
        )
      }
    }

    if (!supplier.approved || !supplier.active) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Supplier is not approved/active" },
          { status: 403 }
        )
      }
    }

    return {
      ok: true,
      uid: decoded.uid,
      email: (decoded.email || "").toLowerCase()
    }
  } catch (error) {
    console.error("SUPPLIER_AUTH_ERROR:", error)
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Unauthorized supplier request" },
        { status: 401 }
      )
    }
  }
}
