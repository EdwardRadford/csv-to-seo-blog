<script setup lang="ts">
import type { PageRecord, PageSummary } from '#shared/page'
import { place } from '#shared/copy'
import { compactMoney, count, metricLabel, percent, sentenceCase } from '#shared/format'

// The one template every report uses. It only reads the stored record:
// data and stats for the figures, content.copy for the words.
const route = useRoute()
const slug = String(route.params.slug)
const { siteUrl, siteName } = useRuntimeConfig().public

const { data: page, error } = await useFetch<PageRecord & { protected: boolean }>(`/api/pages/${slug}`)
if (error.value || !page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Report not found', fatal: true })
}
const { data: related } = await useFetch<PageSummary[]>('/api/pages', {
  key: `related-${slug}`,
  transform: (pages) => pages.filter((r) => r.slug !== slug && !r.noindex).slice(0, 3)
})

const p = page.value
// Older pages stored the raw header ("total_funding_usd"); tidy it for display either way.
const metric = metricLabel(p.subject.metric)
const copy = computed(() => page.value!.content.copy)
const stats = computed(() => page.value!.stats)
const where = place(p.subject.geography)
// "seed-stage fintech" in a sentence, but "AI" rather than "ai".
const scope = sentenceCase([p.subject.qualifier, p.subject.industry].filter(Boolean).join(' '))
const crumb = sentenceCase(p.subject.industry.charAt(0).toUpperCase() + p.subject.industry.slice(1))
const money = (v: number) => compactMoney(v, stats.value.currency)
const url = `${siteUrl}/${slug}`
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const wordCount = computed(() => [copy.value.intro, ...copy.value.overview, ...copy.value.keyFindings, copy.value.locations ?? '', ...copy.value.outlook, ...copy.value.faq.flatMap((f) => [f.question, f.answer])].join(' ').split(/\s+/).length)
const readingTime = computed(() => Math.max(2, Math.round((wordCount.value + page.value!.data.companies.length * 12) / 230)))
const names = computed(() => page.value!.data.companies.map((c) => c.name))
const curve = computed(() => {
  const list = page.value!.data.companies.map((c) => c.amount ?? 0)
  const max = Math.max(1, ...list)
  return list.map((a) => a / max)
})

const figures = computed(() => {
  const s = stats.value
  const list: { label: string; value: string }[] = []
  if (s.total !== null) list.push({ label: `Combined ${metric.toLowerCase()}`, value: money(s.total) })
  if (s.median !== null) list.push({ label: 'Median company', value: money(s.median) })
  if (s.top10Share !== null) list.push({ label: 'Held by the top 10', value: percent(s.top10Share) })
  if (s.regions[0]) list.push({ label: `Based in ${s.regions[0].label}`, value: `${count(s.regions[0].count)} of ${count(s.companies)}` })
  else if (s.founded) list.push({ label: 'Median founding year', value: String(s.founded.median) })
  return list
})

const amounts = computed(() => page.value!.data.companies.map((c) => c.amount ?? 0))
const hasCharts = computed(() => (stats.value.total !== null && page.value!.data.companies.length > 10) || stats.value.regions.length > 1 || stats.value.tags.length > 1)

const sections = computed(() => [
  { id: 'overview', label: 'Overview', show: true },
  { id: 'findings', label: 'Key findings', show: true },
  { id: 'charts', label: 'The data in charts', show: hasCharts.value },
  { id: 'locations', label: 'Where they are based', show: Boolean(copy.value.locations) },
  { id: 'method', label: 'Methodology', show: true },
  { id: 'ranking', label: `Top ${page.value!.data.companies.length} ranking`, show: true },
  { id: 'outlook', label: 'What to watch', show: true },
  { id: 'faq', label: 'FAQ', show: true }
].filter((s) => s.show))

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
  twitterCard: 'summary_large_image',
  ogImage: `${siteUrl}/og.png`,
  ogImageWidth: 1200,
  ogImageHeight: 630,
  ogImageAlt: 'Sector Rankings: a large number 100 above a chart of funding by rank',
  twitterImage: `${siteUrl}/og.png`,
  twitterTitle: p.title,
  twitterDescription: copy.value.metaDescription,
  robots: p.noindex || route.query.sort ? 'noindex, follow' : 'index, follow, max-snippet:-1'
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
    const result = await $fetch<{ copySource: string }>(`/api/pages/${slug}/regenerate`, { method: 'POST', headers: authHeaders() })
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
    await $fetch(`/api/pages/${slug}`, { method: 'DELETE', headers: authHeaders() })
    try { localStorage.removeItem(`edit:${slug}`) } catch {}
    await navigateTo('/')
  } catch (e: any) {
    message.value = e?.data?.statusMessage ?? 'Could not delete this page.'
    busy.value = ''
  }
}
const confirmDelete = ref(false)
const editToken = ref<string | null>(null)
onMounted(() => {
  try { editToken.value = localStorage.getItem(`edit:${slug}`) } catch {}
})
const authHeaders = () => ({ 'x-edit-token': editToken.value ?? '' })
</script>

