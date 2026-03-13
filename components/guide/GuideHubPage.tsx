"use client"

import { useDeferredValue, useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion } from "framer-motion"
import HeroBackground from "@/components/HeroBackground"
import type { FAQItem } from "@/lib/faq-content"
import type { GuidePageContent, GuideStep } from "@/lib/guide-content"
import LiquidGlassPanel from "@/components/guide/LiquidGlassPanel"

type GuideHubPageProps = {
  content: GuidePageContent
  faqItems: FAQItem[]
  updatedAt: string | null
}

function formatUpdatedAt(value: string | null) {
  if (!value) return "Showing the latest default FAQ set"

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Showing the latest FAQ set"

  return `Admin updated on ${date.toLocaleDateString()}`
}

function renderStepCard(step: GuideStep) {
  return (
    <LiquidGlassPanel className="p-6 md:p-7">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-indigo-500 dark:text-cyan-300">
          {step.eyebrow}
        </p>
        <h3 className="mt-3 text-2xl font-semibold">{step.title}</h3>
      </div>

      <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-300">
        {step.description}
      </p>

      {step.note ? (
        <div className="mt-5 rounded-[1.4rem] border border-white/50 bg-white/60 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-black/20 dark:text-gray-300">
          {step.note}
        </div>
      ) : null}

      {step.branches?.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {step.branches.map((branch) => (
            <div
              key={branch.title}
              className="rounded-[1.5rem] border border-white/40 bg-white/70 p-4 backdrop-blur-xl dark:border-white/10 dark:bg-black/20"
            >
              <span className="inline-flex rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">
                {branch.badge}
              </span>
              <h4 className="mt-3 text-lg font-semibold">{branch.title}</h4>
              <p className="mt-2 text-sm leading-7 text-gray-600 dark:text-gray-300">
                {branch.description}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </LiquidGlassPanel>
  )
}

function FaqAccordion({ items }: { items: FAQItem[] }) {
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState(items[0]?.id || "")
  const deferredQuery = useDeferredValue(query)

  const filteredItems = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()

    if (!normalized) {
      return items
    }

    return items.filter((item) => {
      const haystack = `${item.question} ${item.answer} ${item.badge || ""}`.toLowerCase()
      return haystack.includes(normalized)
    })
  }, [deferredQuery, items])

  return (
    <div className="space-y-4">
      <LiquidGlassPanel className="p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">Search FAQ</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              Find a question by keyword, issue, payment step, or process detail.
            </p>
          </div>

          <div className="relative w-full max-w-xl">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0a7 7 0 0114 0z" />
            </svg>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search questions like payment, lag, page count, wallet..."
              className="w-full rounded-[1.35rem] border border-white/45 bg-white/70 py-3 pl-11 pr-4 text-sm text-gray-800 backdrop-blur-xl outline-none transition focus:border-indigo-300/70 dark:border-white/10 dark:bg-black/25 dark:text-white"
            />
          </div>
        </div>

        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          {filteredItems.length} of {items.length} questions visible
        </p>
      </LiquidGlassPanel>

      {filteredItems.length === 0 ? (
        <LiquidGlassPanel className="p-6 md:p-7">
          <p className="text-lg font-semibold">No matching FAQ found</p>
          <p className="mt-2 text-sm leading-7 text-gray-600 dark:text-gray-300">
            Try a simpler keyword like payment, supplier, approval, wallet, lag, or page count.
          </p>
        </LiquidGlassPanel>
      ) : null}

      {filteredItems.map((item, index) => {
        const open = openId === item.id

        return (
          <LiquidGlassPanel key={item.id} className="p-1">
            <button
              onClick={() => setOpenId(open ? "" : item.id)}
              className="flex w-full items-start justify-between gap-4 rounded-[1.8rem] px-5 py-5 text-left md:px-6"
            >
              <div>
                {item.badge ? (
                  <span className="inline-flex rounded-full border border-indigo-300/35 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-700 dark:text-indigo-200">
                    {item.badge}
                  </span>
                ) : null}
                <h3 className="mt-3 text-lg font-semibold md:text-xl">
                  {index + 1}. {item.question}
                </h3>
              </div>

              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/50 bg-white/60 text-xl dark:border-white/10 dark:bg-white/10">
                {open ? "−" : "+"}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {open ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-6 pt-1 md:px-6">
                    <p className="rounded-[1.4rem] border border-white/45 bg-white/55 px-4 py-4 text-sm leading-7 text-gray-700 backdrop-blur-xl dark:border-white/10 dark:bg-black/30 dark:text-gray-300">
                      {item.answer}
                    </p>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </LiquidGlassPanel>
        )
      })}
    </div>
  )
}

export default function GuideHubPage({
  content,
  faqItems,
  updatedAt
}: GuideHubPageProps) {
  return (
    <div className="relative overflow-hidden pb-20">
      <section className="relative px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-12">
        <HeroBackground />

        <div className="relative mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="rounded-[2.25rem] border border-white/45 bg-white/70 px-6 py-8 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur-3xl dark:border-white/10 dark:bg-white/5 md:px-10 md:py-12"
          >
            <div className="flex flex-wrap gap-3">
              {content.heroBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-white/50 bg-white/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200"
                >
                  {badge}
                </span>
              ))}
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-indigo-500 dark:text-cyan-300">
                  Transparent Portal Guide
                </p>
                <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
                  {content.title}
                </h1>
                <p className="mt-4 max-w-2xl text-lg text-gray-700 dark:text-gray-300">
                  {content.subtitle}
                </p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-400">
                  {content.description}
                </p>

                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href={content.primaryCta.href}
                    className="rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3 text-sm font-medium text-white transition hover:scale-[1.02]"
                  >
                    {content.primaryCta.label}
                  </Link>
                  <Link
                    href={content.secondaryCta.href}
                    className="rounded-2xl border border-white/50 bg-white/70 px-6 py-3 text-sm font-medium backdrop-blur-xl transition hover:bg-white/90 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
                  >
                    {content.secondaryCta.label}
                  </Link>
                </div>
              </div>

              <LiquidGlassPanel className="p-6">
                <p className="text-xs uppercase tracking-[0.22em] text-indigo-500 dark:text-cyan-300">
                  Why this guide exists
                </p>
                <p className="mt-4 text-lg leading-8 text-gray-700 dark:text-gray-300">
                  {content.trustStrip}
                </p>
                <p className="mt-6 text-xs uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
                  {formatUpdatedAt(updatedAt)}
                </p>
              </LiquidGlassPanel>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto grid max-w-6xl gap-5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          {content.highlights.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.35, delay: index * 0.06 }}
            >
              <LiquidGlassPanel className="h-full p-6">
                <span className="inline-flex rounded-full border border-white/50 bg-white/65 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200">
                  {item.badge}
                </span>
                <h2 className="mt-4 text-2xl font-semibold">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
                  {item.description}
                </p>
              </LiquidGlassPanel>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-4 py-10 md:px-6 md:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-indigo-500 dark:text-cyan-300">
              Diagram View
            </p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              workflow map
            </h2>
            <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-300">
              Follow the flow in order. The connected cards below reflect the actual movement of an order across the portal.
            </p>
          </div>

          <div className="relative mt-10 space-y-8">
            <div className="absolute bottom-0 left-1/2 top-0 hidden w-px -translate-x-1/2 bg-gradient-to-b from-indigo-400/10 via-cyan-400/70 to-indigo-400/10 md:block" />

            {content.steps.map((step, index) => {
              const alignLeft = index % 2 === 0
              const isBranchStep = Boolean(step.branches?.length)
              const stepNumber = String(index + 1).padStart(2, "0")

              if (isBranchStep) {
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.35 }}
                    className="relative"
                  >
                    <div className="mb-4 flex justify-center">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/50 bg-white/70 text-sm font-bold shadow-[0_16px_50px_rgba(129,140,248,0.25)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/10">
                        {stepNumber}
                      </div>
                    </div>
                    {renderStepCard(step)}
                  </motion.div>
                )
              }

              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.24 }}
                  transition={{ duration: 0.35 }}
                  className="grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center"
                >
                  {alignLeft ? (
                    renderStepCard(step)
                  ) : (
                    <div className="hidden md:block" />
                  )}

                  <div className="flex justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/50 bg-white/70 text-sm font-bold shadow-[0_16px_50px_rgba(129,140,248,0.25)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/10">
                      {stepNumber}
                    </div>
                  </div>

                  {alignLeft ? (
                    <div className="hidden md:block" />
                  ) : (
                    renderStepCard(step)
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-6 md:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.24em] text-indigo-500 dark:text-cyan-300">
              Frequently Asked Questions
            </p>
            <h2 className="mt-3 text-3xl font-bold md:text-4xl">
              Important answers, clearly stated
            </h2>
            <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-300">
              These answers mix real feedback themes with practical guidance so users and suppliers know why the workflow is structured this way.
            </p>
          </div>

          <div className="mt-8">
            <FaqAccordion items={faqItems} />
          </div>
        </div>
      </section>

      <section className="px-4 pt-8 md:px-6">
        <div className="mx-auto max-w-5xl">
          <LiquidGlassPanel className="p-8 text-center md:p-10">
            <p className="text-xs uppercase tracking-[0.22em] text-indigo-500 dark:text-cyan-300">
              Final Note
            </p>
            <h2 className="mt-3 text-3xl font-bold">{content.closingTitle}</h2>
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-300">
              {content.closingText}
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href={content.primaryCta.href}
                className="rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3 text-sm font-medium text-white transition hover:scale-[1.02]"
              >
                {content.primaryCta.label}
              </Link>
              <Link
                href="/contact"
                className="rounded-2xl border border-white/50 bg-white/70 px-6 py-3 text-sm font-medium backdrop-blur-xl transition hover:bg-white/90 dark:border-white/10 dark:bg-white/10 dark:hover:bg-white/15"
              >
                Contact Admin
              </Link>
            </div>
          </LiquidGlassPanel>
        </div>
      </section>
    </div>
  )
}
