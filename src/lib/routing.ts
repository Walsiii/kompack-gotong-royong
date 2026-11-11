import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { distM } from './geo'
import type { LatLng } from './types'

export type RouteCoordinate = [number, number]
export interface WalkingInstruction {
  text: string
  distanceM: number
  beginShapeIndex: number
  endShapeIndex: number
}
export interface WalkingRoute {
  coordinates: RouteCoordinate[]
  geometry: { type: 'LineString'; coordinates: RouteCoordinate[] }
  distanceM: number
  durationS: number
  instructions: WalkingInstruction[]
}
export interface WalkingTarget extends LatLng { id: string; title: string; radius?: number }
export interface PositionQuality { accuracyM: number | null; simulated: boolean; at?: number; mock?: boolean }

export const WALKING_ROUTE_ENDPOINT = 'https://valhalla1.openstreetmap.de/route'
const MAX_POINTS = 50_000
const REQUEST_TIMEOUT_MS = 15_000

export class WalkingRouteError extends Error {
  constructor(public readonly code: 'input' | 'network' | 'timeout' | 'service' | 'response', message: string) {
    super(message)
    this.name = 'WalkingRouteError'
  }
}

function validPosition(value: LatLng): boolean {
  return Number.isFinite(value?.lat) && Number.isFinite(value?.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180
}
function invalidResponse(): never {
  throw new WalkingRouteError('response', 'Rute dari layanan belum bisa dibaca. Coba lagi atau buka Google Maps.')
}

/** Valhalla native JSON encodes latitude then longitude at precision 6.
 * Source: https://github.com/valhalla/valhalla/blob/master/docs/docs/api/route/api-reference.md
 */
export function decodePolyline6(shape: string): RouteCoordinate[] {
  if (typeof shape !== 'string' || !shape.length || shape.length > 2_000_000) invalidResponse()
  const coordinates: RouteCoordinate[] = []
  let cursor = 0
  let lat = 0
  let lng = 0
  const number = () => {
    let value = 0
    let shift = 0
    while (cursor < shape.length && shift <= 30) {
      const chunk = shape.charCodeAt(cursor++) - 63
      if (chunk < 0 || chunk > 63) invalidResponse()
      value += (chunk & 31) * 2 ** shift
      if (chunk < 32) return value % 2 ? -(Math.floor(value / 2) + 1) : value / 2
      shift += 5
    }
    return invalidResponse()
  }
  while (cursor < shape.length) {
    lat += number()
    lng += number()
    const point = { lat: lat / 1e6, lng: lng / 1e6 }
    if (!validPosition(point) || coordinates.length >= MAX_POINTS) invalidResponse()
    coordinates.push([point.lng, point.lat])
  }
  if (coordinates.length < 2) invalidResponse()
  return coordinates
}

type RecordValue = Record<string, unknown>
function record(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalidResponse()
  return value as RecordValue
}
function nonnegative(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalidResponse()
  return value
}
function instructionText(maneuver: RecordValue): string {
  const streets = Array.isArray(maneuver.street_names) ? maneuver.street_names.filter((s): s is string => typeof s === 'string').slice(0, 2).join(' / ').slice(0, 160) : ''
  const onto = streets ? ` ke ${streets}` : ''
  const along = streets ? ` di ${streets}` : ''
  switch (maneuver.type) {
    case 1: case 2: case 3: return `Mulai berjalan${along}`
    case 4: case 5: case 6: return 'Akhir rute jalan kaki; periksa lokasi misi'
    case 9: return `Serong kanan${onto}`
    case 10: case 11: return `Belok kanan${onto}`
    case 12: case 13: return `Putar balik${onto}`
    case 14: case 15: return `Belok kiri${onto}`
    case 16: return `Serong kiri${onto}`
    case 18: case 20: case 23: case 37: return `Ambil jalan kanan${onto}`
    case 19: case 21: case 24: case 38: return `Ambil jalan kiri${onto}`
    case 26: return 'Masuk bundaran'
    case 27: {
      const exit = maneuver.roundabout_exit_count
      return `Keluar bundaran${typeof exit === 'number' && Number.isInteger(exit) && exit > 0 ? ` di jalan keluar ke-${exit}` : ''}${onto}`
    }
    case 28: return 'Naik feri sesuai petunjuk setempat'
    case 29: return 'Turun dari feri'
    case 39: return 'Gunakan lift'
    case 40: return 'Lewati tangga'
    case 41: return 'Gunakan eskalator'
    case 42: return 'Masuk bangunan'
    case 43: return 'Keluar bangunan'
    case 44: return 'Ikuti jalur ke lantai berikutnya'
    default: return `Lanjut berjalan${along}`
  }
}

/** Parses the actual Valhalla response, never fabricating a connecting path. */
export function parseWalkingRoute(value: unknown): WalkingRoute {
  const body = record(value)
  if (body.error_code !== undefined || body.error) throw new WalkingRouteError('service', 'Layanan belum menemukan jalur jalan kaki di sini. Coba Google Maps.')
  const trip = record(body.trip)
  if (trip.status !== 0 || (trip.units !== 'kilometers' && trip.units !== 'km')) invalidResponse()
  const summary = record(trip.summary)
  const distanceM = nonnegative(summary.length) * 1000
  const durationS = nonnegative(summary.time)
  if (!Array.isArray(trip.legs) || trip.legs.length !== 1) invalidResponse()
  const leg = record(trip.legs[0])
  if (typeof leg.shape !== 'string') invalidResponse()
  const coordinates = decodePolyline6(leg.shape)
  if (!Array.isArray(leg.maneuvers) || !leg.maneuvers.length || leg.maneuvers.length > MAX_POINTS) invalidResponse()
  const instructions = leg.maneuvers.map((raw) => {
    const maneuver = record(raw)
    const begin = nonnegative(maneuver.begin_shape_index)
    const end = nonnegative(maneuver.end_shape_index)
    if (!Number.isInteger(begin) || !Number.isInteger(end) || begin > end || end >= coordinates.length) invalidResponse()
    return { text: instructionText(maneuver), distanceM: nonnegative(maneuver.length) * 1000, beginShapeIndex: begin, endShapeIndex: end }
  })
  if (distanceM <= 0 || durationS <= 0) invalidResponse()
  return { coordinates, geometry: { type: 'LineString', coordinates }, distanceM, durationS, instructions }
}

export async function fetchWalkingRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<WalkingRoute> {
  if (!validPosition(from) || !validPosition(to)) throw new WalkingRouteError('input', 'Lokasi awal atau tujuan belum valid.')
  if (signal?.aborted) throw new DOMException('Navigation cancelled', 'AbortError')
  const controller = new AbortController()
  let timedOut = false
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(() => { timedOut = true; controller.abort() }, REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(WALKING_ROUTE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        locations: [{ lat: from.lat, lon: from.lng }, { lat: to.lat, lon: to.lng }],
        costing: 'pedestrian', units: 'kilometers', language: 'en-US',
        directions_options: { units: 'kilometers', language: 'en-US' },
      }),
      signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer',
    })
    if (!response.ok) throw new WalkingRouteError('service', response.status === 429 ? 'Layanan rute sedang ramai. Tunggu sebentar lalu coba lagi.' : 'Layanan rute belum dapat dihubungi. Coba lagi atau buka Google Maps.')
    const raw = await response.text()
    if (raw.length > 5_000_000) invalidResponse()
    let body: unknown
    try { body = JSON.parse(raw) } catch { invalidResponse() }
    const route = parseWalkingRoute(body)
    const first = route.coordinates[0]
    const last = route.coordinates[route.coordinates.length - 1]
    if (distM(from, { lng: first[0], lat: first[1] }) > 300 || distM(to, { lng: last[0], lat: last[1] }) > 300) {
      throw new WalkingRouteError('response', 'Jalur yang ditemukan terlalu jauh dari lokasi misi. Coba Google Maps.')
    }
    return route
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Navigation cancelled', 'AbortError')
    if (timedOut) throw new WalkingRouteError('timeout', 'Mencari rute terlalu lama. Coba lagi atau buka Google Maps.')
    if (error instanceof WalkingRouteError) throw error
    throw new WalkingRouteError('network', 'Rute belum tersambung. Periksa internet atau buka Google Maps.')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export interface RouteProjection { closestIndex: number; progressM: number; distanceFromRouteM: number; totalM: number }

