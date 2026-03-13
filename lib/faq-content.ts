export type FAQAudience = "user" | "supplier"

export type FAQItem = {
  id: string
  question: string
  answer: string
  badge?: string
}

export type FAQContentSnapshot = {
  userFaqs: FAQItem[]
  supplierFaqs: FAQItem[]
  updatedAt: string | null
}

const defaultUserFaqs: FAQItem[] = [
  {
    id: "user-admin-approval",
    question: "Do users need admin approval before placing an order?",
    answer:
      "No. Users can log in and place an order directly from the dashboard. Admin approval is only required for supplier onboarding, not for normal student orders.",
    badge: "Important"
  },
  {
    id: "user-two-order-modes",
    question: "How can I place an order?",
    answer:
      "You have two options. Use Global Launch to send the request to all active suppliers, or choose a specific supplier when you already know who you want to print with.",
    badge: "Ordering"
  },
  {
    id: "user-page-count-fix",
    question: "What if I entered the wrong page count?",
    answer:
      "The supplier can verify and correct the page count before payment. This is especially useful for document files where the page count may be entered manually by mistake.",
    badge: "Verification"
  },
  {
    id: "user-payment-after-accept",
    question: "Why do I pay only after a supplier accepts the order?",
    answer:
      "That step keeps pricing fair. The supplier first confirms availability and can correct the page count if needed, so you pay the verified amount instead of an incorrect estimate.",
    badge: "Payments"
  },
  {
    id: "user-lengthy-process",
    question: "Why does the process feel a little lengthy?",
    answer:
      "Each step exists to avoid hidden surprises. Acceptance confirms the printer is ready, verification prevents page-count mistakes, payment locks the final amount, and only then printing starts. It is designed for transparency, not unnecessary delay.",
    badge: "Process"
  },
  {
    id: "user-performance",
    question: "Why is there sometimes a little lag while scrolling or loading?",
    answer:
      "Some parts of the platform currently run on a free hosting stack, so heavy traffic, large files, or real-time updates can occasionally feel slower. We are already optimizing this and expect the experience to improve over time.",
    badge: "Feedback based"
  },
  {
    id: "user-collection-timing",
    question: "When should I place the order?",
    answer:
      "Place the order at least one day before you need the printout. The standard flow is: order today, payment after acceptance, printing starts after payment, and collection happens on campus the next day.",
    badge: "Timeline"
  },
  {
    id: "user-contact-supplier",
    question: "Can I contact the supplier directly?",
    answer:
      "Yes. You can view the supplier profile and contact details from the portal, so urgent coordination, pickup questions, or clarification can happen directly without hidden intermediaries.",
    badge: "Transparency"
  },
  {
    id: "user-receipt",
    question: "Will I get a payment receipt?",
    answer:
      "Yes. After a successful payment, you can download the receipt directly from the portal for your own record.",
    badge: "Receipt"
  },
  {
    id: "user-admin-help",
    question: "What if I still need help or something feels wrong?",
    answer:
      "The portal is supervised by the admin team. If you need help, want to report a bug, or need clarification, you can reach out from the Contact page.",
    badge: "Support"
  }
]

