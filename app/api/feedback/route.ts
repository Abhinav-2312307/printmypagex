import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import {
  computeOverallFeedbackRating,
  parseFeedbackRatings
} from "@/lib/feedback"
import Feedback from "@/models/Feedback"
import {
  buildSubmissionFingerprint,
  createSubmissionLimitResponse,
  enforceSubmissionGuards,
  getRequestDeviceKey
} from "@/lib/submission-protection"
import { recordActivity } from "@/lib/activity-log"

export const runtime = "nodejs"

const PUBLIC_DEVICE_RULES = [
  {
    name: "public-hourly",
    windowMs: 60 * 60 * 1000,
    maxRequests: 5,
    blockDurationMs: 60 * 60 * 1000
  }
]

const FEEDBACK_DEVICE_RULES = [
  {
    name: "feedback-halfday",
    windowMs: 12 * 60 * 60 * 1000,
    maxRequests: 2,
    blockDurationMs: 12 * 60 * 60 * 1000,
    duplicateCooldownMs: 10 * 60 * 1000
  },
  {
    name: "feedback-weekly",
    windowMs: 7 * 24 * 60 * 60 * 1000,
    maxRequests: 5,
    blockDurationMs: 7 * 24 * 60 * 60 * 1000
  }
]

function sanitizeText(value: unknown) {
  if (typeof value !== "string") return ""
  return value.trim()
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const payload =
      body && typeof body === "object" ? (body as Record<string, unknown>) : {}

    const ratings = parseFeedbackRatings(payload)
    const message = sanitizeText(payload.message)
    const website = sanitizeText(payload.website)

    if (website) {
      return NextResponse.json({
        success: true,
        message: "Thanks for sharing your feedback."
      })
    }

    if (!ratings) {
      return NextResponse.json(
        {
          success: false,
          message: "Please give a star rating for every feedback category."
        },
        { status: 400 }
      )
    }

    if (!message || message.length < 10 || message.length > 1500) {
      return NextResponse.json(
        {
          success: false,
          message: "Feedback message must be between 10 and 1500 characters."
        },
        { status: 400 }
      )
    }

    const deviceKey = getRequestDeviceKey(req)
    const payloadFingerprint = buildSubmissionFingerprint([
      message,
      ...Object.values(ratings)
    ])
    const guard = await enforceSubmissionGuards([
      {
        scope: "public-submission-device",
        identifier: deviceKey,
        rules: PUBLIC_DEVICE_RULES
      },
      {
        scope: "feedback-device",
        identifier: deviceKey,
        rules: FEEDBACK_DEVICE_RULES,
        payloadFingerprint
      }
    ])

    if (!guard.allowed) {
      if (guard.reason === "duplicate") {
        return NextResponse.json({
          success: true,
          message: "Thanks for sharing your feedback."
        })
      }

      return createSubmissionLimitResponse(
        "Too many feedback responses were sent from this device.",
        guard.retryAfterSeconds
      )
    }

    await connectDB()

    const feedback = await Feedback.create({
      ...ratings,
      overallRating: computeOverallFeedbackRating(ratings),
      message
    })

    await recordActivity({
      actorType: "public",
      action: "feedback.submitted",
      entityType: "feedback",
      entityId: String(feedback._id),
      level: "success",
      message: "A public feedback response was submitted",
      metadata: {
        feedbackId: String(feedback._id),
        overallRating: Number(feedback.overallRating || 0)
      }
    })

    return NextResponse.json({
      success: true,
      message: "Thanks for sharing your feedback.",
      feedbackId: String(feedback._id)
    })
  } catch (error) {
    console.error("PUBLIC_FEEDBACK_SUBMIT_ERROR:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Unable to save feedback right now. Please try again later."
      },
      { status: 500 }
    )
  }
}
