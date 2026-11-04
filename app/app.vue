<script setup lang="ts">
const { siteName } = useRuntimeConfig().public
// "Top 100 ... | 2026 - Sector Rankings", the way Beauhurst suffixes its own titles.
useHead({ titleTemplate: (title) => (title && title !== siteName && !title.startsWith(siteName) ? `${title} - ${siteName}` : title ?? siteName) })
</script>

<template>
  <NuxtLayout>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </NuxtLayout>
</template>
