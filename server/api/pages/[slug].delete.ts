export default defineEventHandler(async (event) => {
  await rateLimit(event, 'delete')
  const slug = getRouterParam(event, 'slug') ?? ''
  const page = await getPage(slug)
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })
  if (isProtected(slug)) throw createError({ statusCode: 403, statusMessage: 'This example page can be regenerated but not deleted.' })
  requireEditToken(event, page.editToken)
  await deletePage(slug)
  return { deleted: slug }
})
