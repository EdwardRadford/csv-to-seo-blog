// Protection for the public endpoints that cost something (parsing and AI calls).
import type { H3Event } from 'h3'
import { MAX_BYTES } from '#shared/csv'

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>
}

/**
 * Per-IP limit, using Cloudflare's rate limiting binding (see wrangler.jsonc).
 * Locally the binding doesn't exist, so there is no limit in development.
 */
export async function rateLimit(event: H3Event): Promise<void> {
  const limiter = (event.context.cloudflare?.env as { LIMITER?: RateLimiter } | undefined)?.LIMITER
  if (!limiter) return
  const ip = getRequestHeader(event, 'cf-connecting-ip') ?? 'unknown'
  const { success } = await limiter.limit({ key: ip })
  if (!success) throw createError({ statusCode: 429, statusMessage: 'Too many requests. Please wait a minute and try again.' })
}

/** Reads a JSON body holding a CSV, rejecting anything too big or the wrong shape. */
export async function readCsvBody<T extends { csv: string; filename: string }>(event: H3Event): Promise<T> {
  const length = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (length > MAX_BYTES * 1.5) throw createError({ statusCode: 413, statusMessage: 'The file is over 1 MB.' })
  const body = await readBody<T>(event)
  if (!body || typeof body.csv !== 'string' || typeof body.filename !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Send JSON with "csv" and "filename".' })
  }
  if (!/\.(csv|tsv|txt)$/i.test(body.filename)) {
    throw createError({ statusCode: 415, statusMessage: 'Please upload a .csv file.' })
  }
  return body
}

/** Turns errors from the CSV reader into clear 400 responses. */
export function asClientError(error: unknown): never {
  if (error && typeof error === 'object' && 'statusCode' in error) throw error
  const message = error instanceof Error ? error.message : 'The file could not be read.'
  throw createError({ statusCode: 400, statusMessage: message })
}
