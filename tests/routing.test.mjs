// Deterministic, MOCKED Valhalla fixtures. These tests do not establish endpoint connectivity.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-routing-tests', optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, watch: null }, appType: 'custom' })
const { decodePolyline6, parseWalkingRoute, projectNearestRoutePoint, calculateWalkingProgress, fetchWalkingRoute, deviceWalkingRoute } = await server.ssrLoadModule('/src/lib/routing.ts')
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

// Jaringan gang 3×3 (jarak 100 m) dengan satu blok tanpa jalan di tengah-kanan.
const M = 1 / 111320
const grid = []
for (let i = 0; i <= 2; i++) grid.push({ coords: [[107.6, -6.9 + i * 100 * M], [107.6 + 200 * M, -6.9 + i * 100 * M]], name: `Gang ${i}` })
for (let j = 0; j <= 2; j++) grid.push({ coords: [[107.6 + j * 100 * M, -6.9], [107.6 + j * 100 * M, -6.9 + 200 * M]], name: `Jalan ${j}` })

test('device route follows mapped roads with real turns, never a straight line across blocks', () => {
  const from = { lat: -6.9, lng: 107.6 } // pojok barat daya
  const to = { lat: -6.9 + 200 * M, lng: 107.6 + 200 * M } // pojok timur laut
  const r = deviceWalkingRoute(grid, grid, from, to)
  assert.ok(r)
  assert.equal(r.source, 'device')
  // jarak Manhattan 400 m, bukan diagonal ±283 m
  assert.ok(r.distanceM > 395 && r.distanceM < 405, `distance ${r.distanceM}`)
  // setiap titik jalur berada di salah satu garis jalan
  for (const [lng, lat] of r.coordinates) {
    const onRoad = grid.some(({ coords: [[x0, y0], [x1, y1]] }) => Math.abs((x1 - x0) * (lat - y0) - (y1 - y0) * (lng - x0)) < 1e-12 && lng >= Math.min(x0, x1) - 1e-9 && lng <= Math.max(x0, x1) + 1e-9 && lat >= Math.min(y0, y1) - 1e-9 && lat <= Math.max(y0, y1) + 1e-9)
    assert.ok(onRoad, `titik ${lng},${lat} di luar jalan`)
  }
  assert.match(r.instructions[0].text, /^Mulai berjalan di (Gang|Jalan) 0$/)
  assert.ok(r.instructions.some((s) => /^Belok (kiri|kanan) ke /.test(s.text)), 'harus ada belokan bernama')
  assert.match(r.instructions.at(-1).text, /Sampai di tujuan/)
  for (const s of r.instructions) assert.ok(s.endShapeIndex < r.coordinates.length && s.beginShapeIndex <= s.endShapeIndex)
})

test('device route snaps off-road endpoints, reports the gap, and refuses unreachable or far points', () => {
  const from = { lat: -6.9 + 50 * M, lng: 107.6 + 20 * M } // 20 m dari Jalan 0
  const to = { lat: -6.9 + 150 * M, lng: 107.6 + 200 * M }
  const r = deviceWalkingRoute(grid, grid, from, to)
  assert.ok(r && r.gapStartM > 18 && r.gapStartM < 22)
  assert.equal(deviceWalkingRoute(grid, grid, { lat: -6.9 - 400 * M, lng: 107.6 }, to), null)
  const island = [{ coords: [[107.7, -6.9], [107.7 + 50 * M, -6.9]] }]
  assert.equal(deviceWalkingRoute([...grid, ...island], grid, from, { lat: -6.9, lng: 107.7 + 25 * M }), null)
})

test('next turn distance shrinks as the walker advances; test mode may show progress only when allowed', () => {
  const from = { lat: -6.9, lng: 107.6 }
  const to = { lat: -6.9 + 100 * M, lng: 107.6 + 100 * M }
  const r = deviceWalkingRoute(grid, grid, from, to)
  const tgt = { ...to, id: 't', title: 't', radius: 20 }
  const a = calculateWalkingProgress(r, tgt, from, quality, now)
  const mid = { lat: r.coordinates[0][1] + (r.coordinates[1][1] - r.coordinates[0][1]) / 2, lng: r.coordinates[0][0] + (r.coordinates[1][0] - r.coordinates[0][0]) / 2 }
  const b = calculateWalkingProgress(r, tgt, mid, quality, now)
  assert.ok(a.distanceToNextM > 95 && a.distanceToNextM < 105)
  assert.ok(b.distanceToNextM > 45 && b.distanceToNextM < 55)
  assert.match(a.nextInstruction.text, /^Belok/)
  const sim = { accuracyM: 5, simulated: true, at: now }
  assert.equal(calculateWalkingProgress(r, tgt, mid, sim, now).remainingDistanceM, null)
  assert.ok(calculateWalkingProgress(r, tgt, mid, sim, now, { allowSimulated: true }).remainingDistanceM > 100)
  assert.equal(calculateWalkingProgress(r, tgt, mid, { ...sim, mock: true }, now, { allowSimulated: true }).remainingDistanceM, null)
})
