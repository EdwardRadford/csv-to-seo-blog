// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  css: ['~/assets/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'en-GB' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        // Fetch the heading font alongside the HTML: the cover number is the largest element on the page.
        { rel: 'preload', href: '/fonts/public-sans-latin.woff2', as: 'font', type: 'font/woff2', crossorigin: '' }
      ],
      meta: [{ name: 'theme-color', content: '#111116' }]
    }
  },

  nitro: {
    // Cloudflare Workers (module syntax); bindings come from wrangler.jsonc.
    preset: 'cloudflare_module',
    // Nitro rewrites `typeof window` to "undefined" when bundling for the server. Papa Parse has
    // that phrase inside a string (its web-worker code), and the rewrite breaks the string.
    // Turning the rewrite off is safe: on Workers, `typeof window` is "undefined" anyway.
    replace: { 'typeof window': 'typeof window' },
    // Generated pages live in KV in production and in .data/pages when running locally.
    storage: {
      pages: { driver: 'cloudflare-kv-binding', binding: 'PAGES' }
    },
    devStorage: {
      pages: { driver: 'fs', base: './.data/pages' }
    }
  },

  routeRules: {
    // Security headers on every response. Nuxt needs inline scripts for its hydration
    // data and the JSON-LD, hence 'unsafe-inline' for scripts; nothing loads from other origins.
    '/**': {
      headers: {
        'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'permissions-policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-frame-options': 'DENY'
      }
    },
    // Fonts never change name, so browsers can keep them for a year.
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    '/samples/**': { headers: { 'cache-control': 'public, max-age=86400' } },
    // API responses are live data.
    '/api/**': { headers: { 'cache-control': 'no-store' } }
  },

  runtimeConfig: {
    // Set in production with: wrangler secret put NUXT_GEMINI_API_KEY
    geminiApiKey: '',
    // Lets the site owner regenerate or delete any page. Set with: wrangler secret put NUXT_ADMIN_TOKEN
    adminToken: '',
    // Comma-separated slugs that can't be deleted (the example fintech page).
    protectedSlugs: 'top-100-seed-stage-fintech-companies-in-the-uk-2026',
    public: {
      siteUrl: 'https://csv-to-seo-blog.edward-radford.workers.dev',
      siteName: 'Sector Rankings'
    }
  }
})
