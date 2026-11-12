import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  Check,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  List,
  LocateFixed,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Undo2,
  Volume2,
  VolumeX,
  X,
  type LucideIcon,
} from 'lucide-react'
import { fmtDist } from '../lib/geo'
import type { WalkingNavigationState } from '../lib/routing'
import './navigation-mode.css'

/** ikon belokan dari teks petunjuk */
function turnIcon(text: string | undefined): LucideIcon {
  const t = (text ?? '').toLowerCase()
  if (/putar balik/.test(t)) return Undo2
  if (/bundaran/.test(t)) return RotateCw
  if (/^belok kanan/.test(t)) return CornerUpRight
  if (/^belok kiri/.test(t)) return CornerUpLeft
  if (/kanan/.test(t)) return ArrowUpRight
  if (/kiri/.test(t)) return ArrowUpLeft
  if (/sampai|akhir rute/.test(t)) return Flag
  return ArrowUp
}

/** "Sampai di tujuan; periksa lokasi misi" → "Tujuan di depan" untuk banner */
function bannerText(text: string | undefined): string {
  if (!text) return ''
  if (/sampai di tujuan|akhir rute/i.test(text)) return 'Tujuan ada di depan'
  return text
}

const roundSpoken = (m: number) => (m >= 100 ? Math.round(m / 50) * 50 : Math.max(10, Math.round(m / 10) * 10))

const clock = (s: number) => {
  const d = new Date(Date.now() + s * 1000)
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

/* ───────────── Suara petunjuk ───────────── */

function useVoice(enabled: boolean) {
  const voice = useRef<SpeechSynthesisVoice | null>(null)
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return
    const pick = () => {
      voice.current = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('id')) ?? null
    }
    pick()
    speechSynthesis.addEventListener?.('voiceschanged', pick)
    return () => {
      speechSynthesis.removeEventListener?.('voiceschanged', pick)
      speechSynthesis.cancel()
    }
  }, [])
  return (text: string) => {
    if (!enabled || typeof speechSynthesis === 'undefined' || !text) return
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'id-ID'
    if (voice.current) u.voice = voice.current
    u.rate = 1
    speechSynthesis.speak(u)
  }
}

export const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

interface Props {
  nav: WalkingNavigationState
  targetTitle: string
  following: boolean
  onRecenter: () => void
  onExit: () => void
  onOpenMission: () => void
  /** mode uji: berjalan otomatis sepanjang rute */
  testMode: boolean
  simulating: boolean
  onSimulate: (on: boolean) => void
}

/**
 * Navigasi jalan kaki di dalam aplikasi, pola yang sudah akrab dari aplikasi peta:
 * banner belokan di atas, waktu tiba di bawah, kamera mengikuti arah jalan.
 */
