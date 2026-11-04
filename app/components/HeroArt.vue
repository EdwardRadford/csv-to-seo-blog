<script setup lang="ts">
// The cover illustration for a report, drawn in code so every page gets its own:
// the list size as a giant number, and the real funding curve along the bottom.
const props = defineProps<{
  count: number
  /** Amounts in rank order, scaled 0 to 1. */
  curve: number[]
  /** Short figure shown in the yellow disc, e.g. "£622m". */
  figure?: string | null
  /** Varies the background shapes so each report's cover looks different. */
  seed?: string
}>()

const LAYOUTS = [
  [{ x: 96, y: 92, w: 200, h: 160 }, { x: 384, y: 54, w: 150, h: 150 }],
  [{ x: 60, y: 40, w: 170, h: 170 }, { x: 330, y: 120, w: 230, h: 140 }],
  [{ x: 140, y: 150, w: 260, h: 120 }, { x: 430, y: 30, w: 130, h: 190 }]
]
const shapes = computed(() => {
  let h = 0
  for (const ch of props.seed ?? '') h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return LAYOUTS[h % LAYOUTS.length]!
})

const W = 640
const H = 400
const bars = computed(() => {
  const list = props.curve.slice(0, 40)
  const step = 460 / Math.max(1, list.length)
  return list.map((v, i) => ({ x: 150 + i * step, w: Math.max(2, step * 0.72), h: 6 + v * 92, top: i < 3 }))
})
const numberSize = computed(() => (String(props.count).length >= 3 ? 230 : 270))
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="art" role="img" :aria-label="`Illustration: the number ${count} above a chart of funding by rank`">
    <rect :width="W" :height="H" fill="var(--navy)" />
    <rect :x="shapes[0]!.x" :y="shapes[0]!.y" :width="shapes[0]!.w" :height="shapes[0]!.h" fill="var(--accent)" />
    <rect :x="shapes[1]!.x" :y="shapes[1]!.y" :width="shapes[1]!.w" :height="shapes[1]!.h" fill="#2e2c68" />
    <text x="330" y="262" text-anchor="middle" class="big" :font-size="numberSize">{{ count }}</text>
    <circle cx="116" cy="300" r="12" fill="#fff" />
    <circle cx="116" cy="332" r="12" fill="#fff" />
    <circle cx="116" cy="364" r="12" fill="var(--yellow)" />
    <g v-if="figure" transform="translate(528, 120)">
      <circle r="62" fill="var(--yellow)" />
      <text y="9" text-anchor="middle" class="figure">{{ figure }}</text>
    </g>
    <g transform="translate(0, 384)">
      <rect v-for="(b, i) in bars" :key="i" :x="b.x" :y="-b.h" :width="b.w" :height="b.h" :fill="b.top ? 'var(--yellow)' : 'var(--accent-light)'" :opacity="b.top ? 1 : 0.55" />
    </g>
  </svg>
</template>

<style scoped>
.art { display: block; width: 100%; height: auto; }
.big { font-family: var(--sans); font-weight: 900; fill: var(--accent-light); letter-spacing: -0.04em; }
.figure { font-family: var(--sans); font-weight: 800; font-size: 25px; fill: var(--night); letter-spacing: -0.02em; }
</style>
