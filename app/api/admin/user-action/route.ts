import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import User from "@/models/User"
import Order from "@/models/Order"
import { mergeUserRoles } from "@/lib/user-roles"
import { recordActivity } from "@/lib/activity-log"

export async function POST(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const body = await req.json()

  const firebaseUID = body.firebaseUID as string | undefined
  const action = body.action as string | undefined

  if (!firebaseUID || !action) {
    return NextResponse.json(
      { success: false, message: "firebaseUID and action are required" },
      { status: 400 }
    )
  }

  if (firebaseUID === auth.uid && ["delete", "deactivate"].includes(action)) {
    return NextResponse.json(
      { success: false, message: "Owner cannot deactivate/delete self" },
      { status: 400 }
    )
  }

  if (action === "set_role") {
    const role = body.role as "USER" | "SUPPLIER" | "ADMIN" | undefined
    if (!role) {
      return NextResponse.json(
        { success: false, message: "Role is required" },
        { status: 400 }
      )
    }

    const existingUser = await User.findOne({ firebaseUID }).lean()
    if (!existingUser) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      )
    }

    const roleState = mergeUserRoles(existingUser, [role], {
      preferredRole: role,
      preserveAdmin: false
    })

    const user = await User.findOneAndUpdate(
      { firebaseUID },
      {
        $set: {
          role: roleState.role,
          roles: roleState.roles
        }
      },
      { returnDocument: "after" }
    )

    await recordActivity({
      actorType: "admin",
      actorUID: auth.uid,
      actorEmail: auth.email,
      action: "user.role_updated",
      entityType: "user",
      entityId: firebaseUID,
      level: "info",
      message: `Admin set role ${role} for user ${user?.email || firebaseUID}`,
      metadata: {
        firebaseUID,
        role
      }
    })

    return NextResponse.json({ success: true, user })
  }

  if (action === "activate" || action === "deactivate") {
    const user = await User.findOneAndUpdate(
      { firebaseUID },
      { active: action === "activate" },
      { returnDocument: "after" }
    )

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      )
    }

    await recordActivity({
      actorType: "admin",
      actorUID: auth.uid,
      actorEmail: auth.email,
      action: action === "activate" ? "user.activated" : "user.deactivated",
      entityType: "user",
      entityId: firebaseUID,
      level: action === "activate" ? "success" : "warning",
      message: `Admin ${action === "activate" ? "activated" : "deactivated"} user ${user.email || firebaseUID}`,
      metadata: {
        firebaseUID,
        active: Boolean(user.active)
      }
    })

    return NextResponse.json({ success: true, user })
  }

  if (action === "approve" || action === "disapprove") {
    const user = await User.findOneAndUpdate(
      { firebaseUID },
      { approved: action === "approve" },
      { returnDocument: "after" }
    )

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      )
    }

    await recordActivity({
      actorType: "admin",
      actorUID: auth.uid,
      actorEmail: auth.email,
      action: action === "approve" ? "user.approved" : "user.disapproved",
      entityType: "user",
      entityId: firebaseUID,
      level: action === "approve" ? "success" : "warning",
      message: `Admin ${action === "approve" ? "approved" : "disapproved"} user ${user.email || firebaseUID}`,
      metadata: {
        firebaseUID,
        approved: Boolean(user.approved)
      }
    })

    return NextResponse.json({ success: true, user })
  }

  if (action === "delete") {
    await Promise.all([
      User.deleteOne({ firebaseUID }),
      Order.deleteMany({ userUID: firebaseUID })
    ])

    await recordActivity({
      actorType: "admin",
      actorUID: auth.uid,
      actorEmail: auth.email,
      action: "user.deleted",
      entityType: "user",
      entityId: firebaseUID,
      level: "warning",
      message: `Admin deleted user ${firebaseUID}`,
      metadata: {
        firebaseUID
      }
    })

    return NextResponse.json({ success: true })
  }

  return NextResponse.json(
    { success: false, message: "Unknown action" },
    { status: 400 }
  )
}
