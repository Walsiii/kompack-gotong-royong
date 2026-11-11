// Deterministic, MOCKED Valhalla fixtures. These tests do not establish endpoint connectivity.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-routing-tests', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null }, appType: 'custom' })
const { decodePolyline6, parseWalkingRoute, projectNearestRoutePoint, calculateWalkingProgress, fetchWalkingRoute, walkingMapsLink } = await server.ssrLoadModule('/src/lib/routing.ts')
await server.close()

const coordinates = [[107.6, -6.9], [107.601, -6.9], [107.601, -6.899]]
// Independent fixture encoder, not the decoder under test.
function encode(points) {
  let result = ''; let lastLat = 0; let lastLng = 0
  for (const [lng, lat] of points) {
    const currentLat = Math.round(lat * 1e6); const currentLng = Math.round(lng * 1e6)
    for (const delta of [currentLat - lastLat, currentLng - lastLng]) {
      let value = delta < 0 ? -delta * 2 - 1 : delta * 2
      while (value >= 32) { result += String.fromCharCode((value % 32 | 32) + 63); value = Math.floor(value / 32) }
      result += String.fromCharCode(value + 63)
    }
    lastLat = currentLat; lastLng = currentLng
  }
  return result
}
const fixture = () => ({ trip: { status: 0, units: 'kilometers', summary: { length: 0.222, time: 180 }, legs: [{ shape: encode(coordinates), maneuvers: [
  { type: 1, begin_shape_index: 0, end_shape_index: 1, length: 0.11, street_names: ['Gang Kenari'] },
  { type: 15, begin_shape_index: 1, end_shape_index: 2, length: 0.112, street_names: ['Jalan Melati'] },
  { type: 4, begin_shape_index: 2, end_shape_index: 2, length: 0 },
] }] } })
const route = parseWalkingRoute(fixture())
const from = { lat: -6.9, lng: 107.6 }
const to = { lat: -6.899, lng: 107.601 }
const target = { ...to, id: 'fixture-mission', title: 'Misi uji', radius: 25 }
const now = 1_000_000
const quality = { accuracyM: 5, simulated: false, at: now }

test('polyline6 decodes signed latitude/longitude and rejects truncated or malformed input', () => {
  assert.deepEqual(decodePolyline6('??AA@@'), [[0, 0], [0.000001, 0.000001], [0, 0]])
  assert.deepEqual(decodePolyline6(encode(coordinates)), coordinates)
  for (const bad of ['', '?', '????_', '????\u0000', '___________?']) assert.throws(() => decodePolyline6(bad), { code: 'response' })
})

test('Valhalla kilometres/seconds and turn indices are preserved; directions are Indonesian', () => {
  assert.deepEqual(route.geometry, { type: 'LineString', coordinates })
  assert.equal(route.distanceM, 222)
  assert.equal(route.durationS, 180)
  assert.equal(route.instructions[1].text, 'Belok kiri ke Jalan Melati')
  assert.equal(route.instructions[1].beginShapeIndex, 1)
  assert.match(route.instructions[2].text, /periksa lokasi misi/)
})

test('invalid units, shape indices and service errors cannot produce a line fallback', () => {
  const wrongUnits = fixture(); wrongUnits.trip.units = 'miles'
  const wrongIndex = fixture(); wrongIndex.trip.legs[0].maneuvers[0].end_shape_index = 99
  const negativeTime = fixture(); negativeTime.trip.summary.time = -5
  for (const body of [wrongUnits, wrongIndex, negativeTime, { error_code: 442, error: 'No route' }, null]) assert.throws(() => parseWalkingRoute(body))
})

