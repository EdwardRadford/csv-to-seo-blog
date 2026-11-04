<script setup lang="ts">
// A line of AI copy with known company names in bold. Text only, never v-html.
const props = defineProps<{ text: string; names: string[] }>()
const parts = computed(() => emphasise(props.text, props.names))
</script>

<template>
  <template v-for="(part, i) in parts" :key="i"><strong v-if="part.bold">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template>
</template>
