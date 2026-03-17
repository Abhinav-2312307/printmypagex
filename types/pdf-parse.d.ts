declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    numpages: number
    text: string
    info?: unknown
    metadata?: unknown
    version?: string
  }

  export default function pdf(dataBuffer: Uint8Array): Promise<PdfParseResult>
}
