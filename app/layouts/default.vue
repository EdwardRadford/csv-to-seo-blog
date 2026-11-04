<script setup lang="ts">
const { siteName } = useRuntimeConfig().public
</script>

<template>
  <div class="shell">
    <a class="skip-link" href="#main">Skip to content</a>
    <p class="strip small">
      Every page here is generated from an uploaded CSV.
      <NuxtLink to="/upload">Make one from your own data</NuxtLink>
    </p>
    <header class="site-header">
      <div class="container bar">
        <NuxtLink to="/" class="brand">
          <svg width="18" height="18" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="1" y="12" width="5" height="9" fill="currentColor" opacity="0.5" />
            <rect x="8.5" y="7" width="5" height="14" fill="currentColor" opacity="0.75" />
            <rect x="16" y="1" width="5" height="20" fill="currentColor" />
          </svg>
          {{ siteName }}
        </NuxtLink>
        <nav aria-label="Main" class="nav">
          <NuxtLink to="/">Reports</NuxtLink>
          <NuxtLink to="/#samples">Sample data</NuxtLink>
          <a href="https://github.com/EdwardRadford/csv-to-seo-blog#how-it-works">How it works</a>
        </nav>
        <NuxtLink to="/upload" class="button yellow">Generate a report</NuxtLink>
      </div>
    </header>

    <main id="main" tabindex="-1">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="container foot">
        <div>
          <p class="foot-brand">{{ siteName }}</p>
          <p class="small">
            Rankings generated from company datasets. Every figure is calculated in code from the uploaded file;
            the written copy is drafted by Gemini and checked against those figures before it is published.
          </p>
        </div>
        <div>
          <p class="foot-head small">Explore</p>
          <ul class="small">
            <li><NuxtLink to="/">All reports</NuxtLink></li>
            <li><NuxtLink to="/upload">Generate a report</NuxtLink></li>
            <li><NuxtLink to="/#samples">Sample data</NuxtLink></li>
          </ul>
        </div>
        <div>
          <p class="foot-head small">Project</p>
          <ul class="small">
            <li><a href="https://github.com/EdwardRadford/csv-to-seo-blog">Source on GitHub</a></li>
            <li><a href="https://github.com/EdwardRadford/csv-to-seo-blog#how-it-works">How it works</a></li>
            <li><a href="/sitemap.xml">Sitemap</a></li>
          </ul>
        </div>
      </div>
      <div class="container legal small">Built by Edward Radford for a technical assessment.</div>
    </footer>
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; display: flex; flex-direction: column; }
main { flex: 1; outline: none; }

.strip { background: var(--yellow); color: var(--night); text-align: center; padding: 7px 16px; margin: 0; }
.strip a { color: var(--night); margin-left: 6px; }

.site-header { background: var(--night); color: #fff; }
.bar { display: flex; align-items: center; gap: 32px; min-height: 68px; flex-wrap: wrap; padding-block: 10px; }
.brand { display: inline-flex; align-items: center; gap: 9px; font-weight: 700; color: #fff; text-decoration: none; font-size: 1.05rem; }
.brand svg { color: var(--yellow); }
.nav { display: flex; gap: 24px; flex: 1; flex-wrap: wrap; }
.nav a { color: #fff; text-decoration: none; font-weight: 600; font-size: var(--step--1); }
.nav a:hover { color: var(--yellow); }
@media (max-width: 640px) { .nav { display: none; } .bar { justify-content: space-between; } }

.site-footer { background: var(--night); color: rgba(255, 255, 255, 0.75); margin-top: 120px; }
.foot { display: grid; gap: 32px; padding-block: 56px 32px; }
@media (min-width: 760px) { .foot { grid-template-columns: 2fr 1fr 1fr; } }
.foot-brand { color: #fff; font-weight: 700; margin-bottom: 10px; }
.foot p.small { max-width: 52ch; line-height: 1.6; }
.foot-head { color: #fff; font-weight: 650; margin-bottom: 10px; }
.foot ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.foot a { color: rgba(255, 255, 255, 0.75); text-decoration: none; }
.foot a:hover { color: var(--yellow); }
.legal { border-top: 1px solid rgba(255, 255, 255, 0.12); padding-block: 20px 28px; color: rgba(255, 255, 255, 0.55); }
</style>
