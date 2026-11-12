import { useEffect } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { create } from 'zustand'
import { RULES } from './catalog'
import { distM } from './geo'
import { useStore } from './store'
import type { Fix, LatLng } from './types'

/* ───────────── Plugin native Android: deteksi lokasi palsu ─────────────
   Ditulis di android/app/src/main/java/id/kompack/app/IntegrityPlugin.java */

interface NativeIntegrity {
  check(): Promise<{ mock: boolean; emulator: boolean; lat?: number; lng?: number; acc?: number; time?: number }>
}
const Integrity = registerPlugin<NativeIntegrity>('Integrity')
export const isNative = Capacitor.isNativePlatform()

async function nativeCheck(): Promise<{ mock: boolean; emulator: boolean }> {
  if (!isNative) return { mock: false, emulator: false }
  try {
    const r = await Integrity.check()
    return { mock: !!r.mock, emulator: !!r.emulator }
  } catch {
    return { mock: false, emulator: false }
  }
}

/* ───────────── Status GPS ───────────── */

export type GeoStatus = 'idle' | 'locating' | 'ok' | 'denied' | 'unavailable'

interface GeoState {
  pos: LatLng | null
  acc: number | null
  at: number
  status: GeoStatus
  /** waktu terakhir posisi "melompat" tidak wajar */
  jumpAt: number | null
  /** arah hadap (derajat dari utara): dari GPS saat bergerak, atau kompas HP */
  heading: number | null
  nonce: number
  retry: () => void
}

export const useGeo = create<GeoState>()((set) => ({
  pos: null,
  acc: null,
  at: 0,
  heading: null,
  status: 'idle',
  jumpAt: null,
  nonce: 0,
  retry: () => set((s) => ({ nonce: s.nonce + 1, status: 'locating' })),
}))

/**
 * Posisi uji (mode uji di PC): hanya diisi lewat tombol yang jelas
 * ("Jalan otomatis", "Pindah ke lokasi misi"), tidak pernah dengan mengetuk peta.
 */
export const useTestPos = create<{ pos: LatLng | null; set: (p: LatLng | null) => void }>()((set) => ({
  pos: null,
  set: (pos) => set({ pos }),
}))

function onHeading(h: number | null | undefined) {
  if (h === null || h === undefined || !Number.isFinite(h)) return
  useGeo.setState({ heading: ((h % 360) + 360) % 360 })
}

function onReading(lat: number, lng: number, acc: number, at: number, heading?: number | null) {
  if (heading !== null && heading !== undefined && Number.isFinite(heading)) onHeading(heading)
  const prev = useGeo.getState()
  let jumpAt = prev.jumpAt
  if (prev.pos && prev.at && at > prev.at) {
    const dt = (at - prev.at) / 1000
    const d = distM(prev.pos, { lat, lng })
    // hanya hitung bila kedua pembacaan cukup akurat
    if (acc < 100 && (prev.acc ?? 999) < 100 && d - acc - (prev.acc ?? 0) > 0 && d / Math.max(dt, 1) > RULES.maxSpeed) jumpAt = at
  }
  useGeo.setState({ pos: { lat, lng }, acc, at, status: 'ok', jumpAt })
}

/** Sekali ambil lokasi (dipakai saat pendaftaran). Tidak pernah melempar error. */
export function locateOnce(timeout = 12000): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    let done = false
    const finish = (v: LatLng | null) => {
      if (!done) {
        done = true
        resolve(v)
      }
    }
    const timer = setTimeout(() => finish(null), timeout + 1500)
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(timer)
          onReading(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp || Date.now())
          finish({ lat: p.coords.latitude, lng: p.coords.longitude })
        },
        () => {
          clearTimeout(timer)
          finish(null)
        },
        { enableHighAccuracy: true, timeout, maximumAge: 10000 },
      )
    } catch {
      clearTimeout(timer)
      finish(null)
    }
  })
}

