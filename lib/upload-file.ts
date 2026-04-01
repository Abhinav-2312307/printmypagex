export const ACCEPTED_UPLOAD_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".doc",
  ".docx"
] as const

export const ACCEPTED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const

const IMAGE_UPLOAD_EXTENSIONS = [".png", ".jpg", ".jpeg"] as const
const IMAGE_UPLOAD_MIME_TYPES = ["image/png", "image/jpeg", "image/jpg"] as const
const MANUAL_PAGE_COUNT_EXTENSIONS = [".doc", ".docx"] as const
const MANUAL_PAGE_COUNT_MIME_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const
const PDF_UPLOAD_EXTENSIONS = [".pdf"] as const
const PDF_UPLOAD_MIME_TYPES = ["application/pdf"] as const

export const CLOUDINARY_FREE_UPLOAD_SIZE_MB = 10
export const MAX_IMAGE_UPLOAD_SIZE_MB = 50
export const MAX_PDF_UPLOAD_SIZE_MB = 50
export const MAX_RAW_UPLOAD_SIZE_MB = 50
export const SAFE_CLOUDINARY_UPLOAD_TARGET_MB = 9.5

export const MAX_IMAGE_UPLOAD_SIZE_BYTES = MAX_IMAGE_UPLOAD_SIZE_MB * 1024 * 1024
export const MAX_PDF_UPLOAD_SIZE_BYTES = MAX_PDF_UPLOAD_SIZE_MB * 1024 * 1024
export const MAX_RAW_UPLOAD_SIZE_BYTES = MAX_RAW_UPLOAD_SIZE_MB * 1024 * 1024
export const CLOUDINARY_FREE_UPLOAD_SIZE_BYTES = CLOUDINARY_FREE_UPLOAD_SIZE_MB * 1024 * 1024
export const SAFE_CLOUDINARY_UPLOAD_TARGET_BYTES =
  Math.floor(SAFE_CLOUDINARY_UPLOAD_TARGET_MB * 1024 * 1024)

export const UPLOAD_ACCEPT_ATTRIBUTE = ACCEPTED_UPLOAD_EXTENSIONS.join(",")
export const UPLOAD_POLICY_HELPER_TEXT =
  `Upload PDF, DOC, DOCX, PNG, JPG or JPEG files up to ${MAX_PDF_UPLOAD_SIZE_MB} MB. ` +
  `Files above ${CLOUDINARY_FREE_UPLOAD_SIZE_MB} MB use our lossless large-file storage path and are restored to their original bytes when opened.`

export function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase()
  const lastDotIndex = normalized.lastIndexOf(".")

  if (lastDotIndex === -1) return ""

  return normalized.slice(lastDotIndex)
}

export function isAcceptedUploadFile(file: Pick<File, "name" | "type"> | null) {
  if (!file) return false

  const extension = getFileExtension(file.name)

  return (
    ACCEPTED_UPLOAD_MIME_TYPES.includes(file.type as (typeof ACCEPTED_UPLOAD_MIME_TYPES)[number]) ||
    ACCEPTED_UPLOAD_EXTENSIONS.includes(extension as (typeof ACCEPTED_UPLOAD_EXTENSIONS)[number])
  )
}

export function requiresManualPageCount(file: Pick<File, "name" | "type"> | null) {
  if (!file) return false

  const extension = getFileExtension(file.name)

  return (
    MANUAL_PAGE_COUNT_MIME_TYPES.includes(file.type as (typeof MANUAL_PAGE_COUNT_MIME_TYPES)[number]) ||
    MANUAL_PAGE_COUNT_EXTENSIONS.includes(extension as (typeof MANUAL_PAGE_COUNT_EXTENSIONS)[number])
  )
}

export function isImageUploadFile(file: Pick<File, "name" | "type"> | null) {
  if (!file) return false

  const extension = getFileExtension(file.name)

  return (
    IMAGE_UPLOAD_MIME_TYPES.includes(file.type as (typeof IMAGE_UPLOAD_MIME_TYPES)[number]) ||
    IMAGE_UPLOAD_EXTENSIONS.includes(extension as (typeof IMAGE_UPLOAD_EXTENSIONS)[number])
  )
}

export function isPdfUploadFile(file: Pick<File, "name" | "type"> | null) {
  if (!file) return false

  const extension = getFileExtension(file.name)

  return (
    PDF_UPLOAD_MIME_TYPES.includes(file.type as (typeof PDF_UPLOAD_MIME_TYPES)[number]) ||
    PDF_UPLOAD_EXTENSIONS.includes(extension as (typeof PDF_UPLOAD_EXTENSIONS)[number])
  )
}

type UploadLimitInfo = {
  label: string
  maxBytes: number
  maxMb: number
}

export function getUploadLimitInfo(file: Pick<File, "name" | "type"> | null): UploadLimitInfo {
  if (isImageUploadFile(file)) {
    return {
      label: "images",
      maxBytes: MAX_IMAGE_UPLOAD_SIZE_BYTES,
      maxMb: MAX_IMAGE_UPLOAD_SIZE_MB
    }
  }

  if (isPdfUploadFile(file)) {
    return {
      label: "PDF files",
      maxBytes: MAX_PDF_UPLOAD_SIZE_BYTES,
      maxMb: MAX_PDF_UPLOAD_SIZE_MB
    }
  }

  return {
    label: "DOC, DOCX and raw files",
    maxBytes: MAX_RAW_UPLOAD_SIZE_BYTES,
    maxMb: MAX_RAW_UPLOAD_SIZE_MB
  }
}

export function getUploadLimitErrorMessage(file: Pick<File, "name" | "type"> | null) {
  const { label, maxMb } = getUploadLimitInfo(file)
  return `We accept ${label} up to ${maxMb} MB.`
}

export function getUploadCompressionFailureMessage(file: Pick<File, "name" | "type"> | null) {
  const subject = isImageUploadFile(file)
    ? "image"
    : isPdfUploadFile(file)
      ? "PDF"
      : "document"

  return `This ${subject} could not be prepared for Cloudinary storage. Please upload a smaller file and try again.`
}

export function fitsCloudinaryFreeUploadLimit(file: Pick<File, "size"> | null) {
  if (!file) return false
  return Number(file.size || 0) <= CLOUDINARY_FREE_UPLOAD_SIZE_BYTES
}

export function buildOrderFileAccessPath(token: string) {
  return `/api/orders/file/${encodeURIComponent(token)}`
}
