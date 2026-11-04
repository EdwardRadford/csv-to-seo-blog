<script setup lang="ts">
import type { PageRecord, PageSummary } from '#shared/page'
import { place } from '#shared/copy'
import { compactMoney, count, percent } from '#shared/format'

// The one template every report uses. It only reads the stored record:
// data and stats for the figures, content.copy for the words.
const route = useRoute()
const slug = String(route.params.slug)
const { siteUrl, siteName } = useRuntimeConfig().public

const { data: page, error } = await useFetch<PageRecord & { protected: boolean }>(`/api/pages/${slug}`)
if (error.value || !page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Report not found', fatal: true })
}
const { data: allPages } = await useFetch<PageSummary[]>('/api/pages')

const p = page.value
const copy = computed(() => page.value!.content.copy)
const stats = computed(() => page.value!.stats)
const where = place(p.subject.geography)
const scope = [p.subject.qualifier, p.subject.industry].filter(Boolean).join(' ')
const money = (v: number) => compactMoney(v, stats.value.currency)
const url = `${siteUrl}/${slug}`
const updated = computed(() => new Date(page.value!.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }))
const wordCount = computed(() => [copy.value.intro, ...copy.value.overview, ...copy.value.keyFindings, copy.value.locations ?? '', ...copy.value.outlook, ...copy.value.faq.flatMap((f) => [f.question, f.answer])].join(' ').split(/\s+/).length)
const readingTime = computed(() => Math.max(2, Math.round((wordCount.value + page.value!.data.companies.length * 12) / 230)))
const related = computed(() => (allPages.value ?? []).filter((r) => r.slug !== slug && !r.noindex).slice(0, 4))

const figures = computed(() => {
  const s = stats.value
  const list: { label: string; value: string }[] = []
  if (s.total !== null) list.push({ label: `Combined ${p.subject.metric.toLowerCase()}`, value: money(s.total) })
  if (s.median !== null) list.push({ label: 'Median company', value: money(s.median) })
  if (s.top10Share !== null) list.push({ label: 'Share held by the top 10', value: percent(s.top10Share) })
  if (s.regions[0]) list.push({ label: `Based in ${s.regions[0].label}`, value: `${count(s.regions[0].count)} of ${count(s.companies)}` })
  else if (s.founded) list.push({ label: 'Median founding year', value: String(s.founded.median) })
  return list
})

const amounts = computed(() => page.value!.data.companies.map((c) => c.amount ?? 0))

useSeoMeta({
  title: p.title,
  description: copy.value.metaDescription,
  ogTitle: p.title,
  ogDescription: copy.value.metaDescription,
  ogType: 'article',
  ogUrl: url,
  ogSiteName: siteName,
  ogLocale: 'en_GB',
  articlePublishedTime: p.createdAt,
  articleModifiedTime: p.updatedAt,
  twitterCard: 'summary',
  twitterTitle: p.title,
  twitterDescription: copy.value.metaDescription,
  robots: p.noindex ? 'noindex, follow' : 'index, follow, max-snippet:-1'
})
useHead({
  link: [{ rel: 'canonical', href: url }],
  script: [{
    type: 'application/ld+json',
    // Escaping "<" stops company text from ever closing the script tag.
    innerHTML: JSON.stringify(reportJsonLd(p, url, siteUrl, siteName)).replace(/</g, '\\u003c')
  }]
})

// Managing the page: regenerate the copy from the stored data, or delete it.
const busy = ref<'' | 'regenerate' | 'delete'>('')
const message = ref('')
async function regenerate() {
  busy.value = 'regenerate'
  message.value = 'Rewriting the copy. This takes up to 30 seconds.'
  try {
    const result = await $fetch<{ copySource: string }>(`/api/pages/${slug}/regenerate`, { method: 'POST' })
    await refreshNuxtData()
    message.value = result.copySource === 'ai' ? 'New copy written and checked.' : 'The AI was unavailable, so template copy was used.'
  } catch (e: any) {
    message.value = e?.data?.statusMessage ?? 'Something went wrong. Please try again.'
  } finally {
    busy.value = ''
  }
}
async function remove() {
  busy.value = 'delete'
  try {
    await $fetch(`/api/pages/${slug}`, { method: 'DELETE' })
    await navigateTo('/')
  } catch (e: any) {
    message.value = e?.data?.statusMessage ?? 'Could not delete this page.'
    busy.value = ''
  }
}
const confirmDelete = ref(false)
</script>

