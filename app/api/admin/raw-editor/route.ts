import { NextResponse } from "next/server"
import { authenticateAdminRequest } from "@/lib/admin-auth"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import User from "@/models/User"
import Supplier from "@/models/Supplier"

export const runtime = "nodejs"

function getModel(collection: string) {
  switch (collection) {
    case "orders":
      return Order
    case "users":
      return User
    case "suppliers":
      return Supplier
    default:
      return null
  }
}

export async function GET(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const collection = searchParams.get("collection")
  const id = searchParams.get("id")

  if (!collection || !id) {
    return NextResponse.json({ success: false, message: "Missing collection or id" }, { status: 400 })
  }

  await connectDB()
  const Model = getModel(collection)

  if (!Model) {
    return NextResponse.json({ success: false, message: "Invalid collection" }, { status: 400 })
  }

  try {
    const doc = await Model.findById(id).lean()
    if (!doc) {
      return NextResponse.json({ success: false, message: "Document not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, doc })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const auth = await authenticateAdminRequest(req)
  if (!auth.ok) return auth.response

  try {
    const body = await req.json()
    const { collection, id, updateData } = body

    if (!collection || !id || !updateData) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 })
    }

    await connectDB()
    const Model = getModel(collection)

    if (!Model) {
      return NextResponse.json({ success: false, message: "Invalid collection" }, { status: 400 })
    }

    // Remove immutable fields if someone accidentally tries to change _id
    delete updateData._id

    // Direct replacement of fields. 
    // We intentionally allow this to overwrite fields directly in the database.
    const updatedDoc = await Model.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: false, overwrite: false }
    ).lean()

    if (!updatedDoc) {
      return NextResponse.json({ success: false, message: "Document not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: "Document updated successfully", doc: updatedDoc })
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}
