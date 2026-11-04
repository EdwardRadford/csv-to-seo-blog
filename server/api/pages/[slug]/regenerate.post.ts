export default defineEventHandler(async (event) => {
  await rateLimit(event)
  const page = await regeneratePage(event, getRouterParam(event, 'slug') ?? '')
  return { slug: page.slug, copySource: page.content.source, notes: page.content.notes }
})
