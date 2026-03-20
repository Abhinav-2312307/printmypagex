import Navbar from "@/components/Navbar"
import SmoothScroll from "@/components/SmoothScroll"
import FeatureCard from "@/components/FeatureCard"
import OrderFlow from "@/components/OrderFlow"
import HeroBackground from "@/components/HeroBackground"
import FeedbackLoopShowcase from "@/components/FeedbackLoopShowcase"
import Link from "next/link"
import CursorDepth from "@/components/CursorDepth"
import CurrentYear from "@/components/CurrentYear"
import { FEEDBACK_ASPECTS, type FeedbackAspectKey } from "@/lib/feedback"
import { connectDB } from "@/lib/mongodb"
import Feedback from "@/models/Feedback"
import { getPlatformSettings } from "@/lib/platform-settings"

export const dynamic = "force-dynamic"

type LandingFeedbackRecord = {
  message?: string
  overallRating?: number
  uiRating?: number
  easeOfUseRating?: number
  workflowRating?: number
  effectivenessRating?: number
  performanceRating?: number
  stabilityRating?: number
}

const FEEDBACK_HIGHLIGHT_LABELS: Record<FeedbackAspectKey, string> = {
  uiRating: "Polished visual feel",
  easeOfUseRating: "Easy to use",
  workflowRating: "Smooth workflow",
  effectivenessRating: "Gets work done",
  performanceRating: "Fast experience",
  stabilityRating: "Feels stable"
}

function createFeedbackSnippet(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim()

  if (!normalized) return ""

  const firstSentence = normalized.split(/(?<=[.!?])\s+/)[0] || normalized
  const compact = firstSentence.replace(/^["'`]+|["'`]+$/g, "")

  if (compact.length <= 110) return compact

  return `${compact.slice(0, 107).trimEnd()}...`
}

async function getFeedbackShowcaseData() {
  await connectDB()

  const [feedbackRows, summaryRows] = await Promise.all([
    Feedback.find({})
      .sort({ createdAt: -1 })
      .limit(16)
      .select("message overallRating")
      .lean<LandingFeedbackRecord[]>(),
    Feedback.aggregate<{
      _id: null
      total: number
      averageRating: number
      uiRating: number
      easeOfUseRating: number
      workflowRating: number
      effectivenessRating: number
      performanceRating: number
      stabilityRating: number
    }>([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          averageRating: { $avg: "$overallRating" },
          uiRating: { $avg: "$uiRating" },
          easeOfUseRating: { $avg: "$easeOfUseRating" },
          workflowRating: { $avg: "$workflowRating" },
          effectivenessRating: { $avg: "$effectivenessRating" },
          performanceRating: { $avg: "$performanceRating" },
          stabilityRating: { $avg: "$stabilityRating" }
        }
      }
    ])
  ])

  const summary = summaryRows[0]

  if (!summary || summary.total < 1) {
    return {
      averageRating: 5,
      feedbackCount: 0,
      topHighlights: ["Campus ready", "Clean workflow", "Fast feel"],
      items: [
        { quote: "Early visitors are starting to share how the flow feels in real use.", rating: 5 },
        { quote: "This space will turn live feedback into a moving wall of short campus reactions.", rating: 5 },
        { quote: "Once more responses arrive, the landing page will update itself with real quotes.", rating: 5 }
      ]
    }
  }

  const topHighlights = FEEDBACK_ASPECTS.map((aspect) => ({
    key: aspect.key,
    value: Number(summary[aspect.key] || 0)
  }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 3)
    .map((aspect) => FEEDBACK_HIGHLIGHT_LABELS[aspect.key])

  const seen = new Set<string>()
  const items = feedbackRows
    .map((item) => ({
      quote: createFeedbackSnippet(String(item.message || "")),
      rating: Number(item.overallRating || 0)
    }))
    .filter((item) => item.quote && item.rating > 0)
    .filter((item) => {
      if (seen.has(item.quote)) return false
      seen.add(item.quote)
      return true
    })
    .slice(0, 12)

  return {
    averageRating: Math.round(Number(summary.averageRating || 0) * 10) / 10,
    feedbackCount: Number(summary.total || 0),
    topHighlights,
    items: items.length
      ? items
      : [
          { quote: "Visitors are liking the overall experience and sharing strong early impressions.", rating: 5 }
        ]
  }
}

export default async function Home(){
const [feedbackShowcase, platformSettings] = await Promise.all([
  getFeedbackShowcaseData(),
  getPlatformSettings()
])

return(

<main className="bg-transparent dark:bg-black text-gray-900 dark:text-white overflow-x-hidden">

<SmoothScroll/>
<CursorDepth/>
<Navbar
navButtons={[
{
label:"Feedback",
href:"/feedback",
variant:"glass"
},
{
label:"FAQ + Flow",
href:"/faq",
variant:"accent"
},
{
label:"Contact",
href:"/contact",
variant:"contact"
}
]}/>

{/* HERO */}

<section className="relative px-6 py-24 text-center sm:py-32 md:py-40">

<HeroBackground/>

<h1 className="relative text-4xl font-bold leading-tight sm:text-6xl md:text-7xl">

Your Campus Print Partner

<br/>

<span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">

Fast. Simple. Reliable.

</span>

</h1>

<p className="mx-auto mt-6 max-w-xl text-sm text-gray-600 dark:text-gray-400 sm:text-base">
Upload your documents today, pick up your prints tomorrow on campus.
</p>

<div className="mt-10 flex flex-wrap justify-center gap-4 sm:gap-6">

<Link
href="/user/dashboard"
className="rounded-2xl border border-white/20 bg-white/70 px-6 py-3 backdrop-blur-xl transition hover:scale-105 dark:bg-white/10 sm:px-8 sm:py-4"
>
Start Printing
</Link>

<Link
href="/supplier"
className="rounded-2xl border border-white/20 px-6 py-3 backdrop-blur-xl transition hover:bg-indigo-500 hover:text-white sm:px-8 sm:py-4"
>
Become Supplier
</Link>

</div>

</section>


{/* FEATURES */}

<section className="py-20 md:py-32">

<h2 className="mb-14 text-center text-3xl font-bold md:mb-20 md:text-4xl">
Why PrintMyPage
</h2>

<div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3 md:gap-10">

<FeatureCard
title="Instant Matching"
desc="Your order instantly reaches all campus suppliers — or choose your favorite ❤️ one."
direction="left"
/>

<FeatureCard
title="Live Tracking"
desc="Track the print progress in real time."
direction="bottom"
/>

<FeatureCard
title="Campus Approved"
desc="Real student feedback keeps the experience sharper every week."
direction="right"
/>

</div>

</section>


{/* ORDER FLOW */}

<OrderFlow/>


{platformSettings.landingFeedbackVisible ? (
<FeedbackLoopShowcase
averageRating={feedbackShowcase.averageRating}
feedbackCount={feedbackShowcase.feedbackCount}
topHighlights={feedbackShowcase.topHighlights}
items={feedbackShowcase.items}
/>
) : null}


{/* CTA */}

<section className="py-24 text-center md:py-40">

<h2 className="mb-6 text-3xl font-bold md:text-4xl">
Start Printing Today
</h2>

<p className="text-gray-500 mb-8">
Fast campus printing in seconds.
</p>

<Link
href="/user/dashboard"
className="rounded-2xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-8 py-3 text-white transition hover:scale-105 sm:px-10 sm:py-4"
>
Create Order
</Link>

</section>


<footer className="border-t border-gray-200 dark:border-gray-800 py-10 text-center text-gray-500">

© <CurrentYear /> PrintMyPage

</footer>

</main>

)
}
