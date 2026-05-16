export interface QueryValidationIssue {
  readonly param: string
  readonly message: string
  readonly min?: number
  readonly max?: number
}

interface IntegerQueryParamOptions {
  readonly name: string
  readonly value: string | undefined
  readonly defaultValue: number
  readonly min?: number
  readonly max: number
}

type IntegerQueryParamResult =
  | { readonly ok: true; readonly value: number }
  | { readonly ok: false; readonly issue: QueryValidationIssue }

interface PaginationQueryOptions {
  readonly limit: string | undefined
  readonly offset: string | undefined
  readonly defaultLimit: number
  readonly maxLimit: number
  readonly defaultOffset?: number
  readonly maxOffset?: number
}

type PaginationQueryResult =
  | { readonly ok: true; readonly value: { readonly limit: number; readonly offset: number } }
  | { readonly ok: false; readonly issue: QueryValidationIssue }

const DECIMAL_INTEGER = /^\d+$/

export function invalidQueryResponse(issue: QueryValidationIssue): {
  readonly error: string
  readonly details: readonly QueryValidationIssue[]
} {
  return {
    error: "Invalid query parameter",
    details: [issue],
  }
}

export function parseIntegerQueryParam(
  options: IntegerQueryParamOptions,
): IntegerQueryParamResult {
  const min = options.min ?? 0

  if (options.value === undefined) {
    return { ok: true, value: options.defaultValue }
  }

  if (!DECIMAL_INTEGER.test(options.value)) {
    return {
      ok: false,
      issue: {
        param: options.name,
        message: `${options.name} must be an integer between ${min} and ${options.max}`,
        min,
        max: options.max,
      },
    }
  }

  const parsed = Number(options.value)
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > options.max) {
    return {
      ok: false,
      issue: {
        param: options.name,
        message: `${options.name} must be an integer between ${min} and ${options.max}`,
        min,
        max: options.max,
      },
    }
  }

  return { ok: true, value: parsed }
}

export function parsePaginationQuery(
  options: PaginationQueryOptions,
): PaginationQueryResult {
  const limit = parseIntegerQueryParam({
    name: "limit",
    value: options.limit,
    defaultValue: options.defaultLimit,
    min: 1,
    max: options.maxLimit,
  })
  if (!limit.ok) return limit

  const offset = parseIntegerQueryParam({
    name: "offset",
    value: options.offset,
    defaultValue: options.defaultOffset ?? 0,
    min: 0,
    max: options.maxOffset ?? 10_000,
  })
  if (!offset.ok) return offset

  return { ok: true, value: { limit: limit.value, offset: offset.value } }
}
