// Built from the page index on every request, so a newly generated page is
// discoverable straight away with no rebuild. Hidden (noindex) pages are left out.
export default defineEventHandler(async (event) => {
  const { siteUrl } = useRuntimeConfig(event).public
  const pages = (await listPages()).filter((p) => !p.noindex)
  const newest = pages.map((p) => p.updatedAt).sort().at(-1) ?? new Date().toISOString()
  const entry = (loc: string, lastmod: string) => `  <url><loc>${loc}</loc><lastmod>${lastmod.slice(0, 10)}</lastmod></url>`
  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entry(`${siteUrl}/`, newest),
    ...pages.map((p) => entry(`${siteUrl}/${p.slug}`, p.updatedAt)),
    '</urlset>',
    ''
  ].join('\n')
})
