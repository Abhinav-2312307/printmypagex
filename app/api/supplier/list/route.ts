import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"
import User from "@/models/User"
import { authenticateUserRequest } from "@/lib/user-auth"
import { isOwnerEmail } from "@/lib/owner-access"

export async function GET(req: Request) {
  const auth = await authenticateUserRequest(req, {
    requireProfile: false,
    requireActive: false
  })
  if (!auth.ok) return auth.response

  await connectDB()

  const supplierDocs = await Supplier.find({
    approved: true,
    active: true
  })
    .select("firebaseUID name branch year email phone rollNo photoURL firebasePhotoURL")
    .sort({ createdAt: -1 })
    .lean()

  const firebaseUIDs = supplierDocs.map((supplier) => String(supplier.firebaseUID || "")).filter(Boolean)
  const userDocs = await User.find({
    firebaseUID: { $in: firebaseUIDs }
  })
    .select("firebaseUID name email phone rollNo branch year photoURL firebasePhotoURL")
    .lean()

  const userMap = new Map(userDocs.map((user) => [String(user.firebaseUID || ""), user]))

  const suppliers = supplierDocs.map((supplier) => ({
    firebaseUID: String(supplier.firebaseUID || ""),
    name: String(supplier.name || userMap.get(String(supplier.firebaseUID || ""))?.name || ""),
    email: String(userMap.get(String(supplier.firebaseUID || ""))?.email || supplier.email || ""),
    phone: String(userMap.get(String(supplier.firebaseUID || ""))?.phone || supplier.phone || ""),
    rollNo: String(userMap.get(String(supplier.firebaseUID || ""))?.rollNo || supplier.rollNo || ""),
    branch: String(supplier.branch || userMap.get(String(supplier.firebaseUID || ""))?.branch || ""),
    year: String(supplier.year || userMap.get(String(supplier.firebaseUID || ""))?.year || ""),
    photoURL: String(userMap.get(String(supplier.firebaseUID || ""))?.photoURL || supplier.photoURL || ""),
    firebasePhotoURL: String(userMap.get(String(supplier.firebaseUID || ""))?.firebasePhotoURL || supplier.firebasePhotoURL || ""),
    isOwner: isOwnerEmail(String(userMap.get(String(supplier.firebaseUID || ""))?.email || supplier.email || "")),
    displayPhotoURL: String(
      userMap.get(String(supplier.firebaseUID || ""))?.photoURL ||
      supplier.photoURL ||
      userMap.get(String(supplier.firebaseUID || ""))?.firebasePhotoURL ||
      supplier.firebasePhotoURL ||
      ""
    )
  }))

  return NextResponse.json({
    success: true,
    suppliers
  })
}
