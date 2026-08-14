with open("app/user/dashboard/page.tsx", "r") as f:
    content = f.read()

import_statement = "import { PDFDocument } from \"pdf-lib\"\n"
if "pdf-lib" not in content:
    content = content.replace("import { authFetch", import_statement + "import { authFetch")

handle_files_old = """  const handleFilesSelected = (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const newFiles = Array.from(selectedFiles)
    const currentCount = fileEntries.length
    const available = MAX_FILES_PER_ORDER - currentCount
    const filesToAdd = newFiles.slice(0, available)

    if (newFiles.length > available) {
      toast.error(`You can upload up to ${MAX_FILES_PER_ORDER} files. ${newFiles.length - available} file(s) were skipped.`)
    }

    const newEntries: FileEntry[] = filesToAdd
      .filter((file) => {
        if (!isAcceptedUploadFile(file)) {
          toast.error(`"${file.name}" is not a supported file type.`)
          return false
        }
        const limit = getUploadLimitInfo(file)
        if (file.size > limit.maxBytes) {
          toast.error(`"${file.name}": ${getUploadLimitErrorMessage(file)}`)
          return false
        }
        return true
      })
      .map((file) => ({
        id: `file-${++fileIdCounter}`,
        file,
        pageCount: "",
        pdfPassword: "",
        needsPdfPassword: false,
        detectedPages: null
      }))

    setFileEntries((prev) => [...prev, ...newEntries])

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }"""

handle_files_new = """  const handleFilesSelected = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return

    const newFiles = Array.from(selectedFiles)
    const currentCount = fileEntries.length
    const available = MAX_FILES_PER_ORDER - currentCount
    const filesToAdd = newFiles.slice(0, available)

    if (newFiles.length > available) {
      toast.error(`You can upload up to ${MAX_FILES_PER_ORDER} files. ${newFiles.length - available} file(s) were skipped.`)
    }

    const validFiles = filesToAdd.filter((file) => {
      if (!isAcceptedUploadFile(file)) {
        toast.error(`"${file.name}" is not a supported file type.`)
        return false
      }
      const limit = getUploadLimitInfo(file)
      if (file.size > limit.maxBytes) {
        toast.error(`"${file.name}": ${getUploadLimitErrorMessage(file)}`)
        return false
      }
      return true
    })

    const newEntries: FileEntry[] = await Promise.all(
      validFiles.map(async (file) => {
        let detectedPages: number | null = null
        let needsPdfPassword = false
        let pageCount = ""

        if (isPdfUploadFile(file)) {
          try {
            const arrayBuffer = await file.arrayBuffer()
            const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
            detectedPages = pdfDoc.getPageCount()
            pageCount = String(detectedPages)
          } catch (e: any) {
            if (e.message && (e.message.toLowerCase().includes('encrypted') || e.message.toLowerCase().includes('password'))) {
              needsPdfPassword = true
            }
          }
        }

        return {
          id: `file-${++fileIdCounter}`,
          file,
          pageCount,
          pdfPassword: "",
          needsPdfPassword,
          detectedPages
        }
      })
    )

    setFileEntries((prev) => [...prev, ...newEntries])

    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }"""

content = content.replace(handle_files_old, handle_files_new)


ui_old = """          ) : isPdfUploadFile(entry.file) ? (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-emerald-400 font-medium">Auto-detected</span>
              {entry.pageCount && (
                <span className="text-xs text-gray-400">
                  (Override: <input type="number" min="1" value={entry.pageCount} onChange={(e) => updateFileEntry(entry.id, { pageCount: e.target.value.replace(/\D/g, "") })} className="w-16 bg-dark p-1 rounded border border-gray-700 text-xs inline" />)
                </span>
              )}
            </div>"""

ui_new = """          ) : isPdfUploadFile(entry.file) ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="number"
                min="1"
                value={entry.pageCount}
                onChange={(e) => updateFileEntry(entry.id, { pageCount: e.target.value.replace(/\D/g, "") })}
                placeholder={entry.detectedPages ? `Auto-detected: ${entry.detectedPages}` : "Enter page count"}
                className="w-full bg-dark p-2 rounded-lg border border-gray-700 text-sm"
              />
            </div>"""

content = content.replace(ui_old, ui_new)

with open("app/user/dashboard/page.tsx", "w") as f:
    f.write(content)
