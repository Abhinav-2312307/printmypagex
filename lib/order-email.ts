import Supplier from "@/models/Supplier"
import User from "@/models/User"
import { sendAppEmail } from "@/lib/email"
import { getTotalPrintablePages, normalizeCopies } from "@/lib/print-pricing"

type EmailPayload = {
  to: string
  subject: string
  html: string
  replyTo?: string
}

type OrderEmailData = {
  _id: string
  userUID: string
  supplierUID?: string | null
  shortId?: string | null
  requestType?: "global" | "specific" | string
  printType?: string
  pages?: number
  copies?: number | null
  verifiedPages?: number | null
  status?: string
  estimatedPrice?: number | null
  finalPrice?: number | null
  spiralBinding?: boolean | null
  razorpayPaymentId?: string | null
  razorpayRefundId?: string | null
  refundRRN?: string | null
  files?: Array<{
    fileOriginalName?: string
    pages?: number
    verifiedPages?: number | null
  }>
}

type UserRecord = {
  firebaseUID: string
  email?: string
  name?: string
  emailNotifications?: boolean
}

type AdminUserMessageInput = {
  firebaseUID: string
  subject: string
  message: string
  adminEmail?: string
}

type AdminPaymentReminderOptions = {
  note?: string
  adminEmail?: string
}

const appName = "PrintMyPage"

function formatMoney(amount: number | null | undefined) {
  if (typeof amount !== "number" || Number.isNaN(amount)) return "N/A"
  return `INR ${amount.toFixed(2)}`
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null
  const email = value.trim()
  if (!email || !email.includes("@")) return null
  return email
}

async function sendEmail(payload: EmailPayload) {
  try {
    console.log("ORDER_EMAIL_DEBUG: Sending email", {
      subject: payload.subject,
      to: payload.to
    })
    await sendAppEmail(payload)
  } catch (error) {
    console.error("EMAIL_SEND_ERROR:", error)
  }
}

