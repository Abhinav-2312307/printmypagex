import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import { authenticateUserRequest } from "@/lib/user-auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const auth = await authenticateUserRequest(req, {
      requireProfile: false,
      requireActive: false
    })
    if (!auth.ok) return auth.response

    await connectDB()

    const body = await req.json()
    const firebaseUID = body?.firebaseUID as string | undefined
    const email = body?.email as string | undefined
    const photoURL = body?.photoURL as string | undefined

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

    if (!email && !photoURL) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing email or photoURL"
        },
        { status: 400 }
      )
    }

    const supplier = await Supplier.findOneAndUpdate(
      { firebaseUID },
      {
        $set: {
          ...(email ? { email } : {}),
          ...(photoURL ? { firebasePhotoURL: photoURL } : {})
        }
      },
      { returnDocument: "after" }
    )

    if (!supplier) {
      return NextResponse.json(
        {
          success: false,
          message: "Supplier not found"
        },
        { status: 404 }
      )
    }

    await User.findOneAndUpdate(
      { firebaseUID },
      {
        $set: {
          ...(email ? { email } : {}),
          ...(photoURL ? { firebasePhotoURL: photoURL } : {})
        }
      },
      { returnDocument: "after" }
    )

    console.log("SUPPLIER_PROFILE_DEBUG: Synced supplier profile fields", {
      firebaseUID,
      hasEmail: Boolean(email),
      hasPhotoURL: Boolean(photoURL)
    })

    return NextResponse.json({
      success: true,
      message: "Supplier profile synced"
    })
  } catch (error) {
    console.error("SUPPLIER_PROFILE_DEBUG: Failed to sync supplier profile", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to sync supplier profile"
      },
      { status: 500 }
    )
  }
}
