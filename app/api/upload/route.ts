import { NextResponse } from "next/server"
import { createRequire } from "node:module"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import User from "@/models/User"
import { pusherServer } from "@/lib/pusher-server"
import type { UploadApiErrorResponse, UploadApiResponse } from "cloudinary"
import { sendOrderCreatedNotifications } from "@/lib/order-email"
import { authenticateUserRequest } from "@/lib/user-auth"
import {
  getUploadLimitErrorMessage,
  getUploadLimitInfo,
  isAcceptedUploadFile,
  isPdfUploadFile,
  requiresManualPageCount
} from "@/lib/upload-file"
import cloudinary from "@/lib/cloudinary"
import { calculateOrderPrice } from "@/lib/print-pricing"
import { getPrintPricing } from "@/lib/print-pricing-store"
import {
  buildSubmissionFingerprint,
  createSubmissionLimitResponse,
  enforceSubmissionGuards,
  getRequestDeviceKey
} from "@/lib/submission-protection"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

const require = createRequire(import.meta.url)
const PDFJS = require("pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js") as {
  getDocument: (source: { data: Uint8Array; password?: string }) => {
    promise: Promise<{
      numPages: number
      destroy?: () => Promise<void> | void
    }>
    destroy?: () => Promise<void> | void
  }
  PasswordResponses: {
    NEED_PASSWORD: number
    INCORRECT_PASSWORD: number
  }
}

const ORDER_DEVICE_RULES = [
  {
    name: "order-device-burst",
    windowMs: 10 * 60 * 1000,
    maxRequests: 15,
    blockDurationMs: 15 * 60 * 1000
  },
  {
    name: "order-device-daily",
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: 20,
    blockDurationMs: 24 * 60 * 60 * 1000
  }
]

const ORDER_USER_RULES = [
  {
    name: "order-user-burst",
    windowMs: 10 * 60 * 1000,
    maxRequests: 15,
    blockDurationMs: 15 * 60 * 1000
  },
  {
    name: "order-user-daily",
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: 20,
    blockDurationMs: 24 * 60 * 60 * 1000
  }
]

const VALID_PRINT_TYPES = new Set(["bw", "color", "glossy"])
const VALID_REQUEST_TYPES = new Set(["global", "specific"])

type PdfParseAttempt =
  | {
      status: "success"
      pages: number
    }
  | {
      status: "password_required"
    }
  | {
      status: "incorrect_password"
    }
  | {
      status: "unreadable"
      error: unknown
    }

type PdfPageResolution =
  | {
      status: "success"
      pages: number
      isPasswordProtected: boolean
    }
  | {
      status: "password_required"
    }
  | {
      status: "incorrect_password"
    }
  | {
      status: "unreadable"
      error: unknown
    }

function isPdfPasswordError(error: unknown, code: number) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "PasswordException" &&
    "code" in error &&
    error.code === code
  )
}

async function attemptPdfPageCount(buffer: Buffer, password?: string): Promise<PdfParseAttempt> {
  const source: { data: Uint8Array; password?: string } = {
    data: new Uint8Array(buffer)
  }

  if (password !== undefined) {
    source.password = password
  }

  let loadingTask: ReturnType<typeof PDFJS.getDocument> | null = null
  let pdfDocument: Awaited<ReturnType<typeof PDFJS.getDocument>["promise"]> | null = null

  try {
    loadingTask = PDFJS.getDocument(source)
    pdfDocument = await loadingTask.promise

    return {
      status: "success",
      pages: pdfDocument.numPages
    }
  } catch (error) {
    if (isPdfPasswordError(error, PDFJS.PasswordResponses.NEED_PASSWORD)) {
      return { status: "password_required" }
    }

    if (isPdfPasswordError(error, PDFJS.PasswordResponses.INCORRECT_PASSWORD)) {
      return { status: "incorrect_password" }
    }

    return {
      status: "unreadable",
      error
    }
  } finally {
    if (pdfDocument?.destroy) {
      try {
        await pdfDocument.destroy()
      } catch {
        // Ignore cleanup failures for PDF parsing attempts.
      }
    } else if (loadingTask?.destroy) {
      try {
        await loadingTask.destroy()
      } catch {
        // Ignore cleanup failures for PDF parsing attempts.
      }
    }
  }
}

