import type { Snap } from './world'

/** target poin per pekan: cukup 2 misi kecil, supaya terasa bisa dicapai warga sibuk */
export const WEEK_TARGET = 100
const DAY = 86400000

/** awal pekan (Senin 00.00 waktu lokal) */
export function weekStart(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  const back = (d.getDay() + 6) % 7
  return d.getTime() - back * DAY
}

export interface Streak {
  /** jumlah pekan berturut-turut dengan minimal satu aksi yang diterima RT */
  weeks: number
  /** pekan ini sudah terisi? (kalau belum, beruntun masih aman sampai Minggu malam) */
  thisWeek: boolean
  /** poin yang diterima pekan ini (sejak Senin) */
  weekPts: number
  target: number
  /** 6 pekan terakhir, paling lama di kiri */
  recent: boolean[]
}

/**
 * Pekan beruntun — bukan harian, karena kerja bakti tidak ada setiap hari.
 * Yang dihitung hanya aksi yang sudah diterima Ketua RT (misi disetujui atau bonus pelapor), jadi tidak bisa dipancing sendiri.
 */
export function streakOf(s: Snap, userId: string, now = Date.now()): Streak {
  const active = new Set<number>()
  let weekPts = 0
  const cur = weekStart(now)
  const add = (at: number | undefined, pts: number) => {
    if (!at) return
    const w = weekStart(at)
    active.add(w)
    if (w === cur) weekPts += pts
  }
  for (const x of s.subs) if (x.userId === userId && x.status === 'approved') add(x.reviewedAt ?? x.submittedAt, x.awarded ?? 0)
  for (const b of s.bonuses) if (b.userId === userId) add(b.at, b.points)

  const thisWeek = active.has(cur)
  let weeks = 0
  // mundur pekan demi pekan (pakai tanggal, bukan 7×24 jam, supaya aman saat pergantian jam)
  const step = (w: number) => {
    const d = new Date(w)
    d.setDate(d.getDate() - 7)
    return weekStart(d.getTime() + DAY / 2)
  }
  let w = thisWeek ? cur : step(cur)
  while (active.has(w)) {
    weeks++
    w = step(w)
  }
  const recent: boolean[] = []
  let r = cur
  for (let i = 0; i < 6; i++) {
    recent.unshift(active.has(r))
    r = step(r)
  }
  return { weeks, thisWeek, weekPts, target: WEEK_TARGET, recent }
}
