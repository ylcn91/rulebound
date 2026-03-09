import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface BackendErrorStateProps {
  heading: string;
  subheading: string;
  title: string;
  description: string;
}

export function BackendErrorState({
  heading,
  subheading,
  title,
  description,
}: BackendErrorStateProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-xl font-bold text-(--color-text-primary)">
          {heading}
        </h1>
        <p className="mt-1 text-sm text-(--color-text-secondary)">
          {subheading}
        </p>
      </div>

      <Card className="border-2 border-dashed">
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-(--color-muted)" />
          <p className="font-mono text-xs uppercase tracking-widest text-(--color-muted)">
            {title}
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-(--color-text-secondary)">
            {description}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