async function resolvePdfPageCount(buffer: Buffer, password: string): Promise<PdfPageResolution> {
  const initialAttempt = await attemptPdfPageCount(buffer)

  if (initialAttempt.status === "success") {
    return {
      status: "success",
      pages: initialAttempt.pages,
      isPasswordProtected: false
    }
  }

  if (initialAttempt.status === "unreadable") {
    return initialAttempt
  }

  if (!password) {
    return {
      status: "password_required"
    }
  }

  const passwordAttempt = await attemptPdfPageCount(buffer, password)

  if (passwordAttempt.status === "success") {
    return {
      status: "success",
      pages: passwordAttempt.pages,
      isPasswordProtected: true
    }
  }

  if (passwordAttempt.status === "password_required" || passwordAttempt.status === "incorrect_password") {
    return {
      status: "incorrect_password"
    }
  }

  return passwordAttempt
}

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
    const requestType = String(formData.get("requestType") || "").trim()
    const supplier = String(formData.get("supplier") || "").trim()
    const manualPageCountValue = String(formData.get("pageCount") || "").trim()
    const rawPdfPassword = formData.get("pdfPassword")
    const pdfPassword = typeof rawPdfPassword === "string" ? rawPdfPassword : ""

    // NEW FIELDS
    const copiesValue = String(formData.get("copies") || "").trim()
    const alternatePhone = String(formData.get("alternatePhone") || "").trim()
    const duplex = String(formData.get("duplex") || "").trim()
    const spiralBinding = String(formData.get("spiralBinding") || "").trim()
    const instruction = String(formData.get("instruction") || "").trim()
    const copies = copiesValue === "" ? 1 : Number(copiesValue)

    if (!file) {
      return NextResponse.json(
        { error: "File missing" },
        { status: 400 }
      )
    }

    const uploadLimit = getUploadLimitInfo(file)

    if (file.size > uploadLimit.maxBytes) {
      return NextResponse.json(
        {
          error: getUploadLimitErrorMessage(file)
        },
        { status: 413 }
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

    if (!VALID_PRINT_TYPES.has(printType)) {
      return NextResponse.json(
        { error: "Invalid print type selected" },
        { status: 400 }
      )
    }

    if (!VALID_REQUEST_TYPES.has(requestType)) {
      return NextResponse.json(
        { error: "Invalid request type selected" },
        { status: 400 }
      )
    }

    if (requestType === "specific" && !supplier) {
      return NextResponse.json(
        { error: "Select a supplier for a specific request" },
        { status: 400 }
      )
    }

    if (alternatePhone && !/^\d{10,15}$/.test(alternatePhone)) {
      return NextResponse.json(
        { error: "Alternate phone must be 10-15 digits" },
        { status: 400 }
      )
    }

    if (instruction.length > 500) {
      return NextResponse.json(
        { error: "Instruction must be 500 characters or fewer" },
        { status: 400 }
      )
    }

    if (!Number.isInteger(copies) || copies < 1) {
      return NextResponse.json(
        { error: "Copies must be a whole number greater than 0" },
        { status: 400 }
      )
    }

    // Allowed file types
    if (!isAcceptedUploadFile(file)) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload PDF, DOC, DOCX, PNG, JPG or JPEG files." },
        { status: 400 }
      )
    }

    const payloadFingerprint = buildSubmissionFingerprint([
      firebaseUID,
      file.name,
      file.size,
      file.type,
      printType,
      requestType,
      supplier,
      manualPageCountValue,
      copies,
      alternatePhone,
      duplex,
      spiralBinding,
      instruction
    ])
    const guard = await enforceSubmissionGuards([
      {
        scope: "order-create-device",
        identifier: getRequestDeviceKey(req),
        rules: ORDER_DEVICE_RULES,
        payloadFingerprint
      },
      {
        scope: "order-create-user",
        identifier: buildSubmissionFingerprint([firebaseUID]),
        rules: ORDER_USER_RULES,
        payloadFingerprint
      }
    ])

    if (!guard.allowed) {
      return createSubmissionLimitResponse(
        "Too many order creation requests were sent from this account or device.",
        guard.retryAfterSeconds
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
    let pdfPasswordRequired = false

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

    const isPdfUpload = isPdfUploadFile(file)

    if (!needsManualPageCount && isPdfUpload) {
      const pdfPageResolution = await resolvePdfPageCount(buffer, pdfPassword)

      if (pdfPageResolution.status === "password_required") {
        return NextResponse.json(
          {
            error: "This PDF is locked. Enter the PDF password so we can count pages and share it with the supplier.",
            code: "PDF_PASSWORD_REQUIRED",
            requiresPdfPassword: true
          },
          { status: 400 }
        )
      }

      if (pdfPageResolution.status === "incorrect_password") {
        return NextResponse.json(
          {
            error: "The PDF password looks incorrect. Please recheck it and try again.",
            code: "PDF_PASSWORD_INVALID",
            requiresPdfPassword: true
          },
          { status: 400 }
        )
      }

      if (pdfPageResolution.status === "unreadable") {
        console.error("PDF parse error:", pdfPageResolution.error)
        return NextResponse.json(
          {
            error: "We could not read this PDF. Please upload a valid PDF file or re-export it and try again."
          },
          { status: 400 }
        )
      }

      pages = pdfPageResolution.pages
      pdfPasswordRequired = pdfPageResolution.isPasswordProtected
    }

    // Price calculation
    const pricing = await getPrintPricing()
    const wantsSpiralBinding = spiralBinding === "true"
    const estimatedPrice = calculateOrderPrice(pages, printType, pricing, {
      copies,
      spiralBinding: wantsSpiralBinding
    })

    // Detect file type for Cloudinary
    const isImage = file.type.startsWith("image/")
    const resourceType = isImage ? "image" : "raw"

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

      spiralBinding: wantsSpiralBinding,

      instruction: instruction || "",

      fileURL: upload.secure_url,

      pdfPasswordRequired,

      pdfPassword: pdfPasswordRequired ? pdfPassword : "",

      pages,

      copies,

      printType,

      estimatedPrice,

      status: "pending"

    })

    // Real-time broadcast
    try {
      await pusherServer.trigger(
        "orders",
        "new-order",
        order
      )
    } catch (pushError) {
      console.error("PUSHER ORDER CREATE ERROR:", pushError)
    }

    sendOrderCreatedNotifications(order).catch((emailError) => {
      console.error("ORDER_CREATED_EMAIL_ERROR:", emailError)
    })
    console.log("ORDER_EMAIL_DEBUG: Triggered create notifications", {
      orderId: String(order._id),
      requestType: order.requestType
    })

    await recordActivity({
      actorType: "user",
      actorUID: firebaseUID,
      actorEmail: auth.email,
      action: "order.created",
      entityType: "order",
      entityId: String(order._id),
      level: "success",
      message: `User created order ${String(order._id).slice(-8)}`,
      metadata: {
        orderId: String(order._id),
        userUID: firebaseUID,
        supplierUID: String(order.supplierUID || ""),
        requestType: String(order.requestType || ""),
        estimatedPrice: Number(order.estimatedPrice || 0),
        pages: Number(order.pages || 0),
        copies: Number(order.copies || 1),
        printType: String(order.printType || "")
      }
    })

    return NextResponse.json({
      success: true,
      pages,
      copies,
      estimatedPrice,
      order
    })

  } catch (err) {

    console.error("UPLOAD ERROR:", err)

    const uploadErrorMessage =
      typeof err === "object" &&
      err !== null &&
      "message" in err &&
      typeof (err as UploadApiErrorResponse).message === "string"
        ? (err as UploadApiErrorResponse).message
        : ""

    if (uploadErrorMessage) {
      return NextResponse.json(
        { error: uploadErrorMessage },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    )

  }

}
