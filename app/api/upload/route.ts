import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import User from "@/models/User"
import { pusherServer } from "@/lib/pusher-server"
import { v2 as cloudinary } from "cloudinary"
import type { UploadApiResponse } from "cloudinary"
import pdf from "pdf-parse/lib/pdf-parse.js"
import { sendOrderCreatedNotifications } from "@/lib/order-email"
import { authenticateUserRequest } from "@/lib/user-auth"
import { isAcceptedUploadFile, requiresManualPageCount } from "@/lib/upload-file"

export const runtime = "nodejs"

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!
})

export async function POST(req: Request) {

  try {
    const auth = await authenticateUserRequest(req)
    if (!auth.ok) return auth.response

    await connectDB()

    const formData = await req.formData()

    const file = formData.get("file") as File
    const printType = formData.get("printType") as string
    const requestedUID = String(formData.get("firebaseUID") || "").trim()
    const firebaseUID = auth.uid
    const userEmail = formData.get("userEmail") as string
    const requestType = formData.get("requestType") as string
    const supplier = formData.get("supplier") as string
    const manualPageCountValue = String(formData.get("pageCount") || "").trim()

    // NEW FIELDS
    const alternatePhone = formData.get("alternatePhone") as string
    const duplex = formData.get("duplex") as string
    const instruction = formData.get("instruction") as string

    if (!file) {
      return NextResponse.json(
        { error: "File missing" },
        { status: 400 }
      )
    }

    if (!requestedUID) {
      return NextResponse.json(
        { error: "User authentication required" },
        { status: 401 }
      )
    }

    if (requestedUID !== firebaseUID) {
      return NextResponse.json(
        { error: "Unauthorized UID" },
        { status: 403 }
      )
    }

    // Allowed file types
    if (!isAcceptedUploadFile(file)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF, DOC, DOCX, PNG, JPG or JPEG files." },
        { status: 400 }
      )
    }

    // Verify user
    const user = await User.findOne({ firebaseUID })

    console.log("USER_PROFILE_DEBUG: Upload payload identity", {
      firebaseUID,
      hasUserEmailInPayload: Boolean(userEmail),
      hasUserEmailInDB: Boolean(user?.email),
      hasUserNameInDB: Boolean(user?.name)
    })

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 403 }
      )
    }

    if (userEmail) {
      await User.updateOne(
        { firebaseUID },
        {
          $set: {
            email: userEmail
          }
        }
      )
      console.log("USER_PROFILE_DEBUG: Synced user email in upload route", {
        firebaseUID,
        hasEmail: Boolean(userEmail)
      })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Detect pages
    let pages = 1
    const needsManualPageCount = requiresManualPageCount(file)

    if (needsManualPageCount) {
      const parsedPageCount = Number.parseInt(manualPageCountValue, 10)

      if (!Number.isInteger(parsedPageCount) || parsedPageCount < 1) {
        return NextResponse.json(
          { error: "Enter a valid page count for DOC or DOCX files." },
          { status: 400 }
        )
      }

      pages = parsedPageCount
    }

    if (!needsManualPageCount && file.type === "application/pdf") {
      try {
        const data = await pdf(buffer)
        pages = data.numpages
      } catch (err) {
        console.error("PDF parse error:", err)
        pages = 1
      }
    }

    // Price calculation
    const priceMap: Record<string, number> = {
      bw: 2,
      color: 5,
      glossy: 15
    }

    const pricePerPage = priceMap[printType] || 2
    const estimatedPrice = pages * pricePerPage

    // Detect file type for Cloudinary
    const isImage = file.type.startsWith("image/")
    const isPdf = file.type === "application/pdf"
    const resourceType = (isImage || isPdf) ? "image" : "raw"

    const originalFileName = (file.name || `file-${Date.now()}`).trim()

    const sanitizedBaseName = originalFileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "file"

    // Upload file to Cloudinary
    const upload = await new Promise<UploadApiResponse>((resolve, reject) => {

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder: "printmypage",
          public_id: `${sanitizedBaseName}-${Date.now()}`,
          filename_override: originalFileName
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result!)
        }
      )

      uploadStream.end(buffer)

    })

    // CREATE ORDER
    const order = await Order.create({

      userUID: firebaseUID,

      supplierUID:
        requestType === "specific" && supplier
          ? supplier
          : null,

      requestType: requestType || "global",

      alternatePhone: alternatePhone || "",

      duplex: duplex === "true",

      instruction: instruction || "",

      fileURL: upload.secure_url,

      pages,

      printType,

      estimatedPrice,

      status: "pending"

    })

    // Real-time broadcast
    await pusherServer.trigger(
      "orders",
      "new-order",
      order
    )

    sendOrderCreatedNotifications(order).catch((emailError) => {
      console.error("ORDER_CREATED_EMAIL_ERROR:", emailError)
    })
    console.log("ORDER_EMAIL_DEBUG: Triggered create notifications", {
      orderId: String(order._id),
      requestType: order.requestType
    })

    return NextResponse.json({
      success: true,
      pages,
      estimatedPrice,
      order
    })

  } catch (err) {

    console.error("UPLOAD ERROR:", err)

    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    )

  }

}
