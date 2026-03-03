import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { pusherServer } from "@/lib/pusher-server"
import { v2 as cloudinary } from "cloudinary"
import pdf from "pdf-parse/lib/pdf-parse.js"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!
})

export async function POST(req: Request) {

  try {

    await connectDB()

    const formData = await req.formData()

    const file = formData.get("file") as File
    const printType = formData.get("printType") as string
    const firebaseUID = formData.get("firebaseUID") as string
    const requestType = formData.get("requestType") as string
    const supplier = formData.get("supplier") as string

    if (!file) {
      return NextResponse.json({ error: "File missing" }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Count pages
    let pages = 1

    if (file.type === "application/pdf") {
      const data = await pdf(buffer)
      pages = data.numpages
    }

    // Price calculation
    let pricePerPage = 2

    if (printType === "color") pricePerPage = 5
    if (printType === "glossy") pricePerPage = 15

    const estimatedPrice = pages * pricePerPage

    // Upload to Cloudinary
    const upload = await cloudinary.uploader.upload(
      `data:${file.type};base64,${buffer.toString("base64")}`,
      {
        resource_type: "auto"
      }
    )

    // Create Order (Marketplace Mode - Option A)
    const order = await Order.create({

      userUID: firebaseUID,

      supplierUID: requestType === "specific" ? supplier : null,

      requestType: requestType || "global",

      fileURL: upload.secure_url,

      pages,

      printType,

      estimatedPrice,

      status: "pending"

    })

    // 🔥 REAL-TIME BROADCAST TO SUPPLIERS
    await pusherServer.trigger("orders", "new-order", order)

    return NextResponse.json({
      success: true,
      pages,
      estimatedPrice,
      order
    })

  } catch (err) {

    console.error("UPLOAD ERROR:", err)

    return NextResponse.json({
      error: "Upload failed"
    }, { status: 500 })

  }

}