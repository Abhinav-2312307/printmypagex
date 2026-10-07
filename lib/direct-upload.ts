"use client"

import { authFetch, readJsonResponseSafely } from "./client-auth"
import { SAFE_CLOUDINARY_UPLOAD_TARGET_BYTES } from "./upload-file"

export type DirectUploadResult = {
  storageURL: string
  storageChunkURLs: string[]
  storageEncoding: "none" | "gzip"
  storedSizeBytes: number
  accessToken: string
  publicId: string
}

export type DirectUploadProgressHandler = (progress: {
  loaded: number
  total: number | null
}) => void

/**
 * Compresses a file using the browser's native CompressionStream("gzip").
 * If CompressionStream is unavailable or compression doesn't reduce size, returns original file.
 */
export async function compressFileGzip(file: File): Promise<{
  blob: Blob
  isGzipped: boolean
}> {
  if (typeof CompressionStream !== "undefined") {
    try {
      const stream = file.stream().pipeThrough(new CompressionStream("gzip"))
      const compressedBlob = await new Response(stream).blob()

      // Only use gzipped version if it actually reduced the byte size
      if (compressedBlob.size < file.size) {
        return {
          blob: compressedBlob,
          isGzipped: true
        }
      }
    } catch (err) {
      console.warn("Client gzip compression failed, falling back to raw file:", err)
    }
  }

  return {
    blob: file,
    isGzipped: false
  }
}

/**
 * Uploads a single Blob to Cloudinary via XMLHttpRequest with progress tracking.
 */
function uploadSingleBlobWithProgress(
  endpoint: string,
  formData: FormData,
  onProgress?: (progress: { loaded: number; total: number | null }) => void
): Promise<{ secure_url: string; [key: string]: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", endpoint)

    if (onProgress) {
      xhr.upload.addEventListener("progress", (event) => {
        onProgress({
          loaded: event.loaded,
          total: event.lengthComputable ? event.total : null
        })
      })
    }

    xhr.addEventListener("load", () => {
      try {
        const response = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && response.secure_url) {
          resolve(response)
        } else {
          reject(
            new Error(
              response?.error?.message ||
                `Cloudinary upload failed with status ${xhr.status}`
            )
          )
        }
      } catch {
        reject(new Error("Invalid response received from storage provider"))
      }
    })

    xhr.addEventListener("error", () => {
      reject(new Error("Network error during direct file upload to storage."))
    })

    xhr.send(formData)
  })
}

/**
 * Uploads a large file directly to Cloudinary using signed parameters.
 * Automatically slices files into chunks <= 9.5 MB to strictly respect
 * Cloudinary Free Tier's 10 MB per-file hard limit while bypassing Vercel's 4.5 MB gateway limit.
 */
export async function uploadLargeFileDirectly(
  file: File,
  onProgress?: DirectUploadProgressHandler
): Promise<DirectUploadResult> {
  // Step 1: Compress in browser if beneficial
  const { blob: payloadBlob, isGzipped } = await compressFileGzip(file)

  // Step 2: Slice into chunks <= 9.5 MB if needed
  const chunks: Blob[] = []
  if (payloadBlob.size > SAFE_CLOUDINARY_UPLOAD_TARGET_BYTES) {
    for (
      let offset = 0;
      offset < payloadBlob.size;
      offset += SAFE_CLOUDINARY_UPLOAD_TARGET_BYTES
    ) {
      chunks.push(
        payloadBlob.slice(
          offset,
          Math.min(offset + SAFE_CLOUDINARY_UPLOAD_TARGET_BYTES, payloadBlob.size)
        )
      )
    }
  } else {
    chunks.push(payloadBlob)
  }

  // Step 3: Request signed parameters from our serverless endpoint
  const signRes = await authFetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      isGzipped,
      chunkCount: chunks.length
    })
  })

  const { data: signData, rawText } = await readJsonResponseSafely<{
    success: boolean
    signature: string
    timestamp: number
    apiKey: string
    cloudName: string
    folder: string
    publicId: string
    resourceType: string
    accessToken: string
    chunks: Array<{ publicId: string; signature: string }>
    error?: string
  }>(signRes)

  if (!signRes.ok || !signData || !signData.chunks || signData.chunks.length === 0) {
    throw new Error(
      signData?.error || rawText.trim() || "Failed to get upload authorization"
    )
  }

  const uploadEndpoint = `https://api.cloudinary.com/v1_1/${signData.cloudName}/${signData.resourceType}/upload`
  const chunkUrls: string[] = []
  const totalPayloadSize = payloadBlob.size
  let totalUploadedBytes = 0

  // Step 4: Upload each chunk sequentially (under 9.5 MB each)
  for (let i = 0; i < chunks.length; i++) {
    const chunkBlob = chunks[i]
    const chunkSign = signData.chunks[i]
    const partLabel = chunks.length > 1 ? `.part-${i + 1}` : ""
    const fileNameForPart = isGzipped
      ? `${file.name}.gz${partLabel}`
      : `${file.name}${partLabel}`

    const cloudinaryFormData = new FormData()
    cloudinaryFormData.append("file", chunkBlob, fileNameForPart)
    cloudinaryFormData.append("api_key", signData.apiKey)
    cloudinaryFormData.append("timestamp", String(signData.timestamp))
    cloudinaryFormData.append("signature", chunkSign.signature)
    cloudinaryFormData.append("folder", signData.folder)
    cloudinaryFormData.append("public_id", chunkSign.publicId)

    let previousChunkLoaded = 0

    const chunkResult = await uploadSingleBlobWithProgress(
      uploadEndpoint,
      cloudinaryFormData,
      (progress) => {
        const delta = progress.loaded - previousChunkLoaded
        previousChunkLoaded = progress.loaded
        totalUploadedBytes += delta
        onProgress?.({
          loaded: totalUploadedBytes,
          total: totalPayloadSize
        })
      }
    )

    chunkUrls.push(chunkResult.secure_url)
  }

  return {
    storageURL: chunkUrls.length === 1 ? chunkUrls[0] : "",
    storageChunkURLs: chunkUrls.length > 1 ? chunkUrls : [],
    storageEncoding: isGzipped ? "gzip" : "none",
    storedSizeBytes: totalPayloadSize,
    accessToken: signData.accessToken,
    publicId: signData.publicId
  }
}
