import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getDoc, getAllSlugs } from "@/content/docs/registry"
import { DocContent } from "@/components/docs/doc-content"

interface PageProps {
  params: Promise<{ slug: string[] }>
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const slugPath = slug.join("/")
  const doc = await getDoc(slugPath)

  if (!doc) {
    return { title: "Not Found — Rulebound Docs" }
  }

  return {
    title: `${doc.title} — Rulebound Docs`,
    description: doc.description,
  }
}

export default async function DocSlugPage({ params }: PageProps) {
  const { slug } = await params
  const slugPath = slug.join("/")
  const doc = await getDoc(slugPath)

  if (!doc) {
    notFound()
  }

  return <DocContent content={doc.content} />
}
