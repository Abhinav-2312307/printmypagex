import GuideHubPage from "@/components/guide/GuideHubPage"
import { getFaqContentSnapshot } from "@/lib/faq-store"
import { supplierGuideContent } from "@/lib/guide-content"

export const dynamic = "force-dynamic"

export default async function SupplierFaqPage() {
  const content = await getFaqContentSnapshot()

  return (
    <main className="overflow-x-hidden bg-transparent text-gray-900 dark:bg-black dark:text-white">
      <GuideHubPage
        content={supplierGuideContent}
        faqItems={content.supplierFaqs}
        updatedAt={content.updatedAt}
      />
    </main>
  )
}
