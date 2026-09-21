import { writeFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

/** Writes dist/supabase.config.json so a host can swap projects without rebuilding JS. */
function emitSupabaseConfig(env: Record<string, string>): Plugin {
  return {
    name: 'emit-supabase-config',
    closeBundle() {
      const url = env.VITE_SUPABASE_URL?.trim()
      const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
      if (!url || !anonKey) return
      writeFileSync(
        path.resolve('dist/supabase.config.json'),
        `${JSON.stringify({ url, anonKey }, null, 2)}\n`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [
      react(),
      tailwindcss(),
      emitSupabaseConfig(env),
      VitePWA({
        registerType: 'autoUpdate',
        // Service worker is disabled in dev to avoid stale index.html while building.
        devOptions: { enabled: false },
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'GouriNidhi',
          short_name: 'GouriNidhi',
          description: 'Chit Fund Management Made Simple',
          theme_color: '#0f766e',
          background_color: '#faf9f7',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          navigateFallback: 'index.html',
          navigateFallbackDenylist: [/^\/supabase\.config\.json$/i],
          globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
  }
})
