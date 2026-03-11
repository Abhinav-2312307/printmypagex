import { NextResponse } from "next/server"
import { sendAppEmail } from "@/lib/email"

export const runtime = "nodejs"

const CONTACT_RECEIVER_EMAIL =
  process.env.CONTACT_RECEIVER_EMAIL || "abhinavrishi32@gmail.com"

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
