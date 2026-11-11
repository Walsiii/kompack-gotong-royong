import type {} from 'geojson'
import { useEffect, useRef } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl'
import { CATS } from '../lib/catalog'
import { circleRing, ringCenter } from '../lib/geo'
import type { Category, LatLng, Ring } from '../lib/types'
import { avatarSvg, catIconSvg } from './art'
import { RASTER_TILES, kompackStyle } from './mapStyle'

export interface MapPin {
  id: string
  lat: number
  lng: number
  kind: 'quest' | 'laporan' | 'tolong'
  category: Category
  /** teks kecil di atas penanda, mis. "+50" */
  label?: string
  state: 'live' | 'off' | 'done'
}

export interface Neighbor {
  id: string
  name: string
  ring: Ring
}

interface Props {
  center: LatLng
  zoom?: number
  pins?: MapPin[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  me?: LatLng | null
  meAvatar?: number
  /** wilayah RT-mu: disorot, luar wilayah diredupkan */
  territory?: Ring | null
  /** batas wilayah tidak sah (merah) */
  territoryBad?: boolean
  neighbors?: Neighbor[]
  circle?: { lat: number; lng: number; radius: number; bad?: boolean } | null
  onMapClick?: (p: LatLng) => void
  threeD?: boolean
  focus?: { lat: number; lng: number; key: number | string; zoom?: number } | null
  padding?: { top?: number; bottom?: number; left?: number; right?: number }
  interactive?: boolean
  /** animasi terbang masuk saat peta pertama dimuat */
  intro?: boolean
  /** kamera berputar pelan mengelilingi titik tengah */
  orbit?: boolean
  onReady?: (map: MLMap) => void
  className?: string
}

/* ───────────── GeoJSON ───────────── */

const close = (ring: Ring): [number, number][] => {
  const c = ring.map((p) => [p.lng, p.lat] as [number, number])
  if (c.length) c.push(c[0])
  return c
}

function signedArea(c: [number, number][]): number {
  let s = 0
  for (let i = 0; i < c.length - 1; i++) s += c[i][0] * c[i + 1][1] - c[i + 1][0] * c[i][1]
  return s / 2
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

function polyFC(rings: Ring[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: rings
      .filter((r) => r.length >= 3)
      .map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [close(r)] } })),
  }
}

/** bidang gelap di luar wilayah (wilayah jadi "lubang") */
function maskFC(ring: Ring | null | undefined): GeoJSON.FeatureCollection {
  if (!ring || ring.length < 3) return EMPTY
  const c = ringCenter(ring)
  const d = 0.6
  const outer: [number, number][] = [
    [c.lng - d, c.lat - d],
    [c.lng + d, c.lat - d],
    [c.lng + d, c.lat + d],
    [c.lng - d, c.lat + d],
    [c.lng - d, c.lat - d],
  ]
  let hole = close(ring)
  if (Math.sign(signedArea(hole)) === Math.sign(signedArea(outer))) hole = hole.reverse()
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [outer, hole] } }] }
}

/* ───────────── Elemen penanda ───────────── */

function pinElement(p: MapPin, index: number): HTMLElement {
  const el = document.createElement('div')
  const color = CATS[p.category].color
  if (p.kind === 'quest') {
    el.className = `bk is-${p.state}`
    el.style.setProperty('--c', color)
    el.style.setProperty('--d', `${Math.min(index, 8) * 80}ms`)
    el.innerHTML = `<div class="bk-in"><div class="bk-ring"></div><div class="bk-base"></div><div class="bk-stem"></div><div class="bk-head">${catIconSvg(p.category)}${
      p.label ? `<span class="bk-pts">${p.label}</span>` : ''
    }</div></div>`
  } else {
    el.className = 'rp'
    el.style.setProperty('--c', p.kind === 'tolong' ? CATS.bantu.color : '#FF5A1F')
    el.style.setProperty('--d', `${Math.min(index, 8) * 80 + 200}ms`)
    el.innerHTML = `<div class="rp-head">${
      p.kind === 'tolong'
        ? catIconSvg('bantu', 17)
        : `<svg viewBox="0 0 24 24" width="17" height="17"><path d="M12 3.5 2.8 19.5h18.4z" fill="#FF5A1F"/><path d="M12 9.5v4.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.3" fill="#fff"/></svg>`
    }</div>`
  }
  el.setAttribute('role', 'button')
  el.setAttribute('aria-label', p.kind === 'quest' ? `Quest ${CATS[p.category].label}` : p.kind === 'tolong' ? 'Permintaan tolong' : 'Laporan warga')
  return el
}

