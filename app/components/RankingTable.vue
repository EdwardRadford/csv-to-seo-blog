<script setup lang="ts">
import type { Company, Currency, Dataset } from '#shared/types'
import { fullMoney } from '#shared/format'

// The full ranking, laid out like Beauhurst's own tables. Sorting uses links
// (?sort=amount&order=asc), so it works without JavaScript and stays server-rendered.
const props = defineProps<{
  companies: Company[]
  has: Dataset['has']
  currency: Currency
  metric: string
  caption: string
}>()

type Key = 'rank' | 'name' | 'region' | 'stage' | 'size' | 'founded' | 'amount'
const route = useRoute()
const sort = computed<Key>(() => (['rank', 'name', 'region', 'stage', 'size', 'founded', 'amount'].includes(String(route.query.sort)) ? (route.query.sort as Key) : 'rank'))
const order = computed(() => (route.query.order === 'desc' ? 'desc' : 'asc'))

// A column where every row says the same thing ("Seed" x 100) adds nothing; the title already says it.
const showStage = computed(() => props.has.stage && new Set(props.companies.map((c) => c.stage)).size > 1)

const columns = computed(() =>
  ([
    { key: 'rank', label: '', show: true },
    { key: 'name', label: 'Company', show: true },
    { key: 'region', label: 'Region', show: props.has.region },
    { key: 'stage', label: 'Stage', show: showStage.value },
    { key: 'size', label: 'Employees', show: props.has.size },
    { key: 'founded', label: 'Founded', show: props.has.founded },
    { key: 'amount', label: props.metric, show: props.has.amount }
  ] as { key: Key; label: string; show: boolean }[]).filter((c) => c.show)
)

const value = (c: Company, key: Key): string | number => {
  switch (key) {
    case 'size': return c.size?.min ?? -1
    case 'amount': return c.amount ?? -1
    case 'founded': return c.founded ?? 0
    case 'rank': return c.rank
    default: return (c[key] ?? '').toString().toLowerCase()
  }
}

const rows = computed(() => {
  const direction = order.value === 'desc' ? -1 : 1
  return [...props.companies].sort((a, b) => {
    const x = value(a, sort.value)
    const y = value(b, sort.value)
    return (x < y ? -1 : x > y ? 1 : a.rank - b.rank) * direction
  })
})

// Clicking the current column flips the order; a new column starts in its natural order.
const linkFor = (key: Key) => {
  const natural = key === 'amount' || key === 'size' ? 'desc' : 'asc'
  const next = sort.value === key ? (order.value === 'asc' ? 'desc' : 'asc') : natural
  return { query: { ...route.query, sort: key, order: next }, hash: '#ranking' }
}
const ariaSort = (key: Key) => (sort.value === key ? (order.value === 'asc' ? 'ascending' : 'descending') : 'none')
const host = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
</script>

<template>
  <div class="scroller" tabindex="0" role="region" :aria-label="caption">
    <table>
      <caption class="visually-hidden">{{ caption }}. Column headings sort the table.</caption>
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key" scope="col" :aria-sort="ariaSort(col.key)" :class="col.key">
            <NuxtLink :to="linkFor(col.key)" rel="nofollow" :class="{ active: sort === col.key }">
              <span v-if="col.key === 'rank'" class="visually-hidden">Rank</span>{{ col.label }}<span v-if="sort === col.key && col.key !== 'rank'" aria-hidden="true" class="arrow">{{ order === 'asc' ? ' ↑' : ' ↓' }}</span>
            </NuxtLink>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="c in rows" :key="c.rank + c.name">
          <td class="rank num">{{ c.rank }}</td>
          <th scope="row" class="name">
            <a v-if="c.website" :href="c.website" rel="nofollow noopener" target="_blank" :title="c.description ?? undefined">{{ c.name }}<span class="visually-hidden"> (opens {{ host(c.website) }} in a new tab)</span></a>
            <span v-else :title="c.description ?? undefined">{{ c.name }}</span>
          </th>
          <td v-if="has.region">{{ c.region ?? '-' }}</td>
          <td v-if="showStage">{{ c.stage ?? '-' }}</td>
          <td v-if="has.size" class="num">{{ c.size?.label ?? '-' }}</td>
          <td v-if="has.founded" class="num">{{ c.founded ?? '-' }}</td>
          <td v-if="has.amount" class="amount num">{{ c.amount !== null ? fullMoney(c.amount, currency) : '-' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.scroller { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: var(--step--1); min-width: 600px; color: var(--text); }
th, td { padding: 11px 14px; text-align: left; border-bottom: 1px solid var(--line); }
thead th { font-weight: 500; white-space: nowrap; border-bottom: 1px solid var(--line); }
thead a { color: var(--text); text-decoration: none; }
thead a:hover, thead a.active { color: var(--ink); text-decoration: underline; }
.arrow { color: var(--accent); }

.rank { width: 3rem; text-align: center; color: var(--text); position: sticky; left: 0; background: var(--bg); }
.name { position: sticky; left: 3rem; background: var(--bg); font-weight: 700; color: var(--ink); min-width: 180px; }
.name a { color: var(--ink); text-decoration: none; }
.name a:hover { color: var(--accent); text-decoration: underline; }
.amount, thead .amount { text-align: right; white-space: nowrap; }
.amount { font-weight: 700; color: var(--ink); }
tbody tr:hover > * { background: #f7f7fa; }
</style>
