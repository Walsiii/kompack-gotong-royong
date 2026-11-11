/**
 * Pemeriksaan anti-curang Kompack!
 *
 * Di purwarupa ini pemeriksaan berjalan di perangkat. Fungsinya sengaja dibuat murni
 * (tanpa ketergantungan UI) supaya bisa dijalankan ulang di server saat aplikasi
 * memakai backend — perangkat tidak boleh jadi satu-satunya penentu poin.
 */
import { RULES } from './catalog'
import { distM, fmtDist } from './geo'
import type { Check, CheckStatus, Evidence, Fix, Person, Misi, Submission } from './types'

/* ───────────── Sidik visual foto (dHash 64-bit) ───────────── */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Gambar tidak bisa dibaca'))
    img.src = src
  })
}

/** dHash dari sumber gambar apa pun yang bisa digambar ke kanvas */
export function dHashFrom(source: CanvasImageSource): string {
  const c = document.createElement('canvas')
  c.width = 9
  c.height = 8
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return '0'.repeat(16)
  ctx.drawImage(source, 0, 0, 9, 8)
  const d = ctx.getImageData(0, 0, 9, 8).data
  const lum = (x: number, y: number) => {
    const i = (y * 9 + x) * 4
    return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
  }
  let hex = ''
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x += 4) {
      let nib = 0
      for (let k = 0; k < 4; k++) nib = (nib << 1) | (lum(x + k, y) > lum(x + k + 1, y) ? 1 : 0)
      hex += nib.toString(16)
    }
  }
  return hex
}

export async function dHash(src: string): Promise<string> {
  return dHashFrom(await loadImage(src))
}

export function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64
  let n = 0
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16)
    while (x) {
      n += x & 1
      x >>= 1
    }
  }
  return n
}

/* ───────────── Segel bukti (SHA-256) ───────────── */

async function sha256(text: string): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
  }
  // cadangan bila halaman tidak berjalan di konteks aman (http di jaringan lokal)
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < text.length; i++) {
    h1 = Math.imul(h1 ^ text.charCodeAt(i), 16777619)
    h2 = Math.imul(h2 ^ text.charCodeAt(text.length - 1 - i), 2246822519)
  }
  return `fnv${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`
}

export async function sealEvidence(e: Omit<Evidence, 'seal'>, userId: string, ref: string): Promise<string> {
  const imgHash = await sha256(e.img)
  return sha256(
    [userId, ref, e.at, e.lat.toFixed(6), e.lng.toFixed(6), Math.round(e.acc), e.hash, e.sample ? 1 : 0, e.simulated ? 1 : 0, imgHash].join('|'),
  )
}

export async function verifySeal(e: Evidence, userId: string, ref: string): Promise<boolean> {
  const { seal, ...rest } = e
  return (await sealEvidence(rest, userId, ref)) === seal
}

/** kode pendek untuk watermark foto */
export function shortCode(seed: string): string {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6)
}

/* ───────────── Validasi posisi ───────────── */

export interface FixResult {
  ok: boolean
  dist: number
  reason?: string
}

export function validateFix(
  fix: Fix | null,
  target: { lat: number; lng: number; radius: number },
  jumpAt: number | null,
  now = Date.now(),
): FixResult {
  if (!fix) return { ok: false, dist: Infinity, reason: 'Posisimu belum diketahui. Izinkan akses lokasi lalu tunggu sinyal GPS.' }
  const dist = distM(fix, target)
  if (fix.mock) {
    return { ok: false, dist, reason: 'Lokasi palsu terdeteksi. Matikan aplikasi pemalsu GPS (mock location), lalu coba lagi.' }
  }
  if (!fix.simulated) {
    if (jumpAt && now - jumpAt < RULES.jumpCooldownMs) {
      const left = Math.ceil((RULES.jumpCooldownMs - (now - jumpAt)) / 60000)
      return { ok: false, dist, reason: `Lokasimu melompat terlalu jauh dalam waktu singkat. Coba lagi ${left} menit lagi.` }
    }
    if (now - fix.at > 30000) return { ok: false, dist, reason: 'Lokasi belum diperbarui. Tunggu sinyal GPS sebentar.' }
    if (fix.acc > RULES.maxAccuracy) {
      return { ok: false, dist, reason: `Sinyal GPS kurang akurat (±${Math.round(fix.acc)} m). Pindah ke tempat terbuka lalu coba lagi.` }
    }
  }
  if (dist > target.radius) return { ok: false, dist, reason: `Kamu masih ${fmtDist(dist - target.radius)} di luar area check-in.` }
  return { ok: true, dist }
}

/* ───────────── Penilaian setoran ───────────── */

export interface EvidenceRef {
  ref: string
  label: string
  ev: Evidence
}

export interface Assessment {
  checks: Check[]
  risk: 'rendah' | 'sedang' | 'tinggi'
  /** alasan setoran tidak boleh dikirim sama sekali */
  block: string | null
}

export function riskOf(checks: Check[]): Assessment['risk'] {
  if (checks.some((c) => c.status === 'bad')) return 'tinggi'
  if (checks.some((c) => c.status === 'warn')) return 'sedang'
  return 'rendah'
}

