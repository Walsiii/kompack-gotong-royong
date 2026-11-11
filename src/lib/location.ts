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
  nonce: number
  retry: () => void
}

export const useGeo = create<GeoState>()((set) => ({
  pos: null,
  acc: null,
  at: 0,
  status: 'idle',
  jumpAt: null,
  nonce: 0,
  retry: () => set((s) => ({ nonce: s.nonce + 1, status: 'locating' })),
}))

function onReading(lat: number, lng: number, acc: number, at: number) {
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

/** Dipasang sekali di App: memantau GPS selama mode uji mati. */
export function useGeoWatcher(): void {
  const testMode = useStore((s) => s.testMode)
  const registered = useStore((s) => s.meId !== null)
  const nonce = useGeo((s) => s.nonce)

  useEffect(() => {
    if (!registered || testMode) return
    if (!('geolocation' in navigator)) {
      useGeo.setState({ status: 'unavailable' })
      return
    }
    useGeo.setState((s) => ({ status: s.pos ? 'ok' : 'locating' }))
    let id: number | null = null
    try {
      id = navigator.geolocation.watchPosition(
        (p) => onReading(p.coords.latitude, p.coords.longitude, p.coords.accuracy, p.timestamp || Date.now()),
        (err) => {
          if (err.code === err.PERMISSION_DENIED) useGeo.setState({ status: 'denied' })
          else if (!useGeo.getState().pos) useGeo.setState({ status: 'unavailable' })
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
      )
    } catch {
      useGeo.setState({ status: 'unavailable' })
    }
    return () => {
      if (id !== null) navigator.geolocation.clearWatch(id)
    }
  }, [testMode, registered, nonce])
}

export interface MyPos {
  pos: LatLng | null
  acc: number | null
  test: boolean
  status: GeoStatus
  jumpAt: number | null
  retry: () => void
}

/** Posisi yang dipakai aplikasi: GPS asli, atau titik uji (mode uji). */
export function useMyPos(): MyPos {
  const test = useStore((s) => s.testMode)
  const simPos = useStore((s) => s.simPos)
  const home = useStore((s) => s.home)
  const geo = useGeo()
  if (test) return { pos: simPos ?? home, acc: 5, test, status: 'ok', jumpAt: null, retry: geo.retry }
  return { pos: geo.pos, acc: geo.acc, test, status: geo.status, jumpAt: geo.jumpAt, retry: geo.retry }
}

/**
 * Ambil posisi terkini untuk tindakan penting (check-in, foto).
 * Di Android juga memeriksa apakah lokasi berasal dari aplikasi pemalsu GPS.
 */
export async function currentFix(): Promise<Fix | null> {
  const s = useStore.getState()
  if (s.testMode) {
    const p = s.simPos ?? s.home
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
