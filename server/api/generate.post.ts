// Step 2 of the upload: build the page and save it. Returns where to find it.
import type { GenerateInput } from '../utils/generate'

export default defineEventHandler(async (event) => {
  await rateLimit(event, 'generate')
  const body = await readCsvBody<GenerateInput>(event)
  try {
    const page = await generatePage(event, body)
    // The edit token goes only to the uploader, who keeps it to delete or regenerate later.
    return { slug: page.slug, title: page.title, copySource: page.content.source, notes: page.content.notes, editToken: page.editToken }
  } catch (error) {
    asClientError(error)
  }
})
