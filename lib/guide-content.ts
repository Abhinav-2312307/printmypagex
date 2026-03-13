export type GuideBranchOption = {
  badge: string
  title: string
  description: string
}

export type GuideStep = {
  id: string
  eyebrow: string
  title: string
  description: string
  note?: string
  branches?: GuideBranchOption[]
}

export type GuideHighlight = {
  badge: string
  title: string
  description: string
}

export type GuidePageContent = {
  audience: "user" | "supplier"
  title: string
  subtitle: string
  description: string
  heroBadges: string[]
  primaryCta: {
    label: string
    href: string
  }
  secondaryCta: {
    label: string
    href: string
  }
  trustStrip: string
  highlights: GuideHighlight[]
  steps: GuideStep[]
  closingTitle: string
  closingText: string
}

export const userGuideContent: GuidePageContent = {
  audience: "user",
  title: "Student FAQ & Flow Guide",
  subtitle: "Understand every step before you place the order.",
  description:
    "This page explains the exact student journey from login to next-day pickup. It also answers the most common questions raised in real feedback so the workflow stays transparent.",
  heroBadges: [
    "Admin-curated FAQ",
    "Two order modes",
    "Page-count verification",
    "Direct supplier contact"
  ],
  primaryCta: {
    label: "Create Order",
    href: "/user/dashboard"
  },
  secondaryCta: {
    label: "Contact Admin",
    href: "/contact"
  },
  trustStrip:
    "Transparent flow: no hidden approval for student orders, verified page counts before payment, direct supplier visibility, and admin support when needed.",
  highlights: [
    {
      badge: "Clarity",
      title: "Two clear order paths",
      description:
        "Send your request to every supplier using Global Launch, or select the exact supplier you trust."
    },
    {
      badge: "Protection",
      title: "Verified before you pay",
      description:
        "If the page count was typed incorrectly, the supplier can correct it before payment so you do not pay the wrong amount."
    },
    {
      badge: "Transparency",
      title: "Full profile visibility",
      description:
        "You can view the supplier profile, contact them directly, and keep track of the process without hidden quirks."
    }
  ],
  steps: [
    {
      id: "user-login",
      eyebrow: "Step 01",
      title: "Login and open your dashboard",
      description:
        "Sign in to the student portal and start the order from your dashboard whenever you are ready."
    },
    {
      id: "user-create",
      eyebrow: "Step 02",
      title: "Create the order",
      description:
        "Upload the file, add print details, and submit the request from the dashboard."
    },
    {
      id: "user-branch",
      eyebrow: "Step 03",
      title: "Choose how the request should travel",
      description:
        "You control whether the order goes wide to all suppliers or directly to one selected supplier.",
      branches: [
        {
          badge: "Global Launch",
          title: "Broadcast to all suppliers",
          description:
            "The order reaches all available suppliers so the first suitable supplier can accept it."
        },
        {
          badge: "Selected Supplier",
          title: "Send to one supplier only",
          description:
            "Choose a known supplier directly when you already prefer a specific printer or contact."
        }
      ]
    },
    {
      id: "user-accept",
      eyebrow: "Step 04",
      title: "A supplier accepts the order",
      description:
        "Once a supplier takes the request, the order becomes active on both sides. Student orders do not wait for admin approval."
    },
    {
      id: "user-verify",
      eyebrow: "Step 05",
      title: "Page count gets verified",
      description:
        "If the entered page count is inaccurate, the supplier can correct it before payment so pricing stays fair.",
      note: "This is especially useful when a document's page count was typed manually."
    },
    {
      id: "user-pay",
      eyebrow: "Step 06",
      title: "Pay and download the receipt",
      description:
        "After acceptance and verification, you pay the confirmed amount and can download the receipt immediately."
    },
    {
      id: "user-print",
      eyebrow: "Step 07",
      title: "Printing starts after payment",
      description:
        "The supplier begins the print process only after payment is completed, keeping the workflow clear for both sides."
    },
    {
      id: "user-pickup",
      eyebrow: "Step 08",
      title: "Collect the printout the next day",
      description:
        "Place the order a day in advance, then collect the printed order from the supplier in college on the next day.",
      note: "If anything feels urgent, you can contact the supplier directly from the portal."
    }
  ],
  closingTitle: "Need help beyond the flow?",
  closingText:
    "If something still feels unclear, use the Contact page. The portal stays under admin supervision and the support path remains open."
}