const defaultSupplierFaqs: FAQItem[] = [
  {
    id: "supplier-who-can-register",
    question: "Who can register as a supplier?",
    answer:
      "Any campus member who has access to a printer and wants to handle print orders can apply to the supplier portal.",
    badge: "Onboarding"
  },
  {
    id: "supplier-approval",
    question: "Why do suppliers need admin approval?",
    answer:
      "Supplier approval protects users and keeps the marketplace reliable. Admin review helps verify that the supplier is genuine before live orders are routed to that account.",
    badge: "Important"
  },
  {
    id: "supplier-after-approval",
    question: "What happens after I get approved?",
    answer:
      "Once approved, you can access the supplier portal, review incoming orders, and accept or reject requests based on your availability.",
    badge: "Access"
  },
  {
    id: "supplier-user-admin-misunderstanding",
    question: "Do user orders wait for admin approval before I can handle them?",
    answer:
      "No. Student orders do not wait for admin approval. After a user places an order, suppliers can directly accept or reject it. Admin approval only applies to supplier registration.",
    badge: "Clarification"
  },
  {
    id: "supplier-page-verification",
    question: "Why do I need to verify the page count?",
    answer:
      "For some document uploads, page count may be entered manually by the user and can be wrong. Verification lets you correct the count before payment so pricing stays accurate for both sides.",
    badge: "Verification"
  },
  {
    id: "supplier-payment-wait",
    question: "Why should printing start only after payment?",
    answer:
      "Printing after confirmed payment protects your time, paper, and toner. The accepted order becomes financially clear before production starts.",
    badge: "Payments"
  },
  {
    id: "supplier-wallet-payout",
    question: "How do supplier wallet and payouts work?",
    answer:
      "When a paid order is delivered, its earnings contribute to your supplier wallet balance. You can request a payout for any amount within the available balance, and the admin team reviews the request, coordinates if needed, and approves the payout.",
    badge: "Wallet"
  },
  {
    id: "supplier-lengthy-process",
    question: "Why does the supplier process have several steps?",
    answer:
      "The sequence is intentional. Approval establishes trust, acceptance confirms readiness, verification fixes pricing mistakes, payment secures the order, and printing starts only when the workflow is fully confirmed.",
    badge: "Process"
  },
  {
    id: "supplier-performance",
    question: "Why can the portal feel slow sometimes?",
    answer:
      "The platform is still being optimized and some infrastructure currently runs on a free tier. Real-time updates, document handling, and shared resources can occasionally affect speed, and we are improving this gradually.",
    badge: "Feedback based"
  },
  {
    id: "supplier-contact-user",
    question: "Can I contact the user directly?",
    answer:
      "Yes. Suppliers can access the user's profile details and contact them directly for urgency, pickup coordination, or clarification.",
    badge: "Transparency"
  },
  {
    id: "supplier-admin-supervision",
    question: "Who handles disputes or supervision?",
    answer:
      "The full workflow remains transparent and under admin supervision. If anything feels unclear, the admin team can be contacted and can review the order trail.",
    badge: "Support"
  }
]

function fallbackId(prefix: string, index: number) {
  return `${prefix}-${index + 1}`
}

export function sanitizeFaqItem(item: Partial<FAQItem> | null | undefined, audience: FAQAudience, index: number): FAQItem | null {
  const question = String(item?.question || "").trim()
  const answer = String(item?.answer || "").trim()

  if (!question || !answer) {
    return null
  }

  const badge = String(item?.badge || "").trim()

  return {
    id: String(item?.id || "").trim() || fallbackId(audience, index),
    question,
    answer,
    ...(badge ? { badge } : {})
  }
}

function sanitizeFaqList(items: Array<Partial<FAQItem>> | null | undefined, audience: FAQAudience, fallback: FAQItem[]) {
  const sanitized = (items || [])
    .map((item, index) => sanitizeFaqItem(item, audience, index))
    .filter((item): item is FAQItem => Boolean(item))

  return sanitized.length ? sanitized : fallback
}

export function sanitizeFaqContentSnapshot(
  value?: Partial<FAQContentSnapshot> | null
): FAQContentSnapshot {
  return {
    userFaqs: sanitizeFaqList(value?.userFaqs, "user", defaultUserFaqs),
    supplierFaqs: sanitizeFaqList(value?.supplierFaqs, "supplier", defaultSupplierFaqs),
    updatedAt: value?.updatedAt ? String(value.updatedAt) : null
  }
}

export const defaultFaqContentSnapshot: FAQContentSnapshot = sanitizeFaqContentSnapshot({
  userFaqs: defaultUserFaqs,
  supplierFaqs: defaultSupplierFaqs,
  updatedAt: null
})
