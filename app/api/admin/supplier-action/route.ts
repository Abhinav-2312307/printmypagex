import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import Order from "@/models/Order"
import { removeUserRoles } from "@/lib/user-roles"

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

  if (action === "approve" || action === "disapprove") {
    const approved = action === "approve"
    const supplier = await Supplier.findOneAndUpdate(
      { firebaseUID },
      { approved, active: approved },
      { returnDocument: "after" }
    )

    if (!supplier) {
      return NextResponse.json(
        { success: false, message: "Supplier not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, supplier })
  }

  if (action === "activate" || action === "deactivate") {
    const supplier = await Supplier.findOneAndUpdate(
      { firebaseUID },
      { active: action === "activate" },
      { returnDocument: "after" }
    )

    if (!supplier) {
      return NextResponse.json(
        { success: false, message: "Supplier not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, supplier })
  }

  if (action === "delete") {
    const existingUser = await User.findOne({ firebaseUID }).lean()
    const userRoleState = existingUser
      ? removeUserRoles(existingUser, ["SUPPLIER"], {
          fallbackRole: "USER"
        })
      : null

    await Promise.all([
      Supplier.deleteOne({ firebaseUID }),
      userRoleState
        ? User.updateOne(
            { firebaseUID },
            {
              $set: {
                role: userRoleState.role,
                roles: userRoleState.roles
              }
            }
          )
        : Promise.resolve(),
      Order.updateMany(
        { supplierUID: firebaseUID },
        {
          supplierUID: null,
          status: "pending"
        }
      )
    ])

    return NextResponse.json({ success: true })
  }

  return NextResponse.json(
    { success: false, message: "Unknown action" },
    { status: 400 }
  )
}
