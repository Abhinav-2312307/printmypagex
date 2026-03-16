"use client"

import { useMemo, useState } from "react"

type ProfileAvatarProps = {
  name?: string
  photoURL?: string
  alt?: string
  className?: string
  imageClassName?: string
  initialsClassName?: string
  isOwner?: boolean
}

function sanitizePhotoURL(value?: string) {
  const url = String(value || "").trim()
  if (!url || url === "null" || url === "undefined") {
    return ""
  }
  return url
}

function getInitials(name?: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return "U"
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("")
}

export default function ProfileAvatar({
  name,
  photoURL,
  alt,
  className = "",
  imageClassName = "",
  initialsClassName = "",
  isOwner = false
}: ProfileAvatarProps) {
  const safePhotoURL = useMemo(() => sanitizePhotoURL(photoURL), [photoURL])
  const [failedURL, setFailedURL] = useState("")
  const initials = getInitials(name)
  const showImage = Boolean(safePhotoURL && failedURL !== safePhotoURL)

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden ${
        isOwner
          ? "border border-amber-300/45 bg-gradient-to-br from-amber-100/20 via-amber-200/10 to-amber-300/10 text-amber-50 shadow-[0_10px_24px_rgba(245,158,11,0.14)]"
          : "border border-slate-300/70 bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 dark:border-white/10 dark:from-slate-800 dark:to-slate-900 dark:text-white"
      } ${className}`.trim()}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={safePhotoURL}
          alt={alt || name || "Profile"}
          onError={() => setFailedURL(safePhotoURL)}
          className={`h-full w-full object-cover ${imageClassName}`.trim()}
        />
      ) : (
        <span
          className={`select-none font-semibold tracking-[0.06em] ${
            isOwner ? "text-amber-100" : "text-slate-700 dark:text-slate-100"
          } ${initialsClassName}`.trim()}
        >
          {initials}
        </span>
      )}

      {isOwner ? (
        <div className="pointer-events-none absolute inset-[3px] rounded-[inherit] border border-amber-100/25" />
      ) : null}
    </div>
  )
}
