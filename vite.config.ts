import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite'
import vue from '@vitejs/plugin-vue'
import { transformAssetUrls } from 'vite-plugin-vuetify'

const { version } = createRequire(import.meta.url)('./package.json')

// in a git worktree node_modules resolves to the main checkout, outside vite's
// default fs allow list — allow the actually-resolved node_modules dir too
const nodeModulesDir = resolve(
  dirname(createRequire(import.meta.url).resolve('@fortawesome/fontawesome-free/package.json')),
  '../..'
)

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
          // both spellings: '**/' does not match files at the root of the output dir
          globIgnores: ['**/__test-*', '__test-*'],
          // the app ships as one inlined chunk (see inlineDynamicImports); keep this well above its
          // size or workbox drops it from the precache manifest without failing the build
          maximumFileSizeToCacheInBytes: 20 * 1024 ** 2,
        },
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
    // stamped by scripts/deployBeta.mjs and deliberately not committed, so each beta
    // upload is identifiable without a source change
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __BETA_BUILD__: JSON.stringify(process.env.BETA_BUILD ?? ''),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd()), nodeModulesDir],
      },
    },
    build: {
      // docs/ is what GitHub Pages serves for production and is committed; the beta
      // build goes somewhere ignored so publishing it never touches the prod output
      outDir: mode === 'beta' ? 'dist-beta' : 'docs',
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
          sanitizeFileName: (name) => {
            // Sanitizes file names generated during the build process:
            // - Replaces spaces with dashes ('-').
            // - Removes invalid characters that are not alphanumeric, underscores (_), periods (.), or dashes (-).
            return name
              .replace(/\s+/g, '-') // Replaces spaces with dashes.
              .replace(/[^a-zA-Z0-9_.-]/g, '') // Removes all invalid characters.
          },
        },
      },
    },
    base: process.env.VITE_BASE_URL,
  })
}