<template>
  <article v-if="page" class="report">
    <header class="hero">
      <div class="container">
        <nav aria-label="Breadcrumb" class="crumbs small">
          <NuxtLink to="/">Reports</NuxtLink>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{{ page.subject.industry }}</span>
        </nav>
        <p class="eyebrow">{{ page.subject.industry }} · {{ page.subject.geography }}</p>
        <h1>{{ page.title }}</h1>
        <p class="byline small muted">
          Updated <time :datetime="page.updatedAt">{{ updated }}</time>
          · {{ count(page.data.companies.length) }} companies
          · {{ readingTime }} min read
        </p>
        <p class="lead">{{ copy.intro }}</p>

        <dl class="figures">
          <div v-for="f in figures" :key="f.label">
            <dt>{{ f.label }}</dt>
            <dd class="num">{{ f.value }}</dd>
          </div>
        </dl>
      </div>
    </header>

    <div class="container body">
      <section class="prose" aria-labelledby="overview">
        <h2 id="overview">An overview of {{ scope }} companies in {{ where }}</h2>
        <p v-for="(para, i) in copy.overview" :key="i">{{ para }}</p>
      </section>

      <section class="prose" aria-labelledby="findings">
        <h2 id="findings">Key findings</h2>
        <ul class="findings">
          <li v-for="(finding, i) in copy.keyFindings" :key="i">{{ finding }}</li>
        </ul>
      </section>

      <section aria-labelledby="charts">
        <h2 id="charts" class="visually-hidden">The data in charts</h2>
        <div class="charts">
          <ConcentrationChart
            v-if="stats.total !== null && page.data.companies.length > 10"
            class="wide"
            caption="Funding by rank"
            :amounts="amounts"
            :top-share="stats.top10Share !== null ? percent(stats.top10Share) : null"
            :summary="`Column chart of ${page.subject.metric.toLowerCase()} for each company in rank order. The top 10 hold ${stats.top10Share !== null ? percent(stats.top10Share) : 'most'} of the total.`"
          />
          <BarList v-if="stats.regions.length > 1" title="Where the companies are based" unit="companies" :items="stats.regions.map((r) => ({ label: r.label, value: r.count }))" />
          <BarList v-if="stats.tags.length > 1" title="Most common categories" unit="companies" :items="stats.tags.map((t) => ({ label: t.label, value: t.count }))" />
          <BarList v-if="stats.sizes.length > 1 && stats.amountBySize.length" title="Employees" unit="companies" :items="stats.sizes.map((s) => ({ label: s.label, value: s.count }))" />
          <BarList v-if="stats.stages.length > 1" title="Stage" unit="companies" :items="stats.stages.map((s) => ({ label: s.label, value: s.count }))" />
        </div>
      </section>

      <section v-if="copy.locations" class="prose" aria-labelledby="locations">
        <h2 id="locations">Where the companies are based</h2>
        <p>{{ copy.locations }}</p>
      </section>

      <section aria-labelledby="ranking" class="ranking">
        <h2 id="ranking">The top {{ count(page.data.companies.length) }} {{ scope }} companies in {{ where }}</h2>
        <p class="muted small">
          Ranked by {{ page.subject.metric.toLowerCase() }}{{ page.data.rankedByAmount ? ' (highest first)' : '' }}.
          Select a column heading to sort.
        </p>
        <RankingTable
          :companies="page.data.companies"
          :has="page.data.has"
          :currency="page.data.currency"
          :metric="page.subject.metric"
          :caption="page.title"
        />
      </section>

      <section class="prose" aria-labelledby="outlook">
        <h2 id="outlook">What to watch</h2>
        <p v-for="(para, i) in copy.outlook" :key="i">{{ para }}</p>
      </section>

      <section class="prose" aria-labelledby="faq">
        <h2 id="faq">Frequently asked questions</h2>
        <div v-for="(item, i) in copy.faq" :key="i" class="faq">
          <h3>{{ item.question }}</h3>
          <p>{{ item.answer }}</p>
        </div>
      </section>

      <section class="prose method" aria-labelledby="method">
        <h2 id="method">Methodology</h2>
        <p>
          This page was generated from <strong>{{ page.source.filename }}</strong>
          ({{ count(page.source.rows) }} rows). Companies are ranked by
          {{ page.data.rankedByAmount ? `${page.subject.metric.toLowerCase()}, highest first, because the file had no usable rank column` : 'the rank given in the file' }}.
          Every figure on the page is calculated in code from that file.
        </p>
        <p>
          <template v-if="page.content.source === 'ai'">
            The written copy was drafted by {{ page.content.model }} from those figures, then checked automatically:
            any number that isn't a correctly rounded version of a calculated figure would have been rejected.
          </template>
          <template v-else>
            The written copy is template text built from the calculated figures, because the AI was unavailable when this page was generated.
          </template>
        </p>
        <p class="small muted">
          Columns used:
          <span v-for="(header, role, i) in page.source.columns" :key="role">{{ i ? ', ' : '' }}{{ role }} = “{{ header }}”</span>.
        </p>
        <ul v-if="page.source.warnings.length" class="small muted">
          <li v-for="w in page.source.warnings" :key="w">{{ w }}</li>
        </ul>
      </section>

      <aside class="manage" aria-labelledby="manage">
        <h2 id="manage" class="small-heading">Manage this page</h2>
        <div class="actions">
          <button class="button secondary" :disabled="!!busy" @click="regenerate">
            {{ busy === 'regenerate' ? 'Rewriting…' : 'Regenerate the copy' }}
          </button>
          <template v-if="!page.protected">
            <button v-if="!confirmDelete" class="button danger" :disabled="!!busy" @click="confirmDelete = true">Delete page</button>
            <template v-else>
              <span class="small">Delete this page for good?</span>
              <button class="button danger" :disabled="!!busy" @click="remove">Yes, delete</button>
              <button class="button secondary" @click="confirmDelete = false">Cancel</button>
            </template>
          </template>
          <span v-else class="small muted">This example page can't be deleted.</span>
        </div>
        <p v-if="message" class="small" role="status">{{ message }}</p>
      </aside>

      <nav v-if="related.length" aria-labelledby="related" class="related">
        <h2 id="related" class="small-heading">More reports</h2>
        <ul>
          <li v-for="r in related" :key="r.slug">
            <NuxtLink :to="`/${r.slug}`">{{ r.title }}</NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
  </article>
