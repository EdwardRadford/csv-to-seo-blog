// Page storage. In production this is Cloudflare KV; locally it's files in .data/.
// Both come from Nitro's storage layer (see nuxt.config.ts), so this code doesn't know which.
import type { PageRecord, PageSummary } from '#shared/page'
import { summarise } from '#shared/page'

const storage = () => useStorage('pages')

/** Example pages (set in runtime config) can be regenerated but not deleted. */
export function isProtected(slug: string): boolean {
  const list = String(useRuntimeConfig().protectedSlugs ?? '')
  return list.split(',').map((s) => s.trim()).includes(slug)
}
const INDEX = 'index'

export async function listPages(): Promise<PageSummary[]> {
  const pages = (await storage().getItem<PageSummary[]>(INDEX)) ?? []
  // Index entries written before the summary gained new fields are rebuilt once from their page.
  if (pages.some((p) => !Array.isArray(p.curve))) {
    const rebuilt = await Promise.all(pages.map(async (p) => {
      if (Array.isArray(p.curve)) return p
      const page = await getPage(p.slug)
      return page ? summarise(page) : p
    }))
    await storage().setItem(INDEX, rebuilt)
    return rebuilt
  }
  return pages
}

export async function getPage(slug: string): Promise<PageRecord | null> {
  return storage().getItem<PageRecord>(`page:${slug}`)
}

export async function savePage(page: PageRecord): Promise<void> {
  await storage().setItem(`page:${page.slug}`, page)
  const others = (await listPages()).filter((p) => p.slug !== page.slug)
  await storage().setItem(INDEX, [summarise(page), ...others])
}

export async function deletePage(slug: string): Promise<void> {
  await storage().removeItem(`page:${slug}`)
  await storage().setItem(INDEX, (await listPages()).filter((p) => p.slug !== slug))
}

/** "top-50-healthtech-companies-in-the-uk-2026", or "-2", "-3" if that's taken. */
export async function freeSlug(base: string): Promise<string> {
  const taken = new Set((await listPages()).map((p) => p.slug))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}

/**
 * Daily cap on AI generations, so the public demo can't burn the free Gemini quota.
 * KV is eventually consistent, so this is a soft cap; the per-IP limiter is the hard one.
 */
export async function takeDailyGeneration(limit: number): Promise<boolean> {
  const key = `count:${new Date().toISOString().slice(0, 10)}`
  const used = (await storage().getItem<number>(key)) ?? 0
  if (used >= limit) return false
  await storage().setItem(key, used + 1, { expirationTtl: 60 * 60 * 48 })
  return true
}
