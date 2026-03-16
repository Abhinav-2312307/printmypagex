const DEFAULT_OWNER_EMAILS = [
  "abhinavrishi32@gmail.com",
  "abhinav1the2great3@gmail.com"
]

function parseEmailList(value: string) {
  return value
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

export function getOwnerEmails() {
  const configured =
    process.env.NEXT_PUBLIC_ADMIN_OWNER_EMAILS ||
    process.env.ADMIN_OWNER_EMAILS ||
    ""

  const combined = [...parseEmailList(configured), ...DEFAULT_OWNER_EMAILS]
  return Array.from(new Set(combined))
}

export function isOwnerEmail(email?: string | null) {
  if (!email) return false
  return getOwnerEmails().includes(email.trim().toLowerCase())
}
