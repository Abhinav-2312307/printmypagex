import { NextResponse } from "next/server"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"
import { gzip } from "node:zlib"
import { promisify } from "node:util"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import { pusherServer } from "@/lib/pusher-server"
import type { UploadApiErrorResponse, UploadApiResponse } from "cloudinary"
import { sendOrderCreatedNotifications } from "@/lib/order-email"
import { authenticateUserRequest } from "@/lib/user-auth"
import {
  buildOrderFileAccessPath,
  CLOUDINARY_FREE_UPLOAD_SIZE_BYTES,
  SAFE_CLOUDINARY_UPLOAD_TARGET_BYTES,
  fitsCloudinaryFreeUploadLimit,
  getUploadLimitErrorMessage,
  getUploadLimitInfo,
  isAcceptedUploadFile,
  isImageUploadFile,
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
const gzipAsync = promisify(gzip)
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

type StorageEncoding = "none" | "gzip"

type PreparedCloudinaryPayload = {
  accessURL: string
  accessToken: string
  originalSizeBytes: number
  storageEncoding: StorageEncoding
  storageChunkURLs: string[]
  storageURL: string
  storedSizeBytes: number
}

type PreparedStoragePlan = {
  buffers: Buffer[]
  storageEncoding: StorageEncoding
}

function normalizeOriginalFileName(value: string, fallbackName: string) {
  const normalized = value.trim()
  return normalized || fallbackName.trim() || `file-${Date.now()}`
}

function buildStoredFileName(originalFileName: string, storageEncoding: StorageEncoding) {
  return storageEncoding === "gzip" ? `${originalFileName}.gz` : originalFileName
}

function splitBufferIntoChunks(buffer: Buffer, chunkSize: number) {
  const chunks: Buffer[] = []

  for (let offset = 0; offset < buffer.byteLength; offset += chunkSize) {
    chunks.push(buffer.subarray(offset, Math.min(offset + chunkSize, buffer.byteLength)))
  }

  return chunks
}

async function prepareBuffersForCloudinary(file: File, buffer: Buffer): Promise<PreparedStoragePlan> {
  if (fitsCloudinaryFreeUploadLimit(file) && buffer.byteLength <= CLOUDINARY_FREE_UPLOAD_SIZE_BYTES) {
    return {
      buffers: [buffer],
      storageEncoding: "none" as const
    }
  }

  const gzippedBuffer = await gzipAsync(buffer, { level: 9 })

  if (gzippedBuffer.byteLength > CLOUDINARY_FREE_UPLOAD_SIZE_BYTES) {
    const preferredBuffer = gzippedBuffer.byteLength < buffer.byteLength ? gzippedBuffer : buffer

    return {
      buffers: splitBufferIntoChunks(preferredBuffer, SAFE_CLOUDINARY_UPLOAD_TARGET_BYTES),
      storageEncoding: preferredBuffer === gzippedBuffer ? "gzip" : "none"
    }
  }

  return {
    buffers: [gzippedBuffer],
    storageEncoding: "gzip" as const
  }
}

async function notifyRelevantSuppliers(order: {
  _id: unknown
  requestType?: string | null
  supplierUID?: string | null
}) {
  const requestType = String(order.requestType || "global")
  let targetSupplierUIDs: string[] = []

  if (requestType === "specific" && order.supplierUID) {
    targetSupplierUIDs = [String(order.supplierUID)]
  } else {
    const activeSuppliers = (await Supplier.find({
      approved: true,
      active: true
    })
      .select("firebaseUID")
      .lean()) as Array<{ firebaseUID?: string }>

    targetSupplierUIDs = activeSuppliers
      .map((supplier) => String(supplier.firebaseUID || ""))
      .filter(Boolean)
  }

  if (!targetSupplierUIDs.length) {
    return
  }

  await Promise.all(
    [...new Set(targetSupplierUIDs)].map((supplierUID) =>
      pusherServer.trigger(`private-supplier-${supplierUID}`, "order-updated", order)
    )
  )
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
    const originalFileNameInput = String(formData.get("originalFileName") || "").trim()
    const originalFileTypeInput = String(formData.get("originalFileType") || "").trim()

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

    const sourceFileName = normalizeOriginalFileName(
      originalFileNameInput,
      file.name || `file-${Date.now()}`
    )
    const sourceFileType = originalFileTypeInput || file.type || "application/octet-stream"
    const { buffers: uploadBuffers, storageEncoding } = await prepareBuffersForCloudinary(file, buffer)
    const deliveryFileName =
      storageEncoding === "gzip"
        ? sourceFileName
        : normalizeOriginalFileName(file.name || "", sourceFileName)
    const deliveryFileType =
      storageEncoding === "gzip"
        ? sourceFileType
        : file.type || sourceFileType
    const usesProxyAccess = storageEncoding === "gzip" || uploadBuffers.length > 1

    // Detect file type for Cloudinary
    const resourceType =
      !usesProxyAccess && isImageUploadFile(file)
        ? "image"
        : "raw"
    const storedFileName = buildStoredFileName(deliveryFileName, storageEncoding)
    const accessToken = usesProxyAccess ? randomUUID().replace(/-/g, "") : ""

    const sanitizedBaseName = deliveryFileName
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "file"
    const uploadTimestamp = Date.now()

    // Upload file to Cloudinary
    const uploads = await Promise.all(
      uploadBuffers.map(
        (uploadBuffer, index) =>
          new Promise<UploadApiResponse>((resolve, reject) => {
            const partLabel =
              uploadBuffers.length > 1
                ? `-part-${String(index + 1).padStart(2, "0")}`
                : ""

            const uploadStream = cloudinary.uploader.upload_stream(
              {
                resource_type: resourceType,
                folder: "printmypage",
                public_id: `${sanitizedBaseName}-${uploadTimestamp}${partLabel}`,
                filename_override:
                  uploadBuffers.length > 1
                    ? `${storedFileName}.part-${index + 1}`
                    : storedFileName
              },
              (error, result) => {
                if (error) reject(error)
                else resolve(result!)
              }
            )

            uploadStream.end(uploadBuffer)
          })
      )
    )

    const preparedStorage: PreparedCloudinaryPayload = {
      accessURL: usesProxyAccess ? buildOrderFileAccessPath(accessToken) : uploads[0].secure_url,
      accessToken,
      originalSizeBytes: buffer.byteLength,
      storageEncoding,
      storageChunkURLs: uploadBuffers.length > 1 ? uploads.map((upload) => upload.secure_url) : [],
      storageURL: uploadBuffers.length > 1 ? "" : uploads[0].secure_url,
      storedSizeBytes: uploadBuffers.reduce((total, uploadBuffer) => total + uploadBuffer.byteLength, 0)
    }

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

      fileURL: preparedStorage.accessURL,

      storageChunkURLs: preparedStorage.storageChunkURLs,

      storageURL: preparedStorage.storageURL,

      fileOriginalName: deliveryFileName,

      fileMimeType: deliveryFileType,

      fileStorageEncoding: preparedStorage.storageEncoding,

      fileOriginalSizeBytes: preparedStorage.originalSizeBytes,

      fileStoredSizeBytes: preparedStorage.storedSizeBytes,

      ...(preparedStorage.accessToken
        ? {
            fileAccessToken: preparedStorage.accessToken
          }
        : {}),

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
      await notifyRelevantSuppliers(order)
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
