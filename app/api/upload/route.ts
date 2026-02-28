import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
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

    if (!file) {
      return NextResponse.json({error:"File missing"})
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let pages = 1

    if (file.type === "application/pdf") {

      const data = await pdf(buffer)
      pages = data.numpages

    }

    let pricePerPage = 2

    if (printType === "color") pricePerPage = 5
    if (printType === "glossy") pricePerPage = 15

    const price = pages * pricePerPage

    const upload = await cloudinary.uploader.upload(
      `data:${file.type};base64,${buffer.toString("base64")}`,
      {
        resource_type: "auto"
      }
    )

    const order = await Order.create({
      firebaseUID,
      fileUrl: upload.secure_url,
      pages,
      price,
      status: "pending"
    })

    return NextResponse.json({
      success:true,
      pages,
      price,
      order
    })

  } catch(err){

    console.log("UPLOAD ERROR:", err)

    return NextResponse.json({
      error:"Upload failed"
    })

  }

}