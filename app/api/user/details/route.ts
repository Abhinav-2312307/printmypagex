import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import User from "@/models/User"
import { authenticateUserRequest } from "@/lib/user-auth"
import { resolveUserRoleState } from "@/lib/user-roles"

type UserDetailsRecord = {
  [key: string]: unknown
  photoURL?: string
  firebasePhotoURL?: string
  role?: string | null
  roles?: Array<string | null | undefined> | null
}

export async function GET(req: Request) {
  const auth = await authenticateUserRequest(req, {
    requireProfile: false,
    requireActive: false
  })
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const firebaseUID = searchParams.get("firebaseUID")

  if (!firebaseUID) {
    return NextResponse.json({ error: "Missing UID" }, { status: 400 })
  }

  if (firebaseUID !== auth.uid) {
    return NextResponse.json({ error: "Unauthorized UID" }, { status: 403 })
  }

  await connectDB()

  const user = await User.findOne({ firebaseUID }).lean<UserDetailsRecord | null>()

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const normalizedRoles = resolveUserRoleState(user)

  return NextResponse.json({
    user: {
      ...user,
      role: normalizedRoles.role,
      roles: normalizedRoles.roles,
      displayPhotoURL: user.photoURL || user.firebasePhotoURL || ""
    }
  })
}
