// Types shared by the server, the pages and the tests.

/** What a column holds, worked out from its values. */
export type ColumnType = 'money' | 'number' | 'year' | 'band' | 'url' | 'list' | 'category' | 'text' | 'date' | 'empty'

/** What a column means for the report. Every role is optional except name. */
export type Role = 'name' | 'rank' | 'amount' | 'region' | 'stage' | 'size' | 'description' | 'website' | 'tags' | 'founded'

export const ROLES: Role[] = ['name', 'rank', 'amount', 'region', 'stage', 'size', 'description', 'website', 'tags', 'founded']

export interface ColumnProfile {
  header: string
  index: number
  type: ColumnType
  /** Share of rows with a value, 0 to 1. */
  filled: number
  /** Number of rows with a value. */
  count: number
  distinct: number
  examples: string[]
  /** For money columns: the currency symbol seen most often. */
  currency?: Currency
  /** For list columns: the separator used. */
  separator?: string
}

export type Currency = 'GBP' | 'USD' | 'EUR'

/** Which column fills each role. null means the dataset has no such column. */
export type Mapping = Record<Role, number | null>

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
  delimiter: string
  warnings: string[]
}

export interface SizeBand {
  label: string
  min: number
  max: number | null
}

export interface Company {
  rank: number
  name: string
  amount: number | null
  region: string | null
  stage: string | null
  size: SizeBand | null
  description: string | null
  website: string | null
  tags: string[]
  founded: number | null
}

export interface Dataset {
  companies: Company[]
  currency: Currency
  /** Which roles this dataset has, so the template can drop what's missing. */
  has: Record<Role, boolean>
  /** Header text for each role that was found, for the methodology note. */
  columns: Partial<Record<Role, string>>
  warnings: string[]
  /** True when the CSV had no rank column and the app ranked by amount. */
  rankedByAmount: boolean
}
