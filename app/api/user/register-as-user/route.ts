import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import { authenticateUserRequest } from "@/lib/user-auth"
import { mergeUserRoles, resolveUserRoleState } from "@/lib/user-roles"

export async function POST(req: Request) {
  try {
    const auth = await authenticateUserRequest(req, {
      requireProfile: false,
      requireActive: false
    })
    if (!auth.ok) return auth.response

    await connectDB()

    const body = await req.json()
    const firebaseUID = String(body?.firebaseUID || "").trim()
    const email = String(body?.email || "").trim()
    const photoURL = String(body?.photoURL || "").trim()

    if (!firebaseUID) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing firebaseUID"
        },
        { status: 400 }
      )
    }

    if (firebaseUID !== auth.uid) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized UID"
        },
        { status: 403 }
      )
    }

    const [existingUser, supplier] = await Promise.all([
      User.findOne({ firebaseUID }).lean(),
      Supplier.findOne({ firebaseUID }).lean()
    ])

    if (!existingUser && !supplier) {
      return NextResponse.json(
        {
          success: false,
          message: "No supplier-backed account found for this user"
        },
        { status: 404 }
      )
    }

    const supplierYear = Number.parseInt(String(supplier?.year || ""), 10)
    const roleState = mergeUserRoles(
      existingUser || (supplier ? { role: "SUPPLIER", roles: ["SUPPLIER"] } : null),
      supplier ? ["USER", "SUPPLIER"] : ["USER"]
    )

    const user = await User.findOneAndUpdate(
      { firebaseUID },
      {
        $set: {
          firebaseUID,
          email: email || existingUser?.email || supplier?.email || auth.email || undefined,
          firebasePhotoURL:
            photoURL ||
            existingUser?.firebasePhotoURL ||
            supplier?.firebasePhotoURL ||
            undefined,
          name: existingUser?.name || supplier?.name || undefined,
          phone: existingUser?.phone || supplier?.phone || undefined,
          rollNo: existingUser?.rollNo || supplier?.rollNo || undefined,
          branch: existingUser?.branch || supplier?.branch || undefined,
          year:
            existingUser?.year ||
            (Number.isInteger(supplierYear) ? supplierYear : undefined),
          role: roleState.role,
          roles: roleState.roles,
          approved: existingUser?.approved ?? true,
          active: existingUser?.active ?? true
        }
      },
      {
        upsert: true,
        returnDocument: "after"
      }
    )

    const userObj = user.toObject()
    const normalizedRoles = resolveUserRoleState(userObj)

    return NextResponse.json({
      success: true,
      message: "User role added successfully",
      user: {
        ...userObj,
        role: normalizedRoles.role,
        roles: normalizedRoles.roles,
        displayPhotoURL: userObj.photoURL || userObj.firebasePhotoURL || ""
      }
    })
  } catch (error) {
    console.error("REGISTER_AS_USER_ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to register as user"
      },
      { status: 500 }
    )
  }
}
