import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import SubmissionRateLimit from "@/models/SubmissionRateLimit"

type SubmissionLimitRule = {
  name: string
  windowMs: number
  maxRequests: number
  blockDurationMs?: number
  duplicateCooldownMs?: number
}

type SubmissionLimitCheck = {
  scope: string
  identifier: string
  rules: SubmissionLimitRule[]
  payloadFingerprint?: string
}

type SubmissionGuardResult =
  | {
      allowed: true
    }
  | {
      allowed: false
      reason: "rate_limit" | "duplicate"
      retryAfterSeconds: number
    }

type SubmissionRateLimitRecord = {
  windowStartedAt?: Date | string | null
  windowHits?: number | null
  totalHits?: number | null
  blockedUntil?: Date | string | null
  lastPayloadHash?: string | null
  lastPayloadAt?: Date | string | null
}

const IP_HEADER_NAMES = [
  "cf-connecting-ip",
  "x-forwarded-for",
  "x-real-ip",
  "x-vercel-forwarded-for",
  "true-client-ip",
  "fastly-client-ip"
]

function normalizeTextFragment(value: unknown) {
  if (typeof value !== "string") {
    return String(value ?? "")
  }

  return value.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 500)
}

function normalizeIpAddress(value: string) {
  const trimmed = value.trim()

  if (!trimmed) return "unknown"
  if (trimmed === "::1") return "127.0.0.1"
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7)

  return trimmed.slice(0, 120)
}

function normalizeUserAgent(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ")
  return normalized ? normalized.slice(0, 300) : "unknown"
}

function hashValue(value: string) {
  return crypto
    .createHash("sha256")
    .update(value)
    .digest("hex")
}

function toDate(value: Date | string | null | undefined) {
  if (!value) return null

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function computeRetentionMs(rule: SubmissionLimitRule) {
  const longestWindow = Math.max(
    rule.windowMs,
    rule.blockDurationMs ?? 0,
    rule.duplicateCooldownMs ?? 0
  )

  return Math.max(longestWindow * 4, 30 * 24 * 60 * 60 * 1000)
}

function buildRuleScope(scope: string, rule: SubmissionLimitRule) {
  return `${scope}:${rule.name}`
}

async function consumeRateLimitBucket(
  scope: string,
  identifier: string,
  rule: SubmissionLimitRule,
  payloadFingerprint?: string
): Promise<SubmissionGuardResult> {
  const now = new Date()
  const nowMs = now.getTime()
  const ruleScope = buildRuleScope(scope, rule)
  const identifierHash = hashValue(`${ruleScope}:${identifier}`)
  const payloadHash = payloadFingerprint ? hashValue(payloadFingerprint) : ""

  const bucket = await SubmissionRateLimit.findOne({
    scope: ruleScope,
    identifierHash
  }).lean<SubmissionRateLimitRecord | null>()

  const blockedUntil = toDate(bucket?.blockedUntil)

  if (blockedUntil && blockedUntil.getTime() > nowMs) {
    return {
      allowed: false,
      reason: "rate_limit",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((blockedUntil.getTime() - nowMs) / 1000)
      )
    }
  }

  const lastPayloadAt = toDate(bucket?.lastPayloadAt)
  const lastPayloadHash = String(bucket?.lastPayloadHash || "")

  if (
    payloadHash &&
    rule.duplicateCooldownMs &&
    lastPayloadHash &&
    lastPayloadHash === payloadHash &&
    lastPayloadAt &&
    nowMs - lastPayloadAt.getTime() < rule.duplicateCooldownMs
  ) {
    const duplicateBlockedUntil = new Date(
      lastPayloadAt.getTime() + rule.duplicateCooldownMs
    )

    await SubmissionRateLimit.findOneAndUpdate(
      {
        scope: ruleScope,
        identifierHash
      },
      {
        $set: {
          blockedUntil: duplicateBlockedUntil,
          lastRequestAt: now,
          expiresAt: new Date(nowMs + computeRetentionMs(rule))
        },
        $inc: {
          totalHits: 1
        }
      },
      {
        upsert: true,
        setDefaultsOnInsert: true
      }
    )

    return {
      allowed: false,
      reason: "duplicate",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((duplicateBlockedUntil.getTime() - nowMs) / 1000)
      )
    }
  }

  let windowStartedAt = toDate(bucket?.windowStartedAt) || now
  let windowHits = Number(bucket?.windowHits || 0)

  if (nowMs - windowStartedAt.getTime() >= rule.windowMs) {
    windowStartedAt = now
    windowHits = 0
  }

  windowHits += 1

  const blockedForThisRequest =
    windowHits > rule.maxRequests
      ? new Date(nowMs + (rule.blockDurationMs ?? rule.windowMs))
      : null

  await SubmissionRateLimit.findOneAndUpdate(
    {
      scope: ruleScope,
      identifierHash
    },
    {
      $set: {
        windowStartedAt,
        windowHits,
        blockedUntil: blockedForThisRequest,
        lastPayloadHash: payloadHash || lastPayloadHash,
        lastPayloadAt: payloadHash ? now : lastPayloadAt,
        lastRequestAt: now,
        expiresAt: new Date(nowMs + computeRetentionMs(rule))
      },
      $inc: {
        totalHits: 1
      }
    },
    {
      upsert: true,
      setDefaultsOnInsert: true
    }
  )

  if (blockedForThisRequest) {
    return {
      allowed: false,
      reason: "rate_limit",
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((blockedForThisRequest.getTime() - nowMs) / 1000)
      )
    }
  }

  return {
    allowed: true
  }
}

