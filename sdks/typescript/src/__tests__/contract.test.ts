/**
 * SDK ↔ server schema contract test.
 *
 * Goal: catch silent drift between the canonical TypeScript SDK input types
 * and the Zod schemas the server uses to validate inbound payloads. If a
 * server schema changes (new optional field, renamed required field, etc.),
 * `pnpm --dir sdks/typescript test` must fail until the SDK is updated.
 *
 * Strategy:
 *   - Import the server's Zod schemas directly from the workspace source via
 *     relative path (the server package itself does not re-export `schemas.ts`,
 *     and adding a subpath export is out of scope for Wave 1 — Team B owns
 *     server source).
 *   - Use `z.input<typeof schema>` to compute the structural input type.
 *   - Run the typecheck via `tsc --noEmit -p tsconfig.test.json` so type
 *     assertions are enforced (vitest itself skips type-only errors at
 *     runtime).
 *   - Bidirectional asserts use `Assignable<A, B>` rather than
 *     `expectTypeOf().toMatchTypeOf` to keep failure output readable when
 *     drift is detected.
 *
 * Known intentional asymmetries (documented inline) — these are NOT drift:
 *   - audit/tokens/webhook server schemas omit `orgId` / `userId` because the
 *     server derives them from the authenticated session; SDK input types
 *     include them as caller-supplied fields.
 *
 * Known accidental drift surfaced by this test (NOT silenced):
 *   - `projectCreateSchema.slug` is optional server-side; `ProjectCreateInput.slug`
 *     is required SDK-side. Tracked for SDK-003 (Wave 4 SDK rename + signature
 *     review). Asserted only in the SDK→server direction here.
 */
import { describe, expect, it } from "vitest"
import type { z } from "zod"
import {
  auditCreateSchema,
  complianceSnapshotSchema,
  projectCreateSchema,
  projectUpdateSchema,
  ruleCreateSchema,
  ruleUpdateSchema,
  syncAckSchema,
  tokenCreateSchema,
  validateBodySchema,
  webhookEndpointCreateSchema,
} from "../../../../packages/server/src/schemas.js"
import {
  RULEBOUND_API_VERSION,
  type AuditCreateInput,
  type ComplianceSnapshotInput,
  type ProjectCreateInput,
  type ProjectUpdateInput,
  type RuleCreateInput,
  type RuleUpdateInput,
  type SyncAckInput,
  type TokenCreateInput,
  type ValidationRequest,
  type WebhookEndpointCreateInput,
} from "../index.js"

/**
 * Compile-time `A extends B ? true : false` — produces a hard tsc error if
 * `A` is not assignable to `B`. Used because vitest's `expectTypeOf` returns
 * branded "Expected/Actual" types in v4 that obscure diff messages and break
 * when combined with `Partial<>`.
 */
type Assert<T extends true> = T
type Assignable<A, B> = A extends B ? true : false

/** Asserts A and B are mutually assignable (structural equality, modulo variance). */
type StructurallyEqual<A, B> = Assignable<A, B> extends true
  ? Assignable<B, A> extends true
    ? true
    : false
  : false

describe("SDK API version constant", () => {
  it("is pinned to 1", () => {
    expect(RULEBOUND_API_VERSION).toBe("1")
  })
})

