import { z } from "zod"

// ── Validate API ────────────────────────────────────────

export const validateBodySchema = z
  .object({
    plan: z.string().optional(),
    code: z.string().optional(),
    language: z.string().optional(),
    project: z.string().optional(),
    task: z.string().optional(),
    useLlm: z.boolean().optional(),
  })
  .strip()
  .refine((data) => data.plan || data.code, {
    message: "Provide 'plan' or 'code' field",
  })

// ── Rules API ───────────────────────────────────────────

export const ruleCreateSchema = z
  .object({
    title: z.string().min(1, "title is required"),
    content: z.string().min(1, "content is required"),
    category: z.string().min(1, "category is required"),
    severity: z.string().optional(),
    modality: z.string().optional(),
    tags: z.array(z.string()).optional(),
    stack: z.array(z.string()).optional(),
    ruleSetId: z.string().optional(),
  })
  .strip()

export const ruleUpdateSchema = z
  .object({
    title: z.string().optional(),
    content: z.string().optional(),
    category: z.string().optional(),
    severity: z.string().optional(),
    modality: z.string().optional(),
    tags: z.array(z.string()).optional(),
    stack: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
    changeNote: z.string().optional(),
  })
  .strip()

// ── Webhooks API ────────────────────────────────────────

export const webhookEndpointCreateSchema = z
  .object({
    url: z.string().url("url must be a valid URL"),
    secret: z.string().min(16, "secret must be at least 16 characters"),
    events: z.array(z.string()).min(1, "at least one event is required"),
    description: z.string().optional(),
  })
  .strip()

// ── Audit API ───────────────────────────────────────────

export const auditCreateSchema = z
  .object({
    projectId: z.string().optional(),
    userId: z.string().optional(),
    action: z.string().min(1, "action is required"),
    ruleId: z.string().optional(),
    status: z.string().min(1, "status is required"),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strip()

// ── Compliance API ──────────────────────────────────────

export const complianceSnapshotSchema = z
  .object({
    score: z.number().min(0, "score is required"),
    passCount: z.number().int().min(0).optional(),
    violatedCount: z.number().int().min(0).optional(),
    notCoveredCount: z.number().int().min(0).optional(),
  })
  .strip()

// ── Sync API ────────────────────────────────────────────

export const syncAckSchema = z
  .object({
    projectId: z.string().min(1, "projectId is required"),
    ruleVersionHash: z.string().min(1, "ruleVersionHash is required"),
  })
  .strip()

// ── Tokens API ──────────────────────────────────────────

export const tokenCreateSchema = z
  .object({
    name: z.string().min(1, "name is required"),
    scopes: z.array(z.string()).optional(),
    expiresAt: z.string().optional(),
  })
  .strip()

// ── Projects API ────────────────────────────────────────

export const projectCreateSchema = z
  .object({
    name: z.string().min(1, "name is required"),
    slug: z.string().min(1, "slug cannot be empty").optional(),
    repoUrl: z.string().url("repoUrl must be a valid URL").optional(),
    stack: z.array(z.string()).optional(),
    ruleSetIds: z.array(z.string()).optional(),
  })
  .strip()

export const projectUpdateSchema = z
  .object({
    name: z.string().min(1, "name cannot be empty").optional(),
    slug: z.string().min(1, "slug cannot be empty").optional(),
    repoUrl: z.string().url("repoUrl must be a valid URL").nullable().optional(),
    stack: z.array(z.string()).optional(),
    ruleSetIds: z.array(z.string()).optional(),
  })
  .strip()