async function sendEmailStrict(payload: EmailPayload) {
  console.log("ORDER_EMAIL_DEBUG: Sending email", {
    subject: payload.subject,
    to: payload.to
  })
  await sendAppEmail(payload)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function renderMultilineText(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />")
}

function renderAdminNote(note?: string) {
  const trimmed = String(note || "").trim()
  if (!trimmed) return ""

  return `
    <div style="margin:16px 0;padding:12px 14px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;">
      <p style="margin:0 0 6px 0;font-weight:600;">Admin note</p>
      <p style="margin:0;line-height:1.6;">${renderMultilineText(trimmed)}</p>
    </div>
  `
}

function orderSummaryHtml(order: OrderEmailData) {
  const pagesPerCopy = Number(order.verifiedPages ?? order.pages ?? 0)
  const copies = normalizeCopies(order.copies)
  const hasMultipleFiles = Array.isArray(order.files) && order.files.length > 1

  let filesSection = ""
  if (hasMultipleFiles) {
    const fileItems = order.files!.map((f, i) =>
      `<li>${escapeHtml(f.fileOriginalName || `File ${i + 1}`)}: ${f.verifiedPages ?? f.pages ?? 0} pages</li>`
    ).join("")
    filesSection = `
      <p><strong>Files (${order.files!.length}):</strong></p>
      <ul style="margin:4px 0 8px 16px;padding:0;">${fileItems}</ul>
    `
  }

  return `
    <p><strong>Order ID:</strong> ${String(order._id)}</p>
    <p><strong>Print Type:</strong> ${(order.printType || "bw").toUpperCase()}</p>
    ${filesSection}
    <p><strong>Pages Per Copy:</strong> ${pagesPerCopy || "N/A"}</p>
    <p><strong>Copies:</strong> ${copies}</p>
    <p><strong>Total Print Pages:</strong> ${getTotalPrintablePages(pagesPerCopy, copies)}</p>
    <p><strong>Status:</strong> ${String(order.status || "pending").toUpperCase()}</p>
    <p><strong>Spiral Binding:</strong> ${order.spiralBinding ? "Yes" : "No"}</p>
    <p><strong>Estimated Price:</strong> ${formatMoney(order.estimatedPrice)}</p>
    <p><strong>Final Price:</strong> ${formatMoney(order.finalPrice)}</p>
  `
}

async function getUserEmail(firebaseUID: string) {
  const user = await User.findOne({ firebaseUID }).lean<UserRecord | null>()
  if (!user) {
    console.warn("ORDER_EMAIL_DEBUG: User record not found for UID", firebaseUID)
  }
  if (user && !user.email) {
    console.warn("ORDER_EMAIL_DEBUG: User has no email", firebaseUID)
  }
  return {
    email: normalizeEmail(user?.email),
    name: user?.name || "User",
    emailNotifications: user?.emailNotifications ?? true
  }
}

async function getSupplierProfiles(firebaseUIDs: string[]) {
  if (!firebaseUIDs.length) return []

  const users = await User.find<UserRecord>({
    firebaseUID: { $in: firebaseUIDs }
  }).lean<UserRecord[]>()

  return users
    .map((u) => ({
      firebaseUID: String(u.firebaseUID),
      email: normalizeEmail(u.email),
      name: u.name || "Supplier",
      emailNotifications: u.emailNotifications ?? true
    }))
    .filter((u) => u.email)
}

export async function sendOrderCreatedNotifications(order: OrderEmailData) {
  console.log("ORDER_EMAIL_DEBUG: Event=order_created", {
    orderId: String(order._id),
    requestType: order.requestType,
    supplierUID: order.supplierUID || null
  })

  const userProfile = await getUserEmail(String(order.userUID))

  if (userProfile.email && userProfile.emailNotifications !== false) {
    await sendEmail({
      to: userProfile.email,
      subject: `${appName}: Order Confirmed`,
      html: `
        <h2>Your order is confirmed</h2>
        <p>Hi ${userProfile.name}, your order has been successfully placed.</p>
        ${orderSummaryHtml(order)}
      `
    })
  }

  if (order.requestType === "specific" && order.supplierUID) {
    const supplierProfile = await getUserEmail(String(order.supplierUID))
    if (!supplierProfile.email) {
      console.warn("ORDER_EMAIL_DEBUG: Specific supplier email missing", String(order.supplierUID))
    }
    if (supplierProfile.email && supplierProfile.emailNotifications !== false) {
      await sendEmail({
        to: supplierProfile.email,
        subject: `${appName}: New Order Assigned`,
        html: `
          <h2>You received a new order</h2>
          <p>Hi ${supplierProfile.name}, a user selected you for a new print order.</p>
          ${orderSummaryHtml(order)}
        `
      })
    }
    return
  }

  if (order.requestType === "global") {
    const activeSuppliers = await Supplier.find<{
      firebaseUID: string
      email?: string
      name?: string
      emailNotifications?: boolean
    }>({
      approved: true,
      active: true
    }).lean<{ firebaseUID: string; email?: string; name?: string; emailNotifications?: boolean }[]>()

    const suppliersWithDirectEmail = activeSuppliers
      .map((s) => ({
        firebaseUID: String(s.firebaseUID || ""),
        email: normalizeEmail(s.email),
        name: s.name || "Supplier",
        emailNotifications: s.emailNotifications ?? true
      }))
      .filter((s) => s.firebaseUID && s.email)

    const uniqueSupplierUIDs = Array.from(
      new Set(
        activeSuppliers
          .map((supplier) => String(supplier.firebaseUID || ""))
          .filter(Boolean)
      )
    )

    const profilesFromUsers = await getSupplierProfiles(uniqueSupplierUIDs)
    const profileMap = new Map<string, { firebaseUID: string; email: string; name: string; emailNotifications: boolean }>()

    suppliersWithDirectEmail.forEach((p) => {
      profileMap.set(p.firebaseUID, {
        firebaseUID: p.firebaseUID,
        email: p.email!,
        name: p.name,
        emailNotifications: p.emailNotifications
      })
    })

    profilesFromUsers.forEach((p) => {
      profileMap.set(String(p.firebaseUID), {
        firebaseUID: String(p.firebaseUID),
        email: p.email!,
        name: p.name || "Supplier",
        emailNotifications: p.emailNotifications
      })
    })

    const profiles = Array.from(profileMap.values())
    console.log("ORDER_EMAIL_DEBUG: Global supplier targets", {
      totalActiveSuppliers: uniqueSupplierUIDs.length,
      suppliersWithEmail: profiles.length
    })

    await Promise.allSettled(
      profiles
        .filter((profile) => profile.emailNotifications !== false)
        .map((profile) =>
          sendEmail({
            to: profile.email!,
            subject: `${appName}: Global Launch Order - Accept Fast`,
            html: `
              <h2>Global launch order is live</h2>
              <p>Hi ${profile.name}, a global order has been launched. Accept fast to claim it.</p>
              ${orderSummaryHtml(order)}
            `
          })
        )
    )
  }
}

export async function sendOrderAcceptedNotification(order: OrderEmailData) {
  // Merged into sendAwaitingPaymentNotification to prevent sending duplicate emails to the user
  return sendAwaitingPaymentNotification(order)
}

export async function sendAwaitingPaymentNotification(order: OrderEmailData) {
  console.log("ORDER_EMAIL_DEBUG: Event=order_accepted_and_awaiting_payment", {
    orderId: String(order._id),
    userUID: order.userUID
  })
  const userProfile = await getUserEmail(String(order.userUID))
  if (!userProfile.email || userProfile.emailNotifications === false) {
    return
  }

  const orderRef = order.shortId || String(order._id).slice(-8)
  const payableStr = formatMoney(order.finalPrice ?? order.estimatedPrice)

  await sendEmail({
    to: userProfile.email,
    subject: `${appName}: Order Accepted & Payment Required - Ref #${orderRef}`,
    html: `
      <h2>Order Accepted & Payment Ready</h2>
      <p>Hi ${escapeHtml(userProfile.name || "User")},</p>
      <p>Great news! Your order (Ref: <strong>#${orderRef}</strong>) has been accepted by the supplier and verified.</p>
      <p><strong>Amount Payable:</strong> <span style="font-size: 18px; font-weight: bold; color: #16a34a;">${payableStr}</span></p>
      <p>Please log in to your account and click <strong>Pay Now</strong> so the supplier can start printing your document.</p>
      ${orderSummaryHtml(order)}
    `
  })
}

export async function sendOrderStatusNotification(order: OrderEmailData, status: string) {
  // Skip duplicate email for 'printing' because sendPaymentReceivedNotifications already notifies user that payment succeeded and printing started
  if (status === "printing" || status === "awaiting_payment" || status === "accepted") {
    return
  }

  console.log("ORDER_EMAIL_DEBUG: Event=status_update", {
    orderId: String(order._id),
    status
  })
  const userProfile = await getUserEmail(String(order.userUID))
  if (!userProfile.email || userProfile.emailNotifications === false) {
    return
  }

  const orderRef = order.shortId || String(order._id).slice(-8)
  let statusTitle = `Order Status Updated To ${status.toUpperCase()}`
  let statusMsg = `Your order status is now <strong>${status.toUpperCase()}</strong>.`

  if (status === "printed") {
    statusTitle = "Your Order Has Been Printed!"
    statusMsg = `Your document printing is complete and ready for pickup / delivery.`
  } else if (status === "delivered") {
    statusTitle = "Your Order Has Been Delivered!"
    statusMsg = `Your order has been marked as delivered. Thank you for using ${appName}!`
  }

  await sendEmail({
    to: userProfile.email,
    subject: `${appName}: ${statusTitle} - Ref #${orderRef}`,
    html: `
      <h2>${statusTitle}</h2>
      <p>Hi ${escapeHtml(userProfile.name || "User")}, ${statusMsg}</p>
      ${orderSummaryHtml(order)}
    `
  })
}

export async function sendOrderCancelledNotification(
  order: OrderEmailData,
  cancelledBy: "user" | "supplier" | "admin" | "system"
) {
  console.log("ORDER_EMAIL_DEBUG: Event=order_cancelled", {
    orderId: String(order._id),
    cancelledBy
  })
  const orderRef = order.shortId || String(order._id).slice(-8)
  const userProfile = await getUserEmail(String(order.userUID))
  if (userProfile.email && userProfile.emailNotifications !== false) {
    await sendEmail({
      to: userProfile.email,
      subject: `${appName}: Order Cancelled - Ref #${orderRef}`,
      html: `
        <h2>Your order has been cancelled</h2>
        <p>Hi ${escapeHtml(userProfile.name || "User")}, order <strong>#${orderRef}</strong> was cancelled by ${cancelledBy.toUpperCase()}.</p>
        ${orderSummaryHtml(order)}
      `
    })
  }

  if (order.supplierUID) {
    const supplierProfile = await getUserEmail(String(order.supplierUID))
    if (supplierProfile.email && supplierProfile.emailNotifications !== false) {
      await sendEmail({
        to: supplierProfile.email,
        subject: `${appName}: Order Cancelled - Ref #${orderRef}`,
        html: `
          <h2>Order Cancelled Notice</h2>
          <p>Hi ${escapeHtml(supplierProfile.name || "Supplier")}, order <strong>#${orderRef}</strong> was cancelled by ${cancelledBy.toUpperCase()}.</p>
          ${orderSummaryHtml(order)}
        `
      })
    }
  }
}

export async function sendPaymentReceivedNotifications(order: OrderEmailData) {
  console.log("ORDER_EMAIL_DEBUG: Event=payment_received", {
    orderId: String(order._id)
  })
  const orderRef = order.shortId || String(order._id).slice(-8)
  const userProfile = await getUserEmail(String(order.userUID))
  if (userProfile.email && userProfile.emailNotifications !== false) {
    const amountStr = formatMoney(order.finalPrice ?? order.estimatedPrice)
    const paymentId = order.razorpayPaymentId || "N/A"

    await sendEmail({
      to: userProfile.email,
      subject: `${appName}: Payment Confirmed & Printing Started - Ref #${orderRef}`,
      html: `
        <h2>Payment Successful - Printing Started!</h2>
        <p>Hi ${escapeHtml(userProfile.name || "User")},</p>
        <p>We received your payment of <strong>${amountStr}</strong> (Payment ID: <code style="font-family: monospace;">${escapeHtml(paymentId)}</code>).</p>
        <p>Your order (Ref: <strong>#${orderRef}</strong>) has automatically moved to <strong>PRINTING</strong> status. Your supplier is now printing your document!</p>
        ${orderSummaryHtml(order)}
      `
    })
  }

  if (order.supplierUID) {
    const supplierProfile = await getUserEmail(String(order.supplierUID))
    if (supplierProfile.email && supplierProfile.emailNotifications !== false) {
      await sendEmail({
        to: supplierProfile.email,
        subject: `${appName}: Payment Confirmed for Order - Ref #${orderRef}`,
        html: `
          <h2>User Payment Confirmed</h2>
          <p>Hi ${escapeHtml(supplierProfile.name || "Supplier")}, payment for order <strong>#${orderRef}</strong> has been received. Please proceed with printing!</p>
          ${orderSummaryHtml(order)}
        `
      })
    }
  }
}

export async function sendAdminMessageToUser(input: AdminUserMessageInput) {
  const userProfile = await getUserEmail(String(input.firebaseUID))
  if (!userProfile.email) {
    throw new Error("Selected user does not have a valid email address")
  }

  const normalizedSubject = String(input.subject || "").replace(/\s+/g, " ").trim()
  const normalizedMessage = String(input.message || "").trim()

  if (!normalizedSubject) {
    throw new Error("Email subject is required")
  }

  if (!normalizedMessage) {
    throw new Error("Email message is required")
  }

  await sendEmailStrict({
    to: userProfile.email,
    subject: normalizedSubject,
    replyTo: input.adminEmail || undefined,
    html: `
      <h2>Message from ${appName} admin</h2>
      <p>Hi ${escapeHtml(userProfile.name || "User")},</p>
      <p style="line-height:1.7;">${renderMultilineText(normalizedMessage)}</p>
      <p>If you need help, you can reply to this email.</p>
      ${input.adminEmail ? `<p><strong>Sent by:</strong> ${escapeHtml(input.adminEmail)}</p>` : ""}
    `
  })
}

export async function sendAdminPaymentReminderNotification(
  order: OrderEmailData,
  options: AdminPaymentReminderOptions = {}
) {
  console.log("ORDER_EMAIL_DEBUG: Event=admin_payment_reminder", {
    orderId: String(order._id),
    userUID: order.userUID
  })

  const userProfile = await getUserEmail(String(order.userUID))
  if (!userProfile.email) {
    throw new Error("Selected order user does not have a valid email address")
  }

  await sendEmailStrict({
    to: userProfile.email,
    subject: `${appName}: Payment Reminder For Your Order`,
    replyTo: options.adminEmail || undefined,
    html: `
      <h2>Payment reminder</h2>
      <p>Hi ${escapeHtml(userProfile.name || "User")}, this is a reminder that your payment is still pending for the order below.</p>
      <p><strong>Amount payable:</strong> ${formatMoney(order.finalPrice ?? order.estimatedPrice)}</p>
      <p>Please complete the payment from your orders page so printing can begin without further delay.</p>
      ${renderAdminNote(options.note)}
      ${orderSummaryHtml(order)}
    `
  })
}

export async function sendOrderRefundNotification(order: OrderEmailData, refundAmount?: number) {
  console.log("ORDER_EMAIL_DEBUG: Event=order_refund", {
    orderId: String(order._id),
    userUID: order.userUID
  })

  const userProfile = await getUserEmail(String(order.userUID))
  if (userProfile.email && userProfile.emailNotifications !== false) {
    const amountStr = formatMoney(refundAmount ?? order.finalPrice ?? order.estimatedPrice)
    const refundId = order.razorpayRefundId || "Processing"
    const paymentId = order.razorpayPaymentId || "N/A"
    const rrn = order.refundRRN || null
    const orderRef = order.shortId || String(order._id).slice(-8)

    await sendEmail({
      to: userProfile.email,
      subject: `${appName}: Refund Initiated - Ref #${orderRef}`,
      html: `
        <h2>Refund Initiated</h2>
        <p>Hi ${escapeHtml(userProfile.name || "User")},</p>
        <p>A full refund of <strong>${amountStr}</strong> has been initiated for your order (Ref: <strong>#${orderRef}</strong>).</p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; p-4; padding: 16px; margin: 16px 0;">
          <h3 style="margin-top: 0; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">Bank & Payment Reference Details</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Razorpay Refund ID:</td>
              <td style="padding: 4px 0; font-weight: 600; font-family: monospace; color: #0f172a;">${escapeHtml(refundId)}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Original Payment ID:</td>
              <td style="padding: 4px 0; font-weight: 600; font-family: monospace; color: #0f172a;">${escapeHtml(paymentId)}</td>
            </tr>
            ${rrn ? `
            <tr>
              <td style="padding: 4px 0; color: #64748b;">Bank UTR / RRN:</td>
              <td style="padding: 4px 0; font-weight: 600; font-family: monospace; color: #0f172a;">${escapeHtml(rrn)}</td>
            </tr>
            ` : ""}
          </table>
        </div>

        <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; margin-bottom: 16px; border-radius: 4px; font-size: 13px; color: #1e40af;">
          <strong>How to trace with your bank if needed:</strong><br />
          Most refunds reflect in your bank account / card within <strong>5 to 7 business days</strong>.<br />
          If the refund does not reflect after 7 business days, you can contact your bank's customer support and provide the <strong>Razorpay Refund ID (${escapeHtml(refundId)})</strong> or <strong>Payment ID (${escapeHtml(paymentId)})</strong>. Your bank will use this official reference number to locate and expedite your refund.
        </div>

        ${orderSummaryHtml(order)}
      `
    })
  }
}

