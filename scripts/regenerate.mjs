// Rewrites the AI copy of live pages from their stored data, as the site owner.
// Needs NUXT_ADMIN_TOKEN in .env (the same value as the Worker secret).
// Run: node scripts/regenerate.mjs <slug> [<slug> ...]
import { readFileSync } from 'node:fs'

const base = process.env.SITE_URL ?? 'https://csv-to-seo-blog.edward-radford.workers.dev'
const token = /NUXT_ADMIN_TOKEN=(.+)/.exec(readFileSync(new URL('../.env', import.meta.url), 'utf8'))?.[1]?.trim()
if (!token) throw new Error('NUXT_ADMIN_TOKEN is not set in .env')

for (const [i, slug] of process.argv.slice(2).entries()) {
  // Space the calls out: the free Gemini tier also limits requests per minute.
  if (i) await new Promise((resolve) => setTimeout(resolve, 45_000))
  const started = Date.now()
  const response = await fetch(`${base}/api/pages/${slug}/regenerate`, { method: 'POST', headers: { 'x-edit-token': token } })
  const body = await response.json()
  const page = await fetch(`${base}/api/pages/${slug}`).then((r) => r.json())
  console.log(`${slug}: HTTP ${response.status} in ${Math.round((Date.now() - started) / 1000)}s,`, response.ok ? `copy by ${page.content.model ?? 'template'}` : body.statusMessage)
}
