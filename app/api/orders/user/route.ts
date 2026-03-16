import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import { authenticateUserRequest } from "@/lib/user-auth"
import { applyOrderLifecycleRules } from "@/lib/order-lifecycle"
import { isOwnerEmail } from "@/lib/owner-access"

type MinimalSupplier = {
  firebaseUID: string
  name?: string
  email?: string
  phone?: string
  rollNo?: string
  branch?: string
  year?: string
  photoURL?: string
  firebasePhotoURL?: string
}

type MinimalUser = MinimalSupplier & {
  role?: string
}

const ORDER_SELECT_FIELDS = [
  "userUID",
  "supplierUID",
  "status",
  "paymentStatus",
  "printType",
  "pages",
  "verifiedPages",
  "estimatedPrice",
  "finalPrice",
  "fileURL",
  "duplex",
  "instruction",
  "alternatePhone",
  "requestType",
  "createdAt",
  "acceptedAt",
  "paidAt",
  "deliveredAt"
].join(" ")

export async function GET(req: Request) {

  try {
    const auth = await authenticateUserRequest(req, {
      requireProfile: false,
      requireActive: false
    })
    if (!auth.ok) return auth.response

    await connectDB()

    const { searchParams } = new URL(req.url)
    const firebaseUID = searchParams.get("firebaseUID")

    if (!firebaseUID) {
      return NextResponse.json({
        success: false,
        message: "Missing firebaseUID"
      }, { status: 400 })
    }

    if (firebaseUID !== auth.uid) {
      return NextResponse.json({
        success: false,
        message: "Unauthorized UID"
      }, { status: 403 })
    }

    await applyOrderLifecycleRules({ userUID: firebaseUID })

    const orders = await Order.find({
      userUID: firebaseUID
    })
      .select(ORDER_SELECT_FIELDS)
      .sort({ createdAt: -1 })
      .lean()

    const supplierUIDs = [
      ...new Set(
        orders
          .map((order) => String(order.supplierUID || ""))
          .filter(Boolean)
      )
    ]

    const suppliers = (await Supplier.find({
      firebaseUID: { $in: supplierUIDs }
    })
      .select("firebaseUID name email phone rollNo branch year photoURL firebasePhotoURL")
      .lean()) as MinimalSupplier[]

    const users = (await User.find({
      firebaseUID: { $in: supplierUIDs }
    })
      .select("firebaseUID name email phone rollNo branch year photoURL firebasePhotoURL role")
      .lean()) as MinimalUser[]

    const supplierMap = new Map<string, MinimalSupplier>()
    suppliers.forEach((supplier) => {
      supplierMap.set(String(supplier.firebaseUID), supplier)
    })

    const userMap = new Map(users.map((user) => [String(user.firebaseUID || ""), user]))

    const enrichedOrders = orders.map((order) => {
      const supplierUID = String(order.supplierUID || "")
      const supplier = supplierMap.get(supplierUID)
      const linkedUser = userMap.get(supplierUID)
      const supplierEmail = String(linkedUser?.email || supplier?.email || "")
      const supplierIsOwner = Boolean(
        isOwnerEmail(supplierEmail) ||
        linkedUser?.role === "ADMIN"
      )

      const supplierProfile = supplier
        ? {
            name: supplier.name || linkedUser?.name || "",
            email: supplierEmail,
            phone: supplier.phone || linkedUser?.phone || "",
            rollNo: supplier.rollNo || linkedUser?.rollNo || "",
            branch: supplier.branch || linkedUser?.branch || "",
            year: supplier.year || linkedUser?.year || "",
            photoURL: supplier.photoURL || linkedUser?.photoURL || "",
            firebasePhotoURL: supplier.firebasePhotoURL || linkedUser?.firebasePhotoURL || "",
            displayPhotoURL:
              supplier.photoURL ||
              linkedUser?.photoURL ||
              supplier.firebasePhotoURL ||
              linkedUser?.firebasePhotoURL ||
              "",
            isOwner: supplierIsOwner
          }
        : null

      return {
        ...order,
        supplierName: supplier?.name || linkedUser?.name || null,
        supplierIsOwner,
        supplierProfile
      }
    })

    return NextResponse.json({
      success: true,
      orders: enrichedOrders
    })

  } catch (error) {

    console.log("FETCH USER ORDERS ERROR:", error)

    return NextResponse.json({
      success: false,
      message: "Failed to fetch orders"
    })

  }

}
