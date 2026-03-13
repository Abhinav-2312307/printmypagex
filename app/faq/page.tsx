import Navbar from "@/components/Navbar"
import SmoothScroll from "@/components/SmoothScroll"
import CursorDepth from "@/components/CursorDepth"
import GuideHubPage from "@/components/guide/GuideHubPage"
import { getFaqContentSnapshot } from "@/lib/faq-store"
import { userGuideContent } from "@/lib/guide-content"

export const dynamic = "force-dynamic"

export default async function UserFaqPage() {
  const content = await getFaqContentSnapshot()

  return (
    <main className="overflow-x-hidden bg-transparent text-gray-900 dark:bg-black dark:text-white">
      <SmoothScroll />
      <CursorDepth />
      <Navbar
        navButtons={[
          {
            label: "Back Home",
            href: "/",
            variant: "back"
          },
          {
            label: "Pricing",
            href: "/pricing",
            variant: "glass"
          },
          {
            label: "Contact",
            href: "/contact",
            variant: "contact"
          }
        ]}
      />

      <GuideHubPage
        content={userGuideContent}
        faqItems={content.userFaqs}
        updatedAt={content.updatedAt}
      />
    </main>
  )
}
