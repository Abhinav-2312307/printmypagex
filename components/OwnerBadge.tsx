"use client"

import { isOwnerEmail } from "@/lib/owner-access"

type OwnerBadgeProps = {
  email?: string | null
  isOwner?: boolean
  label?: string
  className?: string
}

export default function OwnerBadge({
  email,
  isOwner,
  label = "Owner",
  className = ""
}: OwnerBadgeProps) {
  const shouldShow = Boolean(isOwner || isOwnerEmail(email))

  if (!shouldShow) {
    return null
  }

  const displayLabel = email === "2k23.cs2312635@gmail.com" ? "CEO" : label

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300/35 bg-amber-100/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800 shadow-[0_6px_18px_rgba(245,158,11,0.12)] dark:bg-amber-200/10 dark:text-amber-100 ${className}`.trim()}
    >
      <svg className="h-3 w-3 text-current" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2l2.35 4.76 5.25.76-3.8 3.7.9 5.23L12 14l-4.7 2.45.9-5.23-3.8-3.7 5.25-.76L12 2z" />
      </svg>
      {displayLabel}
    </span>
  )
}
