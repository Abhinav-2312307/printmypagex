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

const MANUAL_PAGE_COUNT_EXTENSIONS = [".doc", ".docx"] as const
const MANUAL_PAGE_COUNT_MIME_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
] as const

export const UPLOAD_ACCEPT_ATTRIBUTE = ACCEPTED_UPLOAD_EXTENSIONS.join(",")

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
