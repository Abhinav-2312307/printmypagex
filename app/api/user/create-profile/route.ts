import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import User from "@/models/User"
import {
  isAlphabeticText,
  isAlphanumericHyphenText,
  isNumeric,
  normalizeText
} from "@/lib/form-validation"
import { authenticateUserRequest } from "@/lib/user-auth"
import { mergeUserRoles } from "@/lib/user-roles"

export async function POST(req: Request) {

  try {
    const auth = await authenticateUserRequest(req, {
      requireProfile: false,
      requireActive: false
    })
    if (!auth.ok) return auth.response

    await connectDB()

    const body = await req.json()

    if (!body.firebaseUID) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing firebaseUID"
        },
        { status: 400 }
      )
    }

    if (String(body.firebaseUID) !== auth.uid) {
      return NextResponse.json(
        {
          success: false,
          message: "Unauthorized UID"
        },
        { status: 403 }
      )
    }

    const name = normalizeText(String(body.name || ""))
    const rollNo = String(body.rollNo || "").trim()
    const branch = normalizeText(String(body.branch || ""))
    const section = normalizeText(String(body.section || ""))
    const phone = String(body.phone || "").trim()
    const year = Number(body.year)

    if (!name || !isAlphabeticText(name)) {
      return NextResponse.json(
        { success: false, message: "Name must contain only text" },
        { status: 400 }
      )
    }

    if (!rollNo || !isNumeric(rollNo)) {
      return NextResponse.json(
        { success: false, message: "Roll number must be numeric" },
        { status: 400 }
      )
    }

    if (!branch || !isAlphabeticText(branch)) {
      return NextResponse.json(
        { success: false, message: "Branch must contain only text" },
        { status: 400 }
      )
    }

    if (!section || !isAlphanumericHyphenText(section)) {
      return NextResponse.json(
        { success: false, message: "Section must contain only letters, numbers or '-'" },
        { status: 400 }
      )
    }

    if (!Number.isInteger(year) || year < 1 || year > 8) {
      return NextResponse.json(
        { success: false, message: "Year must be a number between 1 and 8" },
        { status: 400 }
      )
    }

    if (!isNumeric(phone) || phone.length < 10 || phone.length > 15) {
      return NextResponse.json(
        { success: false, message: "Phone must be numeric (10-15 digits)" },
        { status: 400 }
      )
    }

    const existingUser = await User.findOne({ firebaseUID: body.firebaseUID }).lean()
    const roleState = mergeUserRoles(existingUser, ["USER"])

    const user = await User.findOneAndUpdate(
      { firebaseUID: body.firebaseUID },
      {
        $set: {
          firebaseUID: body.firebaseUID,
          email: body.email || existingUser?.email || undefined,
          firebasePhotoURL: body.photoURL || existingUser?.firebasePhotoURL || undefined,
          name,
          rollNo,
          branch,
          year,
          section,
          phone,
          role: roleState.role,
          roles: roleState.roles,
          approved: existingUser?.approved ?? true,
          active: existingUser?.active ?? true
        }
      },
      {
        upsert: true,
        new: true
      }
    )

    console.log("USER_PROFILE_DEBUG: Profile upserted", {
      firebaseUID: body.firebaseUID,
      hasEmail: Boolean(body.email)
    })

    return NextResponse.json({
      success: true,
      message: "Profile saved successfully",
      user
    })
  } catch (error) {
    console.error("USER_PROFILE_DEBUG: Create/Update failed", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to save profile"
      },
      { status: 500 }
    )
  }
}
