import { NextResponse } from "next/server"
import { adminAuth } from "@/lib/firebase-admin"
import { connectDB } from "@/lib/mongodb"
import User from "@/models/User"

function getAllowedOwnerEmails() {
  return (process.env.ADMIN_OWNER_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, message: "Missing auth token" },
        { status: 401 }
      )
    }

    const idToken = authHeader.slice(7).trim()
    const decoded = await adminAuth.verifyIdToken(idToken)

    const email = (decoded.email || "").toLowerCase()
    const allowedOwnerEmails = getAllowedOwnerEmails()

    if (!email || !allowedOwnerEmails.length || !allowedOwnerEmails.includes(email)) {
      return NextResponse.json(
        { success: false, message: "Only owner email can access admin portal" },
        { status: 403 }
      )
    }

    await connectDB()

    const user = await User.findOneAndUpdate(
      { firebaseUID: decoded.uid },
      {
        firebaseUID: decoded.uid,
        email,
        name: decoded.name || "Admin",
        role: "ADMIN",
        roles: ["ADMIN"],
        approved: true,
        active: true
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    )

    return NextResponse.json({
      success: true,
      user
    })
  } catch (error) {
    console.error("ADMIN_BOOTSTRAP_ERROR:", error)
    return NextResponse.json(
      { success: false, message: "Failed to bootstrap admin" },
      { status: 500 }
    )
  }
}
