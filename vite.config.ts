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
        // prompt, not autoUpdate: a silent swap gives the user no way to know a new build
        // landed, and an installed app may never close long enough for one to take over
        registerType: 'prompt',
        injectRegister: null, // useAppUpdate registers it, so it can hold the callbacks
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
          theme_color: process.env.VITE_PRIMARY_COLOR,
          // each environment ships its own icon files, named by VITE_ICON_BASE
          icons: [192, 512].map((size) => ({
            src: `${process.env.VITE_ICON_BASE}-${size}.png`,
            sizes: `${size}x${size}`,
            type: 'image/png',
          })),
        },
      }),
    ],
    // stamped by scripts/deployBeta.mjs and deliberately not committed, so each beta
    // upload is identifiable without a source change
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __BETA_BUILD__: JSON.stringify(process.env.BETA_BUILD ?? ''),
    },
    // Signalsmith builds its worklet by stringifying its own source into a Blob, so anything
    // that lowers the class fields in it lowers them into `__publicField` helpers that do not
    // exist in worklet scope - the processor then dies on load and the node never becomes
    // ready, which shows up as play() hanging rather than as an error. The dev dep optimiser
    // does exactly that, so it is kept away from it. The production build targets modern
    // browsers and leaves the fields alone; if the build target is ever lowered, check
    // `__publicField` has not appeared in the bundle.
    optimizeDeps: { exclude: ['signalsmith-stretch'] },
    resolve: {
      alias: {
        // the branded logo is a bundled asset, so the ISLA build swaps the module
        // rather than the components referencing it; must precede the '@' prefix
        ...(mode === 'isla'
          ? {
              '@/assets/logo.svg': fileURLToPath(new URL('./src/assets/logo-isla.svg', import.meta.url)),
            }
          : {}),
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd()), nodeModulesDir],
      },
    },
    build: {
      // docs/ is what GitHub Pages serves for production and is committed; the beta and
      // ISLA builds go somewhere ignored so publishing them never touches the prod output
      outDir: mode === 'beta' ? 'dist-beta' : mode === 'isla' ? 'dist-isla' : 'docs',
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
