import { fileURLToPath, URL } from 'node:url'

import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { transformAssetUrls } from 'vite-plugin-vuetify'

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) }
  return defineConfig({
    plugins: [
      vue({
        template: { transformAssetUrls },
      }),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*'],
        },
        includeAssets: ['**/*'],
        manifest: {
          scope: process.env.VITE_BASE_URL,
          name: process.env.VITE_APP_NAME,
          short_name: process.env.VITE_APP_SHORT_NAME,
          display: 'fullscreen',
          description: process.env.VITE_APP_DESCRIPTION,
          theme_color: '#41B883',
          icons: [
            {
              src: 'logo-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'logo-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'docs',
    },
    base: process.env.VITE_BASE_URL,
  })
}
