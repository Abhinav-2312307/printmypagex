type FeedbackLoopItem = {
  quote: string
  rating: number
}

type FeedbackLoopShowcaseProps = {
  averageRating: number
  feedbackCount: number
  topHighlights: string[]
  items: FeedbackLoopItem[]
}

function renderStars(rating: number) {
  const fullStars = Math.max(0, Math.min(5, Math.round(rating)))
  return `${"★".repeat(fullStars)}${"☆".repeat(5 - fullStars)}`
}

function FeedbackCard({ item }: { item: FeedbackLoopItem }) {
  return (
    <article
      className="mx-2.5 flex h-[12.75rem] w-[17rem] shrink-0 flex-col justify-between overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(238,246,255,0.9))] p-5 shadow-[0_14px_40px_rgba(60,88,142,0.16)] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(16,24,39,0.96),rgba(13,24,43,0.9))] sm:w-[19rem] lg:w-[21rem]"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-amber-300/40 bg-amber-100/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-200">
          {item.rating.toFixed(1)} / 5
        </span>
        <span className="text-sm tracking-[0.12em] text-amber-500 dark:text-amber-300">
          {renderStars(item.rating)}
        </span>
      </div>

      <p
        className="mt-4 text-sm leading-7 text-slate-700 dark:text-slate-100 sm:text-[15px]"
        style={{
          display: "-webkit-box",
          WebkitBoxOrient: "vertical",
          WebkitLineClamp: 4,
          overflow: "hidden"
        }}
      >
        &ldquo;{item.quote}&rdquo;
      </p>

      <div className="mt-5 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.24em] text-slate-400 dark:text-white/45">
        <span>Campus Voice</span>
        <span>Live Feedback</span>
      </div>
    </article>
  )
}

function FeedbackTrack({
  items,
  reverse = false
}: {
  items: FeedbackLoopItem[]
  reverse?: boolean
}) {
  const trackItems = items.length ? [...items, ...items] : []

  return (
    <div className="feedback-marquee-shell min-w-0">
      <div className={`feedback-marquee ${reverse ? "feedback-marquee-reverse" : ""}`}>
        {trackItems.map((item, index) => (
          <FeedbackCard key={`${item.quote}-${index}`} item={item} />
        ))}
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sublabel,
  emphasis = "soft"
}: {
  label: string
  value: string
  sublabel: string
  emphasis?: "soft" | "dark"
}) {
  const containerClass =
    emphasis === "dark"
      ? "border-white/10 bg-[linear-gradient(160deg,rgba(15,23,42,0.95),rgba(12,18,32,0.9))] text-white shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
      : "border-slate-200/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.97),rgba(235,245,255,0.9))] text-slate-900 shadow-[0_18px_40px_rgba(74,98,145,0.12)] dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(28,50,86,0.32),rgba(13,20,34,0.86))] dark:text-white"

  const labelClass =
    emphasis === "dark"
      ? "text-white/60"
      : "text-slate-500 dark:text-slate-300/75"

  const sublabelClass =
    emphasis === "dark"
      ? "text-white/72"
      : "text-slate-500 dark:text-slate-300/75"

  return (
    <div className={`rounded-[28px] border p-5 sm:p-6 ${containerClass}`}>
      <p className={`text-xs uppercase tracking-[0.24em] ${labelClass}`}>{label}</p>
      <p className="mt-3 text-4xl font-black leading-none sm:text-5xl">{value}</p>
      <p className={`mt-3 text-sm leading-6 ${sublabelClass}`}>{sublabel}</p>
    </div>
  )
}

export default function FeedbackLoopShowcase({
  averageRating,
  feedbackCount,
  topHighlights,
  items
}: FeedbackLoopShowcaseProps) {
  const primaryItems = items.slice(0, Math.max(1, Math.ceil(items.length / 2)))
  const secondaryItems = items.slice(Math.ceil(items.length / 2))
  const fallbackSecondary = secondaryItems.length ? secondaryItems : primaryItems

  return (
    <section className="relative py-20 md:py-28">
      <div className="pointer-events-none absolute inset-x-0 top-10 h-44 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.12),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.12),transparent_60%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="overflow-hidden rounded-[34px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.75),rgba(241,247,255,0.7))] shadow-[0_24px_70px_rgba(56,78,122,0.14)] backdrop-blur-2xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(9,14,24,0.92),rgba(7,11,20,0.96))]">
          <div className="relative px-5 py-8 sm:px-8 sm:py-10 md:px-10">
            <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-400/10" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-36 w-36 rounded-full bg-indigo-300/20 blur-3xl dark:bg-indigo-500/10" />

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)] lg:items-end">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.34em] text-indigo-500 dark:text-cyan-300">
                  Campus Feedback Loop
                </p>
                <h2 className="mt-4 text-3xl font-bold leading-tight text-slate-900 dark:text-white md:text-5xl">
                  The lower half now feels like
                  <span className="block bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 bg-clip-text text-transparent">
                    a live pulse of campus sentiment
                  </span>
                </h2>
                <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300 md:text-base">
                  We only surface the strongest parts of real feedback here: the average rating,
                  standout praise themes, and short snippets that keep moving without turning the
                  landing page into a giant testimonials dump.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  {topHighlights.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-slate-200/90 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 shadow-sm dark:border-white/10 dark:bg-white/6 dark:text-slate-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="rounded-[28px] border border-slate-200/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(233,243,255,0.92))] p-5 shadow-[0_18px_40px_rgba(74,98,145,0.12)] dark:border-white/10 dark:bg-[linear-gradient(160deg,rgba(36,66,115,0.26),rgba(13,20,34,0.9))]">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-300/75">
                    Average Rating
                  </p>
                  <div className="mt-3 flex items-end gap-3">
                    <span className="text-4xl font-black leading-none text-slate-900 dark:text-white sm:text-5xl">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="pb-1 text-sm font-medium text-slate-500 dark:text-slate-300/75">
                      / 5.0
                    </span>
                  </div>
                  <p className="mt-3 text-sm tracking-[0.16em] text-amber-500 dark:text-amber-300">
                    {renderStars(averageRating)}
                  </p>
                </div>

                <StatCard
                  label="Responses"
                  value={String(feedbackCount)}
                  sublabel="public notes collected so far"
                  emphasis="dark"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200/70 bg-[linear-gradient(180deg,rgba(244,249,255,0.96),rgba(236,245,255,0.9))] px-0 py-6 dark:border-white/10 dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.08),transparent_36%),linear-gradient(180deg,rgba(8,14,26,0.72),rgba(5,8,16,0.96))] sm:py-8">
            <div className="space-y-4 sm:space-y-5">
              <FeedbackTrack items={primaryItems} />
              <FeedbackTrack items={fallbackSecondary} reverse />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
