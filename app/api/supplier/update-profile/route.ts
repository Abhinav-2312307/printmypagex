import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import { isAlphabeticText, isNumeric, normalizeText } from "@/lib/form-validation"
import { authenticateUserRequest } from "@/lib/user-auth"
import { mergeUserRoles } from "@/lib/user-roles"

export async function POST(req: Request) {
  try {
    const auth = await authenticateUserRequest(req)
    if (!auth.ok) return auth.response

    await connectDB()

    const body = await req.json()
    const firebaseUID = String(body?.firebaseUID || "").trim()
    const name = normalizeText(String(body?.name || ""))
    const rollNo = String(body?.rollNo || "").trim()
    const phone = String(body?.phone || "").trim()

    if (!firebaseUID) {
      return NextResponse.json({ success: false, message: "Missing firebaseUID" }, { status: 400 })
    }

    if (firebaseUID !== auth.uid) {
      return NextResponse.json({ success: false, message: "Unauthorized UID" }, { status: 403 })
    }

    if (!name || !isAlphabeticText(name)) {
      return NextResponse.json(
        { success: false, message: "Name must contain only text" },
        { status: 400 }
      )
    }

    if (!isNumeric(rollNo)) {
      return NextResponse.json(
        { success: false, message: "Roll number must be numeric" },
        { status: 400 }
      )
    }

    if (!isNumeric(phone) || phone.length < 10 || phone.length > 15) {
      return NextResponse.json(
        { success: false, message: "Phone must be numeric (10-15 digits)" },
        { status: 400 }
      )
    }

    const supplier = await Supplier.findOneAndUpdate(
      { firebaseUID },
      {
        $set: {
          name,
          rollNo,
          phone
        }
      },
      { returnDocument: "after" }
    )

    if (!supplier) {
      return NextResponse.json(
        { success: false, message: "Supplier profile not found" },
        { status: 404 }
      )
    }

    const existingUser = await User.findOne({ firebaseUID }).lean()
    const supplierRoleState = mergeUserRoles(existingUser, ["SUPPLIER"], {
      preferredRole: "SUPPLIER"
    })

    await User.findOneAndUpdate(
      { firebaseUID },
      {
        $set: {
          name,
          rollNo,
          phone,
          role: supplierRoleState.role,
          roles: supplierRoleState.roles
        }
      },
      { returnDocument: "after" }
    )

    return NextResponse.json({
      success: true,
      message: "Supplier profile updated",
      supplier: {
        ...supplier.toObject(),
        displayPhotoURL: supplier.photoURL || supplier.firebasePhotoURL || ""
      }
    })
  } catch (error) {
    console.error("SUPPLIER_PROFILE_UPDATE_ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update supplier profile"
      },
      { status: 500 }
    )
  }
}
