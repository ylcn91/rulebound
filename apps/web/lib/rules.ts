export const RULE_CATEGORY_OPTIONS = [
  "architecture",
  "security",
  "style",
  "testing",
  "performance",
  "infra",
  "workflow",
] as const;

export const RULE_SEVERITY_OPTIONS = ["error", "warning", "info"] as const;
export const RULE_MODALITY_OPTIONS = ["must", "should", "may"] as const;

export type RuleCategoryOption = (typeof RULE_CATEGORY_OPTIONS)[number];
export type RuleSeverityOption = (typeof RULE_SEVERITY_OPTIONS)[number];
export type RuleModalityOption = (typeof RULE_MODALITY_OPTIONS)[number];

export function joinCommaList(values: string[] | null | undefined): string {
  return (values ?? []).join(", ");
}

export function splitCommaList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function isRecommendedCategory(
  category: string,
): category is RuleCategoryOption {
  return RULE_CATEGORY_OPTIONS.includes(category as RuleCategoryOption);
}

export function getRuleCategoryDraft(category: string) {
  if (isRecommendedCategory(category)) {
    return {
      selectedCategory: category,
      customCategory: "",
    };
  }

  return {
    selectedCategory: "__custom__",
    customCategory: category,
  };
}

export function formatRuleLabel(value: string): string {
  return value
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
