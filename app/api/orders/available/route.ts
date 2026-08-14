import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import { isOwnerEmail } from "@/lib/owner-access"
import { authenticateUserRequest } from "@/lib/user-auth"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"

type MinimalUser = {
  firebaseUID: string
  name?: string
  email?: string
  phone?: string
  rollNo?: string
  branch?: string
  year?: number
  section?: string
  photoURL?: string
  firebasePhotoURL?: string
}

const ORDER_SELECT_FIELDS = [
  "userUID",
  "supplierUID",
  "status",
  "paymentStatus",
  "printType",
  "pages",
  "copies",
  "verifiedPages",
  "estimatedPrice",
  "finalPrice",
  "fileURL",
  "files",
  "pdfPasswordRequired",
  "pdfPassword",
  "duplex",
  "spiralBinding",
  "instruction",
  "alternatePhone",
  "requestType",
  "createdAt",
  "acceptedAt",
  "paidAt",
  "deliveredAt"
].join(" ")

export async function GET(req: Request) {
  const auth = await authenticateUserRequest(req, {
    requireProfile: false,
    requireActive: false
  })
  if (!auth.ok) return auth.response

  await connectDB()

  const { searchParams } = new URL(req.url)
  const supplierUID = searchParams.get("supplierUID")

  if (!supplierUID) {
    return NextResponse.json(
      { error: "Supplier UID missing" },
      { status: 400 }
    )
  }

  if (supplierUID !== auth.uid) {
    return NextResponse.json(
      { error: "Unauthorized UID" },
      { status: 403 }
    )
  }

  const supplier = await Supplier.findOne({
    firebaseUID: supplierUID
  })
    .select("firebaseUID approved active")
    .lean()

  const ownerAccess = isOwnerEmail(auth.email)

  if (!supplier && !ownerAccess) {
    return NextResponse.json({ error: "Supplier not registered" }, { status: 403 })
  }

  if (!ownerAccess && !supplier?.approved) {
    return NextResponse.json({ error: "Supplier not approved" }, { status: 403 })
  }

  if (!ownerAccess && !supplier?.active) {
    return NextResponse.json({ error: "Supplier inactive" }, { status: 403 })
  }

  await applyOrderLifecycleRules()

  const orders = await Order.find({

    status: "pending",

    $or: [

      {
        requestType: "global",
        supplierUID: null
      },

      {
        requestType: "specific",
        supplierUID: supplierUID
      }

    ]

  })
    .select(ORDER_SELECT_FIELDS)
    .sort({ createdAt: -1 })
    .lean()

  const userUIDs = [
    ...new Set(
      orders
        .map((order) => String(order.userUID || ""))
        .filter(Boolean)
    )
  ]

  const users = (await User.find({
    firebaseUID: { $in: userUIDs }
  })
    .select("firebaseUID name email phone rollNo branch year section photoURL firebasePhotoURL")
    .lean()) as MinimalUser[]

  const userMap = new Map<string, MinimalUser>()
  users.forEach((user) => {
    userMap.set(String(user.firebaseUID), user)
  })

  const enrichedOrders = orders.map((order) => {
    const user = userMap.get(String(order.userUID || ""))
    const canRevealPdfPassword = String(order.supplierUID || "") === supplierUID

    return {
      ...order,
      pdfPassword: canRevealPdfPassword ? String(order.pdfPassword || "") : "",
      pdfPasswordRequired: Boolean(order.pdfPasswordRequired),
      userName: user?.name || "",
      class: user?.section || "",
      rollNo: user?.rollNo || "",
      phone: user?.phone || "",
      userProfile: {
        name: user?.name || "",
        email: user?.email || "",
        phone: user?.phone || "",
        rollNo: user?.rollNo || "",
        branch: user?.branch || "",
        year: user?.year || "",
        section: user?.section || "",
        photoURL: user?.photoURL || "",
        firebasePhotoURL: user?.firebasePhotoURL || "",
        displayPhotoURL: (user?.photoURL || user?.firebasePhotoURL || "")
      }
    }
  })

  return NextResponse.json({
    success: true,
    orders: enrichedOrders
  })

}
