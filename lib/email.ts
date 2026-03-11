import nodemailer from "nodemailer"

type SendAppEmailInput = {
  to: string
  subject: string
  html: string
  replyTo?: string
}

let cachedTransporter: nodemailer.Transporter | null = null

function extractEmail(raw: string | undefined) {
  if (!raw) return ""
  const match = raw.match(/<([^>]+)>/)
  if (match?.[1]) return match[1].trim()
  return raw.trim()
}

function getFromAddress() {
  return process.env.EMAIL_FROM || process.env.GMAIL_USER || process.env.SMTP_USER || ""
}

function maskEmail(email: string) {
  const parts = email.split("@")
  if (parts.length !== 2) return "***"
  const name = parts[0]
  const domain = parts[1]
  const visible = name.slice(0, 2)
  return `${visible}${"*".repeat(Math.max(name.length - 2, 1))}@${domain}`
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter

  const smtpHost = process.env.SMTP_HOST
  const smtpPort = Number(process.env.SMTP_PORT || 0)
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS

  if (smtpHost && smtpPort && smtpUser && smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    })
    return cachedTransporter
  }

  const gmailUser =
    process.env.GMAIL_USER ||
    extractEmail(process.env.EMAIL_FROM) ||
    ""
  const gmailAppPassword =
    process.env.GMAIL_APP_PASSWORD ||
    process.env.GMAIL_APP_PASS ||
    process.env.GMAIL_PASSWORD ||
    ""

  if (gmailUser && gmailAppPassword) {
    cachedTransporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailAppPassword
      }
    })
    return cachedTransporter
  }

  return null
}

export async function sendAppEmail(input: SendAppEmailInput) {
  const from = getFromAddress()
  const maskedTo = maskEmail(input.to)
  const maskedFrom = from ? maskEmail(extractEmail(from)) : ""

  console.log("EMAIL_DEBUG: Attempting send", {
    to: maskedTo,
    subject: input.subject,
    hasFrom: Boolean(from),
    hasGmailUser: Boolean(process.env.GMAIL_USER || extractEmail(process.env.EMAIL_FROM)),
    hasGmailAppPassword: Boolean(
      process.env.GMAIL_APP_PASSWORD ||
        process.env.GMAIL_APP_PASS ||
        process.env.GMAIL_PASSWORD
    )
  })

  if (!from) {
    throw new Error("EMAIL_NOT_CONFIGURED: Missing sender address")
  }

  const transporter = getTransporter()
  if (!transporter) {
    throw new Error(
      "GMAIL SMTP NOT CONFIGURED: Set GMAIL_USER and GMAIL_APP_PASSWORD (or GMAIL_APP_PASS)."
    )
  }

  try {
    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo || process.env.EMAIL_REPLY_TO || undefined
    })
    console.log("EMAIL_DEBUG: SMTP send success", {
      to: maskedTo,
      from: maskedFrom
    })
  } catch (smtpError) {
    console.error("EMAIL_DEBUG: SMTP send failed", smtpError)
    throw smtpError
  }
}
