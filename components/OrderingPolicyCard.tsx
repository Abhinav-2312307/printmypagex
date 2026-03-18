"use client"

import { useState } from "react"
import {
  ChevronDown,
  Clock3,
  GraduationCap,
  Info,
  MapPinned,
  PhoneCall
} from "lucide-react"

const ORDERING_POLICIES = [
  {
    title: "PSIT students only",
    body: "This service is only for PSIT students. Students from other colleges should not place orders.",
    icon: GraduationCap
  },
  {
    title: "Order one day in advance",
    body: "Place your order at least one day before you need it so the supplier can bring the prints to campus.",
    icon: Clock3
  },
  {
    title: "Supplier details appear after acceptance",
    body: "Once your order is accepted, you will be able to see the supplier details inside your order view.",
    icon: Info
  },
  {
    title: "Contact and collect on campus next day",
    body: "Please contact your supplier for reminders if needed and collect your print from the supplier on campus the next day.",
    icon: PhoneCall
  }
]

type OrderingPolicyCardProps = {
  className?: string
}

export default function OrderingPolicyCard({ className = "" }: OrderingPolicyCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section
      className={`rounded-[2rem] border border-amber-200/70 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,255,255,0.88))] p-5 shadow-[0_20px_50px_rgba(217,119,6,0.08)] backdrop-blur-2xl dark:border-amber-300/15 dark:bg-[linear-gradient(135deg,rgba(46,27,7,0.9),rgba(17,24,39,0.86))] ${className}`.trim()}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-200">
            <MapPinned className="h-5 w-5" />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-600 dark:text-amber-200">
              Important Before Ordering
            </p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-white">
              PSIT-only printing with next-day campus pickup
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Only PSIT students should order here, and every order should be placed at least one day earlier so the supplier can bring the print.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-300/70 bg-white/80 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50 dark:border-amber-200/20 dark:bg-white/10 dark:text-amber-100 dark:hover:bg-white/15"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/15">
            <Info className="h-4 w-4" />
          </span>
          {expanded ? "Hide details" : "Read details"}
          <ChevronDown className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {ORDERING_POLICIES.map((item) => {
            const Icon = item.icon

            return (
              <div
                key={item.title}
                className="rounded-2xl border border-white/70 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-200">
                    <Icon className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
