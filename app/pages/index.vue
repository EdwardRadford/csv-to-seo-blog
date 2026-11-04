<script setup lang="ts">
import type { PageSummary } from '#shared/page'

const { siteUrl, siteName } = useRuntimeConfig().public
const { data: pages } = await useFetch<(PageSummary & { protected: boolean })[]>('/api/pages')

const description = 'Data-led rankings of UK companies by sector, generated from company datasets. Upload a CSV and get a server-rendered, SEO-ready report.'
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
  { file: 'fintech-uk-seed-top-100.csv', label: 'Fintech (the real dataset)' },
  { file: 'healthtech-uk-top-50.csv', label: 'Healthtech, different column names' },
  { file: 'cleantech-europe.csv', label: 'Cleantech, dollars and no rank column' },
  { file: 'ai-startups-uk.csv', label: 'AI, extra columns and no location' },
  { file: 'messy-proptech.csv', label: 'Proptech, deliberately messy' }
]
const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
</script>

<template>
  <div>
    <section class="intro">
      <div class="container">
        <p class="eyebrow">CSV to SEO blog</p>
        <h1>Turn any company dataset into a ranked, search-ready report</h1>
        <p class="lead">
          Upload a CSV of companies. The app works out which column is which, calculates the statistics,
          has Gemini write the copy around those figures, checks every number, and publishes a server-rendered page.
        </p>
        <div class="cta">
          <NuxtLink to="/upload" class="button">Generate a report</NuxtLink>
          <a href="https://github.com/EdwardRadford/csv-to-seo-blog#how-it-works" class="button secondary">How it works</a>
        </div>
      </div>
    </section>

    <div class="container body">
      <section aria-labelledby="reports">
        <h2 id="reports">Reports</h2>
        <p v-if="!pages?.length" class="muted">No reports yet. Generate the first one.</p>
        <ul v-else class="cards">
          <li v-for="p in pages" :key="p.slug">
            <NuxtLink :to="`/${p.slug}`" class="card">
              <span class="eyebrow">{{ p.industry }}</span>
              <span class="title">{{ p.title }}</span>
              <span class="small muted">{{ p.companies }} companies · updated {{ shortDate(p.updatedAt) }}<template v-if="p.noindex"> · hidden from search</template></span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section aria-labelledby="samples" class="samples">
        <h2 id="samples">Try it with a sample file</h2>
        <p class="muted">Download one, then upload it. Only the fintech file is real data; the others are invented to test different file shapes.</p>
        <ul>
          <li v-for="s in samples" :key="s.file">
            <a :href="`/samples/${s.file}`" download>{{ s.label }}</a>
            <span class="small muted"> · {{ s.file }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.intro { background: var(--surface); border-bottom: 1px solid var(--line); padding-block: 56px; }
h1 { max-width: 20ch; margin-top: 12px; }
.lead { font-size: var(--step-1); line-height: 1.5; max-width: 58ch; margin-top: 20px; color: var(--muted); }
.cta { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 32px; }
.body { display: grid; gap: 56px; padding-top: 48px; }
h2 { margin-bottom: 20px; }
.cards { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 16px; }
.card { display: grid; gap: 8px; padding: 20px; height: 100%; border: 1px solid var(--line); border-radius: var(--radius); text-decoration: none; color: var(--ink); }
.card:hover { border-color: var(--accent); }
.card .title { font-weight: 600; font-size: var(--step-1); line-height: 1.3; }
.samples ul { padding-left: 1.2em; display: grid; gap: 6px; }
</style>
