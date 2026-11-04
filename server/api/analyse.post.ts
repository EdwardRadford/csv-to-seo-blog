// Step 1 of the upload: read the file and say which column is which, for the user to check.
import { analyseCsv } from '#shared/csv'
import { buildDataset } from '#shared/csv/normalise'
import { ROLES } from '#shared/types'
import { improveMapping, industryFromFilename } from '../utils/ai'

export default defineEventHandler(async (event) => {
  await rateLimit(event)
  const body = await readCsvBody(event)

  let analysis
  try {
    analysis = analyseCsv(body.csv)
  } catch (error) {
    asClientError(error)
  }
  const { csv, profiles, match } = analysis
  const improved = await improveMapping(apiKey(event), profiles, match, body.filename)

  let preview: ReturnType<typeof buildDataset> | null = null
  try {
    preview = buildDataset(csv, profiles, improved.match.mapping)
  } catch {
    // No name column yet: the user picks one on the preview screen.
  }

  return {
    filename: body.filename,
    rows: csv.rows.length,
    columns: profiles.map((p) => ({ header: p.header, type: p.type, filled: p.filled, examples: p.examples })),
    mapping: Object.fromEntries(ROLES.map((role) => [role, improved.match.mapping[role] === null ? null : csv.headers[improved.match.mapping[role]!]])),
    source: improved.match.source,
    industry: improved.industry ?? industryFromFilename(body.filename),
    aiUsed: improved.aiUsed,
    warnings: [...csv.warnings, ...(preview?.warnings ?? [])],
    preview: preview?.companies.slice(0, 5) ?? []
  }
})
