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

export async function POST(req: Request) {
  try {
    const auth = await authenticateUserRequest(req)
    if (!auth.ok) return auth.response

    await connectDB()

    const body = await req.json()

    const firebaseUID = String(body?.firebaseUID || "").trim()
    const name = normalizeText(String(body?.name || ""))
    const rollNo = String(body?.rollNo || "").trim()
    const branch = normalizeText(String(body?.branch || ""))
    const section = normalizeText(String(body?.section || ""))
    const phone = String(body?.phone || "").trim()
    const year = Number(body?.year)

    if (!firebaseUID) {
      return NextResponse.json(
        { success: false, message: "Missing firebaseUID" },
        { status: 400 }
      )
    }

    if (firebaseUID !== auth.uid) {
      return NextResponse.json(
        { success: false, message: "Unauthorized UID" },
        { status: 403 }
      )
    }

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

    const user = await User.findOneAndUpdate(
      { firebaseUID },
      {
        $set: {
          name,
          rollNo,
          branch,
          section,
          year,
          phone
        }
      },
      { returnDocument: "after" }
    )

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User profile not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated",
      user: {
        ...user.toObject(),
        displayPhotoURL: user.photoURL || user.firebasePhotoURL || ""
      }
    })
  } catch (error) {
    console.error("USER_PROFILE_UPDATE_ERROR:", error)
    return NextResponse.json(
      { success: false, message: "Failed to update profile" },
      { status: 500 }
    )
  }
}