test('GPS projects between sparse route vertices, preserving accumulated distance around a corner', () => {
  const halfwayFirst = projectNearestRoutePoint({ lat: -6.9, lng: 107.6005 }, coordinates)
  const halfwaySecond = projectNearestRoutePoint({ lat: -6.8995, lng: 107.601 }, coordinates)
  assert.equal(halfwayFirst.closestIndex, 0)
  assert.ok(halfwayFirst.distanceFromRouteM < 0.1)
  assert.ok(halfwayFirst.progressM > 54 && halfwayFirst.progressM < 56)
  assert.equal(halfwaySecond.closestIndex, 1)
  assert.ok(halfwaySecond.progressM > 164 && halfwaySecond.progressM < 168)
  assert.ok(halfwaySecond.totalM > 220 && halfwaySecond.totalM < 223)
  assert.throws(() => projectNearestRoutePoint({ lat: NaN, lng: 0 }, coordinates), { code: 'input' })
})

test('arrival requires real, fresh, accurate GPS fully within the mission radius', () => {
  assert.equal(calculateWalkingProgress(route, target, to, quality, now).arrived, true)
  for (const bad of [{ ...quality, simulated: true }, { ...quality, mock: true }, { ...quality, accuracyM: 70 }, { ...quality, accuracyM: null }, { ...quality, at: now - 31_000 }, { ...quality, at: undefined }]) {
    const state = calculateWalkingProgress(route, target, to, bad, now)
    assert.equal(state.arrived, false)
    assert.equal(state.remainingDistanceM, null)
    assert.equal(state.distanceToTargetM, null)
  }
  assert.equal(calculateWalkingProgress(route, target, to, undefined, now).arrived, false)
  const uncertainBoundary = { lat: -6.89882, lng: 107.601 }
  assert.equal(calculateWalkingProgress(route, target, uncertainBoundary, { ...quality, accuracyM: 10 }, now).arrived, false)
})

test('progress decreases remaining route distance; off-route GPS does not fabricate remaining distance', () => {
  const early = calculateWalkingProgress(route, target, from, quality, now)
  const later = calculateWalkingProgress(route, target, { lat: -6.8995, lng: 107.601 }, quality, now)
  assert.ok(later.remainingDistanceM < early.remainingDistanceM)
  assert.ok(later.remainingDurationS < early.remainingDurationS)
  const outside = calculateWalkingProgress(route, target, { lat: -6.902, lng: 107.601 }, quality, now)
  assert.equal(outside.offRoute, true)
  assert.equal(outside.remainingDistanceM, null)
  assert.equal(outside.arrived, false)
})

test('request is pedestrian, omits credentials, and rejects HTTP/network/invalid response errors', async (t) => {
  let captured
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    captured = { url, options }
    return new Response(JSON.stringify(fixture()), { status: 200 })
  })
  assert.equal((await fetchWalkingRoute(from, to)).coordinates.length, 3)
  assert.equal(JSON.parse(captured.options.body).costing, 'pedestrian')
  assert.equal(JSON.parse(captured.options.body).locations[0].lon, from.lng)
  assert.equal(captured.options.credentials, 'omit')
  globalThis.fetch = async () => new Response('', { status: 429 })
  await assert.rejects(fetchWalkingRoute(from, to), { code: 'service' })
  globalThis.fetch = async () => { throw new TypeError('offline') }
  await assert.rejects(fetchWalkingRoute(from, to), { code: 'network' })
  globalThis.fetch = async () => new Response('<html>proxy</html>', { status: 200 })
  await assert.rejects(fetchWalkingRoute(from, to), { code: 'response' })
  await assert.rejects(fetchWalkingRoute({ lat: 100, lng: 0 }, to), { code: 'input' })
})

test('cancel before/during request aborts without an error fallback; timeout is distinct', async (t) => {
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })))
  const controller = new AbortController()
  const pending = fetchWalkingRoute(from, to, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  await assert.rejects(fetchWalkingRoute(from, to, controller.signal), { name: 'AbortError' })
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const timeout = fetchWalkingRoute(from, to)
  t.mock.timers.tick(15_001)
  await assert.rejects(timeout, { code: 'timeout' })
})

test('Google Maps fallback uses genuine walking directions and supplies no assumed origin', () => {
  const url = new URL(walkingMapsLink(to))
  assert.equal(url.searchParams.get('travelmode'), 'walking')
  assert.equal(url.searchParams.get('destination'), '-6.899,107.601')
  assert.equal(url.searchParams.has('origin'), false)
})
