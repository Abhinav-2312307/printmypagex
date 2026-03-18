import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import type { UploadApiResponse } from "cloudinary"
import { authenticateUserRequest } from "@/lib/user-auth"
import cloudinary from "@/lib/cloudinary"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const auth = await authenticateUserRequest(req)
    if (!auth.ok) return auth.response

    await connectDB()

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const requestedUID = String(formData.get("firebaseUID") || "").trim()
    const firebaseUID = auth.uid

    if (!requestedUID) {
      return NextResponse.json(
        { success: false, message: "Missing firebaseUID" },
        { status: 400 }
      )
    }

    if (requestedUID !== firebaseUID) {
      return NextResponse.json(
        { success: false, message: "Unauthorized UID" },
        { status: 403 }
      )
    }

    if (!file) {
      return NextResponse.json(
        { success: false, message: "File is required" },
        { status: 400 }
      )
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "Only image files are allowed" },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          folder: "printmypage/profile",
          public_id: `supplier-${firebaseUID}-${Date.now()}`
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result!)
        }
      )

      stream.end(buffer)
    })

    const photoURL = upload.secure_url

    const user = await User.findOneAndUpdate(
      { firebaseUID },
      { $set: { photoURL } },
      { returnDocument: "after" }
    )

    if (!user) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      )
    }

    const supplier = await Supplier.findOneAndUpdate(
      { firebaseUID },
      { $set: { photoURL } },
      { returnDocument: "after" }
    )

    return NextResponse.json({
      success: true,
      message: "Profile photo updated",
      photoURL,
      supplier:
        (supplier
          ? {
              ...supplier.toObject(),
              displayPhotoURL: photoURL || supplier.firebasePhotoURL || ""
            }
          :
        {
          firebaseUID,
          name: user.name || "Owner",
          email: user.email || "",
          phone: user.phone || "",
          rollNo: user.rollNo || "",
          branch: user.branch || "",
          year: user.year || "",
          photoURL,
          firebasePhotoURL: user.firebasePhotoURL || "",
          displayPhotoURL: photoURL || user.firebasePhotoURL || "",
          approved: true,
          active: true
        })
    })
  } catch (error) {
    console.error("SUPPLIER_UPLOAD_PHOTO_ERROR:", error)
    return NextResponse.json(
      { success: false, message: "Failed to upload profile photo" },
      { status: 500 }
    )
  }
}
