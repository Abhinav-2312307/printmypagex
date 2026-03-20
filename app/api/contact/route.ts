import { NextResponse } from "next/server"
import { sendAppEmail } from "@/lib/email"
import {
  buildSubmissionFingerprint,
  createSubmissionLimitResponse,
  enforceSubmissionGuards,
  getRequestDeviceKey
} from "@/lib/submission-protection"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

const CONTACT_RECEIVER_EMAIL =
  process.env.CONTACT_RECEIVER_EMAIL || "abhinavrishi32@gmail.com"

const PUBLIC_DEVICE_RULES = [
  {
    name: "public-hourly",
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    blockDurationMs: 60 * 60 * 1000
  }
]

const CONTACT_DEVICE_RULES = [
  {
    name: "contact-burst",
    windowMs: 10 * 60 * 1000,
    maxRequests: 2,
    blockDurationMs: 30 * 60 * 1000,
    duplicateCooldownMs: 5 * 60 * 1000
  },
  {
    name: "contact-daily",
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: 6,
    blockDurationMs: 24 * 60 * 60 * 1000
  }
]

const CONTACT_EMAIL_RULES = [
  {
    name: "contact-email-hourly",
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    blockDurationMs: 2 * 60 * 60 * 1000,
    duplicateCooldownMs: 5 * 60 * 1000
  },
  {
    name: "contact-email-daily",
    windowMs: 24 * 60 * 60 * 1000,
    maxRequests: 5,
    blockDurationMs: 24 * 60 * 60 * 1000
  }
]

function sanitizeText(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim()
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function escapeHtml(input: string) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))

    const name = sanitizeText(body?.name)
    const email = sanitizeText(body?.email).toLowerCase()
    const message = sanitizeText(body?.message)
    const website = sanitizeText(body?.website)

    if (website) {
      return NextResponse.json({
        success: true,
        message: "Message sent successfully."
      })
    }

    if (!name || name.length < 2 || name.length > 80) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid name (2-80 characters)."
        },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid email address."
        },
        { status: 400 }
      )
    }

    if (!message || message.length < 10 || message.length > 2000) {
      return NextResponse.json(
        {
          success: false,
          message: "Message must be between 10 and 2000 characters."
        },
        { status: 400 }
      )
    }

    const deviceKey = getRequestDeviceKey(req)
    const payloadFingerprint = buildSubmissionFingerprint([name, email, message])
    const guard = await enforceSubmissionGuards([
      {
        scope: "public-submission-device",
        identifier: deviceKey,
        rules: PUBLIC_DEVICE_RULES
      },
      {
        scope: "contact-device",
        identifier: deviceKey,
        rules: CONTACT_DEVICE_RULES,
        payloadFingerprint
      },
      {
        scope: "contact-email",
        identifier: buildSubmissionFingerprint([email]),
        rules: CONTACT_EMAIL_RULES,
        payloadFingerprint
      }
    ])

    if (!guard.allowed) {
      if (guard.reason === "duplicate") {
        return NextResponse.json({
          success: true,
          message: "Message sent successfully."
        })
      }

      return createSubmissionLimitResponse(
        "Too many contact messages were sent from this device.",
        guard.retryAfterSeconds
      )
    }

    const submittedAt = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short"
    })

    await sendAppEmail({
      to: CONTACT_RECEIVER_EMAIL,
      subject: `New Contact Message - ${name}`,
      replyTo: email,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Submitted At (IST):</strong> ${escapeHtml(submittedAt)}</p>
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
      `
    })

    await recordActivity({
      actorType: "public",
      action: "contact.submitted",
      entityType: "contact",
      entityId: email,
      level: "info",
      message: `A public contact form was submitted by ${email}`,
      metadata: {
        name,
        email
      }
    })

    return NextResponse.json({
      success: true,
      message: "Message sent successfully."
    })
  } catch (error) {
    console.error("CONTACT_FORM_ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Unable to send message right now. Please try again later."
      },
      { status: 500 }
    )
  }
}