/** Projects GPS onto the nearest segment, including between sparse shape points. */
export function projectNearestRoutePoint(position: LatLng, coordinates: RouteCoordinate[]): RouteProjection {
  if (!validPosition(position) || coordinates.length < 2 || coordinates.length > MAX_POINTS) throw new WalkingRouteError('input', 'Lokasi atau jalur belum valid.')
  const rad = Math.PI / 180
  const kx = 6371000 * rad * Math.cos(position.lat * rad)
  const ky = 6371000 * rad
  let closestIndex = 0
  let progressM = 0
  let totalM = 0
  let best = Infinity
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = { lng: coordinates[i][0], lat: coordinates[i][1] }
    const b = { lng: coordinates[i + 1][0], lat: coordinates[i + 1][1] }
    if (!validPosition(a) || !validPosition(b)) throw new WalkingRouteError('input', 'Jalur belum valid.')
    const ax = (a.lng - position.lng) * kx
    const ay = (a.lat - position.lat) * ky
    const dx = (b.lng - a.lng) * kx
    const dy = (b.lat - a.lat) * ky
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0
    const distance = Math.hypot(ax + dx * t, ay + dy * t)
    const segmentM = distM(a, b)
    if (distance < best) {
      best = distance
      closestIndex = i
      progressM = totalM + t * segmentM
    }
    totalM += segmentM
  }
  return { closestIndex, progressM, distanceFromRouteM: best, totalM }
}

export function walkingMapsLink(target: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${target.lat},${target.lng}`)}&travelmode=walking`
}

