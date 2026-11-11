import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import '@fontsource-variable/public-sans/index.css'
import './styles.css'
import App from './App'
import './lib/theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA (offline + bisa dipasang) hanya untuk versi web; di dalam APK aset sudah ikut terpasang.
if (!Capacitor.isNativePlatform() && import.meta.env.PROD) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}
