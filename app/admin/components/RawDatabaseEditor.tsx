"use client"

import { useState, useEffect } from "react"
import { toast } from "react-hot-toast"
import { authFetch } from "@/lib/client-auth"

type RawDatabaseEditorProps = {
  collection: "orders" | "users" | "suppliers"
  documentId: string
  onClose: () => void
  onSuccess: () => void
}

export function RawDatabaseEditor({ collection, documentId, onClose, onSuccess }: RawDatabaseEditorProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rawJson, setRawJson] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDocument() {
      try {
        const res = await authFetch(`/api/admin/raw-editor?collection=${collection}&id=${documentId}`)
        const data = await res.json()
        if (data.success) {
          setRawJson(JSON.stringify(data.doc, null, 2))
        } else {
          setError(data.message || "Failed to fetch document")
        }
      } catch (err: any) {
        setError(err.message || "An error occurred")
      } finally {
        setLoading(false)
      }
    }

    fetchDocument()
  }, [collection, documentId])

  const handleSave = async () => {
    let parsedData
    try {
      parsedData = JSON.parse(rawJson)
    } catch (e) {
      toast.error("Invalid JSON format. Please correct it before saving.")
      return
    }

    setSaving(true)
    try {
      const res = await authFetch(`/api/admin/raw-editor`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          collection,
          id: documentId,
          updateData: parsedData
        })
      })

      const data = await res.json()
      if (data.success) {
        toast.success("Document updated successfully")
        onSuccess()
        onClose()
      } else {
        toast.error(data.message || "Failed to update document")
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred during save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex justify-center items-center p-4 sm:p-6 backdrop-blur-sm">
      <div className="bg-gray-900 w-full max-w-5xl h-[85vh] p-4 sm:p-6 rounded-2xl shadow-2xl flex flex-col border border-white/10">
        
        <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">Raw Database Editor</h2>
            <p className="text-sm text-gray-400 font-mono mt-1">
              {collection} / {documentId}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition text-gray-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
          </div>
        ) : error ? (
          <div className="flex-1 flex justify-center items-center text-red-400">
            {error}
          </div>
        ) : (
          <>
            <div className="flex-1 bg-black rounded-xl border border-white/10 flex flex-col min-h-0 overflow-hidden">
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                className="flex-1 w-full h-full min-h-0 bg-transparent text-green-400 font-mono text-sm p-4 focus:outline-none resize-none overflow-auto leading-relaxed"
                spellCheck={false}
              />
            </div>
            
            <div className="mt-4 flex justify-between items-center bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl shrink-0 gap-4">
              <p className="text-xs text-yellow-500/80 max-w-2xl">
                ⚠️ <strong className="text-yellow-500">Warning:</strong> Direct database changes bypass all application logic, validation, and webhooks. Incorrect changes can break the application. Ensure you only enter valid JSON.
              </p>
              
              <div className="flex gap-3 shrink-0">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/10 text-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-lg transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "FORCE SAVE"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
