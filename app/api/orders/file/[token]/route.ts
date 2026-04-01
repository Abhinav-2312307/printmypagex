import { NextResponse } from "next/server"
import { gunzip } from "node:zlib"
import { promisify } from "node:util"
import { connectDB } from "@/lib/mongodb"
import Order from "@/models/Order"
import { buildOrderFileAccessPath } from "@/lib/upload-file"

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

    const orderQuery = Order.findOne({
      $or: [
        { fileAccessToken: token },
        { fileURL: buildOrderFileAccessPath(token) }
      ]
    })
      .select("storageURL storageChunkURLs fileStorageEncoding fileOriginalName fileMimeType")

    const order = await orderQuery.lean<{
      storageURL?: string
      storageChunkURLs?: string[]
      fileStorageEncoding?: "none" | "gzip"
      fileOriginalName?: string
      fileMimeType?: string
    } | null>()

    if (!order) {
      return NextResponse.json(
        { success: false, message: "File not found" },
        { status: 404 }
      )
    }

    const sourceUrls = Array.isArray(order.storageChunkURLs) && order.storageChunkURLs.length
      ? order.storageChunkURLs
      : order.storageURL
        ? [order.storageURL]
        : []

    if (!sourceUrls.length) {
      return NextResponse.json(
        { success: false, message: "File not found" },
        { status: 404 }
      )
    }

    const upstreamResponses = await Promise.all(
      sourceUrls.map((sourceUrl) => fetch(sourceUrl, { cache: "no-store" }))
    )

    if (upstreamResponses.some((response) => !response.ok)) {
      return NextResponse.json(
        { success: false, message: "Failed to fetch file from storage" },
        { status: 502 }
      )
    }

    const upstreamBuffers = await Promise.all(
      upstreamResponses.map(async (response) => Buffer.from(await response.arrayBuffer()))
    )
    const upstreamBuffer = Buffer.concat(upstreamBuffers)
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
          upstreamResponses[0]?.headers.get("content-type") ||
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
