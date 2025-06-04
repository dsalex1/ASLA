if (!self.define) {
  let e,
    s = {}
  const i = (i, l) => (
    (i = new URL(i + '.js', l).href),
    s[i] ||
      new Promise((s) => {
        if ('document' in self) {
          const e = document.createElement('script')
          ;(e.src = i), (e.onload = s), document.head.appendChild(e)
        } else (e = i), importScripts(i), s()
      }).then(() => {
        let e = s[i]
        if (!e) throw new Error(`Module ${i} didn’t register its module`)
        return e
      })
  )
  self.define = (l, r) => {
    const n = e || ('document' in self ? document.currentScript.src : '') || location.href
    if (s[n]) return
    let t = {}
    const o = (e) => i(e, n),
      u = { module: { uri: n }, exports: t, require: o }
    s[n] = Promise.all(l.map((e) => u[e] || o(e))).then((e) => (r(...e), t))
  }
}
define(['./workbox-3e911b1d'], function (e) {
  'use strict'
  self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        { url: 'assets/AppLayout.vuevuetypescriptsetuptruelang-BNmHHtd5.js', revision: null },
        { url: 'assets/auth--A0yA-1s.js', revision: null },
        { url: 'assets/fa-brands-400-Dur5g48u.ttf', revision: null },
        { url: 'assets/fa-brands-400-O7nZalfM.woff2', revision: null },
        { url: 'assets/fa-regular-400-Bf3rG5Nx.ttf', revision: null },
        { url: 'assets/fa-regular-400-DgEfZSYE.woff2', revision: null },
        { url: 'assets/fa-solid-900-BV3CbEM2.ttf', revision: null },
        { url: 'assets/fa-solid-900-DOQJEhcS.woff2', revision: null },
        { url: 'assets/fa-v4compatibility-B9MWI-E6.ttf', revision: null },
        { url: 'assets/fa-v4compatibility-BX8XWJtE.woff2', revision: null },
        { url: 'assets/helpers-D7Qv92-Z.js', revision: null },
        { url: 'assets/index-B9ObJYfV.js', revision: null },
        { url: 'assets/index-C9bBjSeL.css', revision: null },
        { url: 'assets/Login-BgEDS-GA.js', revision: null },
        { url: 'assets/logo-DW4Ev_FE.svg', revision: null },
        { url: 'assets/plugin-vueexport-helper-DlAUqK2U.js', revision: null },
        { url: 'assets/SetlistCreateUpdate-BT6RzEEO.css', revision: null },
        { url: 'assets/SetlistCreateUpdate-hVyDsY4p.js', revision: null },
        { url: 'assets/SetlistRead-6dtV6y6J.css', revision: null },
        { url: 'assets/SetlistsIndex-CTuPEV4b.js', revision: null },
        { url: 'assets/Settings-BSj1VZYC.js', revision: null },
        { url: 'assets/Settings-Dk6xmiep.css', revision: null },
        { url: 'assets/sheetBaseDirectory-D1dr36hr.js', revision: null },
        { url: 'favicon.png', revision: 'd0097bcce18709204ba671022be00f7e' },
        { url: 'index.html', revision: '93f3e48bc0a3c6b8e0f03a301a782cf5' },
        { url: 'logo-192.png', revision: '73d68843e656e5f30ec38ebf7a8aed88' },
        { url: 'logo-512.png', revision: 'd0097bcce18709204ba671022be00f7e' },
        { url: 'logo.svg', revision: '0ff8cfbb47dfced8d2d0cd8bea7c750b' },
        { url: 'manifest.webmanifest', revision: '61731d4186513254143e4dcbb6f0256a' },
        { url: 'registerSW.js', revision: '2e0665151922ce34ca3d1dda51f71bbb' },
        { url: 'logo-192.png', revision: '73d68843e656e5f30ec38ebf7a8aed88' },
        { url: 'favicon.png', revision: 'd0097bcce18709204ba671022be00f7e' },
        { url: 'logo-512.png', revision: 'd0097bcce18709204ba671022be00f7e' },
        { url: 'logo.svg', revision: '0ff8cfbb47dfced8d2d0cd8bea7c750b' },
        { url: 'manifest.webmanifest', revision: '61731d4186513254143e4dcbb6f0256a' },
      ],
      {}
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(new e.NavigationRoute(e.createHandlerBoundToURL('index.html')))
})
