import { NextResponse } from "next/server"
import { gunzip } from "node:zlib"
import { promisify } from "node:util"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"

export const runtime = "nodejs"

const gunzipAsync = promisify(gunzip)

function buildContentDisposition(fileName: string) {
  const fallbackName = (fileName || "file")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "_")

  return `inline; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(fileName || "file")}`
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Missing file token" },
        { status: 400 }
      )
    }

    await connectDB()

    const order = await Order.findOne({ fileAccessToken: token })
      .select("storageURL fileStorageEncoding fileOriginalName fileMimeType")
      .lean<{
        storageURL?: string
        fileStorageEncoding?: "none" | "gzip"
        fileOriginalName?: string
        fileMimeType?: string
      } | null>()

    if (!order?.storageURL) {
      return NextResponse.json(
        { success: false, message: "File not found" },
        { status: 404 }
      )
    }

    const upstreamResponse = await fetch(order.storageURL, { cache: "no-store" })

    if (!upstreamResponse.ok) {
      return NextResponse.json(
        { success: false, message: "Failed to fetch file from storage" },
        { status: 502 }
      )
    }

    const upstreamBuffer = Buffer.from(await upstreamResponse.arrayBuffer())
    const outputBuffer =
      order.fileStorageEncoding === "gzip"
        ? await gunzipAsync(upstreamBuffer)
        : upstreamBuffer

    return new NextResponse(outputBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": buildContentDisposition(order.fileOriginalName || "file"),
        "Content-Length": String(outputBuffer.byteLength),
        "Content-Type":
          order.fileMimeType ||
          upstreamResponse.headers.get("content-type") ||
          "application/octet-stream"
      }
    })
  } catch (error) {
    console.error("ORDER_FILE_FETCH_ERROR:", error)

    return NextResponse.json(
      { success: false, message: "Failed to open file" },
      { status: 500 }
    )
  }
}
