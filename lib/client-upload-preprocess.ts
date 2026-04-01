"use client"

type PreparedUploadResult = {
  file: File
  wasCompressed: boolean
}

export async function prepareFileForUpload(file: File): Promise<PreparedUploadResult> {
  return {
    file,
    wasCompressed: false
  }
}