export function buildSubmissionFingerprint(parts: unknown[]) {
  return parts.map((part) => normalizeTextFragment(part)).join("|")
}

export function getRequestDeviceKey(req: Request) {
  let ipAddress = "unknown"

  for (const headerName of IP_HEADER_NAMES) {
    const headerValue = req.headers.get(headerName)
    if (!headerValue) continue

    const firstValue = headerValue
      .split(",")
      .map((value) => value.trim())
      .find(Boolean)

    if (firstValue) {
      ipAddress = normalizeIpAddress(firstValue)
      break
    }
  }

  const userAgent = normalizeUserAgent(req.headers.get("user-agent") || "")

  return buildSubmissionFingerprint([
    "device",
    ipAddress,
    userAgent
  ])
}

export async function enforceSubmissionGuards(
  checks: SubmissionLimitCheck[]
): Promise<SubmissionGuardResult> {
  const activeChecks = checks.filter((check) => check.identifier.trim())

  if (activeChecks.length === 0) {
    return { allowed: true }
  }

  await connectDB()

  for (const check of activeChecks) {
    for (const rule of check.rules) {
      const result = await consumeRateLimitBucket(
        check.scope,
        check.identifier,
        rule,
        check.payloadFingerprint
      )

      if (!result.allowed) {
        return result
      }
    }
  }

  return { allowed: true }
}

function formatRetryAfter(retryAfterSeconds: number) {
  if (retryAfterSeconds < 60) {
    return `${retryAfterSeconds} second${retryAfterSeconds === 1 ? "" : "s"}`
  }

  const totalMinutes = Math.ceil(retryAfterSeconds / 60)

  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`
  }

  const totalHours = Math.ceil(totalMinutes / 60)
  return `${totalHours} hour${totalHours === 1 ? "" : "s"}`
}

export function createSubmissionLimitResponse(
  message: string,
  retryAfterSeconds: number
) {
  const fullMessage = `${message} Please wait ${formatRetryAfter(retryAfterSeconds)} and try again.`

  return NextResponse.json(
    {
      success: false,
      message: fullMessage,
      error: fullMessage,
      retryAfterSeconds
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds)
      }
    }
  )
}
