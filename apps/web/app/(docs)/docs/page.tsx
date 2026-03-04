import type { Metadata } from "next"
import introDoc from "@/content/docs/index"
import { DocContent } from "@/components/docs/doc-content"

export const metadata: Metadata = {
  title: "Documentation — Rulebound",
  description: introDoc.description,
}

export default function DocsPage() {
  return <DocContent content={introDoc.content} />
}
