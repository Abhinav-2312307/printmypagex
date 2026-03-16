import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import User from "@/models/User"
import { authenticateUserRequest } from "@/lib/user-auth"
import { resolveUserRoleState } from "@/lib/user-roles"

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

  const user = await User.findOne({ firebaseUID })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  const userObj = user.toObject()
  const normalizedRoles = resolveUserRoleState(userObj)

  return NextResponse.json({
    user: {
      ...userObj,
      role: normalizedRoles.role,
      roles: normalizedRoles.roles,
      displayPhotoURL: userObj.photoURL || userObj.firebasePhotoURL || ""
    }
  })
}
