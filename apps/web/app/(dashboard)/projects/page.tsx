import Link from "next/link"
import { Plus, FolderKanban, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const MOCK_PROJECTS = [
  {
    id: "1",
    name: "rulebound",
    repoUrl: "https://github.com/rulebound/rulebound",
    ruleSets: 3,
    updatedAt: "2026-02-20",
  },
  {
    id: "2",
    name: "acme-frontend",
    repoUrl: "https://github.com/acme/frontend",
    ruleSets: 2,
    updatedAt: "2026-02-18",
  },
  {
    id: "3",
    name: "api-service",
    repoUrl: "https://github.com/acme/api-service",
    ruleSets: 1,
    updatedAt: "2026-02-15",
  },
]

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-sans text-xl font-semibold text-(--color-text-primary)">
            Projects
          </h1>
          <p className="text-sm text-(--color-text-secondary) mt-1">
            Repositories connected to your rule sets
          </p>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Project cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MOCK_PROJECTS.map((project) => (
          <Card
            key={project.id}
            className="border-2 hover:border-(--color-text-primary)/30 transition-colors duration-150"
          >
            <CardContent className="pt-5 pb-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-(--color-text-primary) shrink-0" />
                  <h2 className="font-sans font-semibold text-(--color-text-primary)">
                    {project.name}
                  </h2>
                </div>
              </div>

              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-(--color-muted) hover:text-(--color-text-primary) cursor-pointer transition-colors duration-150"
              >
                {project.repoUrl.replace("https://github.com/", "")}
                <ExternalLink className="h-3 w-3" />
              </a>

              <div className="flex items-center justify-between pt-1">
                <Badge variant="default">
                  {project.ruleSets} rule set{project.ruleSets !== 1 ? "s" : ""}
                </Badge>
                <span className="text-xs text-(--color-muted)">
                  {project.updatedAt}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {MOCK_PROJECTS.length === 0 && (
        <div className="border border-dashed border-(--color-border) rounded-md p-12 text-center">
          <FolderKanban className="h-8 w-8 text-(--color-muted) mx-auto mb-3" />
          <p className="text-(--color-text-secondary) text-sm">
            No projects yet. Connect your first repository.
          </p>
        </div>
      )}
    </div>
  )
}
