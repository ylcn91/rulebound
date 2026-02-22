import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For individual developers and small projects.",
    cta: "Get Started Free",
    ctaVariant: "primary" as const,
    features: [
      "Unlimited rules",
      "3 agent integrations",
      "Task plan validation",
      "Community support",
    ],
  },
  {
    name: "Team & Enterprise",
    price: "Let's talk",
    period: "",
    description: "For teams that need centralized control and compliance.",
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
    features: [
      "Everything in Free",
      "Unlimited team members",
      "SSO / SAML",
      "Priority support",
      "Custom integrations",
      "Dedicated onboarding",
    ],
  },
];

export function Pricing() {
  return (
    <section className="bg-dot-grid py-(--spacing-section)">
      <div className="mx-auto max-w-6xl px-6">
        <p className="section-label">Pricing</p>
        <h2 className="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Simple, Transparent Pricing
        </h2>

        <div className="mt-12 grid gap-6 md:grid-cols-2 max-w-3xl mx-auto">
          {tiers.map((tier) => (
            <Card key={tier.name} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col pt-6">
                <div className="flex items-center gap-3">
                  <h3 className="font-mono text-lg font-semibold">
                    {tier.name}
                  </h3>
                  {tier.name === "Free" && (
                    <Badge variant="success">Popular</Badge>
                  )}
                </div>
                <div className="mt-4">
                  <span className="font-mono text-3xl font-bold">
                    {tier.price}
                  </span>
                  {tier.period && (
                    <span className="text-sm text-(--color-muted)">
                      {tier.period}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-(--color-text-secondary)">
                  {tier.description}
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-(--color-success) mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button variant={tier.ctaVariant} size="lg" className="mt-8 w-full">
                  {tier.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
