export default defineEventHandler(async () =>
  (await listPages()).map((page) => ({ ...page, protected: isProtected(page.slug) }))
)
