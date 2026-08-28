// registers the service worker and starts watching for new builds; imported here rather
// than from the prompt so it also happens on routes that render no layout, like login
import '@/composables/useAppUpdate'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import { VueFire, VueFireAuth } from 'vuefire'
import { app as firebaseApp } from './plugins/firebase'

// Import our custom CSS
import './main.scss'

// Vuetify
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, fa } from 'vuetify/iconsets/fa'
import '@fortawesome/fontawesome-free/css/all.css'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'customLightTheme',
    themes: {
      customLightTheme: {
        dark: false,
        colors: {
          background: '#f7f7f7',
          surface: '#FFFFFF',
          primary: '#38A700',
          secondary: '#A72608',
        },
      },
    },
  },
  icons: {
    defaultSet: 'fa',
    aliases,
    sets: {
      fa,
    },
  },
})

//dayjs
import dayjs from 'dayjs'
//import 'dayjs/locale/de' // import locale
//dayjs.locale('de') // use locale
import relativeTime from 'dayjs/plugin/relativeTime'
dayjs.extend(relativeTime)

import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.use(VueFire, {
  firebaseApp,
  modules: [VueFireAuth()],
})

app.use(vuetify)

app.mount('#app')
