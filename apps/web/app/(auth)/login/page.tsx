import { Github } from "lucide-react"
import Link from "next/link"
import { signIn } from "@/lib/auth/config"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardContent className="pt-8 pb-8 flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <span className="font-mono text-xl font-bold tracking-tight text-(--color-text-primary)">
            rulebound
          </span>
          <div className="divider-dots w-12" />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="font-sans text-lg font-semibold text-(--color-text-primary)">
            Sign in to Rulebound
          </h1>
          <p className="text-sm text-(--color-text-secondary)">
            Enforce rules across your AI coding agents
          </p>
        </div>

        <form
          action={async () => {
            "use server"
            await signIn("github", { redirectTo: "/rules" })
          }}
          className="w-full"
        >
          <Button type="submit" variant="secondary" size="lg" className="w-full gap-2">
            <Github className="h-5 w-5" />
            Continue with GitHub
          </Button>
        </form>

        <div className="flex flex-col items-center gap-3 text-sm">
          <p className="text-(--color-muted)">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-(--color-primary) hover:underline cursor-pointer"
            >
              Sign up
            </Link>
          </p>
          <p className="font-mono text-xs text-(--color-muted) tracking-wide uppercase">
            Free forever for individuals
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
