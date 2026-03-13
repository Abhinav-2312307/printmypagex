"use client"

import { useEffect, useState } from "react"
import type { FAQContentSnapshot, FAQAudience, FAQItem } from "@/lib/faq-content"

type FaqManagerProps = {
  content: FAQContentSnapshot
  saving?: boolean
  onSave: (content: FAQContentSnapshot) => Promise<void>
}

function createFaqItem(audience: FAQAudience): FAQItem {
  return {
    id: `${audience}-${crypto.randomUUID()}`,
    question: "",
    answer: "",
    badge: ""
  }
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "Using default FAQ content"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Saved"

  return `Updated ${date.toLocaleString()}`
}

type SectionProps = {
  audience: FAQAudience
  title: string
  description: string
  items: FAQItem[]
  onChange: (items: FAQItem[]) => void
}

function FaqSection({ audience, title, description, items, onChange }: SectionProps) {
  const updateItem = (index: number, field: keyof FAQItem, value: string) => {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    )
  }

  const removeItem = (index: number) => {
    onChange(items.filter((_, itemIndex) => itemIndex !== index))
  }

  return (
    <section className="space-y-4 rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/5 p-5 md:p-6 backdrop-blur-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-indigo-500 dark:text-cyan-300">
            {title}
          </p>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 max-w-2xl">
            {description}
          </p>
        </div>

        <button
          onClick={() => onChange([...items, createFaqItem(audience)])}
          className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white transition hover:scale-[1.02]"
        >
          Add FAQ
        </button>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className="rounded-[1.6rem] border border-white/30 dark:border-white/10 bg-white/70 dark:bg-black/20 p-4 md:p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                FAQ {String(index + 1).padStart(2, "0")}
              </p>

              <button
                onClick={() => removeItem(index)}
                className="rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-500 transition hover:bg-rose-500/20"
              >
                Remove
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <input
                value={item.badge || ""}
                onChange={(event) => updateItem(index, "badge", event.target.value)}
                placeholder="Short badge like Important, Payments, Feedback based"
                className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-black/30 px-4 py-3 text-sm"
              />

              <input
                value={item.question}
                onChange={(event) => updateItem(index, "question", event.target.value)}
                placeholder="Question"
                className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-black/30 px-4 py-3 text-sm"
              />

              <textarea
                value={item.answer}
                onChange={(event) => updateItem(index, "answer", event.target.value)}
                placeholder="Answer"
                rows={4}
                className="w-full rounded-2xl border border-gray-200 dark:border-white/10 bg-white/90 dark:bg-black/30 px-4 py-3 text-sm resize-y"
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function FaqManager({ content, saving = false, onSave }: FaqManagerProps) {
  const [draft, setDraft] = useState<FAQContentSnapshot>(content)

  useEffect(() => {
    setDraft(content)
  }, [content])

  return (
    <div className="space-y-5">
      <div className="rounded-[2rem] border border-gray-200 dark:border-white/10 bg-white/75 dark:bg-white/5 p-6 backdrop-blur-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-indigo-500 dark:text-cyan-300">
              FAQ CMS
            </p>
            <h3 className="mt-2 text-2xl font-semibold">Public FAQ Editor</h3>
            <p className="mt-2 max-w-2xl text-sm text-gray-600 dark:text-gray-300">
              These questions appear on the new user and supplier guide pages. Leave blank rows out of the final save. If every row is removed, the platform falls back to the built-in defaults.
            </p>
          </div>

          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatUpdatedAt(draft.updatedAt)}
            </p>
            <button
              onClick={() => onSave(draft)}
              disabled={saving}
              className="mt-3 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-5 py-2.5 text-sm font-medium text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save FAQ Content"}
            </button>
          </div>
        </div>
      </div>

      <FaqSection
        audience="user"
        title="User FAQ"
        description="Questions shown on the student-facing FAQ and workflow page."
        items={draft.userFaqs}
        onChange={(items) =>
          setDraft((prev) => ({
            ...prev,
            userFaqs: items
          }))
        }
      />

      <FaqSection
        audience="supplier"
        title="Supplier FAQ"
        description="Questions shown on the supplier-facing FAQ and workflow page."
        items={draft.supplierFaqs}
        onChange={(items) =>
          setDraft((prev) => ({
            ...prev,
            supplierFaqs: items
          }))
        }
      />
    </div>
  )
}
