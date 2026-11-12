/**
 * Rute jalan kaki di perangkat, dihitung dari garis jalan OpenStreetMap yang sudah termuat di peta.
 *
 * Dipakai bila layanan rute online tidak terjangkau. Jalurnya selalu mengikuti ruas jalan
 * yang benar-benar ada di data peta (Dijkstra di atas graf simpul OSM), tidak pernah garis
 * lurus menembus rumah. Ujung awal dan akhir disambung ke titik terdekat di jalan; potongan
 * itu dilaporkan terpisah (gapStartM/gapEndM) supaya peta bisa menggambarnya putus-putus.
 */
import { distM } from './geo'
import type { LatLng } from './types'

export type Coord = [number, number]
export interface RoadLine {
  coords: Coord[]
  name?: string
}
export interface DeviceRouteStep {
  text: string
  distanceM: number
  beginShapeIndex: number
  endShapeIndex: number
}
export interface DeviceRoute {
  coordinates: Coord[]
  distanceM: number
  durationS: number
  instructions: DeviceRouteStep[]
  gapStartM: number
  gapEndM: number
}

/** kecepatan jalan kaki santai (m/detik) */
export const WALK_SPEED = 1.25
/** titik awal/akhir yang lebih jauh dari ini ke jalan terdekat dianggap tidak terjangkau */
export const MAX_SNAP_M = 150

