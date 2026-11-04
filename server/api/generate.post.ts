// Step 2 of the upload: build the page and save it. Returns where to find it.
import type { GenerateInput } from '../utils/generate'

export default defineEventHandler(async (event) => {
  await rateLimit(event)
  const body = await readCsvBody<GenerateInput>(event)
  try {
    const page = await generatePage(event, body)
    return { slug: page.slug, title: page.title, copySource: page.content.source, notes: page.content.notes }
  } catch (error) {
    asClientError(error)
  }
})
