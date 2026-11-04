// Calls the real Gemini API. Skipped unless LIVE=1, so CI never spends quota.
// Run: LIVE=1 npx vitest run test/live.test.ts
import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyseCsv, datasetFromCsv } from '#shared/csv'
import type { Subject } from '#shared/copy'
import { computeStats, factsFrom } from '#shared/stats'
import { improveMapping, writeCopy } from '../server/utils/ai'

const envFile = new URL('../.env', import.meta.url)
const apiKey = process.env.NUXT_GEMINI_API_KEY
  ?? (existsSync(envFile) ? /NUXT_GEMINI_API_KEY=(.+)/.exec(readFileSync(envFile, 'utf8'))?.[1]?.trim() : undefined)
  ?? ''
const sample = (name: string) => readFileSync(new URL(`../samples/${name}`, import.meta.url), 'utf8')

describe.skipIf(!process.env.LIVE)('live Gemini', () => {
  it('writes fintech copy that passes the checks, three times', { timeout: 240_000 }, async () => {
    const data = datasetFromCsv(sample('fintech-uk-seed-top-100.csv'))
    const stats = computeStats(data)
    const facts = factsFrom(stats, { metric: 'Total Raised' })
    const subject: Subject = { industry: 'fintech', geography: 'UK', qualifier: 'seed-stage', metric: 'Total Raised', year: 2026 }
    for (let run = 1; run <= 3; run++) {
      const started = Date.now()
      const result = await writeCopy(apiKey, subject, stats, facts, data)
      console.log(`run ${run}: ${result.source} ${result.model ?? ''} ${Date.now() - started}ms`, result.notes)
      if (run === 1) console.log(JSON.stringify(result.copy, null, 2))
      expect(result.source).toBe('ai')
    }
  })

  it('maps the AI startups columns and names the industry', { timeout: 60_000 }, async () => {
    const text = sample('ai-startups-uk.csv')
    const { profiles, match } = analyseCsv(text)
    const result = await improveMapping(apiKey, profiles, match, 'ai-startups-uk.csv')
    console.log(result.industry, result.match.source, result.match.unmatched.map((i) => profiles[i]!.header))
    expect(result.aiUsed).toBe(true)
    expect(result.industry).toBeTruthy()
    expect(result.match.mapping.name).toBe(match.mapping.name) // rules are never overridden
  })
})