const key = (c: Coord) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`
const toLL = (c: Coord): LatLng => ({ lng: c[0], lat: c[1] })

function bearing(a: Coord, b: Coord): number {
  const r = Math.PI / 180
  const y = Math.sin((b[0] - a[0]) * r) * Math.cos(b[1] * r)
  const x = Math.cos(a[1] * r) * Math.sin(b[1] * r) - Math.sin(a[1] * r) * Math.cos(b[1] * r) * Math.cos((b[0] - a[0]) * r)
  return ((Math.atan2(y, x) / r) + 360) % 360
}

/** proyeksi titik ke ruas ab (meter, proyeksi lokal) */
function project(p: Coord, a: Coord, b: Coord): { t: number; d: number; at: Coord } {
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180)
  const ky = 110540
  const ax = (a[0] - p[0]) * kx
  const ay = (a[1] - p[1]) * ky
  const dx = (b[0] - a[0]) * kx
  const dy = (b[1] - a[1]) * ky
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len)) : 0
  return { t, d: Math.hypot(ax + dx * t, ay + dy * t), at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] }
}

/** antrean prioritas biner minimal untuk Dijkstra */
class Heap {
  private items: [number, number][] = []
  get size() {
    return this.items.length
  }
  push(node: number, cost: number) {
    const a = this.items
    a.push([cost, node])
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p][0] <= a[i][0]) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop(): [number, number] {
    const a = this.items
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
}

interface Edge {
  to: number
  w: number
}

interface Snap {
  a: number
  b: number
  t: number
  at: Coord
  d: number
}

/** nama jalan terdekat (≤ 12 m) untuk sebuah titik, dari garis yang punya nama */
function nameNear(p: Coord, named: RoadLine[]): string | undefined {
  let best: string | undefined
  let bestD = 12
  for (const l of named) {
    if (!l.name) continue
    for (let i = 0; i < l.coords.length - 1; i++) {
      const { d } = project(p, l.coords[i], l.coords[i + 1])
      if (d < bestD) {
        bestD = d
        best = l.name
      }
    }
  }
  return best
}

/** titik di sepanjang jalur sejauh `m` meter dari indeks i (maju bila m>0, mundur bila m<0) */
function along(path: Coord[], i: number, m: number): Coord {
  let left = Math.abs(m)
  const dir = m > 0 ? 1 : -1
  let j = i
  while (left > 0) {
    const k = j + dir
    if (k < 0 || k >= path.length) return path[j]
    const seg = distM(toLL(path[j]), toLL(path[k]))
    if (seg >= left) {
      const f = left / seg
      return [path[j][0] + (path[k][0] - path[j][0]) * f, path[j][1] + (path[k][1] - path[j][1]) * f]
    }
    left -= seg
    j = k
  }
  return path[j]
}

function turnText(delta: number, name?: string): string {
  const onto = name ? ` ke ${name}` : ''
  const a = Math.abs(delta)
  const side = delta > 0 ? 'kanan' : 'kiri'
  if (a >= 150) return `Putar balik${onto}`
  if (a >= 60) return `Belok ${side}${onto}`
  return `Serong ${side}${onto}`
}

/**
 * Pecah ruas di setiap persilangan & pertigaan. Data ubin peta bisa menyederhanakan garis
 * sehingga dua jalan yang bertemu tidak berbagi titik simpul; tanpa ini graf jadi terputus.
 */
function splitAtCrossings(lines: RoadLine[]): [Coord, Coord][] {
  const raw: [Coord, Coord][] = []
  const dedup = new Set<string>()
  for (const l of lines) {
    for (let i = 0; i < l.coords.length - 1; i++) {
      const a = l.coords[i]
      const b = l.coords[i + 1]
      const ka = key(a)
      const kb = key(b)
      if (ka === kb) continue
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
      if (dedup.has(k)) continue
      dedup.add(k)
      raw.push([a, b])
    }
  }
  if (!raw.length) return raw
  // proyeksi lokal (meter) supaya perhitungan perpotongan stabil
  const o = raw[0][0]
  const kx = 111320 * Math.cos((o[1] * Math.PI) / 180)
  const ky = 110540
  const P = raw.map(([a, b]) => [(a[0] - o[0]) * kx, (a[1] - o[1]) * ky, (b[0] - o[0]) * kx, (b[1] - o[1]) * ky])
  const back = (x: number, y: number): Coord => [o[0] + x / kx, o[1] + y / ky]
  const cuts: { t: number; c: Coord }[][] = raw.map(() => [])
  // indeks grid 60 m
  const CELL = 60
  const grid = new Map<string, number[]>()
  P.forEach(([x0, y0, x1, y1], i) => {
    for (let gx = Math.floor(Math.min(x0, x1) / CELL); gx <= Math.floor(Math.max(x0, x1) / CELL); gx++)
      for (let gy = Math.floor(Math.min(y0, y1) / CELL); gy <= Math.floor(Math.max(y0, y1) / CELL); gy++) {
        const k = `${gx},${gy}`
        const list = grid.get(k)
        if (list) list.push(i)
        else grid.set(k, [i])
      }
  })
  const TOL = 1.2 // meter: pertigaan yang ujungnya nyaris menyentuh jalan lain
  const done = new Set<string>()
  const onSeg = (px: number, py: number, s: number[]) => {
    const dx = s[2] - s[0]
    const dy = s[3] - s[1]
    const len = dx * dx + dy * dy
    const t = len ? ((px - s[0]) * dx + (py - s[1]) * dy) / len : 0
    if (t <= 0 || t >= 1) return null
    return Math.hypot(s[0] + dx * t - px, s[1] + dy * t - py) <= TOL ? t : null
  }
  for (const list of grid.values()) {
    for (let x = 0; x < list.length; x++)
      for (let y = x + 1; y < list.length; y++) {
        const i = list[x]
        const j = list[y]
        const pk = i < j ? `${i}-${j}` : `${j}-${i}`
        if (done.has(pk)) continue
        done.add(pk)
        const A = P[i]
        const B = P[j]
        const rx = A[2] - A[0]
        const ry = A[3] - A[1]
        const sx = B[2] - B[0]
        const sy = B[3] - B[1]
        const den = rx * sy - ry * sx
        if (Math.abs(den) > 1e-9) {
          const t = ((B[0] - A[0]) * sy - (B[1] - A[1]) * sx) / den
          const u = ((B[0] - A[0]) * ry - (B[1] - A[1]) * rx) / den
          if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) {
            const c = back(A[0] + rx * t, A[1] + ry * t)
            cuts[i].push({ t, c })
            cuts[j].push({ t: u, c })
            continue
          }
        }
        // ujung satu ruas jatuh di tengah ruas lain (pertigaan)
        for (const [m, n] of [[i, j], [j, i]] as const) {
          const S = P[m]
          for (const end of [0, 1] as const) {
            const t = onSeg(P[n][end * 2], P[n][end * 2 + 1], S)
            if (t !== null) cuts[m].push({ t, c: raw[n][end] })
          }
        }
      }
  }
  const out: [Coord, Coord][] = []
  raw.forEach(([a, b], i) => {
    const cs = cuts[i].sort((p, q) => p.t - q.t)
    let prev = a
    for (const { c } of cs) {
      out.push([prev, c])
      prev = c
    }
    out.push([prev, b])
  })
  return out
}

/**
 * Cari rute jalan kaki dari `from` ke `to` di atas `lines`.
 * `named` dipakai untuk nama jalan (boleh sama dengan `lines`). Kembalikan null bila tidak terhubung.
 */
export function routeOnRoads(lines: RoadLine[], from: LatLng, to: LatLng, named: RoadLine[] = lines): DeviceRoute | null {
  const pts: Coord[] = []
  const ids = new Map<string, number>()
  const adj: Edge[][] = []
  const node = (c: Coord) => {
    const k = key(c)
    let id = ids.get(k)
    if (id === undefined) {
      id = pts.length
      ids.set(k, id)
      pts.push(c)
      adj.push([])
    }
    return id
  }
  const segs: [number, number][] = []
  const seen = new Set<string>()
  for (const [ca, cb] of splitAtCrossings(lines)) {
    const a = node(ca)
    const b = node(cb)
    if (a === b) continue
    const sk = a < b ? `${a}-${b}` : `${b}-${a}`
    if (seen.has(sk)) continue // ruas yang sama dari dua ubin peta
    seen.add(sk)
    const w = distM(toLL(pts[a]), toLL(pts[b]))
    adj[a].push({ to: b, w })
    adj[b].push({ to: a, w })
    segs.push([a, b])
  }
  if (!segs.length) return null

  const snap = (p: LatLng): Snap | null => {
    const c: Coord = [p.lng, p.lat]
    let best: Snap | null = null
    for (const [a, b] of segs) {
      const r = project(c, pts[a], pts[b])
      if (!best || r.d < best.d) best = { a, b, t: r.t, at: r.at, d: r.d }
    }
    return best && best.d <= MAX_SNAP_M ? best : null
  }
  const s = snap(from)
  const e = snap(to)
  if (!s || !e) return null

  // simpul semu untuk titik awal & akhir di tengah ruas
  const S = pts.length
  const T = S + 1
  pts.push(s.at, e.at)
  adj.push([], [])
  const link = (v: number, sn: Snap) => {
    const la = distM(toLL(pts[v]), toLL(pts[sn.a]))
    const lb = distM(toLL(pts[v]), toLL(pts[sn.b]))
    adj[v].push({ to: sn.a, w: la }, { to: sn.b, w: lb })
    adj[sn.a].push({ to: v, w: la })
    adj[sn.b].push({ to: v, w: lb })
  }
  link(S, s)
  link(T, e)
  if ((s.a === e.a && s.b === e.b) || (s.a === e.b && s.b === e.a)) {
    const w = distM(toLL(s.at), toLL(e.at))
    adj[S].push({ to: T, w })
    adj[T].push({ to: S, w })
  }

  // Dijkstra
  const dist = new Float64Array(pts.length).fill(Infinity)
  const prev = new Int32Array(pts.length).fill(-1)
  dist[S] = 0
  const heap = new Heap()
  heap.push(S, 0)
  while (heap.size) {
    const [d, u] = heap.pop()
    if (d > dist[u]) continue
    if (u === T) break
    for (const { to: v, w } of adj[u]) {
      const nd = d + w
      if (nd < dist[v]) {
        dist[v] = nd
        prev[v] = u
        heap.push(v, nd)
      }
    }
  }
  if (!Number.isFinite(dist[T])) return null

  const order: number[] = []
  for (let v = T; v !== -1; v = prev[v]) order.push(v)
  order.reverse()
  // buang titik yang berimpit (< 0,5 m) supaya arah belokan stabil
  const path: Coord[] = []
  for (const v of order) {
    const c = pts[v]
    if (!path.length || distM(toLL(path[path.length - 1]), toLL(c)) > 0.5) path.push(c)
  }
  if (path.length < 2) path.push(e.at)

  const cum = [0]
  for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + distM(toLL(path[i - 1]), toLL(path[i])))
  const total = cum[cum.length - 1]

  // belokan: bandingkan arah 12 m sebelum dan sesudah tiap simpul
  const turns: { i: number; delta: number }[] = []
  for (let i = 1; i < path.length - 1; i++) {
    const inB = bearing(along(path, i, -12), path[i])
    const outB = bearing(path[i], along(path, i, 12))
    let delta = outB - inB
    if (delta > 180) delta -= 360
    if (delta <= -180) delta += 360
    if (Math.abs(delta) < 32) continue
    const last = turns[turns.length - 1]
    if (last && cum[i] - cum[last.i] < 8) {
      // dua tekukan rapat dihitung satu belokan
      last.delta = Math.max(-179, Math.min(179, last.delta + delta))
      continue
    }
    turns.push({ i, delta })
  }

  const instructions: DeviceRouteStep[] = []
  const firstName = nameNear(along(path, 0, Math.min(10, total / 2)), named)
  const firstEnd = turns[0]?.i ?? path.length - 1
  instructions.push({ text: `Mulai berjalan${firstName ? ` di ${firstName}` : ''}`, distanceM: cum[firstEnd], beginShapeIndex: 0, endShapeIndex: firstEnd })
  turns.forEach((t, k) => {
    const end = turns[k + 1]?.i ?? path.length - 1
    const name = nameNear(along(path, t.i, Math.min(10, (cum[end] - cum[t.i]) / 2)), named)
    instructions.push({ text: turnText(t.delta, name), distanceM: cum[end] - cum[t.i], beginShapeIndex: t.i, endShapeIndex: end })
  })
  instructions.push({ text: 'Sampai di tujuan; periksa lokasi misi', distanceM: 0, beginShapeIndex: path.length - 1, endShapeIndex: path.length - 1 })

  return {
    coordinates: path,
    distanceM: total,
    durationS: total / WALK_SPEED,
    instructions,
    gapStartM: s.d,
    gapEndM: e.d,
  }
}
