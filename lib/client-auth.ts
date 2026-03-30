"use client"

import { auth } from "@/lib/firebase"
import { onAuthStateChanged, type User } from "firebase/auth"

type AuthFetchOptions = {
  forceRefresh?: boolean
}

type AuthUploadProgress = {
  loaded: number
  total: number | null
}

type AuthUploadHandlers = {
  onUploadComplete?: () => void
  onUploadProgress?: (progress: AuthUploadProgress) => void
}

type SafeJsonResponse<T> = {
  data: T | null
  rawText: string
}

async function getAuthenticatedUser() {
  let user = auth.currentUser
  if (!user) {
    user = await new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
        unsubscribe()
        resolve(nextUser)
      })
    })
  }

  if (!user) {
    throw new Error("Authentication required")
  }

  return user
}

function buildAuthorizedHeaders(headers: HeadersInit | undefined, token: string) {
  const nextHeaders = new Headers(headers || {})
  nextHeaders.set("Authorization", `Bearer ${token}`)
  return nextHeaders
}

function parseResponseHeaders(rawHeaders: string) {
  const headers = new Headers()

  rawHeaders
    .trim()
    .split(/[\r\n]+/)
    .forEach((line) => {
      if (!line) return

      const separatorIndex = line.indexOf(":")
      if (separatorIndex === -1) return

      headers.append(
        line.slice(0, separatorIndex).trim(),
        line.slice(separatorIndex + 1).trim()
      )
    })

  return headers
}

export async function readJsonResponseSafely<T>(response: Response): Promise<SafeJsonResponse<T>> {
  const rawText = await response.text()

  if (!rawText) {
    return {
      data: null,
      rawText: ""
    }
  }

  try {
    return {
      data: JSON.parse(rawText) as T,
      rawText
    }
  } catch {
    return {
      data: null,
      rawText
    }
  }
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: AuthFetchOptions = {}
) {
  const user = await getAuthenticatedUser()
  const token = await user.getIdToken(Boolean(options.forceRefresh))
  const headers = buildAuthorizedHeaders(init.headers, token)

  return fetch(input, {
    ...init,
    headers
  })
}

export async function authUploadWithProgress(
  input: string | URL,
  init: Omit<RequestInit, "body"> & { body: Document | XMLHttpRequestBodyInit },
  handlers: AuthUploadHandlers = {},
  options: AuthFetchOptions = {}
) {
  const user = await getAuthenticatedUser()
  const token = await user.getIdToken(Boolean(options.forceRefresh))
  const headers = buildAuthorizedHeaders(init.headers, token)

  return new Promise<Response>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const abortSignal = init.signal
    const abortUpload = () => {
      xhr.abort()
    }

    xhr.open(init.method || "GET", input.toString())
    headers.forEach((value, key) => {
      xhr.setRequestHeader(key, value)
    })

    xhr.upload.addEventListener("progress", (event) => {
      handlers.onUploadProgress?.({
        loaded: event.loaded,
        total: event.lengthComputable ? event.total : null
      })
    })

    xhr.upload.addEventListener("load", () => {
      handlers.onUploadComplete?.()
    })

    xhr.addEventListener("load", () => {
      if (abortSignal) {
        abortSignal.removeEventListener("abort", abortUpload)
      }

      resolve(
        new Response(xhr.responseText, {
          headers: parseResponseHeaders(xhr.getAllResponseHeaders()),
          status: xhr.status,
          statusText: xhr.statusText
        })
      )
    })

    xhr.addEventListener("error", () => {
      if (abortSignal) {
        abortSignal.removeEventListener("abort", abortUpload)
      }

      reject(new Error("Network error while uploading file."))
    })

    xhr.addEventListener("abort", () => {
      if (abortSignal) {
        abortSignal.removeEventListener("abort", abortUpload)
      }

      reject(new Error("Upload was cancelled."))
    })

    if (abortSignal) {
      if (abortSignal.aborted) {
        xhr.abort()
        return
      }

      abortSignal.addEventListener("abort", abortUpload, { once: true })
    }

    xhr.send(init.body)
  })
}
