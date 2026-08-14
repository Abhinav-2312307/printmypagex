import re

with open("app/user/dashboard/page.tsx", "r") as f:
    content = f.read()

# Add getFileTypeLabel, getFileTypeBadgeColor, formatBytes to file if not present
if "function formatBytes(" not in content:
    content = content.replace("export default function Dashboard", """function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** unitIndex
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
}

function getFileTypeLabel(file: File): string {
  if (isPdfUploadFile(file)) return "PDF"
  if (requiresManualPageCount(file)) return "DOC"
  return "IMG"
}

function getFileTypeBadgeColor(file: File): string {
  if (isPdfUploadFile(file)) return "bg-rose-500/20 text-rose-400 border-rose-500/30"
  if (requiresManualPageCount(file)) return "bg-blue-500/20 text-blue-400 border-blue-500/30"
  return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
}

export default function Dashboard""")

old_jsx = """<input
ref={fileInputRef}
type="file"
required
accept={UPLOAD_ACCEPT_ATTRIBUTE}
onChange={(e)=>{
const selectedFile = e.target.files?.[0] || null
setFile(selectedFile)
setPdfPassword("")
setNeedsPdfPassword(false)

if(!requiresManualPageCount(selectedFile)){
setPageCount("")
}
}}
/>

<p className="text-xs text-gray-400">
{UPLOAD_POLICY_HELPER_TEXT}
</p>

{showPdfPasswordField && (
<div className="space-y-2">
<label className="block text-sm text-gray-400">
PDF Password
</label>
<input
type="password"
value={pdfPassword}
onChange={(e)=>setPdfPassword(e.target.value)}
placeholder="Enter the password used to open this PDF"
className="input w-full"
/>
<p className="text-xs text-gray-400">
We use this to read the locked PDF page count and store it with the order so the supplier can open the same file.
</p>
</div>
)}

{isPdfFile && !showPdfPasswordField && (
<p className="text-xs text-gray-400">
If this PDF is locked, submit once and we will ask for the password before creating the order.
</p>
)}

{requiresManualPageCount(file) && (
<input
type="number"
min="1"
required
placeholder="Enter total pages in document"
value={pageCount}
onChange={(e)=>setPageCount(e.target.value.replace(/\D/g,""))}
className="input w-full"
/>
)}"""

new_jsx = """<div>
  <label className="block mb-2 text-sm text-gray-400">
    Upload Files ({fileEntries.length}/{MAX_FILES_PER_ORDER})
  </label>
  {fileEntries.length < MAX_FILES_PER_ORDER && (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT_ATTRIBUTE}
        onChange={(e) => handleFilesSelected(e.target.files)}
        className="w-full bg-dark p-3 rounded-lg border border-gray-700"
      />
      <p className="mt-2 text-xs text-gray-400">
        {UPLOAD_POLICY_HELPER_TEXT}
      </p>
    </div>
  )}
  {fileEntries.length >= MAX_FILES_PER_ORDER && (
    <p className="text-xs text-amber-400 mt-1">
      Maximum {MAX_FILES_PER_ORDER} files reached. Remove a file to add another.
    </p>
  )}
</div>

{fileEntries.length > 0 && (
  <div className="space-y-3 mt-4">
    {fileEntries.map((entry, index) => (
      <div key={entry.id} className="rounded-xl border border-gray-700 bg-dark/50 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border ${getFileTypeBadgeColor(entry.file)}`}>
              {getFileTypeLabel(entry.file)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{entry.file.name}</p>
              <p className="text-xs text-gray-400">{formatBytes(entry.file.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeFileEntry(entry.id)}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-gray-700 text-gray-400 hover:text-rose-400 hover:border-rose-500/40 transition-colors"
            title="Remove file"
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs text-gray-400 shrink-0 w-16">Pages:</label>
          {requiresManualPageCount(entry.file) ? (
            <div className="flex-1">
              <input
                type="number"
                min="1"
                value={entry.pageCount}
                onChange={(e) => updateFileEntry(entry.id, { pageCount: e.target.value.replace(/\D/g, "") })}
                placeholder="Enter page count"
                className="w-full bg-dark p-2 rounded-lg border border-gray-700 text-sm"
              />
            </div>
          ) : isPdfUploadFile(entry.file) ? (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-emerald-400 font-medium">Auto-detected</span>
              {entry.pageCount && (
                <span className="text-xs text-gray-400">
                  (Override: <input type="number" min="1" value={entry.pageCount} onChange={(e) => updateFileEntry(entry.id, { pageCount: e.target.value.replace(/\D/g, "") })} className="w-16 bg-dark p-1 rounded border border-gray-700 text-xs inline" />)
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-gray-400">1 page (image)</span>
          )}
        </div>

        {isPdfUploadFile(entry.file) && (entry.needsPdfPassword || entry.pdfPassword.length > 0) && (
          <div>
            <input
              type="password"
              value={entry.pdfPassword}
              onChange={(e) => updateFileEntry(entry.id, { pdfPassword: e.target.value })}
              placeholder="PDF password for this file"
              className="w-full bg-dark p-2 rounded-lg border border-gray-700 text-sm"
            />
          </div>
        )}
      </div>
    ))}
  </div>
)}"""

# Replace all occurrences of old_jsx whitespace agnostic
def normalize_ws(text):
    return re.sub(r'\s+', '', text)

old_norm = normalize_ws(old_jsx)
content_norm = normalize_ws(content)
if old_norm in content_norm:
    print("Found exact match for old JSX")

# The easiest way is to use regex matching ignoring whitespace
pattern = re.compile(r'<input\s*ref=\{fileInputRef\}\s*type="file"\s*required\s*accept=\{UPLOAD_ACCEPT_ATTRIBUTE\}.*?className="input w-full"\s*/>\s*\)}', re.DOTALL)
content = pattern.sub(new_jsx, content)

# Remove unused variables if there are errors about them later
with open("app/user/dashboard/page.tsx", "w") as f:
    f.write(content)
