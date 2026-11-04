<script setup lang="ts">
import type { NuxtError } from '#app'

// Shown for 404s and server errors, inside the normal site layout.
const props = defineProps<{ error: NuxtError }>()
const notFound = computed(() => props.error.statusCode === 404)
useSeoMeta({ title: notFound.value ? 'Page not found' : 'Something went wrong', robots: 'noindex, follow' })
</script>

<template>
  <NuxtLayout>
    <div class="container page">
      <p class="kicker">Error {{ error.statusCode }}</p>
      <h1>{{ notFound ? 'We couldn\'t find that page' : 'Something went wrong' }}</h1>
      <p class="serif">
        {{ notFound
          ? 'The report may have been deleted, or the address may be mistyped.'
          : 'Please try again in a moment.' }}
      </p>
      <div class="actions">
        <NuxtLink to="/" class="button" @click="clearError()">See all reports</NuxtLink>
        <NuxtLink to="/upload" class="button secondary" @click="clearError()">Generate a report</NuxtLink>
      </div>
    </div>
  </NuxtLayout>
</template>

<style scoped>
.page { padding-top: 72px; display: grid; gap: 16px; max-width: 640px; }
.actions { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
</style>
