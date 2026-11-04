export default defineEventHandler(async (event) => {
  await rateLimit(event, 'regenerate')
  const slug = getRouterParam(event, 'slug') ?? ''
  const existing = await getPage(slug)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })
  requireEditToken(event, existing.editToken)
  const page = await regeneratePage(event, slug)
  return { slug: page.slug, title: page.title, copySource: page.content.source, notes: page.content.notes }
})