function meElement(avatar: number): HTMLElement {
  const el = document.createElement('div')
  el.className = 'me-mk'
  el.innerHTML = `<div class="me-pulse"></div><div class="me-av">${avatarSvg(avatar)}</div>`
  return el
}

/* ───────────── Komponen ───────────── */

const PITCH = 58
const BEARING = -18

export function Map3D({
  center,
  zoom = 16.6,
  pins = [],
  selectedId,
  onSelect,
  me,
  meAvatar = 0,
  territory,
  territoryBad,
  neighbors = [],
  circle,
  onMapClick,
  threeD = true,
  focus,
  padding,
  interactive = true,
  intro,
  orbit,
  onReady,
  className = '',
}: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const loaded = useRef(false)
  const markers = useRef(new Map<string, { m: maplibregl.Marker; sig: string }>())
  const nbMarkers = useRef<maplibregl.Marker[]>([])
  const meMk = useRef<maplibregl.Marker | null>(null)
  const meAnim = useRef<number | null>(null)
  const cb = useRef({ onSelect, onMapClick, onReady })
  cb.current = { onSelect, onMapClick, onReady }
  const latest = useRef({ territory, neighbors, circle, threeD, padding })
  latest.current = { territory, neighbors, circle, threeD, padding }

  /* buat peta sekali */
  useEffect(() => {
    if (!el.current) return
    const map = new maplibregl.Map({
      container: el.current,
      style: kompackStyle(),
      center: [center.lng, center.lat],
      zoom: intro ? zoom - 2.4 : zoom,
      pitch: intro ? 0 : threeD ? PITCH : 0,
      bearing: intro ? 40 : threeD ? BEARING : 0,
      maxPitch: 70,
      minZoom: 12,
      maxZoom: 19.5,
      interactive,
      attributionControl: { compact: true },
      fadeDuration: 150,
    })
    mapRef.current = map
    map.touchZoomRotate.disableRotation()
    if (!interactive) map.getCanvas().style.cursor = 'default'

    /* cadangan ubin raster bila server vektor tidak terjangkau */
    let fallback = false
    let vectorOk = false
    const useFallback = () => {
      if (fallback || !map.getStyle()) return
      fallback = true
      map.addSource('osm-raster', { type: 'raster', tiles: [RASTER_TILES], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap' })
      map.addLayer({ id: 'osm-raster', type: 'raster', source: 'osm-raster', paint: { 'raster-saturation': -0.55, 'raster-brightness-min': 0.08 } }, 'landuse')
    }
    map.on('error', (e) => {
      const msg = String((e as { error?: { message?: string } }).error?.message ?? '')
      const src = (e as { sourceId?: string }).sourceId
      if (!vectorOk && (src === 'ofm' || (msg.includes('openfreemap') && !msg.includes('/fonts/')))) useFallback()
    })
    map.on('sourcedata', (e) => {
      if (e.sourceId === 'ofm' && e.tile) vectorOk = true
    })
    const fbTimer = window.setTimeout(() => !vectorOk && useFallback(), 7000)

    map.on('load', () => {
      loaded.current = true
      // atribusi tetap ada, tapi diciutkan supaya tidak menutupi isi
      el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      const beforeLabels = 'street-name'
      map.addSource('mask', { type: 'geojson', data: EMPTY })
      map.addSource('territory', { type: 'geojson', data: EMPTY })
      map.addSource('neighbors', { type: 'geojson', data: EMPTY })
      map.addSource('circle', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'nb-fill', type: 'fill', source: 'neighbors', paint: { 'fill-color': '#0F1F19', 'fill-opacity': 0.05 } }, beforeLabels)
      map.addLayer({ id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': '#0F1F19', 'fill-opacity': 0.2 } })
      map.addLayer({
        id: 'nb-line',
        type: 'line',
        source: 'neighbors',
        paint: { 'line-color': '#55655D', 'line-width': 1.6, 'line-dasharray': [3, 2], 'line-opacity': 0.8 },
      })
      map.addLayer({
        id: 'terr-glow',
        type: 'line',
        source: 'territory',
        layout: { 'line-join': 'round' },
        paint: { 'line-color': '#FF5A1F', 'line-width': 9, 'line-opacity': 0.16, 'line-blur': 3 },
      })
      map.addLayer({
        id: 'terr-line',
        type: 'line',
        source: 'territory',
        layout: { 'line-join': 'round' },
        paint: { 'line-color': '#FF5A1F', 'line-width': 2.6, 'line-dasharray': [2.2, 1.4] },
      })
      map.addLayer({
        id: 'circle-fill',
        type: 'fill',
        source: 'circle',
        paint: { 'fill-color': ['case', ['get', 'bad'], '#D23A2A', '#FF5A1F'], 'fill-opacity': 0.14 },
      })
      map.addLayer({
        id: 'circle-line',
        type: 'line',
        source: 'circle',
        paint: { 'line-color': ['case', ['get', 'bad'], '#D23A2A', '#FF5A1F'], 'line-width': 2, 'line-dasharray': [1.5, 1.5] },
      })
      applyAreas()
      if (intro) {
        const { threeD: td } = latest.current
        map.flyTo({ center: [center.lng, center.lat], zoom, pitch: td ? PITCH : 0, bearing: td ? BEARING : 0, duration: 2400, curve: 1.3, essential: true })
      }
      cb.current.onReady?.(map)
    })

    map.on('click', (e) => cb.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }))

    /* kamera berputar pelan sampai pengguna menyentuh peta */
    let orbitRaf: number | null = null
    let stopOrbit = false
    if (orbit) {
      const canvas = map.getCanvasContainer()
      const halt = () => (stopOrbit = true)
      canvas.addEventListener('pointerdown', halt, { once: true })
      canvas.addEventListener('wheel', halt, { once: true })
      const spin = () => {
        if (stopOrbit) return
        if (!map.isMoving()) map.setBearing(map.getBearing() + 0.06)
        orbitRaf = requestAnimationFrame(spin)
      }
      map.once('idle', () => (orbitRaf = requestAnimationFrame(spin)))
    }

    const store = markers.current
    return () => {
      window.clearTimeout(fbTimer)
      if (orbitRaf) cancelAnimationFrame(orbitRaf)
      if (meAnim.current) cancelAnimationFrame(meAnim.current)
      map.remove()
      mapRef.current = null
      loaded.current = false
      store.clear()
      nbMarkers.current = []
      meMk.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* wilayah, tetangga, lingkaran */
  const applyAreas = () => {
    const map = mapRef.current
    if (!map || !loaded.current) return
    const { territory: t, neighbors: nb, circle: c } = latest.current
    ;(map.getSource('mask') as GeoJSONSource | undefined)?.setData(maskFC(t))
    ;(map.getSource('territory') as GeoJSONSource | undefined)?.setData(polyFC(t ? [t] : []))
    ;(map.getSource('neighbors') as GeoJSONSource | undefined)?.setData(polyFC(nb.map((n) => n.ring)))
    const circleData: GeoJSON.FeatureCollection = c
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { bad: !!c.bad }, geometry: { type: 'Polygon', coordinates: [close(circleRing(c, c.radius))] } }] }
      : EMPTY
    ;(map.getSource('circle') as GeoJSONSource | undefined)?.setData(circleData)

    nbMarkers.current.forEach((m) => m.remove())
    nbMarkers.current = nb
      .filter((n) => n.ring.length >= 3)
      .map((n) => {
        const label = document.createElement('div')
        label.className = 'nb-label'
        label.textContent = n.name
        const cc = ringCenter(n.ring)
        return new maplibregl.Marker({ element: label, pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat([cc.lng, cc.lat]).addTo(map)
      })
  }

  const terrKey = territory?.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join(';') ?? ''
  const nbKey = neighbors.map((n) => n.id + n.ring.length).join(';')
  const circleKey = circle ? `${circle.lat},${circle.lng},${circle.radius},${circle.bad}` : ''
  useEffect(applyAreas, [terrKey, nbKey, circleKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded.current) return
    const c = territoryBad ? '#D23A2A' : '#FF5A1F'
    map.setPaintProperty('terr-line', 'line-color', c)
    map.setPaintProperty('terr-glow', 'line-color', c)
  }, [territoryBad])

  /* penanda quest & laporan */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const store = markers.current
    const seen = new Set<string>()
    pins.forEach((p, i) => {
      seen.add(p.id)
      const sig = `${p.lat},${p.lng},${p.kind},${p.category},${p.label},${p.state}`
      const cur = store.get(p.id)
      if (cur && cur.sig === sig) return
      cur?.m.remove()
      const elem = pinElement(p, cur ? 0 : i)
      elem.addEventListener('click', (ev) => {
        ev.stopPropagation()
        cb.current.onSelect?.(p.id)
      })
      const m = new maplibregl.Marker({ element: elem, anchor: 'bottom', pitchAlignment: 'viewport', rotationAlignment: 'viewport' })
        .setLngLat([p.lng, p.lat])
        .addTo(map)
      store.set(p.id, { m, sig })
    })
    for (const [id, v] of store) {
      if (!seen.has(id)) {
        v.m.remove()
        store.delete(id)
      }
    }
  }, [pins])

  useEffect(() => {
    for (const [id, v] of markers.current) {
      const e = v.m.getElement()
      e.classList.toggle('is-sel', id === selectedId)
      e.style.zIndex = id === selectedId ? '5' : ''
    }
  }, [selectedId, pins])

  /* posisi kamu — bergerak halus */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!me) {
      meMk.current?.remove()
      meMk.current = null
      return
    }
    if (!meMk.current) {
      meMk.current = new maplibregl.Marker({ element: meElement(meAvatar), anchor: 'center', pitchAlignment: 'map' }).setLngLat([me.lng, me.lat]).addTo(map)
      return
    }
    const mk = meMk.current
    const from = mk.getLngLat()
    const to = { lng: me.lng, lat: me.lat }
    if (Math.abs(from.lng - to.lng) < 1e-9 && Math.abs(from.lat - to.lat) < 1e-9) return
    if (meAnim.current) cancelAnimationFrame(meAnim.current)
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 700)
      const e = 1 - (1 - k) ** 3
      mk.setLngLat([from.lng + (to.lng - from.lng) * e, from.lat + (to.lat - from.lat) * e])
      meAnim.current = k < 1 ? requestAnimationFrame(step) : null
    }
    meAnim.current = requestAnimationFrame(step)
  }, [me?.lat, me?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const mk = meMk.current
    if (!mk) return
    const elem = mk.getElement()
    elem.innerHTML = meElement(meAvatar).innerHTML
  }, [meAvatar])

  /* 2D ↔ 3D */
  const firstTilt = useRef(true)
  useEffect(() => {
    if (firstTilt.current) {
      firstTilt.current = false
      return
    }
    mapRef.current?.easeTo({ pitch: threeD ? PITCH : 0, bearing: threeD ? BEARING : 0, duration: 900 })
  }, [threeD])

  /* fokus ke titik */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    const p = latest.current.padding
    map.easeTo({
      center: [focus.lng, focus.lat],
      zoom: Math.max(map.getZoom(), focus.zoom ?? 16.8),
      padding: { top: p?.top ?? 0, bottom: p?.bottom ?? 0, left: p?.left ?? 0, right: p?.right ?? 0 },
      duration: 850,
      essential: true,
    })
  }, [focus?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={`h-full w-full ${className}`} />
}
