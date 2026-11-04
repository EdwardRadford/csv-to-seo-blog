// Protection for the public endpoints that cost something (parsing and AI calls).
import type { H3Event } from 'h3'
import { CsvError, MAX_BYTES } from '#shared/csv'

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Per-IP limit, using Cloudflare's rate limiting binding (see wrangler.jsonc).
 * There is no binding in local development, so there is no limit there; in production
 * a missing binding is a misconfiguration and requests are refused rather than let through.
 */
export async function rateLimit(event: H3Event, route: string): Promise<void> {
  const limiter = (event.context.cloudflare?.env as { LIMITER?: RateLimiter } | undefined)?.LIMITER
  if (!limiter) {
    if (import.meta.dev) return
    throw createError({ statusCode: 503, statusMessage: 'Uploads are unavailable right now.' })
  }
  const ip = getRequestHeader(event, 'cf-connecting-ip') ?? 'unknown'
  const { success } = await limiter.limit({ key: `${route}:${ip}` })
  if (!success) throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please wait a minute and try again.' })
}

/** Reads a JSON body holding a CSV, rejecting anything too big or the wrong shape. */
export async function readCsvBody<T extends { csv: string; filename: string }>(event: H3Event): Promise<T> {
  const tooBig = () => createError({ statusCode: 413, statusMessage: 'The file is over 1 MB.' })
  if (Number(getRequestHeader(event, 'content-length') ?? 0) > MAX_BYTES * 1.5) throw tooBig()
  const body = await readBody<T>(event)
  if (!body || typeof body.csv !== 'string' || typeof body.filename !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Send JSON with "csv" and "filename".' })
  }
  // Content-Length can be missing (chunked uploads), so check the real size too.
  if (body.csv.length > MAX_BYTES) throw tooBig()
  if (!/\.(csv|tsv|txt)$/i.test(body.filename)) {
    throw createError({ statusCode: 415, statusMessage: 'Please upload a .csv file.' })
  }
  return body
}

/**
 * Problems with the file become clear 400s. Anything else is a bug: it is logged,
 * and the visitor gets a generic message rather than internal details.
 */
export function asClientError(error: unknown): never {
  if (error && typeof error === 'object' && 'statusCode' in error) throw error
  if (error instanceof CsvError) throw createError({ statusCode: 400, statusMessage: error.message })
  console.error('Unexpected error', error)
  throw createError({ statusCode: 500, statusMessage: 'Something went wrong while reading the file.' })
}

/** The secret that lets the browser which created a page manage it later. */
export function requireEditToken(event: H3Event, expected: string | undefined): void {
  const given = getRequestHeader(event, 'x-edit-token')
  const admin = String(useRuntimeConfig(event).adminToken ?? '')
  if (admin.length >= 24 && given === admin) return
  if (!expected || !given || given !== expected) {
    throw createError({ statusCode: 403, statusMessage: 'Only the browser that generated this page can change it.' })
  }
}
