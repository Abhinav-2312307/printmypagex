import { NextResponse } from "next/server"
import { adminAuth } from "@/lib/firebase-admin"
import { connectDB } from "@/lib/mongodb"
import User from "@/models/User"
import { isOwnerEmail } from "@/lib/owner-access"

type UserAuthOptions = {
  requireProfile?: boolean
  requireActive?: boolean
}

type UserAuthSuccess = {
  ok: true
  uid: string
  email: string
  isOwner: boolean
}

type UserAuthFailure = {
  ok: false
  response: NextResponse
}

type UserAuthResult = UserAuthSuccess | UserAuthFailure

type UserAccessRecord = {
  active?: boolean
  approved?: boolean
}

function extractBearerToken(req: Request) {
  const authHeader = req.headers.get("authorization") || ""
  if (!authHeader.startsWith("Bearer ")) {
    return ""
  }

  return authHeader.slice(7).trim()
}

export async function authenticateUserRequest(
  req: Request,
  options: UserAuthOptions = {}
): Promise<UserAuthResult> {
  const requireProfile = options.requireProfile ?? true
  const requireActive = options.requireActive ?? true

  try {
    const token = extractBearerToken(req)

    if (!token) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Missing auth token" },
          { status: 401 }
        )
      }
    }

    const decoded = await adminAuth.verifyIdToken(token)
    const email = String(decoded.email || "").toLowerCase()
    const isOwner = isOwnerEmail(email)

    if (!requireProfile && !requireActive) {
      return {
        ok: true,
        uid: decoded.uid,
        email,
        isOwner
      }
    }

    await connectDB()
    const user = await User.findOne({ firebaseUID: decoded.uid })
      .select("active approved")
      .lean<UserAccessRecord | null>()

    if (!user) {
      if (requireProfile && !isOwner) {
        return {
          ok: false,
          response: NextResponse.json(
            { success: false, message: "User profile not found" },
            { status: 404 }
          )
        }
      }

      return {
        ok: true,
        uid: decoded.uid,
        email,
        isOwner
      }
    }

    if (requireActive && !isOwner && (user.active === false || user.approved === false)) {
      return {
        ok: false,
        response: NextResponse.json(
          { success: false, message: "Account is inactive or not approved" },
          { status: 403 }
        )
      }
    }

    return {
      ok: true,
      uid: decoded.uid,
      email,
      isOwner
    }
  } catch (error) {
    console.error("USER_AUTH_ERROR:", error)
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "Unauthorized request" },
        { status: 401 }
      )
    }
  }
}
