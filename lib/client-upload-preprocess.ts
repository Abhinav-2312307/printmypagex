"use client"

import {
  SAFE_CLOUDINARY_UPLOAD_TARGET_BYTES,
  fitsCloudinaryFreeUploadLimit,
  getFileExtension,
  getUploadCompressionFailureMessage,
  isImageUploadFile
} from "@/lib/upload-file"

type PreparedUploadResult = {
  file: File
  wasCompressed: boolean
}

const QUALITY_STEPS = [0.88, 0.8, 0.72, 0.64, 0.56, 0.5, 0.45]
const SCALE_STEPS = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52, 0.44, 0.36]

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("We could not read this image for compression."))
    }

    image.src = objectUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image compression failed."))
          return
        }

        resolve(blob)
      },
      "image/jpeg",
      quality
    )
  })
}

function buildCompressedImageName(file: File) {
  const extension = getFileExtension(file.name)
  const baseName = extension ? file.name.slice(0, -extension.length) : file.name
  const safeBaseName = (baseName || "upload")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")

  return `${safeBaseName || "upload"}-compressed.jpg`
}

async function compressImageForUpload(file: File): Promise<File> {
  const image = await loadImage(file)
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")

  if (!context) {
    throw new Error("Your browser could not prepare this image for upload.")
  }

  for (const scale of SCALE_STEPS) {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))

    context.clearRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = "#ffffff"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, quality)

      if (blob.size <= SAFE_CLOUDINARY_UPLOAD_TARGET_BYTES) {
        return new File([blob], buildCompressedImageName(file), {
          type: "image/jpeg",
          lastModified: Date.now()
        })
      }
    }
  }

  throw new Error(getUploadCompressionFailureMessage(file))
}

export async function prepareFileForUpload(file: File): Promise<PreparedUploadResult> {
  if (fitsCloudinaryFreeUploadLimit(file)) {
    return {
      file,
      wasCompressed: false
    }
  }

  if (!isImageUploadFile(file)) {
    return {
      file,
      wasCompressed: false
    }
  }

  return {
    file: await compressImageForUpload(file),
    wasCompressed: true
  }
}
