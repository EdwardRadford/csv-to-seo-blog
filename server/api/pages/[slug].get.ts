export default defineEventHandler(async (event) => {
  const page = await getPage(getRouterParam(event, 'slug') ?? '')
  if (!page) throw createError({ statusCode: 404, statusMessage: 'Page not found.' })
  const { editToken: _, ...publicPage } = page
  return { ...publicPage, protected: isProtected(page.slug) }
})