</template>

<style scoped>
.hero { background: var(--surface); border-bottom: 1px solid var(--line); padding-block: 40px 48px; }
.crumbs { display: flex; gap: 8px; margin-bottom: 24px; color: var(--muted); text-transform: capitalize; }
.crumbs a { color: var(--muted); }
.eyebrow { margin-bottom: 12px; text-transform: uppercase; }
h1 { max-width: 22ch; }
.byline { margin-top: 16px; }
.lead { font-size: var(--step-1); line-height: 1.5; max-width: 60ch; margin-top: 24px; }

.figures { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1px; margin: 40px 0 0; background: var(--line); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.figures div { background: var(--bg); padding: 20px; }
.figures dt { font-size: var(--step--1); color: var(--muted); }
.figures dd { margin: 6px 0 0; font-size: var(--step-2); font-weight: 700; letter-spacing: -0.02em; }

.body { display: grid; gap: 56px; padding-top: 56px; }
/* Grid items default to min-width: auto, which lets the wide table push the page past a phone's width. */
.body > *, .ranking > * { min-width: 0; }
.prose h2 { margin-bottom: 4px; }
.findings { padding-left: 1.2em; display: grid; gap: 10px; margin: 0; }
.findings li::marker { color: var(--accent); }

.charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 16px; }
.charts .wide { grid-column: 1 / -1; }

.ranking { display: grid; gap: 12px; }

.faq + .faq { margin-top: 24px; }
.faq h3 { font-size: var(--step-0); margin-bottom: 6px; }

.method { border-top: 1px solid var(--line); padding-top: 32px; }
.method ul { padding-left: 1.2em; margin: 0; }

.small-heading { font-size: var(--step-0); font-weight: 600; margin-bottom: 12px; }
.manage { border: 1px dashed var(--line); border-radius: var(--radius); padding: 20px; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.manage [role='status'] { margin-top: 12px; }

.related ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
</style>
