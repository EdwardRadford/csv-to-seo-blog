<script setup lang="ts">
// One column per company, in rank order, so the long tail of funding is visible
// at a glance. The top 10 are drawn in the accent colour.
const props = defineProps<{
  amounts: number[]
  topShare: string | null
  caption: string
  summary: string
}>()

const width = 600
const height = 180
const max = computed(() => Math.max(1, ...props.amounts))
const step = computed(() => width / Math.max(1, props.amounts.length))
const bars = computed(() =>
  props.amounts.map((amount, i) => {
    const h = Math.max(1.5, (amount / max.value) * (height - 4))
    return { x: i * step.value, y: height - h, w: Math.max(1, step.value - (step.value > 4 ? 1.5 : 0.5)), h, top: i < 10 }
  })
)
</script>

<template>
  <figure class="chart">
    <figcaption>{{ caption }}</figcaption>
    <p v-if="topShare" class="callout"><strong class="num">{{ topShare }}</strong> of the money sits with the top 10.</p>
    <svg :viewBox="`0 0 ${width} ${height}`" preserveAspectRatio="none" role="img" :aria-label="summary">
      <rect v-for="(bar, i) in bars" :key="i" :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h" :class="{ top: bar.top }" />
    </svg>
    <div class="axis small muted" aria-hidden="true"><span>Rank 1</span><span>Rank {{ amounts.length }}</span></div>
  </figure>
</template>

<style scoped>
.chart { margin: 0; padding: 24px; border: 1px solid var(--line); border-radius: var(--radius); }
figcaption { font-weight: 600; margin-bottom: 4px; }
.callout { color: var(--muted); margin-bottom: 16px; font-size: var(--step--1); }
.callout strong { color: var(--accent); font-size: var(--step-1); }
svg { width: 100%; height: 160px; display: block; }
rect { fill: var(--bar); }
rect.top { fill: var(--accent); }
.axis { display: flex; justify-content: space-between; margin-top: 8px; border-top: 1px solid var(--line); padding-top: 6px; }
</style>