export function NavigationMode({ nav, targetTitle, following, onRecenter, onExit, onOpenMission, testMode, simulating, onSimulate }: Props) {
  const reduced = useReducedMotion()
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('kompack-voice') === 'off'
    } catch {
      return false
    }
  })
  const [steps, setSteps] = useState(false)
  const speak = useVoice(!muted)
  const route = nav.route
  const next = nav.nextInstruction
  const then = nav.thenInstruction
  const NextIcon = turnIcon(next?.text)
  const ThenIcon = turnIcon(then?.text)
  const toNext = nav.distanceToNextM
  const remainingS = nav.remainingDurationS ?? route?.durationS ?? 0
  const remainingM = nav.remainingDistanceM ?? route?.distanceM ?? 0
  const minutes = Math.max(1, Math.round(remainingS / 60))

  /* pengumuman suara: saat rute siap, saat belokan baru jadi "berikutnya", saat belokan sudah dekat, dan saat tiba */
  const spoken = useRef<{ key: string; near: boolean; ready: boolean; arrived: boolean }>({ key: '', near: false, ready: false, arrived: false })
  useEffect(() => {
    if (nav.status !== 'ready' || !route) {
      spoken.current = { key: '', near: false, ready: false, arrived: false }
      return
    }
    const s = spoken.current
    if (nav.arrived) {
      if (!s.arrived) speak(`Kamu sudah sampai di ${targetTitle}.`)
      s.arrived = true
      return
    }
    if (!s.ready) {
      s.ready = true
      const first = route.instructions[0]?.text ?? 'Mulai berjalan'
      speak(next && toNext !== null ? `${first}. Lalu, dalam ${roundSpoken(toNext)} meter, ${bannerText(next.text).toLowerCase()}.` : `${first}.`)
    }
    const key = next ? `${next.beginShapeIndex}:${next.text}` : ''
    if (key && key !== s.key) {
      if (s.key && toNext !== null && toNext > 40) speak(`Dalam ${roundSpoken(toNext)} meter, ${bannerText(next!.text).toLowerCase()}.`)
      s.key = key
      s.near = false
    }
    if (next && toNext !== null && toNext <= 25 && !s.near) {
      s.near = true
      speak(`${bannerText(next.text)}.`)
    }
  }, [nav.status, route, nav.arrived, next, toNext, targetTitle]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    setMuted((m) => {
      try {
        localStorage.setItem('kompack-voice', m ? 'on' : 'off')
      } catch {
        /* abaikan */
      }
      if (!m && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
      return !m
    })
  }

  const enter = reduced ? false : { y: -24, opacity: 0 }
  const enterBottom = reduced ? false : { y: 32, opacity: 0 }

  /* ───── banner atas ───── */
  let banner: React.ReactNode
  if (nav.status === 'loading' || nav.status === 'idle') {
    banner = (
      <div className="navm-banner is-plain" role="status">
        <span className="navm-spinner" aria-hidden="true" />
        <p className="navm-banner-text">Mencari rute jalan kaki…</p>
      </div>
    )
  } else if (nav.status === 'error') {
    banner = (
      <div className="navm-banner is-plain" role="alert">
        <p className="navm-banner-text">{nav.error}</p>
      </div>
    )
  } else if (nav.arrived) {
    banner = (
      <div className="navm-banner is-arrived" role="status">
        <motion.span className="navm-turn" initial={reduced ? false : { scale: 0.4, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 15 }}>
          <Check size={34} strokeWidth={2.6} aria-hidden="true" />
        </motion.span>
        <div className="navm-banner-copy">
          <p className="navm-dist">Kamu sudah sampai</p>
          <p className="navm-banner-text">{targetTitle}</p>
        </div>
      </div>
    )
  } else if (nav.offRoute) {
    banner = (
      <div className="navm-banner" role="status">
        <span className="navm-turn">
          <RotateCcw size={30} aria-hidden="true" />
        </span>
        <div className="navm-banner-copy">
          <p className="navm-dist">Keluar jalur</p>
          <p className="navm-banner-text">Mencari ulang rute dari posisimu…</p>
        </div>
      </div>
    )
  } else {
    banner = (
      <div className="navm-banner" role="status" aria-live="polite">
        <motion.span
          key={next?.text ?? 'lurus'}
          className="navm-turn"
          initial={reduced ? false : { scale: 0.5, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        >
          <NextIcon size={36} strokeWidth={2.4} aria-hidden="true" />
        </motion.span>
        <div className="navm-banner-copy">
          <p className="navm-dist tnum">{toNext !== null ? fmtDist(toNext) : '—'}</p>
<motion.p
            key={next?.text ?? ''}
            className="navm-banner-text"
            initial={reduced ? false : { y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.22 }}
          >
            {bannerText(next?.text) || 'Ikuti jalur'}
          </motion.p>
        </div>
        {voiceSupported && (
          <button type="button" className="navm-icon-btn is-on-dark" onClick={toggleMute} aria-pressed={!muted} aria-label={muted ? 'Nyalakan suara petunjuk' : 'Matikan suara petunjuk'}>
            {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
          </button>
        )}
      </div>
    )
  }

  const showThen = nav.status === 'ready' && !nav.arrived && !nav.offRoute && then && toNext !== null && toNext < 120

  return (
    <>
      <motion.div className="navm-top" initial={enter} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}>
        {banner}
        <AnimatePresence>
          {showThen && (
            <motion.p
              className="navm-then"
              initial={reduced ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={reduced ? undefined : { height: 0, opacity: 0 }}
            >
              Lalu <ThenIcon size={18} aria-hidden="true" /> <span>{bannerText(then!.text)}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {!following && nav.status === 'ready' && !nav.arrived && (
          <motion.button
            type="button"
            className="navm-recenter"
            onClick={onRecenter}
            initial={reduced ? false : { y: 16, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={reduced ? undefined : { y: 16, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
          >
            <LocateFixed size={18} aria-hidden="true" /> Pusatkan ulang
          </motion.button>
        )}
      </AnimatePresence>

      <motion.section className="navm-bottom" aria-label={`Navigasi ke ${targetTitle}`} initial={enterBottom} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.05 }}>
        {nav.arrived ? (
          <div className="navm-row">
            <button type="button" className="navm-icon-btn" onClick={onExit} aria-label="Selesai navigasi">
              <X size={22} aria-hidden="true" />
            </button>
            <button type="button" className="btn btn--primary navm-main-action" onClick={onOpenMission}>
              Mulai misi di sini
            </button>
          </div>
        ) : nav.status === 'error' ? (
          <div className="navm-row">
            <button type="button" className="navm-icon-btn" onClick={onExit} aria-label="Keluar navigasi">
              <X size={22} aria-hidden="true" />
            </button>
            <button type="button" className="btn btn--primary navm-main-action" onClick={() => void nav.retry()}>
              <RotateCcw size={18} aria-hidden="true" /> Coba lagi
            </button>
          </div>
        ) : (
          <>
            <div className="navm-row">
              <button type="button" className="navm-icon-btn" onClick={onExit} aria-label="Keluar navigasi">
                <X size={22} aria-hidden="true" />
              </button>
              <div className="navm-eta">
                {nav.status === 'ready' && route ? (
                  <>
                    <p className="navm-eta-time tnum">
                      {minutes} <span>mnt</span>
                    </p>
                    <p className="navm-eta-meta tnum">
                      {fmtDist(remainingM)} · tiba {clock(remainingS)}
                    </p>
                  </>
                ) : (
                  <p className="navm-eta-meta">Ke {targetTitle}</p>
                )}
              </div>
              <button type="button" className="navm-icon-btn" onClick={() => setSteps(true)} disabled={!route} aria-label="Lihat semua langkah">
                <List size={22} aria-hidden="true" />
              </button>
            </div>
            {testMode && nav.status === 'ready' && (
              <div className="navm-test">
                <span>Mode uji: posisimu disimulasikan.</span>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSimulate(!simulating)}>
                  {simulating ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                  {simulating ? 'Jeda' : 'Jalan otomatis'}
                </button>
              </div>
            )}
          </>
        )}
      </motion.section>

      <AnimatePresence>
        {steps && route && (
          <motion.div className="navm-steps-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSteps(false)}>
            <motion.div
              className="navm-steps"
              role="dialog"
              aria-modal="true"
              aria-label="Langkah rute"
              onClick={(e) => e.stopPropagation()}
              initial={reduced ? false : { y: '100%' }}
              animate={{ y: 0 }}
              exit={reduced ? undefined : { y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <div className="navm-steps-head">
                <div>
                  <p className="navm-steps-title">Ke {targetTitle}</p>
                  <p className="navm-eta-meta tnum">
                    {fmtDist(route.distanceM)} · {Math.max(1, Math.round(route.durationS / 60))} mnt jalan kaki
                  </p>
                </div>
                <button type="button" className="navm-icon-btn" onClick={() => setSteps(false)} aria-label="Tutup langkah">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <ol className="navm-steps-list">
                {route.instructions.map((s, i) => {
                  const Icon = turnIcon(s.text)
                  const done = nav.currentInstruction ? route.instructions.indexOf(nav.currentInstruction) > i : false
                  const current = nav.currentInstruction === s
                  return (
                    <li key={`${s.beginShapeIndex}-${i}`} className={`${done ? 'is-done' : ''} ${current ? 'is-current' : ''}`}>
                      <span className="navm-step-icon">
                        <Icon size={20} aria-hidden="true" />
                      </span>
                      <span className="navm-step-copy">
                        <span>{s.text}</span>
                        {s.distanceM > 0 && <small className="tnum">{fmtDist(s.distanceM)}</small>}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
