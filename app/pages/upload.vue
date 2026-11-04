<script setup lang="ts">
import { ROLES, type Role } from '#shared/types'

// Upload in two steps: read the file and show what was detected, then generate.
// Showing the detected columns first lets a person fix a wrong guess before any copy is written.
useSeoMeta({ title: 'Generate a report', robots: 'noindex, follow' })

interface Analysis {
  filename: string
  rows: number
  columns: { header: string; type: string; filled: number; examples: string[] }[]
  mapping: Record<Role, string | null>
  source: Partial<Record<Role, 'header' | 'type' | 'ai'>>
  industry: string | null
  geography: string | null
  aiUsed: boolean
  warnings: string[]
  preview: { rank: number; name: string; amount: number | null }[]
}

const ROLE_LABELS: Record<Role, string> = {
  name: 'Company name',
  rank: 'Rank',
  amount: 'Amount (ranks the list)',
  region: 'Location',
  stage: 'Stage',
  size: 'Employees',
  description: 'Description',
  website: 'Website',
  tags: 'Sectors or tags',
  founded: 'Year founded'
}
const SOURCE_LABELS = { header: 'from the header', type: 'from the values', ai: 'suggested by AI' }

const csv = ref('')
const analysis = ref<Analysis | null>(null)
const mapping = ref<Record<Role, string | null>>({} as Record<Role, string | null>)
const industry = ref('')
const geography = ref('UK')
const noindex = ref(false)
const step = ref<'choose' | 'reading' | 'review' | 'generating'>('choose')
const error = ref('')
const dragging = ref(false)
const elapsed = ref(0)
const status = ref('')
const reviewHeading = ref<HTMLElement | null>(null)
let controller: AbortController | null = null

async function readFile(file: File | undefined) {
  error.value = ''
  if (!file) return
  if (file.size > 1_000_000) { error.value = 'That file is over 1 MB. Please upload a smaller CSV.'; return }
  if (!/\.(csv|tsv|txt)$/i.test(file.name)) { error.value = 'Please choose a .csv file.'; return }
  step.value = 'reading'
  status.value = 'Reading the file.'
  try {
    csv.value = decode(await file.arrayBuffer())
    const result = await $fetch<Analysis>('/api/analyse', { method: 'POST', body: { csv: csv.value, filename: file.name } })
    analysis.value = result
    mapping.value = { ...result.mapping }
    industry.value = result.industry ?? ''
    geography.value = result.geography || 'UK'
    step.value = 'review'
    status.value = `Read ${result.rows} rows. Check the detected columns below.`
    // Move focus to the new step so keyboard and screen reader users land in the right place.
    await nextTick()
    reviewHeading.value?.focus()
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'The file could not be read.'
    step.value = 'choose'
  }
}

function decode(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1252').decode(bytes)
  }
}

function onDrop(event: DragEvent) {
  dragging.value = false
  if (step.value === 'reading') return
  readFile(event.dataTransfer?.files?.[0])
}

const canGenerate = computed(() => Boolean(mapping.value.name) && industry.value.trim().length > 1)

let timer: ReturnType<typeof setInterval> | undefined
async function generate() {
  if (!analysis.value || !canGenerate.value) return
  step.value = 'generating'
  error.value = ''
  elapsed.value = 0
  status.value = 'Generating the page. This usually takes 10 to 30 seconds, and up to a minute when the AI is busy.'
  timer = setInterval(() => { elapsed.value++ }, 1000)
  // Give up after 90 seconds rather than leave the page waiting forever.
  controller = new AbortController()
  const timeout = setTimeout(() => controller?.abort(), 90_000)
  try {
    const result = await $fetch<{ slug: string; editToken?: string }>('/api/generate', {
      method: 'POST',
      signal: controller.signal,
      body: { csv: csv.value, filename: analysis.value.filename, mapping: mapping.value, industry: industry.value, geography: geography.value, noindex: noindex.value }
    })
    // Keep the edit token in this browser only, so this visitor can regenerate or delete their page.
    try { if (result.editToken) localStorage.setItem(`edit:${result.slug}`, result.editToken) } catch {}
    status.value = 'Page ready. Opening it now.'
    await navigateTo(`/${result.slug}`)
  } catch (e: any) {
    error.value = controller?.signal.aborted
      ? 'Generation was cancelled or took too long. Please try again.'
      : e?.data?.statusMessage ?? 'Generation failed. Please try again.'
    status.value = ''
    step.value = 'review'
  } finally {
    clearInterval(timer)
    clearTimeout(timeout)
    controller = null
  }
}

function cancel() {
  controller?.abort()
}

