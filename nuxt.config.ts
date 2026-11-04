// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  nitro: {
    // Cloudflare Workers (module syntax); bindings come from wrangler.jsonc.
    preset: 'cloudflare_module'
  },

  runtimeConfig: {
    // Set in production with: wrangler secret put NUXT_GEMINI_API_KEY
    geminiApiKey: '',
    public: {
      siteUrl: 'https://csv-to-seo-blog.edward-radford.workers.dev'
    }
  }
})
