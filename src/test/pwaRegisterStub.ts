/** `virtual:pwa-register` under test: no service worker exists, so registering does nothing. */
export const registerSW = () => () => Promise.resolve()