<template>
  <article v-if="page" class="report">
    <div class="container grid hero">
      <header class="side">
        <nav aria-label="Breadcrumb" class="crumbs small">
          <NuxtLink to="/">Reports</NuxtLink>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{{ crumb }}</span>
        </nav>
        <p class="date serif small"><time :datetime="page.updatedAt">{{ dateOf(page.updatedAt) }}</time></p>
        <h1>{{ page.title }}</h1>
        <p class="standfirst serif">{{ copy.metaDescription }}</p>
        <p class="byline serif small">
          Words <NuxtLink to="/#about">{{ siteName }} research</NuxtLink><br>
          {{ readingTime }} min read
        </p>
      </header>
      <figure class="cover">
        <HeroArt :seed="page.slug" :count="page.data.companies.length" :curve="curve" :figure="stats.total !== null ? money(stats.total) : null" />
      </figure>
    </div>

    <div class="container grid">
      <nav class="toc side" aria-label="On this page">
        <p class="toc-head small">On this page</p>
        <ul>
          <li v-for="s in sections" :key="s.id"><a :href="`#${s.id}`">{{ s.label }}</a></li>
        </ul>
      </nav>

      <div class="main">
        <div class="prose intro">
          <p><Rich :text="copy.intro" :names="names" /></p>
        </div>

        <dl class="figures">
          <div v-for="f in figures" :key="f.label">
            <dt>{{ f.label }}</dt>
            <dd class="num">{{ f.value }}</dd>
          </div>
        </dl>

        <section class="prose" aria-labelledby="overview">
          <h2 id="overview">An overview of {{ scope }} companies in {{ where }}</h2>
          <p v-for="(para, i) in copy.overview" :key="i"><Rich :text="para" :names="names" /></p>
        </section>

        <section class="prose" aria-labelledby="findings">
          <h2 id="findings">Key findings</h2>
          <ul class="findings">
            <li v-for="(finding, i) in copy.keyFindings" :key="i"><Rich :text="finding" :names="names" /></li>
          </ul>
        </section>

        <section v-if="hasCharts" aria-labelledby="charts">
          <h2 id="charts">The data in charts</h2>
          <div class="charts">
            <ConcentrationChart
              v-if="stats.total !== null && page.data.companies.length > 10"
              class="wide"
              caption="Funding by rank"
              :amounts="amounts"
              :top-share="stats.top10Share !== null ? percent(stats.top10Share) : null"
              :summary="`Column chart of ${metric.toLowerCase()} for each company in rank order. The top 10 hold ${stats.top10Share !== null ? percent(stats.top10Share) : 'most'} of the total.`"
            />
            <BarList v-if="stats.regions.length > 1" title="Where the companies are based" unit="companies" :items="stats.regions.map((r) => ({ label: r.label, value: r.count }))" />
            <BarList v-if="stats.tags.length > 1" title="Most common categories" unit="companies" :items="stats.tags.map((t) => ({ label: t.label, value: t.count }))" />
            <BarList v-if="stats.sizes.length > 1 && stats.amountBySize.length" title="Employees" unit="companies" :items="stats.sizes.map((s) => ({ label: s.label, value: s.count }))" />
            <BarList v-if="stats.stages.length > 1" title="Stage" unit="companies" :items="stats.stages.map((s) => ({ label: s.label, value: s.count }))" />
          </div>
        </section>

        <section v-if="copy.locations" class="prose" aria-labelledby="locations">
          <h2 id="locations">Where the companies are based</h2>
          <p><Rich :text="copy.locations" :names="names" /></p>
        </section>

        <section class="prose panel method" aria-labelledby="method">
          <h2 id="method">Methodology</h2>
          <p>This ranking is built from the dataset <strong>{{ page.source.filename }}</strong> ({{ count(page.source.rows) }} rows). To be included, a company must:</p>
          <ul>
            <li>be listed in the dataset by name</li>
            <li v-if="page.data.has.amount">have a figure for {{ metric.toLowerCase() }}; companies without one are placed at the bottom</li>
          </ul>
          <p>
            Companies are ranked by
            {{ page.data.rankedByAmount ? `${metric.toLowerCase()}, highest first, because the file had no usable rank column` : 'the rank given in the file' }}.
            Every figure on this page is calculated in code from that file.
          </p>
          <p v-if="page.content.source === 'ai'">
            The written copy was drafted by {{ page.content.model }} from those figures, then checked automatically.
            Any number that isn't a correctly rounded version of a calculated figure is rejected before publishing.
          </p>
          <p v-else>
            The written copy is template text built from the calculated figures, because the AI was unavailable when this page was generated.
          </p>
          <p class="small">
            Columns used:
            <span v-for="(header, role, i) in page.source.columns" :key="role">{{ i ? ', ' : '' }}{{ role }} "{{ header }}"</span>.
            Analysis accurate as of {{ dateOf(page.updatedAt) }}.
          </p>
          <ul v-if="page.source.warnings.length" class="small">
            <li v-for="w in page.source.warnings" :key="w">{{ w }}</li>
          </ul>
        </section>
      </div>
    </div>

    <section class="container ranking" aria-labelledby="ranking">
      <h2 id="ranking">Top {{ count(page.data.companies.length) }} {{ scope }} companies in {{ where }}</h2>
      <p class="updated serif small">Last updated: {{ dateOf(page.updatedAt) }}</p>
      <RankingTable
        :companies="page.data.companies"
        :has="page.data.has"
        :currency="page.data.currency"
        :metric="metric"
        :caption="page.title"
      />
    </section>

    <div class="container grid">
      <div class="side" />
      <div class="main">
        <section class="prose" aria-labelledby="outlook">
          <h2 id="outlook">What to watch</h2>
          <p v-for="(para, i) in copy.outlook" :key="i"><Rich :text="para" :names="names" /></p>
        </section>

        <section class="prose" aria-labelledby="faq">
          <h2 id="faq">FAQ</h2>
          <div v-for="(item, i) in copy.faq" :key="i" class="faq">
            <h3>{{ item.question }}</h3>
            <p><Rich :text="item.answer" :names="names" /></p>
          </div>
        </section>

        <aside class="cta-block" aria-labelledby="cta">
          <h2 id="cta">Turn your own data into a report like this</h2>
          <p class="serif">Upload any CSV of companies. The columns are detected for you, every figure is calculated from the file, and the copy is checked before it is published.</p>
          <NuxtLink to="/upload" class="button yellow">Generate a report</NuxtLink>
        </aside>

        <aside v-if="editToken" class="manage" aria-labelledby="manage">
          <h2 id="manage" class="small-heading">Manage this page</h2>
          <div class="actions">
            <button class="button secondary" :disabled="!!busy" @click="regenerate">
              {{ busy === 'regenerate' ? 'Rewriting...' : 'Regenerate the copy' }}
            </button>
            <template v-if="!page.protected">
              <button v-if="!confirmDelete" class="button danger" :disabled="!!busy" @click="confirmDelete = true">Delete page</button>
              <template v-else>
                <span class="small">Delete this page for good?</span>
                <button class="button danger" :disabled="!!busy" @click="remove">Yes, delete</button>
                <button class="button secondary" :disabled="!!busy" @click="confirmDelete = false">Cancel</button>
              </template>
            </template>
            <span v-else class="small muted">This example page can't be deleted.</span>
          </div>
          <p v-if="message" class="small" role="status">{{ message }}</p>
        </aside>
      </div>
    </div>

    <section v-if="related?.length" class="container latest" aria-labelledby="related">
      <h2 id="related">Latest reports</h2>
      <ul>
        <li v-for="r in related" :key="r.slug">
          <NuxtLink :to="`/${r.slug}`" class="card">
            <HeroArt :count="r.companies" :curve="r.curve ?? []" :seed="r.slug" />
            <span class="date serif small">{{ dateOf(r.updatedAt) }}</span>
            <span class="card-title serif">{{ r.title }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
/* Two columns, as on Beauhurst's research pages: a narrow left column for the
   title block and contents, the article and cover art on the right. */
.grid { display: grid; gap: 32px; }
.grid > * { min-width: 0; }
@media (min-width: 960px) { .grid { grid-template-columns: 260px minmax(0, 1fr); gap: 72px; } }

.hero { padding-top: 24px; }
.crumbs { display: flex; gap: 8px; color: var(--muted); text-transform: capitalize; margin-bottom: 18px; }
.crumbs a { color: var(--muted); }
.date { color: var(--muted); margin-bottom: 14px; }
.side h1 { margin-bottom: 18px; }
.standfirst { font-size: 0.95rem; line-height: 1.55; color: var(--text); }
.byline { margin-top: 14px; color: var(--muted); line-height: 1.7; }
.file { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; overflow-wrap: anywhere; }
.cover { margin: 0; }

.toc { display: none; }
@media (min-width: 960px) {
  .toc { display: block; position: sticky; top: 24px; align-self: start; padding-top: 8px; }
}
.toc-head { font-weight: 650; color: var(--ink); margin-bottom: 10px; }
.toc ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; border-left: 2px solid var(--line); }
.toc a { display: block; padding: 5px 14px; margin-left: -2px; border-left: 2px solid transparent; color: var(--muted); text-decoration: none; font-size: var(--step--1); }
.toc a:hover { color: var(--ink); border-left-color: var(--accent); }

