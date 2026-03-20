import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import Order from "@/models/Order"
import { removeUserRoles } from "@/lib/user-roles"
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

    await recordActivity({
      actorType: "admin",
      actorUID: auth.uid,
      actorEmail: auth.email,
      action: approved ? "supplier.approved" : "supplier.disapproved",
      entityType: "supplier",
      entityId: firebaseUID,
      level: approved ? "success" : "warning",
      message: `Admin ${approved ? "approved" : "disapproved"} supplier ${supplier.email || firebaseUID}`,
      metadata: {
        firebaseUID,
        approved,
        active: Boolean(supplier.active)
      }
    })

    return NextResponse.json({ success: true, supplier })
  }

  if (action === "activate" || action === "deactivate") {
    const existingSupplier = await Supplier.findOne({ firebaseUID })

    if (!existingSupplier) {
      return NextResponse.json(
        { success: false, message: "Supplier not found" },
        { status: 404 }
      )
    }

    if (action === "activate" && !existingSupplier.approved) {
      return NextResponse.json(
        { success: false, message: "Supplier must be approved before activation" },
        { status: 400 }
      )
    }

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

    await recordActivity({
      actorType: "admin",
      actorUID: auth.uid,
      actorEmail: auth.email,
      action: action === "activate" ? "supplier.activated" : "supplier.deactivated",
      entityType: "supplier",
      entityId: firebaseUID,
      level: action === "activate" ? "success" : "warning",
      message: `Admin ${action === "activate" ? "activated" : "deactivated"} supplier ${supplier.email || firebaseUID}`,
      metadata: {
        firebaseUID,
        approved: Boolean(supplier.approved),
        active: Boolean(supplier.active)
      }
    })

    return NextResponse.json({ success: true, supplier })
  }

  if (action === "delete") {
    const existingOrders = await Order.countDocuments({ supplierUID: firebaseUID })

    if (existingOrders > 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Suppliers with order history cannot be deleted. Deactivate them instead."
        },
        { status: 409 }
      )
    }

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

    await recordActivity({
      actorType: "admin",
      actorUID: auth.uid,
      actorEmail: auth.email,
      action: "supplier.deleted",
      entityType: "supplier",
      entityId: firebaseUID,
      level: "warning",
      message: `Admin deleted supplier ${firebaseUID}`,
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
