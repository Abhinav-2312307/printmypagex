"use client"

import { useMemo, useState } from "react"
import OwnerBadge from "@/components/OwnerBadge"
import ProfileAvatar from "@/components/ProfileAvatar"
import ProfileCard from "@/components/ProfileCard"
import { isOwnerEmail } from "@/lib/owner-access"

export type SupplierSelectorItem = {
  firebaseUID: string
  name?: string
  branch?: string
  year?: string | number
  email?: string
  phone?: string
  rollNo?: string
  photoURL?: string
  firebasePhotoURL?: string
  displayPhotoURL?: string
  isOwner?: boolean
}

type SupplierSelectorProps = {
  suppliers: SupplierSelectorItem[]
  value: string
  onChange: (supplierUID: string) => void
}

function getSupplierPhoto(supplier: SupplierSelectorItem) {
  return (
    supplier.displayPhotoURL ||
    supplier.photoURL ||
    supplier.firebasePhotoURL ||
    ""
  )
}

export default function SupplierSelector({
  suppliers,
  value,
  onChange
}: SupplierSelectorProps) {
  const [isOpen, setIsOpen] = useState(!value)
  const [previewSupplier, setPreviewSupplier] = useState<SupplierSelectorItem | null>(null)

  const orderedSuppliers = useMemo(() => {
    return [...suppliers].sort((left, right) => {
      const leftOwner = Number(Boolean(left.isOwner || isOwnerEmail(left.email)))
      const rightOwner = Number(Boolean(right.isOwner || isOwnerEmail(right.email)))

      if (leftOwner !== rightOwner) {
        return rightOwner - leftOwner
      }

      return String(left.name || "").localeCompare(String(right.name || ""))
    })
  }, [suppliers])

  const selectedSupplier = orderedSuppliers.find((supplier) => supplier.firebaseUID === value)

  if (orderedSuppliers.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0b1220] p-4 text-sm text-slate-300">
        No approved suppliers are available right now.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-600 bg-[#0b1220] px-4 py-4 text-left text-white shadow-[0_10px_28px_rgba(2,8,23,0.24)] transition hover:border-cyan-400/45"
      >
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.18em] text-slate-400">Specific Supplier</p>
          {selectedSupplier ? (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-base font-semibold text-white">
                {selectedSupplier.name || "Selected supplier"}
              </span>
              <OwnerBadge
                email={selectedSupplier.email}
                isOwner={selectedSupplier.isOwner}
                className={selectedSupplier.isOwner ? "" : "hidden"}
                label="Founder"
              />
              <span className="text-sm text-slate-400">
                {selectedSupplier.branch || "Unknown branch"} • Year {selectedSupplier.year || "-"}
              </span>
            </div>
          ) : (
            <p className="mt-1 text-base font-medium text-slate-200">Choose Specific Supplier</p>
          )}
        </div>

        <svg
          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen ? (
        <div className="grid max-h-[24rem] gap-3 overflow-y-auto pr-1">
          {orderedSuppliers.map((supplier) => {
            const isOwner = Boolean(supplier.isOwner || isOwnerEmail(supplier.email))
            const isSelected = value === supplier.firebaseUID
            const photo = getSupplierPhoto(supplier)

            return (
              <div
                key={supplier.firebaseUID}
                onClick={() => {
                  onChange(supplier.firebaseUID)
                  setIsOpen(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onChange(supplier.firebaseUID)
                    setIsOpen(false)
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                className={`relative overflow-hidden rounded-2xl border p-4 text-left transition duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${
                  isOwner
                    ? isSelected
                      ? "border-amber-300/55 bg-[linear-gradient(135deg,#1a1308,#100c07)] shadow-[0_16px_36px_rgba(245,158,11,0.12)]"
                      : "border-amber-400/25 bg-[#161108] hover:border-amber-300/45 hover:shadow-[0_12px_30px_rgba(245,158,11,0.08)]"
                    : isSelected
                    ? "border-cyan-400/55 bg-[#122033] shadow-[0_14px_32px_rgba(6,182,212,0.1)]"
                    : "border-slate-700 bg-[#0f1729] hover:border-slate-500 hover:bg-[#13203a]"
                }`}
              >
                {isOwner ? (
                  <>
                    <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-amber-300/10 blur-3xl" />
                    <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
                  </>
                ) : null}

                <div className="relative flex items-start gap-4">
                  <ProfileAvatar
                    name={supplier.name}
                    photoURL={photo}
                    alt={supplier.name || "Supplier"}
                    isOwner={isOwner}
                    className="h-14 w-14 shrink-0 rounded-2xl"
                    initialsClassName="text-xl"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`truncate ${
                          isOwner
                            ? "text-base font-semibold text-amber-100"
                            : "text-base font-semibold text-white"
                        }`}
                      >
                        {supplier.name || "Unknown supplier"}
                      </p>
                      <OwnerBadge
                        email={supplier.email}
                        isOwner={isOwner}
                        className={isOwner ? "" : "hidden"}
                        label="Founder"
                      />
                    </div>

                    <p className={`mt-1 text-sm ${isOwner ? "text-amber-200/85" : "text-slate-300"}`}>
                      {supplier.branch || "Unknown branch"} • Year {supplier.year || "-"}
                    </p>

                    <p className={`mt-2 text-xs ${isOwner ? "text-amber-300/70" : "text-slate-400"}`}>
                      {isOwner
                        ? "Platform owner profile."
                        : "Approved campus supplier"}
                    </p>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setPreviewSupplier(supplier)
                      }}
                      className={`mt-3 text-xs font-medium underline underline-offset-4 ${
                        isOwner ? "text-amber-200 hover:text-amber-100" : "text-cyan-300 hover:text-cyan-200"
                      }`}
                    >
                      View profile
                    </button>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                      isOwner
                        ? isSelected
                          ? "border border-amber-300/50 bg-amber-300/15 text-amber-100"
                          : "border border-amber-300/30 bg-amber-300/10 text-amber-200"
                        : isSelected
                        ? "border border-cyan-300/45 bg-cyan-400/12 text-cyan-100"
                        : "border border-slate-600 bg-slate-800/70 text-slate-200"
                    }`}
                  >
                    {isSelected ? "Selected" : isOwner ? "Owner" : "Available"}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {previewSupplier ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close supplier profile preview"
            onClick={() => setPreviewSupplier(null)}
          />

          <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#0f1422]/96 p-6 shadow-2xl">
            <ProfileCard
              title={previewSupplier.isOwner ? "Platform Owner" : "Supplier Profile"}
              profile={previewSupplier}
            />

            <button
              type="button"
              onClick={() => setPreviewSupplier(null)}
              className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 font-semibold text-white transition hover:opacity-90"
            >
              Close Profile
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
