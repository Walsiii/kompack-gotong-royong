import { useEffect, useState } from 'react'
import type { Quest } from './types'

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const pad = (n: number) => String(n).padStart(2, '0')

export function fmtClock(t: number): string {
  const d = new Date(t)
  return `${pad(d.getHours())}.${pad(d.getMinutes())}`
}

function dayDiff(t: number, now: number): number {
  const a = new Date(t)
  const b = new Date(now)
  a.setHours(0, 0, 0, 0)
  b.setHours(0, 0, 0, 0)
  return Math.round((a.getTime() - b.getTime()) / 86400000)
}

export function fmtDay(t: number, now = Date.now()): string {
  const diff = dayDiff(t, now)
  if (diff === 0) return 'Hari ini'
  if (diff === 1) return 'Besok'
  if (diff === -1) return 'Kemarin'
  const d = new Date(t)
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function fmtWindow(startAt: number, endAt: number, now = Date.now()): string {
  const sameDay = dayDiff(startAt, endAt) === 0
  if (sameDay) return `${fmtDay(startAt, now)} · ${fmtClock(startAt)}–${fmtClock(endAt)}`
  return `${fmtDay(startAt, now)} ${fmtClock(startAt)} – ${fmtDay(endAt, now)} ${fmtClock(endAt)}`
}

export function fmtDateTime(t: number, now = Date.now()): string {
  return `${fmtDay(t, now)}, ${fmtClock(t)}`
}

/** "2 j 15 mnt", "45 mnt", "3 hari" */
export function fmtDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000))
  if (min < 60) return `${min} mnt`
  const h = Math.floor(min / 60)
  if (h < 24) {
    const m = min % 60
    return m ? `${h} j ${m} mnt` : `${h} jam`
  }
  return `${Math.round(h / 24)} hari`
}

export function fmtAgo(t: number, now = Date.now()): string {
  const ms = now - t
  if (ms < 60000) return 'baru saja'
  return `${fmtDuration(ms)} lalu`
}

export type Phase = 'upcoming' | 'live' | 'ended'

/** Check-in dibuka 15 menit sebelum jam mulai. */
export const EARLY_MS = 15 * 60000

export function questPhase(q: Pick<Quest, 'startAt' | 'endAt' | 'closed'>, now = Date.now()): Phase {
  if (q.closed || now > q.endAt) return 'ended'
  if (now < q.startAt - EARLY_MS) return 'upcoming'
  return 'live'
}

export function phaseLabel(q: Pick<Quest, 'startAt' | 'endAt' | 'closed'>, now = Date.now()): string {
  const p = questPhase(q, now)
  if (p === 'ended') return 'Sudah selesai'
  if (p === 'upcoming') return `Mulai ${fmtDuration(q.startAt - now)} lagi`
  if (now < q.startAt) return 'Segera mulai'
  return `Sisa ${fmtDuration(q.endAt - now)}`
}

/** Jam yang berdetak — komponen render ulang tiap `ms`. */
export function useNow(ms = 30000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

/** nilai untuk <input type="date"> dan <input type="time"> */
export function toDateInput(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function toTimeInput(t: number): string {
  const d = new Date(t)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
export function fromInputs(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0).getTime()
}

/** "11 Nov 2026 16.42.10" — dipakai di watermark bukti foto */
export function fmtStamp(t: number): string {
  const d = new Date(t)
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`
}

/** "07:12" untuk hitung mundur */
export function fmtCountdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}

export function startOfDay(t = Date.now()): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
