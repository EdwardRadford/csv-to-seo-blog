import type { Mapping } from '../types'
import { buildDataset } from './normalise'
import { parseCsv } from './parse'
import { profileColumns } from './profile'
import { matchRoles } from './roles'

export { CsvError, MAX_BYTES, MAX_ROWS } from './parse'

/** Reads a CSV and makes a first guess at which column is which, using rules only. */
export function analyseCsv(text: string) {
  const csv = parseCsv(text)
  const profiles = profileColumns(csv)
  const match = matchRoles(profiles)
  return { csv, profiles, match }
}

/** Reads a CSV and builds the clean dataset, using the given mapping or the rules' guess. */
export function datasetFromCsv(text: string, mapping?: Mapping) {
  const { csv, profiles, match } = analyseCsv(text)
  return buildDataset(csv, profiles, mapping ?? match.mapping)
}