.main { display: grid; gap: 48px; padding-top: 32px; }
.main > * { min-width: 0; }
.intro p { font-size: 1.125rem; color: var(--ink); }

.figures { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 1px; margin: 0; background: var(--line); border: 1px solid var(--line); max-width: var(--measure); }
.figures div { background: var(--bg); padding: 18px 20px; }
.figures dt { font-size: var(--step--1); color: var(--muted); }
.figures dd { margin: 6px 0 0; font-size: 1.5rem; font-weight: 750; color: var(--ink); letter-spacing: -0.02em; }

h2 { scroll-margin-top: 24px; }
.findings { padding-left: 1.1em; margin: 0; display: grid; gap: 12px; }
.findings li::marker { color: var(--ink); }

.charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 16px; margin-top: 20px; }
.charts .wide { grid-column: 1 / -1; }

.method ul { padding-left: 1.1em; margin: 12px 0; display: grid; gap: 6px; }

.ranking { display: grid; gap: 10px; padding-top: 72px; max-width: 980px; }
.ranking h2 { text-align: center; margin-bottom: 24px; scroll-margin-top: 24px; }
.updated { color: var(--muted); }
.ranking > * { min-width: 0; }

.faq + .faq { margin-top: 22px; }
.faq h3 { margin-bottom: 6px; }

.small-heading { font-size: var(--step-0); font-weight: 650; margin-bottom: 12px; }
.cta-block { background: var(--night); color: rgba(255, 255, 255, 0.8); padding: 32px; display: grid; gap: 14px; justify-items: start; max-width: var(--measure); }
.cta-block h2 { color: #fff; font-size: var(--step-1); }
.manage { border-top: 1px solid var(--line); padding-top: 24px; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
.manage [role='status'] { margin-top: 12px; }

.latest { padding-top: 96px; }
.latest h2 { margin-bottom: 24px; }
.latest ul { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 32px; }
.card { display: grid; gap: 10px; text-decoration: none; color: var(--ink); }
.card-title { font-size: 1.25rem; font-weight: 600; line-height: 1.3; }
.card:hover .card-title { text-decoration: underline; text-underline-offset: 4px; }
</style>