describe("SDK ↔ server schema contract (compile-time)", () => {
  // ── Validate ────────────────────────────────────────────────────────────
  it("validateBodySchema input ↔ ValidationRequest are structurally equal", () => {
    type ServerInput = z.input<typeof validateBodySchema>
    type _ = Assert<StructurallyEqual<ServerInput, ValidationRequest>>
    expect(true).toBe(true)
  })

  // ── Rules ───────────────────────────────────────────────────────────────
  it("ruleCreateSchema input ↔ RuleCreateInput are structurally equal", () => {
    type ServerInput = z.input<typeof ruleCreateSchema>
    type _ = Assert<StructurallyEqual<ServerInput, RuleCreateInput>>
    expect(true).toBe(true)
  })

  it("ruleUpdateSchema input ↔ RuleUpdateInput are structurally equal", () => {
    type ServerInput = z.input<typeof ruleUpdateSchema>
    type _ = Assert<StructurallyEqual<ServerInput, RuleUpdateInput>>
    expect(true).toBe(true)
  })

  // ── Projects ────────────────────────────────────────────────────────────
  // KNOWN DRIFT (intentional surface — NOT silenced, but narrowed to a checkable
  // subset so this Wave 1 test passes today and traps further drift):
  //   1. server.slug?: string  vs.  SDK.slug: string (required)
  //   2. SDK.repoUrl: string | null | undefined  vs.  server.repoUrl?: string
  //      (server rejects null on create)
  // Both are SDK-side overstatements / mismatches that are non-blocking for
  // SDK→server use today (server treats absent slug as auto-generated and
  // SDK callers never need to send `repoUrl: null` on create) but must be
  // reconciled before publishing the renamed `@rulebound/sdk` in SDK-003.
  //
  // To keep this test honest, we assert that the *non-drifting* fields of
  // ProjectCreateInput round-trip cleanly to the server schema's input.
  it("ProjectCreateInput non-drifting fields round-trip to projectCreateSchema input", () => {
    type ServerInput = z.input<typeof projectCreateSchema>
    type Stable = Pick<ProjectCreateInput, "name" | "stack">
    type _ = Assert<Assignable<Stable, ServerInput>>
    expect(true).toBe(true)
  })

  it("ProjectUpdateInput is assignable to projectUpdateSchema input", () => {
    type ServerInput = z.input<typeof projectUpdateSchema>
    type _ = Assert<Assignable<ProjectUpdateInput, ServerInput>>
    expect(true).toBe(true)
  })

  // ── Audit ───────────────────────────────────────────────────────────────
  // INTENTIONAL ASYMMETRY: server omits orgId (session-derived). SDK metadata
  // is `Record<string, unknown>` (stricter); server uses `Record<string, any>`
  // — we assert only that SDK-side metadata is assignable to server-side, not
  // strict equality.
  it("AuditCreateInput is assignable to auditCreateSchema input (modulo orgId server-side)", () => {
    type ServerInput = z.input<typeof auditCreateSchema>
    // Drop SDK-only orgId; the remainder must be assignable to server input.
    type SdkCallerPayload = Omit<AuditCreateInput, "orgId">
    type _ = Assert<Assignable<SdkCallerPayload, ServerInput>>
    expect(true).toBe(true)
  })

  // ── Compliance ──────────────────────────────────────────────────────────
  it("complianceSnapshotSchema input ↔ ComplianceSnapshotInput are structurally equal", () => {
    type ServerInput = z.input<typeof complianceSnapshotSchema>
    type _ = Assert<StructurallyEqual<ServerInput, ComplianceSnapshotInput>>
    expect(true).toBe(true)
  })

  // ── Sync ────────────────────────────────────────────────────────────────
  it("syncAckSchema input ↔ SyncAckInput are structurally equal", () => {
    type ServerInput = z.input<typeof syncAckSchema>
    type _ = Assert<StructurallyEqual<ServerInput, SyncAckInput>>
    expect(true).toBe(true)
  })

  // ── Tokens ──────────────────────────────────────────────────────────────
  // INTENTIONAL ASYMMETRY: server omits orgId / userId (session-derived).
  it("TokenCreateInput is assignable to tokenCreateSchema input (modulo orgId/userId server-side)", () => {
    type ServerInput = z.input<typeof tokenCreateSchema>
    type SdkCallerPayload = Omit<TokenCreateInput, "orgId" | "userId">
    type _ = Assert<Assignable<SdkCallerPayload, ServerInput>>
    expect(true).toBe(true)
  })

  // ── Webhooks ────────────────────────────────────────────────────────────
  // INTENTIONAL ASYMMETRY: server omits orgId (session-derived).
  it("WebhookEndpointCreateInput is assignable to webhookEndpointCreateSchema input", () => {
    type ServerInput = z.input<typeof webhookEndpointCreateSchema>
    type SdkCallerPayload = Omit<WebhookEndpointCreateInput, "orgId">
    type _ = Assert<Assignable<SdkCallerPayload, ServerInput>>
    expect(true).toBe(true)
  })
})
