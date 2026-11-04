<script setup lang="ts">
import type { PageSummary } from '#shared/page'
import { compactMoney } from '#shared/format'

const { siteUrl, siteName } = useRuntimeConfig().public
const { data: pages } = await useFetch<(PageSummary & { protected: boolean })[]>('/api/pages')

const description = 'Data-led rankings of companies by sector, generated from company datasets. Upload a CSV and get a server-rendered, search-ready report.'
useSeoMeta({
  title: `${siteName}: company rankings by sector`,
  description,
  ogTitle: siteName,
  ogDescription: description,
  ogType: 'website',
  ogUrl: siteUrl
})
useHead({ link: [{ rel: 'canonical', href: `${siteUrl}/` }] })

const samples = [
  { file: 'fintech-uk-seed-top-100.csv', label: 'Fintech', note: 'the real dataset' },
  { file: 'healthtech-uk-top-50.csv', label: 'Healthtech', note: 'different column names' },
  { file: 'cleantech-europe.csv', label: 'Cleantech', note: 'dollars, no rank column' },
  { file: 'ai-startups-uk.csv', label: 'AI', note: 'extra columns, no location' },
  { file: 'messy-proptech.csv', label: 'Proptech', note: 'deliberately messy' }
]
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const featured = computed(() => pages.value?.find((p) => p.protected) ?? pages.value?.[0])
const rest = computed(() => (pages.value ?? []).filter((p) => p.slug !== featured.value?.slug))
</script>

<template>
  <div>
    <section class="container intro">
      <div class="intro-text">
        <p class="kicker">Company rankings, generated</p>
        <h1>Turn any company dataset into a ranked, search-ready report</h1>
        <p class="standfirst serif">
          Upload a CSV of companies. The app works out which column is which, calculates the statistics,
          has Gemini write the copy around those figures, checks every number, and publishes a server-rendered page.
        </p>
        <div class="cta">
          <NuxtLink to="/upload" class="button">Generate a report</NuxtLink>
          <a href="#samples" class="button secondary">Get sample data</a>
        </div>
      </div>
      <NuxtLink v-if="featured" :to="`/${featured.slug}`" class="featured">
        <HeroArt :seed="featured.slug" :count="featured.companies" :curve="featured.curve ?? []" :figure="featured.total ? compactMoney(featured.total, featured.currency) : null" />
        <span class="kicker">{{ dateOf(featured.updatedAt) }}</span>
        <span class="featured-title serif">{{ featured.title }}</span>
      </NuxtLink>
    </section>

    <section class="container reports" aria-labelledby="reports">
      <h2 id="reports">Latest reports</h2>
      <p v-if="!pages?.length" class="muted">No reports yet. Generate the first one.</p>
      <ul v-else class="cards">
        <li v-for="p in rest" :key="p.slug">
          <NuxtLink :to="`/${p.slug}`" class="card">
            <HeroArt :count="p.companies" :curve="p.curve ?? []" :seed="p.slug" />
            <span class="kicker">{{ dateOf(p.updatedAt) }}<template v-if="p.noindex"> · hidden from search</template></span>
            <span class="card-title serif">{{ p.title }}</span>
            <span v-if="p.total" class="small muted">{{ compactMoney(p.total, p.currency) }} across {{ p.companies }} companies</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section id="samples" class="container" aria-labelledby="samples-heading">
      <div class="panel samples">
        <h2 id="samples-heading">Try it with a sample file</h2>
        <p class="serif">
          Download one, then upload it on the generate page. Only the fintech file is real data;
          the others are invented to test files of different shapes.
        </p>
        <ul>
          <li v-for="s in samples" :key="s.file">
            <a :href="`/samples/${s.file}`" download>{{ s.label }}</a>
            <span class="small muted"> {{ s.note }}</span>
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>

<style scoped>
.intro { display: grid; gap: 40px; padding-top: 48px; align-items: start; }
.intro > * { min-width: 0; }
@media (min-width: 960px) { .intro { grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 72px; } }
.intro h1 { margin: 12px 0 18px; font-size: clamp(2rem, 1.4rem + 2vw, 2.9rem); max-width: 18ch; }
.standfirst { font-size: 1.0625rem; line-height: 1.6; max-width: 52ch; }
.cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 28px; }

.featured { display: grid; gap: 10px; text-decoration: none; color: var(--ink); }
.featured-title { font-size: 1.5rem; font-weight: 600; line-height: 1.25; }
.featured:hover .featured-title { text-decoration: underline; text-underline-offset: 4px; }

.reports { padding-top: 88px; }
.reports h2 { margin-bottom: 28px; }
.cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 40px 32px; }
.card { display: grid; gap: 10px; text-decoration: none; color: var(--ink); }
.card-title { font-size: 1.25rem; font-weight: 600; line-height: 1.3; }
.card:hover .card-title { text-decoration: underline; text-underline-offset: 4px; }

#samples { padding-top: 88px; }
.samples { display: grid; gap: 14px; }
.samples ul { margin: 0; padding-left: 1.1em; display: grid; gap: 6px; }
.samples a { font-weight: 650; }
</style>
