import { Header } from "@/components/shared/header"
import { Footer } from "@/components/shared/footer"
import { DocsSidebar } from "@/components/docs/sidebar"

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-(--color-background) flex flex-col">
      <Header />
      <div className="flex-1 flex">
        <DocsSidebar />
        <main className="flex-1 min-w-0 px-6 py-10 lg:px-12">
          <div className="mx-auto max-w-3xl">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