/** Dipasang sekali di App: memantau GPS terus (juga di mode uji), seperti aplikasi peta. */
export function useGeoWatcher(): void {
  const registered = useStore((s) => s.meId !== null)
  const nonce = useGeo((s) => s.nonce)

  /* kompas HP untuk arah hadap titik biru saat diam */
  useEffect(() => {
    if (!registered || typeof window === 'undefined') return
    const onOrient = (e: DeviceOrientationEvent) => {
      const ios = (e as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading
      if (typeof ios === 'number') onHeading(ios)
      else if (e.absolute && typeof e.alpha === 'number') onHeading(360 - e.alpha)
    }
    window.addEventListener('deviceorientationabsolute', onOrient as EventListener)
    window.addEventListener('deviceorientation', onOrient as EventListener)
    return () => {
      window.removeEventListener('deviceorientationabsolute', onOrient as EventListener)
      window.removeEventListener('deviceorientation', onOrient as EventListener)
    }
  }, [registered])

  useEffect(() => {
    if (!registered) return
    if (!('geolocation' in navigator)) {
      useGeo.setState({ status: 'unavailable' })
      return
    }
    useGeo.setState((s) => ({ status: s.pos ? 'ok' : 'locating' }))
    let id: number | null = null
    try {
      id = navigator.geolocation.watchPosition(
        (p) => onReading(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp || Date.now(), p.coords.heading),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) useGeo.setState({ status: 'denied', pos: null, acc: null, at: 0 })
          else if (!useGeo.getState().pos) useGeo.setState({ status: 'unavailable' })
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
      )
    } catch {
      useGeo.setState({ status: 'unavailable' })
    }
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      navigator.geolocation.getCurrentPosition(
        p => onReading(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp || Date.now()),
        () => {}, { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
      )
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
      if (id !== null) navigator.geolocation.clearWatch(id)
    }
  }, [registered, nonce])
}

export interface MyPos {
  pos: LatLng | null
  acc: number | null
  heading: number | null
  test: boolean
  /** posisi sedang diganti posisi uji (bukan GPS) */
  simulated: boolean
  status: GeoStatus
  jumpAt: number | null
  retry: () => void
}

/**
 * Posisi yang dipakai aplikasi: selalu GPS asli. Di mode uji, posisi uji hanya dipakai bila diaktifkan
 * lewat tombol; bila GPS tidak tersedia di PC, dipakai titik rumah saat mendaftar.
 */
export function useMyPos(): MyPos {
  const test = useStore((s) => s.testMode)
  const home = useStore((s) => s.home)
  const override = useTestPos((s) => s.pos)
  const geo = useGeo()
  if (test && override) return { pos: override, acc: 5, heading: geo.heading, test, simulated: true, status: 'ok', jumpAt: null, retry: geo.retry }
  if (test && !geo.pos) return { pos: home, acc: null, heading: geo.heading, test, simulated: true, status: 'ok', jumpAt: null, retry: geo.retry }
  return { pos: geo.pos, acc: geo.acc, heading: geo.heading, test, simulated: false, status: geo.status, jumpAt: test ? null : geo.jumpAt, retry: geo.retry }
}

/**
 * Ambil posisi terkini untuk tindakan penting (check-in, foto).
 * Di Android juga memeriksa apakah lokasi berasal dari aplikasi pemalsu GPS.
 */
export async function currentFix(): Promise<Fix | null> {
  const s = useStore.getState()
  if (s.testMode) {
    const g = useGeo.getState()
    const p = useTestPos.getState().pos ?? g.pos ?? s.home
    if (!p) return null
    const n = await nativeCheck()
    return { ...p, acc: 5, at: Date.now(), simulated: true, mock: n.mock, emulator: n.emulator }
  }
  const g = useGeo.getState()
  let fresh = g.pos && Date.now() - g.at < 8000 ? { ...g.pos, acc: g.acc ?? 999, at: g.at } : null
  if (!fresh) {
    const p = await locateOnce(10000)
    const g2 = useGeo.getState()
    if (p && g2.pos) fresh = { ...g2.pos, acc: g2.acc ?? 999, at: g2.at }
  }
  if (!fresh) return null
  const n = await nativeCheck()
  return { ...fresh, simulated: false, mock: n.mock, emulator: n.emulator }
}