function startOver() {
  analysis.value = null
  csv.value = ''
  error.value = ''
  step.value = 'choose'
}
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="container page">
    <header class="head">
      <p class="kicker">Generate a report</p>
      <h1>Upload a company dataset</h1>
      <p class="lead muted">
        Any CSV with one company per row works. Column names don't need to match anything; the app works them out
        and shows you what it found before writing a word.
      </p>
    </header>

    <ol class="steps small" aria-label="Progress">
      <li :class="{ on: step === 'choose' || step === 'reading' }" :aria-current="step === 'choose' || step === 'reading' ? 'step' : undefined">1. Choose a file</li>
      <li :class="{ on: step === 'review' }" :aria-current="step === 'review' ? 'step' : undefined">2. Check the columns</li>
      <li :class="{ on: step === 'generating' }" :aria-current="step === 'generating' ? 'step' : undefined">3. Generate</li>
    </ol>

    <p v-if="error" class="notice warn" role="alert">{{ error }}</p>

    <!-- Step 1 -->
    <section v-if="step === 'choose' || step === 'reading'" aria-labelledby="choose-heading">
      <h2 id="choose-heading" class="visually-hidden">Choose a file</h2>
      <label
        class="drop"
        :class="{ dragging }"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDrop"
      >
        <input type="file" accept=".csv,text/csv" class="visually-hidden" :disabled="step === 'reading'" @change="readFile(($event.target as HTMLInputElement).files?.[0])">
        <span class="drop-title">{{ step === 'reading' ? 'Reading the file...' : 'Drop a CSV here, or select to browse' }}</span>
        <span class="small muted">Up to 1 MB and 2,000 rows. Need one? <NuxtLink to="/#samples">Download a sample</NuxtLink>.</span>
      </label>
    </section>

    <!-- Step 2 -->
    <section v-else-if="analysis && step === 'review'" aria-labelledby="review-heading" class="review">
      <div class="file-line">
        <h2 id="review-heading" ref="reviewHeading" tabindex="-1">{{ analysis.filename }}</h2>
        <span class="muted small">{{ analysis.rows }} rows · {{ analysis.columns.length }} columns</span>
        <button type="button" class="link small" @click="startOver">Choose a different file</button>
      </div>

      <ul v-if="analysis.warnings.length" class="notice small">
        <li v-for="w in analysis.warnings" :key="w">{{ w }}</li>
      </ul>

      <form class="grid" @submit.prevent="generate">
        <fieldset>
          <legend>What the report is about</legend>
          <label>
            Industry
            <input v-model="industry" required maxlength="40" placeholder="e.g. healthtech">
            <span class="hint small muted">{{ analysis.aiUsed ? 'Suggested by AI from the file.' : 'Taken from the file name.' }} Used in the title and copy.</span>
          </label>
          <label>
            Location
            <input v-model="geography" required maxlength="40" placeholder="e.g. UK">
          </label>
          <label class="check">
            <input v-model="noindex" type="checkbox">
            Hide this page from search engines (noindex)
          </label>
        </fieldset>

        <fieldset>
          <legend>Columns detected</legend>
          <p class="small muted">Change any that are wrong. Only the company name is required.</p>
          <div class="roles">
            <label v-for="role in ROLES" :key="role" class="role">
              <span class="role-head">
                {{ ROLE_LABELS[role] }}
                <span v-if="mapping[role] && analysis.source[role] && mapping[role] === analysis.mapping[role]" class="tag">{{ SOURCE_LABELS[analysis.source[role]!] }}</span>
              </span>
              <select v-model="mapping[role]">
                <option :value="null">Not in this file</option>
                <option v-for="col in analysis.columns" :key="col.header" :value="col.header">{{ col.header }}</option>
              </select>
            </label>
          </div>
        </fieldset>

        <div class="go">
          <button class="button" type="submit" :disabled="!canGenerate">Generate the page</button>
          <span class="small muted">Usually 10 to 30 seconds; up to a minute when the AI is busy.</span>
        </div>
      </form>
    </section>

    <!-- Step 3 -->
    <section v-if="step === 'generating'" class="working">
      <div class="spinner" aria-hidden="true" />
      <p><strong>Cleaning the data, calculating the figures, writing and checking the copy</strong></p>
      <p class="small muted num">{{ elapsed }} seconds. You'll be taken to the new page when it's ready.</p>
      <button type="button" class="button secondary" @click="cancel">Cancel</button>
    </section>

    <!-- Always in the page, so screen readers reliably announce changes to it. -->
    <p class="visually-hidden" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>

<style scoped>
.page { padding-top: 48px; display: grid; gap: 32px; max-width: 880px; }
.lead { margin-top: 12px; max-width: 60ch; }
.head h1 { margin-top: 8px; }
.steps { list-style: none; padding: 0; margin: 0; display: flex; gap: 24px; color: var(--muted); flex-wrap: wrap; }
.steps .on { color: var(--accent); font-weight: 600; }

.drop {
  display: grid; place-items: center; gap: 8px; text-align: center;
  min-height: 220px; padding: 32px; cursor: pointer;
  border: 2px dashed var(--line); border-radius: var(--radius); background: var(--panel);
}
.drop:has(input:focus-visible) { outline: 3px solid var(--accent); outline-offset: 2px; }
.drop:hover, .drop.dragging, .drop:focus-within { border-color: var(--accent); background: #f1f0fb; }
.drop-title { font-weight: 600; font-size: var(--step-1); }

.review { display: grid; gap: 24px; }
.file-line { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; }
.file-line h2 { font-size: var(--step-1); overflow-wrap: anywhere; outline: none; }
.link { background: none; border: 0; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; font: inherit; }
.notice ul, ul.notice { margin: 0; padding-left: 32px; }

.grid { display: grid; gap: 24px; }
fieldset { border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; margin: 0; display: grid; gap: 16px; }
legend { font-weight: 600; padding: 0 6px; }
label { display: grid; gap: 6px; font-weight: 500; font-size: var(--step--1); }
input:not([type='checkbox']), select {
  font: inherit; font-size: var(--step-0); padding: 10px 12px; color: var(--ink);
  background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius); width: 100%;
}
input:focus, select:focus { border-color: var(--accent); }
.check { display: flex; align-items: center; gap: 10px; font-weight: 400; }
.check input { width: 18px; height: 18px; accent-color: var(--accent); }
.roles { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); gap: 16px; }
.role-head { display: flex; justify-content: space-between; gap: 8px; }
.role .tag { color: var(--accent); font-weight: 400; font-size: 0.8rem; }
.go { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

.working { display: grid; justify-items: center; text-align: center; gap: 8px; padding: 48px 16px; border: 1px solid var(--line); border-radius: var(--radius); }
.spinner { width: 32px; height: 32px; border-radius: 50%; border: 3px solid var(--line); border-top-color: var(--accent); animation: spin 0.9s linear infinite; margin-bottom: 8px; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 3s; } }
</style>
