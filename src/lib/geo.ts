import type { LatLng, Ring } from './types'

const R = 6371000
const toRad = (d: number) => (d * Math.PI) / 180

/** Jarak dua titik dalam meter (haversine). */
export function distM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Geser titik sejauh `east`/`north` meter. */
export function offset(p: LatLng, east: number, north: number): LatLng {
  const dLat = (north / R) * (180 / Math.PI)
  const dLng = (east / (R * Math.cos(toRad(p.lat)))) * (180 / Math.PI)
  return { lat: p.lat + dLat, lng: p.lng + dLng }
}

export function fmtDist(m: number): string {
  if (!Number.isFinite(m)) return '—'
  if (m < 950) return `${Math.max(1, Math.round(m))} m`
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`
}

export function fmtCoord(p: LatLng): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
}

/** Titik bawaan bila lokasi tidak tersedia: permukiman Pelesiran, Tamansari, Bandung. */
export const DEFAULT_HOME: LatLng = { lat: -6.8972, lng: 107.6058 }

/* ───────────── Geometri wilayah (proyeksi lokal dalam meter) ───────────── */

interface XY {
  x: number
  y: number
}

function projector(origin: LatLng) {
  const kx = 111320 * Math.cos(toRad(origin.lat))
  const ky = 110540
  return (p: LatLng): XY => ({ x: (p.lng - origin.lng) * kx, y: (p.lat - origin.lat) * ky })
}

function cross(o: XY, a: XY, b: XY): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

function onSegment(p: XY, a: XY, b: XY): boolean {
  return Math.min(a.x, b.x) - 1e-9 <= p.x && p.x <= Math.max(a.x, b.x) + 1e-9 && Math.min(a.y, b.y) - 1e-9 <= p.y && p.y <= Math.max(a.y, b.y) + 1e-9
}

/** true bila ruas ab dan cd berpotongan (termasuk bersinggungan) */
function segmentsTouch(a: XY, b: XY, c: XY, d: XY): boolean {
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true
  if (Math.abs(d1) < 1e-9 && onSegment(a, c, d)) return true
  if (Math.abs(d2) < 1e-9 && onSegment(b, c, d)) return true
  if (Math.abs(d3) < 1e-9 && onSegment(c, a, b)) return true
  if (Math.abs(d4) < 1e-9 && onSegment(d, a, b)) return true
  return false
}

function insideXY(p: XY, poly: XY[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]
    const b = poly[j]
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

export function pointInRing(p: LatLng, ring: Ring): boolean {
  if (ring.length < 3) return false
  const pr = projector(ring[0])
  return insideXY(pr(p), ring.map(pr))
}

/** Poligon memotong dirinya sendiri? */
export function selfIntersects(ring: Ring): boolean {
  const n = ring.length
  if (n < 4) return false
  const pr = projector(ring[0])
  const P = ring.map(pr)
  for (let i = 0; i < n; i++) {
    const a = P[i]
    const b = P[(i + 1) % n]
    for (let j = i + 1; j < n; j++) {
      // ruas yang bersebelahan berbagi titik sudut — lewati
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue
      if (segmentsTouch(a, b, P[j], P[(j + 1) % n])) return true
    }
  }
  return false
}

/** Dua wilayah bertabrakan (saling memotong, bersinggungan, atau satu di dalam yang lain)? */
export function ringsOverlap(a: Ring, b: Ring): boolean {
  if (a.length < 3 || b.length < 3) return false
  const pr = projector(a[0])
  const A = a.map(pr)
  const B = b.map(pr)
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B.length; j++) {
      if (segmentsTouch(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) return true
    }
  }
  return insideXY(A[0], B) || insideXY(B[0], A)
}

/** Luas dalam m² */
export function ringArea(ring: Ring): number {
  if (ring.length < 3) return 0
  const pr = projector(ring[0])
  const P = ring.map(pr)
  let s = 0
  for (let i = 0; i < P.length; i++) {
    const a = P[i]
    const b = P[(i + 1) % P.length]
    s += a.x * b.y - b.x * a.y
  }
  return Math.abs(s) / 2
}

export function ringPerimeter(ring: Ring): number {
  let s = 0
  for (let i = 0; i < ring.length; i++) s += distM(ring[i], ring[(i + 1) % ring.length])
  return s
}

export function ringCenter(ring: Ring): LatLng {
  if (ring.length === 0) return DEFAULT_HOME
  let lat = 0
  let lng = 0
  for (const p of ring) {
    lat += p.lat
    lng += p.lng
  }
  return { lat: lat / ring.length, lng: lng / ring.length }
}

/** Jarak terdekat dari titik ke tepi poligon (meter) */
export function distToEdge(p: LatLng, ring: Ring): number {
  if (ring.length < 2) return Infinity
  const pr = projector(p)
  const P = ring.map(pr)
  let best = Infinity
  for (let i = 0; i < P.length; i++) {
    const a = P[i]
    const b = P[(i + 1) % P.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = dx * dx + dy * dy
    const t = len ? Math.max(0, Math.min(1, (-a.x * dx - a.y * dy) / len)) : 0
    best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy))
  }
  return best
}

/** Lingkaran radius check-in muat seluruhnya di dalam wilayah? */
export function circleInRing(center: LatLng, radius: number, ring: Ring): boolean {
  return pointInRing(center, ring) && distToEdge(center, ring) >= radius
}

export function circleRing(center: LatLng, radius: number, steps = 56): Ring {
  const out: Ring = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    out.push(offset(center, Math.cos(t) * radius, Math.sin(t) * radius))
  }
  return out
}

export function fmtArea(m2: number): string {
  if (m2 < 10000) return `${Math.round(m2).toLocaleString('id-ID')} m²`
  return `${(m2 / 10000).toFixed(2).replace('.', ',')} ha`
}
