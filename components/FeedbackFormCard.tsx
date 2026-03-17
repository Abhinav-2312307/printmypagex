"use client"

import { FormEvent, useEffect, useState } from "react"
import { Star } from "lucide-react"
import {
  computeOverallFeedbackRating,
  FEEDBACK_ASPECTS,
  FeedbackAspectKey,
  FeedbackRatings
} from "@/lib/feedback"

type SubmitStatus = {
  type: "success" | "error"
  message: string
} | null

const ratingLabels = ["Poor", "Fair", "Good", "Very good", "Excellent"]

function createEmptyRatings() {
  return FEEDBACK_ASPECTS.reduce((acc, aspect) => {
    acc[aspect.key] = 0
    return acc
  }, {} as FeedbackRatings)
}

function FeedbackThankYouCard({ onReset }: { onReset: () => void }) {
  const [opened, setOpened] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setOpened(true), 120)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div
        className="card cursor-pointer"
        onClick={() => setOpened((current) => !current)}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            setOpened((current) => !current)
          }
        }}
        aria-label="Open thank you card"
      >
        <div className="relative flex aspect-video w-[300px] items-center justify-center bg-black sm:w-[350px]">
          <div
            className={`absolute h-full w-full bg-white transition-all duration-1000 ${
              opened ? "-translate-y-16" : ""
            } flex flex-col items-center justify-start py-5`}
          >
            <p className="font-serif text-xl font-semibold text-gray-500 sm:text-2xl">
              Thank You
            </p>
            <p className="px-10 text-[10px] text-gray-700 sm:text-[12px]">
              It&apos;s so nice that you had the time to view this idea
            </p>
            <p className="font-serif text-[10px] text-gray-700 sm:text-[12px]">
              Wishing you a fantastic day ahead!
            </p>
            <p className="pt-5 font-sans text-[10px] text-gray-700">
              SMOOKYDEV
            </p>
          </div>

          <button
            type="button"
            tabIndex={-1}
            className={`seal z-40 flex aspect-square w-10 items-center justify-center rounded-full border-4 border-rose-900 bg-rose-500 text-[10px] font-semibold text-red-800 transition-all duration-1000 [clip-path:polygon(50%_0%,_80%_10%,_100%_35%,_100%_70%,_80%_90%,_50%_100%,_20%_90%,_0%_70%,_0%_35%,_20%_10%)] ${
              opened ? "scale-0 rotate-180 opacity-0" : ""
            }`}
          >
            SMKY
          </button>

          <div
            className={`tp absolute h-full w-full bg-neutral-800 transition-all ${
              opened
                ? "duration-200 [clip-path:polygon(50%_0%,_100%_0,_0_0)]"
                : "duration-1000 [clip-path:polygon(50%_50%,_100%_0,_0_0)]"
            }`}
          />
          <div className="lft absolute h-full w-full bg-neutral-900 [clip-path:polygon(50%_50%,_0_0,_0_100%)]" />
          <div className="rgt absolute h-full w-full bg-neutral-800 [clip-path:polygon(50%_50%,_100%_0,_100%_100%)]" />
          <div className="btm absolute h-full w-full bg-neutral-900 [clip-path:polygon(50%_50%,_100%_100%,_0_100%)]" />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Your feedback has been saved. Tap the card to replay the envelope animation.
        </p>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-gray-300 bg-white/80 px-5 py-2 text-sm font-medium text-gray-700 backdrop-blur-md transition hover:bg-gray-200 dark:border-white/20 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
        >
          Share another response
        </button>
      </div>
    </div>
  )
}

