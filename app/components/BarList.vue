<script setup lang="ts">
// Horizontal bars built from HTML, not SVG: the labels stay real, readable text
// at any screen width, and the whole chart is in the server-rendered page.
const props = defineProps<{
  title: string
  items: { label: string; value: number; display?: string }[]
  /** Unit for screen readers, e.g. "companies". */
  unit: string
  limit?: number
}>()

const shown = computed(() => props.items.slice(0, props.limit ?? 8))
const max = computed(() => Math.max(1, ...shown.value.map((i) => i.value)))
</script>

<template>
  <figure class="chart">
    <figcaption>{{ title }}</figcaption>
    <ol class="bars">
      <li v-for="item in shown" :key="item.label" :class="{ top: item.value === max }">
        <span class="label">{{ item.label }}</span>
        <span class="track" aria-hidden="true">
          <span class="fill" :style="{ width: `${(item.value / max) * 100}%` }" />
        </span>
        <span class="value num">
          {{ item.display ?? item.value.toLocaleString('en-GB') }}
          <span class="visually-hidden">{{ unit }}</span>
        </span>
      </li>
    </ol>
    <p v-if="items.length > shown.length" class="more small muted">
      Plus {{ items.length - shown.length }} more.
    </p>
  </figure>
</template>

<style scoped>
.chart { margin: 0; padding: 24px; border: 1px solid var(--line); border-radius: var(--radius); }
figcaption { font-weight: 600; margin-bottom: 16px; }
.bars { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
li { display: grid; grid-template-columns: minmax(96px, 42%) 1fr auto; align-items: center; gap: 12px; font-size: var(--step--1); }
.label { overflow-wrap: anywhere; line-height: 1.3; }
.track { height: 10px; background: var(--surface); border-radius: 999px; overflow: hidden; }
.fill { display: block; height: 100%; background: var(--accent); border-radius: 999px; min-width: 3px; }
li:not(.top) .fill { opacity: 0.5; }
.value { font-weight: 600; min-width: 3ch; text-align: right; }
.more { margin-top: 12px; }
</style>