export const supplierGuideContent: GuidePageContent = {
  audience: "supplier",
  title: "Supplier FAQ & Flow Guide",
  subtitle: "A clear map of approval, order handling, payment, and pickup.",
  description:
    "This page explains the supplier journey from registration to handover and answers the questions suppliers have raised about approvals, payment timing, verification, and performance.",
  heroBadges: [
    "Admin approval flow",
    "Accept or reject orders",
    "Verify page counts",
    "Direct user contact"
  ],
  primaryCta: {
    label: "Open Supplier Portal",
    href: "/supplier/dashboard"
  },
  secondaryCta: {
    label: "Apply as Supplier",
    href: "/supplier/apply"
  },
  trustStrip:
    "Supplier onboarding is admin-approved, order handling is transparent, pricing is verified before payment, delivered paid orders build wallet balance, and the complete trail stays under admin supervision.",
  highlights: [
    {
      badge: "Onboarding",
      title: "Printer owners can apply",
      description:
        "Any supplier with a printer can register for the portal and enter the approval pipeline."
    },
    {
      badge: "Control",
      title: "Accept or reject by availability",
      description:
        "Suppliers stay in control of workload by choosing which orders to handle."
    },
    {
      badge: "Safety",
      title: "Print only after payment",
      description:
        "Verification happens before payment, and production starts only after payment is confirmed."
    },
    {
      badge: "Wallet",
      title: "Request payouts from available balance",
      description:
        "Delivered paid orders contribute to wallet balance, and suppliers can raise payout requests for any amount available to claim."
    }
  ],
  steps: [
    {
      id: "supplier-register",
      eyebrow: "Step 01",
      title: "Register for the supplier portal",
      description:
        "Anyone with access to a printer can apply and submit supplier registration details."
    },
    {
      id: "supplier-approval",
      eyebrow: "Step 02",
      title: "Wait for admin approval",
      description:
        "The admin team reviews supplier applications before opening live order access."
    },
    {
      id: "supplier-access",
      eyebrow: "Step 03",
      title: "Access the supplier dashboard",
      description:
        "Once approved, you can log in, manage profile details, and start handling print requests."
    },
    {
      id: "supplier-accept-reject",
      eyebrow: "Step 04",
      title: "Accept or reject incoming orders",
      description:
        "From the portal, suppliers can decide which orders to handle based on readiness and availability."
    },
    {
      id: "supplier-verify",
      eyebrow: "Step 05",
      title: "Verify the page count",
      description:
        "Because document page count can be entered manually by users, suppliers can correct it before payment when needed."
    },
    {
      id: "supplier-wait-payment",
      eyebrow: "Step 06",
      title: "Wait for the user's payment",
      description:
        "After verification and acceptance, the order pauses until the user completes payment."
    },
    {
      id: "supplier-print",
      eyebrow: "Step 07",
      title: "Start printing after payment",
      description:
        "Once payment is confirmed, the supplier can begin production with a verified order and clear amount."
    },
    {
      id: "supplier-handover",
      eyebrow: "Step 08",
      title: "Hand over the printout the next day",
      description:
        "The student collects the printed order from the supplier in college the next day, and both sides can contact each other directly if required.",
      note: "The overall workflow remains visible and supervised under admin control."
    },
    {
      id: "supplier-wallet-credit",
      eyebrow: "Step 09",
      title: "Delivered paid orders build your wallet",
      description:
        "After an order is paid and delivered, its earnings contribute to your supplier wallet balance and become part of the amount you can claim."
    },
    {
      id: "supplier-payout-request",
      eyebrow: "Step 10",
      title: "Request payout from available balance",
      description:
        "You can send a payout request for any amount within your available wallet balance. The admin team reviews the request, contacts you if needed, and approves the payout."
    }
  ],
  closingTitle: "Need admin support or a process clarification?",
  closingText:
    "The supplier flow is intentionally structured to protect trust, pricing accuracy, and production effort. When something looks wrong, admin supervision is available."
}
