import { NextResponse } from "next/server"
import { adminAuth } from "@/lib/firebase-admin"
import { connectDB } from "@/lib/mongodb"
import User from "@/models/User"

type AdminAuthSuccess = {
  ok: true
  uid: string
  email: string
}

type AdminAuthFailure = {
  ok: false
  response: NextResponse
}

type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure

type AdminUserRecord = {
  role?: string
}

function getOwnerEmails() {
  const raw = process.env.ADMIN_OWNER_EMAILS || ""
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

function extractBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) {
    return ""
  }
  return authHeader.slice(7).trim()
}

export async function authenticateAdminRequest(req: Request): Promise<AdminAuthResult> {
  try {
    const token = extractBearerToken(req)

    if (!token) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Missing admin token" },
          { status: 401 }
        )
      }
    }

    const decoded = await adminAuth.verifyIdToken(token)
    const email = (decoded.email || "").toLowerCase()

    if (!email) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Email is required for admin access" },
          { status: 403 }
        )
      }
    }

    const allowedEmails = getOwnerEmails()
    if (!allowedEmails.length) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "ADMIN_OWNER_EMAILS is not configured" },
          { status: 500 }
        )
      }
    }

    if (!allowedEmails.includes(email)) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Only owner email can access admin portal" },
          { status: 403 }
        )
      }
    }

    await connectDB()
    const adminUser = await User.findOne({ firebaseUID: decoded.uid })
      .select("role")
      .lean<AdminUserRecord | null>()

    if (!adminUser || adminUser.role !== "ADMIN") {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Admin role is required" },
          { status: 403 }
        )
      }
    }

    return {
      ok: true,
      uid: decoded.uid,
      email
    }
  } catch (error) {
    console.error("ADMIN_AUTH_ERROR:", error)
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Unauthorized admin request" },
        { status: 401 }
      )
    }
  }
}
