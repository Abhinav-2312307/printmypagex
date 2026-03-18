import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Supplier from "@/models/Supplier"
import { authenticateAdminRequest } from "@/lib/admin-auth"

export async function POST(req:Request){
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  await connectDB()

  const body = await req.json()
  const supplierId = body.id as string | undefined
  const approved = typeof body.approved === "boolean" ? body.approved : true
  const active = typeof body.active === "boolean" ? body.active : approved

  if (!supplierId) {
    return NextResponse.json(
      { success: false, message: "Supplier id is required" },
      { status: 400 }
    )
  }

  const supplier = await Supplier.findByIdAndUpdate(
    supplierId,
    {
      approved,
      active
    },
    { returnDocument: "after" }
  )

  if (!supplier) {
    return NextResponse.json(
      { success: false, message: "Supplier not found" },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success:true,
    supplier
  })

}