export default function FeedbackFormCard() {
  const [ratings, setRatings] = useState<FeedbackRatings>(createEmptyRatings)
  const [hovered, setHovered] = useState<Partial<Record<FeedbackAspectKey, number>>>({})
  const [message, setMessage] = useState("")
  const [website, setWebsite] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [status, setStatus] = useState<SubmitStatus>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submittedOverall, setSubmittedOverall] = useState(0)

  const overallRating = computeOverallFeedbackRating(ratings)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (isSubmitting) return

    const hasMissingRating = FEEDBACK_ASPECTS.some(
      (aspect) => Number(ratings[aspect.key]) < 1
    )

    if (hasMissingRating) {
      setStatus({
        type: "error",
        message: "Please rate every aspect before submitting."
      })
      return
    }

    if (message.trim().length < 10) {
      setStatus({
        type: "error",
        message: "Please share at least 10 characters in the feedback message."
      })
      return
    }

    setIsSubmitting(true)
    setStatus(null)

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...ratings,
          message: message.trim(),
          website: website.trim()
        })
      })

      const data = await res.json().catch(() => null)

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Unable to submit feedback.")
      }

      setSubmittedOverall(overallRating)
      setSubmitted(true)
      setStatus({
        type: "success",
        message: data?.message || "Thanks for sharing your feedback."
      })
      setRatings(createEmptyRatings())
      setHovered({})
      setMessage("")
      setWebsite("")
    } catch (error) {
      setStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again."
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="relative w-full max-w-[40rem] rounded-[32px] border border-gray-200 bg-white/70 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
        <div className="mb-6 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-indigo-500 dark:text-cyan-300">
            Feedback Submitted
          </p>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
            You just rated PrintMyPage {submittedOverall.toFixed(1)}/5
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            Every response helps us improve the UI, workflow, and bug fixes.
          </p>
        </div>

        <FeedbackThankYouCard
          onReset={() => {
            setSubmitted(false)
            setStatus(null)
          }}
        />
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="relative w-full max-w-[40rem] space-y-6 rounded-[32px] border border-gray-200 bg-white/70 px-6 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-2xl dark:border-white/10 dark:bg-white/5 sm:px-8 sm:py-10"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-indigo-500 dark:text-cyan-300">
            Public Feedback Form
          </p>
          <h2 className="mt-2 text-2xl font-semibold">
            Rate the experience
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            No login is required. Please rate every section and add one message at the end.
          </p>
        </div>

        <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm">
          <p className="text-gray-600 dark:text-gray-300">Current overall</p>
          <p className="mt-1 text-2xl font-semibold text-indigo-500 dark:text-cyan-300">
            {overallRating > 0 ? overallRating.toFixed(1) : "0.0"}/5
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {FEEDBACK_ASPECTS.map((aspect) => {
          const activeValue = hovered[aspect.key] || ratings[aspect.key] || 0

          return (
            <div
              key={aspect.key}
              className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-white/10 dark:bg-black/20"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-semibold">{aspect.label}</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {aspect.description}
                  </p>
                </div>

                <span className="rounded-full border border-gray-200 bg-white/90 px-3 py-1 text-sm font-medium dark:border-white/10 dark:bg-white/5">
                  {activeValue > 0 ? `${activeValue}/5` : "Not rated"}
                </span>
              </div>

              <div
                className="mt-4 flex flex-wrap items-center gap-2"
                onMouseLeave={() =>
                  setHovered((current) => ({ ...current, [aspect.key]: 0 }))
                }
              >
                {Array.from({ length: 5 }, (_, index) => {
                  const value = index + 1
                  const filled = value <= activeValue

                  return (
                    <button
                      key={`${aspect.key}-${value}`}
                      type="button"
                      onMouseEnter={() =>
                        setHovered((current) => ({
                          ...current,
                          [aspect.key]: value
                        }))
                      }
                      onClick={() =>
                        setRatings((current) => ({
                          ...current,
                          [aspect.key]: value
                        }))
                      }
                      className="rounded-full p-1 transition hover:scale-110"
                      aria-label={`Rate ${aspect.label} ${value} star${value > 1 ? "s" : ""}`}
                    >
                      <Star
                        className={`h-7 w-7 ${
                          filled
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-300 dark:text-gray-600"
                        }`}
                      />
                    </button>
                  )
                })}

                <span className="ml-1 text-sm text-gray-600 dark:text-gray-300">
                  {activeValue > 0 ? ratingLabels[activeValue - 1] : "Tap a star to rate"}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 dark:border-white/10 dark:bg-black/20">
        <label htmlFor="feedback-message" className="font-semibold">
          Feedback message
        </label>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
          Tell us what felt great, what felt confusing, and any performance issue or bug you noticed.
        </p>
        <textarea
          id="feedback-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Example: The UI looks clean, but the workflow can be clearer on mobile and the upload step felt a little slow."
          minLength={10}
          maxLength={1500}
          required
          className="mt-4 h-36 w-full resize-none rounded-2xl border border-gray-300 bg-transparent px-4 py-3 outline-none transition focus:border-indigo-400 dark:border-white/20"
        />
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
          <span>Minimum 10 characters</span>
          <span>{message.trim().length}/1500</span>
        </div>
      </div>

      <div
        className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden"
        aria-hidden="true"
      >
        <label htmlFor="feedback-website">Website</label>
        <input
          id="feedback-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Your response will be stored for the admin team to review.
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-6 py-3 font-medium text-white shadow-lg transition hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </div>

      {status ? (
        <p
          role="status"
          aria-live="polite"
          className={`text-sm ${
            status.type === "success" ? "text-emerald-500" : "text-rose-500"
          }`}
        >
          {status.message}
        </p>
      ) : null}
    </form>
  )
}
