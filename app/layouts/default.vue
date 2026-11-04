<script setup lang="ts">
const { siteName } = useRuntimeConfig().public
</script>

<template>
  <div class="shell">
    <a class="skip-link" href="#main">Skip to content</a>
    <header class="site-header">
      <div class="container bar">
        <NuxtLink to="/" class="brand">
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="1" y="12" width="5" height="9" rx="1" fill="currentColor" opacity="0.45" />
            <rect x="8.5" y="7" width="5" height="14" rx="1" fill="currentColor" opacity="0.7" />
            <rect x="16" y="1" width="5" height="20" rx="1" fill="currentColor" />
          </svg>
          {{ siteName }}
        </NuxtLink>
        <nav aria-label="Main">
          <NuxtLink to="/">Reports</NuxtLink>
          <NuxtLink to="/upload" class="button">Generate a report</NuxtLink>
        </nav>
      </div>
    </header>

    <main id="main" tabindex="-1">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="container foot">
        <p>
          Every figure on these pages is calculated in code from the uploaded data.
          The written copy is drafted by Gemini and checked against those figures before it is published.
        </p>
        <p>
          <a href="https://github.com/EdwardRadford/csv-to-seo-blog">Source on GitHub</a>
          · Built by Edward Radford
        </p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; display: flex; flex-direction: column; }
main { flex: 1; outline: none; }

.site-header { border-bottom: 1px solid var(--line); }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 64px; flex-wrap: wrap; }
.brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-weight: 700; color: var(--ink); text-decoration: none; letter-spacing: -0.01em;
}
.brand svg { color: var(--accent); }
nav { display: flex; align-items: center; gap: 20px; }
nav a:not(.button) { color: var(--muted); text-decoration: none; font-weight: 500; font-size: var(--step--1); }
nav a:not(.button):hover, nav a.router-link-exact-active:not(.button) { color: var(--ink); }

.site-footer { border-top: 1px solid var(--line); margin-top: 96px; background: var(--surface); }
.foot { padding-block: 32px; display: grid; gap: 8px; color: var(--muted); font-size: var(--step--1); max-width: var(--wide); }
.foot p:first-child { max-width: 70ch; }
</style>
