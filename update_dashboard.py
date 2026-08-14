import re

with open("app/user/dashboard/page.tsx", "r") as f:
    content = f.read()

# Add FileEntry, MAX_FILES_PER_ORDER, etc to imports
if "MAX_FILES_PER_ORDER" not in content:
    content = content.replace("UPLOAD_ACCEPT_ATTRIBUTE", "UPLOAD_ACCEPT_ATTRIBUTE,\n  MAX_FILES_PER_ORDER")

if "type FileEntry =" not in content:
    content = content.replace("type DashboardOrder =", """type FileEntry = {
  id: string
  file: File
  pageCount: string
  pdfPassword: string
  needsPdfPassword: boolean
  detectedPages: number | null
}

type DashboardOrder =""")

if "let fileIdCounter = 0" not in content:
    content = content.replace("export default function Dashboard() {", """let fileIdCounter = 0

export default function Dashboard() {""")

# Replace states
old_states = """  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState("")
  const [copies, setCopies] = useState("1")
  const [pdfPassword, setPdfPassword] = useState("")
  const [needsPdfPassword, setNeedsPdfPassword] = useState(false)"""

new_states = """  const [fileEntries, setFileEntries] = useState<FileEntry[]>([])
  const [copies, setCopies] = useState("1")"""

content = content.replace(old_states, new_states)

# Replace handleSubmit
import_handlers = """  const handleFilesSelected = (selectedFiles: FileList | null) => {
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
  }

  const removeFileEntry = (id: string) => {
    setFileEntries((prev) => prev.filter((entry) => entry.id !== id))
  }

  const updateFileEntry = (id: string, updates: Partial<FileEntry>) => {
    setFileEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry
      )
    )
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (fileEntries.length === 0) {
      toast.error("Add at least one file to create an order 📁")
      return
    }

    for (let i = 0; i < fileEntries.length; i++) {
      const entry = fileEntries[i]

      if (requiresManualPageCount(entry.file)) {
        const parsedPageCount = Number.parseInt(entry.pageCount, 10)
        if (!Number.isInteger(parsedPageCount) || parsedPageCount < 1) {
          toast.error(`File ${i + 1} ("${entry.file.name}"): Enter a valid page count.`)
          return
        }
      }

      if (isPdfUploadFile(entry.file) && entry.needsPdfPassword && !entry.pdfPassword) {
        toast.error(`File ${i + 1} ("${entry.file.name}"): Enter the PDF password to continue.`)
        return
      }
    }

    const parsedCopies = Number(copies)
    if (!Number.isInteger(parsedCopies) || parsedCopies < 1) {
      toast.error("Enter a valid number of copies.")
      return
    }

    const user = auth.currentUser
    if (!user) return

    if (requestType === "specific" && !supplier) {
      toast.error("Select a supplier first.")
      return
    }

    setSubmitting(true)
    const startedAt = Date.now()
    let lastLoaded = 0
    let lastMeasuredAt = startedAt
    let lastSpeedBytesPerSecond: number | null = null
    
    setUploadProgress({
      stage: "uploading",
      startedAt,
      loaded: 0,
      total: null,
      speedBytesPerSecond: null
    })

    let currentOrderId: string | undefined = undefined
    let finalData: any = null

    try {
      for (let i = 0; i < fileEntries.length; i++) {
        const entry = fileEntries[i]
        const isFirstFile = i === 0
        const isLastFile = i === fileEntries.length - 1

        const { file: uploadFile, wasCompressed } = await prepareFileForUpload(entry.file)
        
        const formData = new FormData()
        formData.append("file", uploadFile)
        formData.append("originalFileName", entry.file.name)
        formData.append("originalFileType", entry.file.type)
        formData.append("printType", printType)
        formData.append("firebaseUID", user.uid)
        
        if (isFirstFile) {
          formData.append("requestType", requestType)
          formData.append("supplier", supplier)
          formData.append("copies", String(parsedCopies))
          formData.append("alternatePhone", alternatePhone)
          formData.append("duplex", String(duplex))
          formData.append("spiralBinding", String(spiralBinding))
          formData.append("instruction", instruction)
        } else if (currentOrderId) {
          formData.append("appendOrderId", currentOrderId)
        }

        if (isLastFile) {
          formData.append("isLastFile", "true")
        }

        if (requiresManualPageCount(entry.file) && entry.pageCount) {
          formData.append("pageCount", entry.pageCount)
        }
        if (isPdfUploadFile(entry.file) && entry.pdfPassword) {
          formData.append("pdfPassword", entry.pdfPassword)
        }
        
        const res = await authUploadWithProgress(
          "/api/upload",
          { method: "POST", body: formData },
          {
            onUploadProgress: ({ loaded, total }) => {
              const now = Date.now()
              const elapsedSinceLastMeasure = now - lastMeasuredAt
              if (elapsedSinceLastMeasure > 0) {
                const nextSpeed = ((loaded - lastLoaded) * 1000) / elapsedSinceLastMeasure
                if (Number.isFinite(nextSpeed) && nextSpeed > 0) {
                  lastSpeedBytesPerSecond = nextSpeed
                }
              }
              lastLoaded = loaded
              lastMeasuredAt = now
              setUploadProgress({
                stage: "uploading",
                startedAt,
                loaded,
                total,
                speedBytesPerSecond: lastSpeedBytesPerSecond
              })
            },
            onUploadComplete: () => {
              setUploadProgress((current) => {
                if (!current) return current
                const completedBytes = current.total ?? current.loaded
                return {
                  ...current,
                  stage: "processing",
                  loaded: completedBytes,
                  total: current.total ?? (completedBytes || null),
                  speedBytesPerSecond: null
                }
              })
            }
          }
        )

        const { data, rawText } = await readJsonResponseSafely<UploadResponseData>(res)
        
        const uploadErrorMessage = data?.error || (res.status === 413 ? getUploadLimitErrorMessage(entry.file) : rawText.trim() || "Upload failed")
        if (!res.ok || !data || data.error) {
          if (data?.requiresPdfPassword) {
            updateFileEntry(entry.id, { needsPdfPassword: true })
          }
          toast.error(`Error on file "${entry.file.name}": ${uploadErrorMessage}`)
          return
        }

        if (isFirstFile && data.orderId) {
          currentOrderId = data.orderId
        }
        
        if (isLastFile) {
          finalData = data
        }
      }

      if (finalData) {
        toast.success(`Order created! ${finalData.fileCount ?? 1} file(s) | Total Pages: ${finalData.pages} | Copies: ${finalData.copies ?? parsedCopies} | ₹${finalData.estimatedPrice}`)
        const nextOrder = finalData.order
        if (nextOrder) {
          setOrders((prev) => [nextOrder, ...prev])
        }
      }

      setFileEntries([])
      setCopies("1")
      setInstruction("")
      setAlternatePhone("")
      setDuplex(false)
      setSpiralBinding(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setSubmitting(false)
      setUploadProgress(null)
    }
  }"""

# Use regex to replace the old handleSubmit
content = re.sub(r'const handleSubmit = async.*?finally {\s*setSubmitting\(false\)\s*setUploadProgress\(null\)\s*}\s*}', import_handlers, content, flags=re.DOTALL)

with open("app/user/dashboard/page.tsx", "w") as f:
    f.write(content)
