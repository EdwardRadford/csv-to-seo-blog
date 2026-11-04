export default defineEventHandler(async (event) => {
  await rateLimit(event)
  const slug = getRouterParam(event, 'slug') ?? ''
  const page = await getPage(slug)
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })
  if (isProtected(slug)) throw createError({ statusCode: 403, statusMessage: 'This example page can be regenerated but not deleted.' })
  await deletePage(slug)
  return { deleted: slug }
})