export async function assessSubmission(
  sub: Submission,
  misi: Misi,
  user: Person,
  others: EvidenceRef[],
): Promise<Assessment> {
  const checks: Check[] = []
  const add = (id: string, label: string, status: CheckStatus, detail: string) => checks.push({ id, label, status, detail })
  const ci = sub.checkin
  const testMode = ci.simulated

  // 1. check-in di area
  add(
    'lokasi',
    'Check-in di area misi',
    ci.dist > misi.radius ? 'bad' : testMode ? 'warn' : 'ok',
    testMode
      ? `Lokasi disimulasikan (mode uji) · ${fmtDist(ci.dist)} dari titik`
      : `${fmtDist(ci.dist)} dari titik (radius ${misi.radius} m), akurasi ±${Math.round(ci.acc)} m`,
  )

  // 2. pemalsu GPS
  add(
    'gps',
    'GPS asli',
    ci.mock ? 'bad' : ci.emulator ? 'warn' : 'ok',
    ci.mock
      ? 'Aplikasi pemalsu lokasi aktif saat check-in'
      : ci.emulator
        ? 'Aplikasi berjalan di emulator, bukan ponsel'
        : testMode
          ? 'Tidak diperiksa (mode uji)'
          : 'Tidak ada pemalsu lokasi atau lompatan posisi',
  )

  const { before, after } = sub
  if (before && after) {
    // 3. foto diambil di lokasi
    const tol = misi.radius + Math.min(25, Math.max(before.acc, after.acc))
    const db = distM(before, misi)
    const da = distM(after, misi)
    add(
      'foto-lokasi',
      'Foto diambil di lokasi',
      db > tol || da > tol ? 'bad' : 'ok',
      db > tol || da > tol ? `Foto diambil ${fmtDist(Math.max(db, da))} dari titik misi` : `Sebelum ${fmtDist(db)} · sesudah ${fmtDist(da)} dari titik`,
    )

    // 4. lama kerja
    const mins = (after.at - before.at) / 60000
    const enough = mins >= misi.minMinutes
    add(
      'durasi',
      'Lama kerja wajar',
      enough ? 'ok' : testMode ? 'warn' : 'bad',
      enough
        ? `${Math.round(mins)} menit kerja (minimal ${misi.minMinutes})`
        : testMode
          ? `Waktu tunggu dilewati di mode uji (${Math.max(0, Math.round(mins))} dari ${misi.minMinutes} menit)`
          : `Hanya ${Math.max(0, Math.round(mins))} menit, minimal ${misi.minMinutes}`,
    )

    // 5. ada perubahan
    const diff = hamming(before.hash, after.hash)
    add(
      'perubahan',
      'Ada perubahan di foto',
      diff <= RULES.sameHash ? 'bad' : diff >= RULES.farHash ? 'warn' : 'ok',
      diff <= RULES.sameHash
        ? 'Foto sebelum dan sesudah hampir sama'
        : diff >= RULES.farHash
          ? 'Sudut foto sesudah sangat berbeda dari foto sebelum'
          : `Selisih visual ${diff}/64, sudut foto sama`,
    )

    // 6. foto tidak dipakai ulang
    let dup: EvidenceRef | null = null
    for (const o of others) {
      for (const mine of [before, after]) {
        if (mine.sample && o.ev.sample) continue
        if (hamming(mine.hash, o.ev.hash) <= RULES.dupHash) dup = o
      }
    }
    add('foto-baru', 'Foto baru, bukan daur ulang', dup ? 'bad' : 'ok', dup ? `Mirip foto di ${dup.label}` : 'Tidak cocok dengan foto lain di RT ini')

    // 7. sumber foto
    const sample = before.sample || after.sample
    add('kamera', 'Diambil dari kamera aplikasi', sample ? 'warn' : 'ok', sample ? 'Memakai foto contoh (mode uji)' : 'Galeri tidak bisa dipakai, foto ber-watermark')

    // 8. segel
    const [sb, sa] = await Promise.all([verifySeal(before, sub.userId, sub.questId), verifySeal(after, sub.userId, sub.questId)])
    add('segel', 'Segel bukti utuh', sb && sa ? 'ok' : 'bad', sb && sa ? 'Foto, waktu, dan lokasi tidak diubah sejak difoto' : 'Data bukti berubah setelah difoto')
  }

  // 9. riwayat warga
  add(
    'kepercayaan',
    'Riwayat warga',
    user.trust >= 80 ? 'ok' : user.trust >= 50 ? 'warn' : 'bad',
    `Skor kepercayaan ${user.trust}/100`,
  )

  const hard = checks.find((c) => (c.id === 'perubahan' || c.id === 'foto-baru' || c.id === 'foto-lokasi') && c.status === 'bad')
  return {
    checks,
    risk: riskOf(checks),
    block: hard
      ? hard.id === 'perubahan'
        ? 'Foto sesudah terlihat sama dengan foto sebelum. Selesaikan pekerjaannya dulu, lalu foto ulang.'
        : hard.id === 'foto-baru'
          ? 'Foto ini pernah dipakai di setoran lain. Ambil foto baru di lokasi.'
          : 'Foto diambil di luar area misi. Ambil ulang di lokasi.'
      : null,
  }
}