/** A navigation estimate is distinct from the mission's existing check-in rules. */
export function calculateWalkingProgress(route: WalkingRoute | null, target: WalkingTarget | null, position: LatLng | null, quality: PositionQuality | undefined, now = Date.now()) {
  const reliablePosition = !!(position && validPosition(position) && quality && !quality.simulated && !quality.mock &&
    quality.accuracyM !== null && quality.accuracyM >= 0 && quality.accuracyM <= 50 &&
    quality.at && now - quality.at < 30_000 && quality.at <= now + 10_000)
  const projection = route && position && reliablePosition ? projectNearestRoutePoint(position, route.coordinates) : null
  const distanceToTargetM = position && target && reliablePosition ? distM(position, target) : null
  const radius = target?.radius && Number.isFinite(target.radius) && target.radius > 0 ? target.radius : 25
  // Include GPS uncertainty: merely overlapping the radius cannot confirm arrival.
  const arrived = !!(route && distanceToTargetM !== null && distanceToTargetM + (quality?.accuracyM ?? Infinity) <= radius)
  const offRoute = !!(projection && projection.distanceFromRouteM > Math.max(30, (quality?.accuracyM ?? 50) * 1.5))
  const remainingFraction = projection?.totalM ? Math.max(0, Math.min(1, 1 - projection.progressM / projection.totalM)) : null
  const remainingDistanceM = !offRoute && route && remainingFraction !== null ? route.distanceM * remainingFraction : null
  const remainingDurationS = !offRoute && route && remainingFraction !== null ? route.durationS * remainingFraction : null
  const currentInstruction = route && projection ? route.instructions.find((item) => item.endShapeIndex > projection.closestIndex) ?? route.instructions[route.instructions.length - 1] : null
  return { reliablePosition, projection, distanceToTargetM, arrived, offRoute, remainingDistanceM, remainingDurationS, currentInstruction }
}

type RouteState = { status: 'idle' | 'loading' | 'ready' | 'error'; route: WalkingRoute | null; error: string | null }
const EMPTY: RouteState = { status: 'idle', route: null, error: null }

export function useWalkingRoute(target: WalkingTarget | null, position: LatLng | null, quality?: PositionQuality) {
  const [state, setState] = useState<RouteState>(EMPTY)
  const [active, setActive] = useState(false)
  const [clock, setClock] = useState(Date.now)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const lastRequest = useRef<{ at: number; from: LatLng } | null>(null)
  const latest = useRef({ target, position, quality })
  latest.current = { target, position, quality }

  const cancel = useCallback(() => {
    generation.current++
    request.current?.abort()
    request.current = null
    lastRequest.current = null
    setActive(false)
    setState(EMPTY)
  }, [])

  // Choosing a different mission never sends new coordinates or keeps an old path.
  useEffect(() => { cancel(); return () => { generation.current++; request.current?.abort() } }, [target?.id, target?.lat, target?.lng, cancel])

  const start = useCallback(async () => {
    const { target: to, position: from } = latest.current
    request.current?.abort()
    const id = ++generation.current
    setActive(!!to)
    setClock(Date.now())
    if (!to || !from) {
      request.current = null
      setState({ status: 'error', route: null, error: 'Tunggu lokasi GPS sebelum memulai navigasi.' })
      return
    }
    const controller = new AbortController()
    request.current = controller
    lastRequest.current = { at: Date.now(), from: { ...from } }
    setState({ status: 'loading', route: null, error: null })
    try {
      const route = await fetchWalkingRoute(from, to, controller.signal)
      if (id === generation.current) setState({ status: 'ready', route, error: null })
    } catch (error) {
      if (controller.signal.aborted || id !== generation.current) return
      setState({ status: 'error', route: null, error: error instanceof Error ? error.message : 'Rute belum bisa dimuat.' })
    } finally {
      if (id === generation.current) request.current = null
    }
  }, [])

  // Expired GPS readings must stop progress even if the watcher stops updating.
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setClock(Date.now()), 5000)
    return () => clearInterval(timer)
  }, [active])

  const progress = useMemo(() => calculateWalkingProgress(state.route, target, position, quality, clock),
    [state.route, target, position?.lat, position?.lng, quality?.accuracyM, quality?.simulated, quality?.at, quality?.mock, clock])
  const { reliablePosition, offRoute } = progress
  const arrived = active && state.status === 'ready' && progress.arrived

  useEffect(() => {
    const last = lastRequest.current
    if (!active || !offRoute || !reliablePosition || !position || state.status !== 'ready' || !last) return
    if (Date.now() - last.at < 30_000 || distM(last.from, position) < 30) return
    void start()
  }, [active, offRoute, reliablePosition, position?.lat, position?.lng, state.status, clock, start])

  return { ...state, ...progress, active, start, retry: start, cancel, arrived,
    mapsLink: target ? walkingMapsLink(target) : null }
}

export type WalkingNavigationState = ReturnType<typeof useWalkingRoute>
