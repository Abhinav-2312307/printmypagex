with open("app/user/dashboard/page.tsx", "r") as f:
    content = f.read()

old_jsx = """<input
ref={fileInputRef}
type="file"
required
accept={UPLOAD_ACCEPT_ATTRIBUTE,
  MAX_FILES_PER_ORDER}
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
{isPdfFile && (
<p className="text-xs text-emerald-400 font-medium">
PDF detected
</p>
)}
{showPdfPasswordField && (
<input
type="password"
placeholder="PDF is encrypted, enter password..."
value={pdfPassword}
onChange={(e)=>setPdfPassword(e.target.value)}
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
                onChange={(e) => updateFileEntry(entry.id, { pageCount: e.target.value.replace(/\\D/g, "") })}
                placeholder="Enter page count"
                className="w-full bg-dark p-2 rounded-lg border border-gray-700 text-sm"
              />
            </div>
          ) : isPdfUploadFile(entry.file) ? (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xs text-emerald-400 font-medium">Auto-detected</span>
              {entry.pageCount && (
                <span className="text-xs text-gray-400">
                  (Override: <input type="number" min="1" value={entry.pageCount} onChange={(e) => updateFileEntry(entry.id, { pageCount: e.target.value.replace(/\\D/g, "") })} className="w-16 bg-dark p-1 rounded border border-gray-700 text-xs inline" />)
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

# We need to find the old JSX more dynamically because whitespace might not match exactly.
# Let's use regex that ignores whitespace differences.
import re
pattern = re.compile(r'<input\s*ref=\{fileInputRef\}\s*type="file"\s*required.*?className="input w-full"\s*/>\s*\)}', re.DOTALL)
content = pattern.sub(lambda x: new_jsx, content)

# Then we remove the unused isPdfFile and showPdfPasswordField at the beginning of the modal
content = re.sub(r'const isPdfFile = isPdfUploadFile\(file\)\nconst showPdfPasswordField = isPdfFile && \(needsPdfPassword \|\| pdfPassword\.length > 0\)', '', content)

with open("app/user/dashboard/page.tsx", "w") as f:
    f.write(content)
