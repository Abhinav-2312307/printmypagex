"use client"

import { authFetch } from "./client-auth"

export type ClientErrorLogPayload = {
  action: string
  message: string
  level?: "error" | "warning" | "info"
  metadata?: Record<string, unknown>
}

/**
 * Reports a client-side user error to the backend ActivityLog so it
 * immediately appears in the Admin Dashboard logs.
 * Executes as a non-blocking fire-and-forget call.
 */
export function reportClientErrorToAdmin(payload: ClientErrorLogPayload) {
  try {
    authFetch("/api/activity/log-client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(() => {
      // Fallback standard fetch if auth token unavailable
      fetch("/api/activity/log-client-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(() => {})
    })
  } catch {
    // Non-blocking
  }
}
