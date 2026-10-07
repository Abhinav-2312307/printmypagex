import { NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { authenticateUserRequest } from "@/lib/user-auth"
import cloudinary from "@/lib/cloudinary"
import {
  getUploadLimitInfo,
  isAcceptedUploadFile,
  isImageUploadFile
} from "@/lib/upload-file"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const auth = await authenticateUserRequest(req)
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload" },
        { status: 400 }
      )
    }

    const fileName = String(body.fileName || "").trim()
    const fileType = String(body.fileType || "").trim()
    const fileSize = Number(body.fileSize || 0)
    const isGzipped = Boolean(body.isGzipped)
    const chunkCount = Math.max(1, Math.min(20, Number(body.chunkCount) || 1))

    if (!fileName) {
      return NextResponse.json(
        { error: "File name is required" },
        { status: 400 }
      )
    }

    const pseudoFile = { name: fileName, type: fileType }
    if (!isAcceptedUploadFile(pseudoFile)) {
      await recordActivity({
        actorType: "user",
        actorUID: auth.uid,
        actorEmail: auth.email,
        action: "upload.unsupported_type",
        entityType: "upload_sign",
        level: "warning",
        message: `Sign rejected for unsupported file type: "${fileName}" (${fileType || "unknown"})`,
        req,
        metadata: { fileName, fileType, fileSize }
      })
      return NextResponse.json(
        { error: `File "${fileName}": Unsupported file type.` },
        { status: 400 }
      )
    }

    const uploadLimit = getUploadLimitInfo(pseudoFile)
    if (fileSize > uploadLimit.maxBytes) {
      await recordActivity({
        actorType: "user",
        actorUID: auth.uid,
        actorEmail: auth.email,
        action: "upload.size_exceeded",
        entityType: "upload_sign",
        level: "warning",
        message: `Sign rejected for oversized file: "${fileName}" (${(fileSize / (1024 * 1024)).toFixed(2)} MB, max ${uploadLimit.maxMb} MB)`,
        req,
        metadata: { fileName, fileSize, maxBytes: uploadLimit.maxBytes }
      })
      return NextResponse.json(
        { error: `File "${fileName}": File size exceeds the ${uploadLimit.maxMb} MB limit.` },
        { status: 413 }
      )
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
      console.error("CLOUDINARY_CONFIG_MISSING in /api/upload/sign")
      await recordActivity({
        actorType: "system",
        action: "upload.sign_config_missing",
        entityType: "system",
        level: "error",
        message: "Cloudinary configuration variables are missing on server in /api/upload/sign",
        req
      })
      return NextResponse.json(
        { error: "Cloudinary configuration is missing on server" },
        { status: 500 }
      )
    }

    const timestamp = Math.round(Date.now() / 1000)
    const sanitizedBaseName =
      fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50) || "file"

    const batchId = randomUUID().slice(0, 6)
    const folder = "printmypage"
    const resourceType =
      chunkCount === 1 && !isGzipped && isImageUploadFile(pseudoFile)
        ? "image"
        : "raw"
    const accessToken = randomUUID().replace(/-/g, "")

    const chunks = []
    for (let i = 0; i < chunkCount; i++) {
      const partLabel =
        chunkCount > 1 ? `-part-${String(i + 1).padStart(2, "0")}` : ""
      const publicId = `${sanitizedBaseName}-${timestamp}-${batchId}${partLabel}`

      const paramsToSign: Record<string, any> = {
        folder,
        public_id: publicId,
        timestamp
      }

      const signature = cloudinary.utils.api_sign_request(
        paramsToSign,
        apiSecret
      )

      chunks.push({
        publicId,
        signature
      })
    }

    return NextResponse.json({
      success: true,
      timestamp,
      apiKey,
      cloudName,
      folder,
      resourceType,
      accessToken,
      signature: chunks[0].signature,
      publicId: chunks[0].publicId,
      chunks
    })
  } catch (err: any) {
    console.error("UPLOAD_SIGN_ERROR:", err)
    await recordActivity({
      actorType: "user",
      action: "upload.sign_failed",
      entityType: "upload_sign",
      level: "error",
      message: `Upload signature generation failed: ${err?.message || "Unknown error"}`,
      req,
      metadata: { error: err?.message || String(err) }
    })
    return NextResponse.json(
      { error: err?.message || "Failed to generate upload signature" },
      { status: 500 }
    )
  }
}
