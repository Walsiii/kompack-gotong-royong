import type {} from 'geojson'
import { useEffect, useRef, useState } from 'react'
import { WifiOff } from 'lucide-react'
import maplibregl, { type GeoJSONSource, type Map as MLMap } from 'maplibre-gl'
import { CATS } from '../lib/catalog'
import { circleRing, ringCenter } from '../lib/geo'
import type { Category, LatLng, Ring } from '../lib/types'
import { avatarSvg, catIconSvg } from './art'
import { RASTER_TILES, VECTOR_URL, kompackStyle, mapPalette } from './mapStyle'

export interface MapPin {
  id: string
  lat: number
  lng: number
  kind: 'misi' | 'laporan' | 'tolong'
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
  walkingRoute?: GeoJSON.LineString | null
  walkingTarget?: LatLng | null
  followMe?: boolean
  /** mode navigasi: kamera miring, arah jalan di atas, posisi jadi panah */
  navigating?: boolean
  /** arah hadap (derajat dari utara) untuk panah & kamera navigasi */
  meHeading?: number | null
  /** bagian rute yang sudah dilewati (0–1), digambar abu-abu */
  routeProgress?: number
  onFollowChange?: (following: boolean) => void
  onReady?: (map: MLMap) => void
  /** arah peta berubah (derajat); dipakai tombol kompas */
  onBearing?: (deg: number) => void
  /** paskan tampilan awal ke seluruh wilayah */
  fitTerritory?: boolean
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

/* ───────────── Penanda sebagai lapisan peta ─────────────
   Penanda digambar GPU bersama peta, jadi tidak tertinggal saat digeser, diputar, atau dimiringkan. */

const WARN_SVG = (ink: string, paper: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path d="M12 3.5 2.8 19.5h18.4z" fill="${ink}"/><path d="M12 9.5v4.6" stroke="${paper}" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="16.8" r="1.3" fill="${paper}"/></svg>`
const CHECK_SVG = (ink: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`

function iconName(p: MapPin): string {
  if (p.state === 'done') return 'pin-check'
  if (p.kind === 'laporan') return 'pin-warn'
  return `pin-${p.kind === 'tolong' ? 'bantu' : p.category}`
}

async function loadPinImages(map: MLMap, ink: string, paper: string): Promise<void> {
  const svgs: Record<string, string> = { 'pin-warn': WARN_SVG(ink, paper), 'pin-check': CHECK_SVG(ink) }
  for (const cat of Object.keys(CATS) as Category[]) svgs[`pin-${cat}`] = catIconSvg(cat, 24, ink)
  await Promise.all(
    Object.entries(svgs).map(async ([name, svg]) => {
      const img = new Image(48, 48)
      img.src = `data:image/svg+xml;utf8,${encodeURIComponent(svg.replace(/width="\d+" height="\d+"/, 'width="48" height="48"'))}`
      try {
        await img.decode()
        if (!map.getStyle()) return
        if (map.hasImage(name)) map.updateImage(name, img)
        else map.addImage(name, img, { pixelRatio: 2 })
      } catch {
        /* ikon gagal dimuat: cakram penanda tetap tampil */
      }
    }),
  )
}

function pinsFC(pins: MapPin[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pins.map((p) => ({
      type: 'Feature',
      id: p.id,
      properties: { id: p.id, kind: p.kind, state: p.state, icon: iconName(p), label: p.kind === 'misi' ? (p.label ?? CATS[p.category].label) : p.kind === 'tolong' ? 'Minta tolong' : 'Laporan' },
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
    })),
  }
}

/** easing dengan sedikit lewat lalu kembali — rasa "pegas" */
const backOut = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2)
const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3)

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
  threeD = false,
  focus,
  padding,
  interactive = true,
  intro,
  orbit,
  walkingRoute,
  walkingTarget,
  followMe = false,
  navigating = false,
  meHeading = null,
  routeProgress = 0,
  onFollowChange,
  onReady,
  onBearing,
  fitTerritory,
  className = '',
}: Props) {
  const el = useRef<HTMLDivElement>(null)
  const [mapUnavailable, setMapUnavailable] = useState(false)
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mapRef = useRef<MLMap | null>(null)
  const loaded = useRef(false)
  const known = useRef(new Set<string>())
  const selPrev = useRef<string | null>(null)
  const tweens = useRef(new Map<string, number>())
  const pinsReady = useRef(false)
  const nbMarkers = useRef<maplibregl.Marker[]>([])
  const meMk = useRef<maplibregl.Marker | null>(null)
  const navMk = useRef<maplibregl.Marker | null>(null)
  const drawing = useRef(false)
  const meAnim = useRef<number | null>(null)
  const cb = useRef({ onSelect, onMapClick, onReady, onFollowChange, onBearing })
  cb.current = { onSelect, onMapClick, onReady, onFollowChange, onBearing }
  const latest = useRef({ territory, neighbors, circle, threeD, padding, walkingRoute, walkingTarget, pins, selectedId, me, routeProgress })
  latest.current = { territory, neighbors, circle, threeD, padding, walkingRoute, walkingTarget, pins, selectedId, me, routeProgress }

  /** jalankan animasi bernama; yang lama dengan nama sama dihentikan */
  const tween = (name: string, ms: number, step: (t: number) => void, done?: () => void) => {
    const prev = tweens.current.get(name)
    if (prev) cancelAnimationFrame(prev)
    if (reducedMotion() || ms <= 0) {
      step(1)
      done?.()
      return
    }
    const t0 = performance.now()
    const tick = (now: number) => {
      if (!mapRef.current?.getStyle()) return
      const t = Math.min(1, (now - t0) / ms)
      step(t)
      if (t < 1) tweens.current.set(name, requestAnimationFrame(tick))
      else {
        tweens.current.delete(name)
        done?.()
      }
    }
    tweens.current.set(name, requestAnimationFrame(tick))
  }

  /* buat peta sekali */
  useEffect(() => {
    if (!el.current) return
    const reduce = reducedMotion()
    const c = mapPalette()
    const map = new maplibregl.Map({
      container: el.current,
      style: kompackStyle(),
      center: [center.lng, center.lat],
      zoom: intro && !reduce ? zoom - 0.6 : zoom,
      pitch: intro && !reduce ? 0 : threeD ? PITCH : 0,
      bearing: threeD && (!intro || reduce) ? BEARING : 0,
      maxPitch: 70,
      minZoom: 12,
      maxZoom: 19.5,
      interactive,
      attributionControl: { compact: true },
      fadeDuration: reduce ? 0 : 150,
    })
    map.setPadding({ top: padding?.top ?? 0, bottom: padding?.bottom ?? 0, left: padding?.left ?? 0, right: padding?.right ?? 0 })
    mapRef.current = map
    if (!interactive) map.getCanvas().style.cursor = 'default'

    /* cadangan ubin raster bila server vektor tidak terjangkau */
    let fallback = false
    let vectorOk = false
    const useFallback = () => {
      if (fallback || !map.getStyle()) return
      fallback = true
      map.addSource('osm-raster', { type: 'raster', tiles: [RASTER_TILES], tileSize: 256, maxzoom: 19, attribution: '© OpenStreetMap' })
      map.addLayer({ id: 'osm-raster', type: 'raster', source: 'osm-raster', paint: { 'raster-saturation': -1, 'raster-brightness-min': 0.08 } }, 'landuse')
    }
    map.on('error', (e) => {
      const msg = String((e as { error?: { message?: string } }).error?.message ?? '')
      const src = (e as { sourceId?: string }).sourceId
      if (src === 'osm-raster') setMapUnavailable(true)
      if (!vectorOk && (src === 'ofm' || (msg.includes('openfreemap') && !msg.includes('/fonts/')))) useFallback()
    })
    map.on('sourcedata', (e) => {
      if (e.tile && (e.tile as { state?: string }).state === 'loaded') {
        if (e.sourceId === 'ofm') vectorOk = true
        if (e.sourceId === 'ofm' || e.sourceId === 'osm-raster') setMapUnavailable(false)
      }
    })
    const fbTimer = window.setTimeout(() => !vectorOk && useFallback(), 7000)
    const retryTiles = () => {
      const vector = map.getSource('ofm') as maplibregl.VectorTileSource | undefined
      vector?.setUrl(VECTOR_URL)
      const raster = map.getSource('osm-raster') as maplibregl.RasterTileSource | undefined
      raster?.setTiles([RASTER_TILES])
      map.triggerRepaint()
    }
    window.addEventListener('online', retryTiles)

    map.on('load', () => {
      loaded.current = true
      // atribusi tetap ada, tapi diciutkan supaya tidak menutupi isi
      el.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
      const beforeLabels = 'street-name'
      map.addSource('mask', { type: 'geojson', data: EMPTY })
      map.addSource('territory', { type: 'geojson', data: EMPTY })
      map.addSource('neighbors', { type: 'geojson', data: EMPTY })
      map.addSource('circle', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'nb-fill', type: 'fill', source: 'neighbors', paint: { 'fill-color': c.ink, 'fill-opacity': 0.05 } }, beforeLabels)
      map.addLayer({ id: 'mask', type: 'fill', source: 'mask', paint: { 'fill-color': c.ink, 'fill-opacity': 0.06 } })
      map.addLayer({
        id: 'nb-line',
        type: 'line',
        source: 'neighbors',
        paint: { 'line-color': c.muted, 'line-width': 1.6, 'line-dasharray': [3, 2], 'line-opacity': 0.8 },
      })
      map.addLayer({
        id: 'terr-line',
        type: 'line',
        source: 'territory',
        layout: { 'line-join': 'round' },
        paint: { 'line-color': c.accent, 'line-width': 1.4, 'line-opacity': 0.55, 'line-dasharray': [2.2, 1.4] },
      })
      map.addLayer({
        id: 'circle-fill',
        type: 'fill',
        source: 'circle',
        paint: { 'fill-color': ['case', ['get', 'bad'], c.bad, c.accent], 'fill-opacity': 0.06 },
      })
      map.addLayer({
        id: 'circle-line',
        type: 'line',
        source: 'circle',
        paint: { 'line-color': ['case', ['get', 'bad'], c.bad, c.accent], 'line-width': 2, 'line-dasharray': [1.5, 1.5] },
      })
      map.addSource('walking-route', { type: 'geojson', data: EMPTY, lineMetrics: true })
      map.addLayer({ id: 'walking-route-halo', type: 'line', source: 'walking-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': c.light, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 8, 18, 13], 'line-opacity': 0.95 } }, beforeLabels)
      map.addLayer({ id: 'walking-route-line', type: 'line', source: 'walking-route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': c.accent, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 4, 18, 7] } }, beforeLabels)
      map.addSource('walking-gap', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'walking-gap', type: 'line', source: 'walking-gap', layout: { 'line-cap': 'round' }, paint: { 'line-color': c.accent, 'line-width': 3, 'line-dasharray': [0.6, 1.8] } }, beforeLabels)
      map.addSource('walking-destination', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'walking-destination-point', type: 'circle', source: 'walking-destination', paint: { 'circle-radius': 7, 'circle-color': c.accent, 'circle-stroke-color': c.light, 'circle-stroke-width': 3 } })
      /* penanda misi & laporan */
      map.addSource('pins', { type: 'geojson', data: EMPTY, promoteId: 'id' })
      map.addSource('ripple', { type: 'geojson', data: EMPTY })
      const A: unknown = ['coalesce', ['feature-state', 'a'], 0]
      const S: unknown = ['coalesce', ['feature-state', 's'], 0]
      const H: unknown = ['coalesce', ['feature-state', 'h'], 0]
      const base: unknown = ['match', ['get', 'kind'], 'misi', 16, 13]
      map.addLayer({ id: 'ripple', type: 'circle', source: 'ripple', paint: { 'circle-radius': 0, 'circle-color': c.ink, 'circle-opacity': 0, 'circle-pitch-alignment': 'map' } })
      map.addLayer({ id: 'pin-pulse', type: 'circle', source: 'pins', filter: ['==', ['get', 'id'], ''], paint: { 'circle-radius': 0, 'circle-color': c.ink, 'circle-opacity': 0 } })
      map.addLayer({
        id: 'pin-disc',
        type: 'circle',
        source: 'pins',
        paint: {
          'circle-radius': ['*', A, ['+', base, ['*', S, 6], ['*', H, 2]]],
          'circle-color': ['match', ['get', 'state'], 'off', c.ground, c.light],
          'circle-stroke-color': c.ink,
          'circle-stroke-width': ['+', 2, ['*', S, 2]],
          'circle-stroke-opacity': ['*', A, ['match', ['get', 'state'], 'off', 0.4, 1]],
          'circle-opacity': A,
        },
      } as maplibregl.LayerSpecification)
      map.addLayer({
        id: 'pin-icon',
        type: 'symbol',
        source: 'pins',
        layout: { 'icon-image': ['get', 'icon'], 'icon-size': ['match', ['get', 'kind'], 'misi', 0.84, 0.7], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
        paint: { 'icon-opacity': ['*', A, ['match', ['get', 'state'], 'off', 0.45, 1]] },
      } as maplibregl.LayerSpecification)
      map.addLayer({
        id: 'pin-label',
        type: 'symbol',
        source: 'pins',
        minzoom: 15.4,
        layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 12, 'text-anchor': 'left', 'text-offset': [1.9, 0], 'text-optional': true, 'text-max-width': 9 },
        paint: { 'text-color': c.ink, 'text-halo-color': c.light, 'text-halo-width': 2, 'text-opacity': A },
      } as maplibregl.LayerSpecification)
      void loadPinImages(map, c.ink, c.light)
      pinsReady.current = true
      applyAreas()
      applyWalkingRoute()
      applyPins()
      applySelection(true)
      updateTheme()
      const { threeD: td, territory: terr } = latest.current
      let target = { center: [center.lng, center.lat] as [number, number], zoom }
      if (fitTerritory && terr && terr.length >= 3) {
        const bounds = new maplibregl.LngLatBounds()
        for (const p of terr) bounds.extend([p.lng, p.lat])
        const cam = map.cameraForBounds(bounds, { padding: 28, maxZoom: 17.2 })
        if (cam?.center && cam.zoom !== undefined) {
          const cc = maplibregl.LngLat.convert(cam.center)
          target = { center: [cc.lng, cc.lat], zoom: cam.zoom }
        }
      }
      if (intro && !reduce) {
        map.jumpTo({ center: target.center, zoom: target.zoom - 0.9 })
        map.flyTo({ ...target, pitch: td ? PITCH : 0, bearing: td ? BEARING : 0, duration: 1600, curve: 1.15, essential: false })
        if (td) riseBuildings()
      } else if (fitTerritory) map.jumpTo(target)
      cb.current.onReady?.(map)
    })

    map.on('dragstart', () => cb.current.onFollowChange?.(false))
    map.on('rotatestart', (e) => { if ((e as { originalEvent?: Event }).originalEvent) cb.current.onFollowChange?.(false) })
    const hit = (pt: maplibregl.Point, slop: number): string | null => {
      if (!pinsReady.current) return null
      const found = map.queryRenderedFeatures([[pt.x - slop, pt.y - slop], [pt.x + slop, pt.y + slop]], { layers: ['pin-disc'] })
      let best: string | null = null
      let bestD = Infinity
      for (const f of found) {
        const g = f.geometry as GeoJSON.Point
        const q = map.project(g.coordinates as [number, number])
        const d = Math.hypot(q.x - pt.x, q.y - pt.y)
        if (d < bestD) {
          bestD = d
          best = String(f.properties?.id)
        }
      }
      return best
    }
    const ripple = (lng: number, lat: number, big: boolean) => {
      const src = map.getSource('ripple') as GeoJSONSource | undefined
      if (!src) return
      src.setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lng, lat] } }] })
      tween('ripple', 520, (t) => {
        const e = cubicOut(t)
        map.setPaintProperty('ripple', 'circle-radius', 6 + e * (big ? 46 : 30))
        map.setPaintProperty('ripple', 'circle-opacity', 0.22 * (1 - e))
      })
    }
    map.on('click', (e) => {
      const id = hit(e.point, 20)
      if (id) {
        const f = latest.current.pins.find((p) => p.id === id)
        if (f) ripple(f.lng, f.lat, true)
        navigator.vibrate?.(8)
        cb.current.onSelect?.(id)
        return
      }
      if (cb.current.onMapClick) ripple(e.lngLat.lng, e.lngLat.lat, false)
      cb.current.onMapClick?.({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })
    let hovered: string | null = null
    map.on('mousemove', (e) => {
      const id = hit(e.point, 6)
      if (id === hovered) return
      if (hovered) map.setFeatureState({ source: 'pins', id: hovered }, { h: 0 })
      hovered = id
      if (id) map.setFeatureState({ source: 'pins', id }, { h: 1 })
      map.getCanvas().style.cursor = id ? 'pointer' : ''
    })
    map.on('rotate', () => cb.current.onBearing?.(map.getBearing()))

    // Theme changes update paint in place, preserving sources and map interaction state.
    const updateTheme = () => {
      const palette = mapPalette()
      for (const layer of kompackStyle().layers) {
        if (!map.getLayer(layer.id) || !layer.paint) continue
        for (const [name, value] of Object.entries(layer.paint)) map.setPaintProperty(layer.id, name, value)
      }
      const paints: [string, string, unknown][] = [
        ['nb-fill', 'fill-color', palette.ink], ['mask', 'fill-color', palette.ink],
        ['nb-line', 'line-color', palette.muted], ['terr-line', 'line-color', palette.accent],
        ['circle-fill', 'fill-color', ['case', ['get', 'bad'], palette.bad, palette.accent]],
        ['circle-line', 'line-color', ['case', ['get', 'bad'], palette.bad, palette.accent]],
        ['walking-route-halo', 'line-color', palette.light], ['walking-route-line', 'line-color', palette.accent],
        ['walking-gap', 'line-color', palette.accent],
        ['walking-destination-point', 'circle-color', palette.accent], ['walking-destination-point', 'circle-stroke-color', palette.light],
        ['pin-disc', 'circle-color', ['match', ['get', 'state'], 'off', palette.ground, palette.light]], ['pin-disc', 'circle-stroke-color', palette.ink],
        ['pin-pulse', 'circle-color', palette.ink], ['ripple', 'circle-color', palette.ink],
        ['pin-label', 'text-color', palette.ink], ['pin-label', 'text-halo-color', palette.light],
      ]
      void loadPinImages(map, palette.ink, palette.light)
      for (const [id, name, value] of paints) if (map.getLayer(id)) map.setPaintProperty(id, name, value)
    }
    const themeObserver = new MutationObserver(() => { if (loaded.current) updateTheme() })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    /* An opening orbit stops after five seconds or the first interaction. */
    let orbitRaf: number | null = null
    let stopOrbit = false
    const orbitStopTimer = window.setTimeout(() => (stopOrbit = true), 5000)
    if (orbit && !reduce) {
      const canvas = map.getCanvasContainer()
      const halt = () => (stopOrbit = true)
      canvas.addEventListener('pointerdown', halt, { once: true })
      canvas.addEventListener('wheel', halt, { once: true })
      canvas.addEventListener('pointerenter', halt, { once: true })
      canvas.addEventListener('focusin', halt, { once: true })
      const spin = () => {
        if (stopOrbit) return
        if (!map.isMoving()) map.setBearing(map.getBearing() + 0.06)
        orbitRaf = requestAnimationFrame(spin)
      }
      map.once('idle', () => (orbitRaf = requestAnimationFrame(spin)))
    }

    const running = tweens.current
    const seen = known.current
    return () => {
      for (const id of running.values()) cancelAnimationFrame(id)
      running.clear()
      seen.clear()
      pinsReady.current = false
      selPrev.current = null
      window.clearTimeout(fbTimer)
      window.removeEventListener('online', retryTiles)
      window.clearTimeout(orbitStopTimer)
      themeObserver.disconnect()
      if (orbitRaf) cancelAnimationFrame(orbitRaf)
      if (meAnim.current) cancelAnimationFrame(meAnim.current)
      map.remove()
      mapRef.current = null
      loaded.current = false
      nbMarkers.current = []
      meMk.current = null
      navMk.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** bagian yang sudah dilewati abu-abu, sisanya warna aksen */
  const applyProgress = () => {
    const map = mapRef.current
    if (!map || !loaded.current || drawing.current || !map.getLayer('walking-route-line')) return
    const k = latest.current.routeProgress ?? 0
    if (k <= 0.002) {
      map.setPaintProperty('walking-route-line', 'line-gradient', undefined)
      return
    }
    const palette = mapPalette()
    map.setPaintProperty('walking-route-line', 'line-gradient', ['step', ['line-progress'], palette.edge, Math.min(0.999, k), palette.accent])
  }

  /** garis putus-putus dari posisimu ke awal jalur dan dari ujung jalur ke tujuan (bagian di luar jalan) */
  const applyGaps = () => {
    const map = mapRef.current
    if (!map || !loaded.current) return
    const route = latest.current.walkingRoute
    const target = latest.current.walkingTarget
    const me = latest.current.me
    const lines: GeoJSON.Feature[] = []
    if (route && route.coordinates.length > 1) {
      const first = route.coordinates[0]
      const last = route.coordinates[route.coordinates.length - 1]
      const far = (a: [number, number], b: LatLng) => Math.hypot((a[0] - b.lng) * 110000, (a[1] - b.lat) * 110000) > 4
      if (me && far(first as [number, number], me) && (latest.current.routeProgress ?? 0) < 0.02) lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[me.lng, me.lat], first] } })
      if (target && far(last as [number, number], target)) lines.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [last, [target.lng, target.lat]] } })
    }
    ;(map.getSource('walking-gap') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: lines })
  }

  const hadRoute = useRef(false)
  const applyWalkingRoute = () => {
    const map = mapRef.current
    if (!map || !loaded.current) return
    const route = latest.current.walkingRoute
    const target = latest.current.walkingTarget
    const data: GeoJSON.FeatureCollection = route ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: route }] } : EMPTY
    const destination: GeoJSON.FeatureCollection = route && target ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [target.lng, target.lat] } }] } : EMPTY
    ;(map.getSource('walking-route') as GeoJSONSource | undefined)?.setData(data)
    ;(map.getSource('walking-destination') as GeoJSONSource | undefined)?.setData(destination)
    applyGaps()
    const fresh = !!route && !hadRoute.current
    hadRoute.current = !!route
    if (fresh) {
      const palette = mapPalette()
      const clear = 'rgba(0,0,0,0)'
      drawing.current = true
      tween('route', 900, (t) => {
        const k = Math.min(0.999, Math.max(0.001, cubicOut(t)))
        map.setPaintProperty('walking-route-line', 'line-gradient', ['step', ['line-progress'], palette.accent, k, clear])
        map.setPaintProperty('walking-route-halo', 'line-gradient', ['step', ['line-progress'], palette.light, k, clear])
      }, () => {
        drawing.current = false
        map.setPaintProperty('walking-route-halo', 'line-gradient', undefined)
        applyProgress()
      })
    } else if (route) applyProgress()
    // rute baru: tunjukkan seluruh jalur dulu (kecuali sedang mengikuti posisi dalam mode navigasi)
    if (fresh && route && route.coordinates.length > 1 && !(navigating && followMe)) {
      const bounds = new maplibregl.LngLatBounds()
      for (const [lng, lat] of route.coordinates) bounds.extend([lng, lat])
      const p = latest.current.padding
      map.setPadding({ top: p?.top ?? 0, bottom: p?.bottom ?? 0, left: p?.left ?? 0, right: p?.right ?? 0 })
      map.fitBounds(bounds, { padding: 48, duration: reducedMotion() ? 0 : 900, maxZoom: 18.4, easing: (t) => 1 - Math.pow(1 - t, 4) })
    }
  }
  useEffect(applyWalkingRoute, [walkingRoute, walkingTarget?.lat, walkingTarget?.lng]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    applyProgress()
    applyGaps()
  }, [routeProgress, me?.lat, me?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  /* padding mengikuti tata letak (mis. banner navigasi muncul) */
  const padKey = `${padding?.top}|${padding?.bottom}|${padding?.left}|${padding?.right}`
  useEffect(() => {
    const p = latest.current.padding
    mapRef.current?.easeTo({ padding: { top: p?.top ?? 0, bottom: p?.bottom ?? 0, left: p?.left ?? 0, right: p?.right ?? 0 }, duration: reducedMotion() ? 0 : 400 })
  }, [padKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /* kamera mengikuti posisi; dalam mode navigasi miring 50° dengan arah jalan di atas */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !followMe || !me) return
    const p = latest.current.padding
    map.easeTo({
      center: [me.lng, me.lat],
      padding: { top: p?.top ?? 0, bottom: p?.bottom ?? 0, left: p?.left ?? 0, right: p?.right ?? 0 },
      ...(navigating ? { zoom: Math.max(17.6, Math.min(18.4, map.getZoom())), pitch: 50, bearing: meHeading ?? map.getBearing() } : {}),
      duration: reducedMotion() ? 0 : navigating ? 650 : 400,
      easing: (t) => t * (2 - t),
      essential: false,
    })
  }, [followMe, navigating, me?.lat, me?.lng, meHeading === null ? null : Math.round(meHeading / 4)]) // eslint-disable-line react-hooks/exhaustive-deps

  /* keluar navigasi: kembalikan kamera tegak */
  const wasNavigating = useRef(false)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (wasNavigating.current && !navigating) map.easeTo({ pitch: latest.current.threeD ? PITCH : 0, bearing: latest.current.threeD ? BEARING : 0, duration: reducedMotion() ? 0 : 700 })
    wasNavigating.current = navigating
  }, [navigating])

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
    const palette = mapPalette()
    const c = territoryBad ? palette.bad : palette.accent
    map.setPaintProperty('terr-line', 'line-color', c)
  }, [territoryBad])

  /* gedung "tumbuh" saat masuk 3D */
  const riseBuildings = () => {
    const map = mapRef.current
    if (!map?.getLayer('building')) return
    tween('rise', 900, (t) => {
      const k = 0.08 + 0.92 * backOut(t)
      map.setPaintProperty('building', 'fill-extrusion-height', ['interpolate', ['linear'], ['zoom'], 14, 0, 15.2, ['*', k, ['coalesce', ['get', 'render_height'], 6]]])
    })
  }

  /* penanda misi & laporan */
  const applyPins = () => {
    const map = mapRef.current
    if (!map || !pinsReady.current) return
    const list = latest.current.pins
    ;(map.getSource('pins') as GeoJSONSource | undefined)?.setData(pinsFC(list))
    const ids = new Set(list.map((p) => p.id))
    for (const id of known.current) if (!ids.has(id)) known.current.delete(id)
    // penanda baru muncul berurutan, memantul sedikit
    const fresh = list.filter((p) => !known.current.has(p.id))
    fresh.forEach((p, i) => {
      known.current.add(p.id)
      map.setFeatureState({ source: 'pins', id: p.id }, { a: 0 })
      const delay = Math.min(i, 10) * 55
      window.setTimeout(() => tween(`in:${p.id}`, 420, (t) => mapRef.current?.setFeatureState({ source: 'pins', id: p.id }, { a: backOut(t) })), delay)
    })
  }
  const pinsKey = pins.map((p) => `${p.id},${p.lat},${p.lng},${p.kind},${p.category},${p.label},${p.state}`).join('|')
  useEffect(applyPins, [pinsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /* penanda terpilih membesar, yang lama mengecil, lalu berdenyut dua kali */
  const applySelection = (instant = false) => {
    const map = mapRef.current
    if (!map || !pinsReady.current) return
    const next = latest.current.selectedId ?? null
    const prev = selPrev.current
    if (prev === next && !instant) return
    selPrev.current = next
    if (prev && prev !== next) tween(`sel:${prev}`, 220, (t) => mapRef.current?.setFeatureState({ source: 'pins', id: prev }, { s: 1 - cubicOut(t) }))
    if (!next) {
      map.setFilter('pin-pulse', ['==', ['get', 'id'], ''])
      return
    }
    tween(`sel:${next}`, instant ? 0 : 380, (t) => mapRef.current?.setFeatureState({ source: 'pins', id: next }, { s: backOut(t) }))
    map.setFilter('pin-pulse', ['==', ['get', 'id'], next])
    tween('pulse', instant ? 0 : 1500, (t) => {
      const k = (t * 2) % 1
      map.setPaintProperty('pin-pulse', 'circle-radius', 22 + cubicOut(k) * 26)
      map.setPaintProperty('pin-pulse', 'circle-opacity', t >= 1 ? 0 : 0.16 * (1 - k))
    })
  }
  useEffect(() => applySelection(), [selectedId, pinsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  /* posisi kamu — bergerak halus; saat navigasi jadi panah yang menghadap arah jalan */
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const showArrow = navigating && meHeading !== null && !!me
    if (showArrow && !navMk.current && me) {
      const el = document.createElement('div')
      el.className = 'nav-arrow'
      el.innerHTML = '<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="var(--color-card)" stroke="var(--color-ink)" stroke-width="2"/><path d="M20 8 29 29 20 24 11 29z" fill="var(--color-ink)"/></svg>'
      navMk.current = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat([me.lng, me.lat]).addTo(map)
    }
    if (!showArrow && navMk.current) {
      navMk.current.remove()
      navMk.current = null
    }
    if (navMk.current && meHeading !== null) navMk.current.setRotation(meHeading)
    const av = meMk.current?.getElement()
    if (av) av.style.visibility = showArrow ? 'hidden' : ''
  }, [navigating, meHeading, !!me]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!me) {
      meMk.current?.remove()
      meMk.current = null
      return
    }
    if (!meMk.current) {
      meMk.current = new maplibregl.Marker({ element: meElement(meAvatar), anchor: 'center', pitchAlignment: 'viewport' }).setLngLat([me.lng, me.lat]).addTo(map)
      navMk.current?.setLngLat([me.lng, me.lat])
      return
    }
    const mk = meMk.current
    const from = mk.getLngLat()
    const to = { lng: me.lng, lat: me.lat }
    if (Math.abs(from.lng - to.lng) < 1e-9 && Math.abs(from.lat - to.lat) < 1e-9) return
    if (meAnim.current) cancelAnimationFrame(meAnim.current)
    const put = (lng: number, lat: number) => {
      mk.setLngLat([lng, lat])
      navMk.current?.setLngLat([lng, lat])
    }
    if (reducedMotion()) { put(to.lng, to.lat); return }
    const t0 = performance.now()
    const dur = navigating ? 600 : 700
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const e = navigating ? k * (2 - k) : 1 - (1 - k) ** 3
      put(from.lng + (to.lng - from.lng) * e, from.lat + (to.lat - from.lat) * e)
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
    mapRef.current?.easeTo({ pitch: threeD ? PITCH : 0, bearing: threeD ? BEARING : 0, duration: reducedMotion() ? 0 : 900, easing: (t) => 1 - Math.pow(1 - t, 4) })
    if (threeD) riseBuildings()
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
      duration: reducedMotion() ? 0 : 750,
      easing: (t) => 1 - Math.pow(1 - t, 4),
      essential: false,
    })
  }, [focus?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative h-full w-full ${className}`}>
      <div ref={el} className="h-full w-full" />
      {mapUnavailable && <details className="map-availability"><summary aria-label="Status peta"><WifiOff size={16} aria-hidden="true" /><span>Peta</span></summary><p role="status">Ubin peta belum terhubung. Lokasi dan daftar misi tetap bisa dipakai. Periksa sambungan internet.</p></details>}
    </div>
  )
}
