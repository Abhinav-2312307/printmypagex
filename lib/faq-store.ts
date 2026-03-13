import { connectDB } from "@/lib/mongodb"
import FaqContent from "@/models/FaqContent"
import {
  defaultFaqContentSnapshot,
  sanitizeFaqContentSnapshot,
  type FAQContentSnapshot
} from "@/lib/faq-content"

type FaqDoc = {
  userFaqs?: FAQContentSnapshot["userFaqs"]
  supplierFaqs?: FAQContentSnapshot["supplierFaqs"]
  updatedAt?: Date | string | null
}

export async function getFaqContentSnapshot(): Promise<FAQContentSnapshot> {
  await connectDB()

  const doc = (await FaqContent.findOne({ key: "main" }).lean()) as FaqDoc | null

  if (!doc) {
    return defaultFaqContentSnapshot
  }

  return sanitizeFaqContentSnapshot({
    userFaqs: doc.userFaqs,
    supplierFaqs: doc.supplierFaqs,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null
  })
}

export async function saveFaqContentSnapshot(
  value: Partial<FAQContentSnapshot>
): Promise<FAQContentSnapshot> {
  await connectDB()

  const sanitized = sanitizeFaqContentSnapshot(value)

  const doc = await FaqContent.findOneAndUpdate(
    { key: "main" },
    {
      key: "main",
      userFaqs: sanitized.userFaqs,
      supplierFaqs: sanitized.supplierFaqs
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).lean<FaqDoc>()

  return sanitizeFaqContentSnapshot({
    userFaqs: doc?.userFaqs,
    supplierFaqs: doc?.supplierFaqs,
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null
  })
}
