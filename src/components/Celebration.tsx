import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronsUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { nextRank, rankOf, rankProgress } from '../lib/catalog'
import { ME, pointsOf, useSnap, useStore } from '../lib/store'
import { Coin } from './art'
import { Button, RollingNumber } from './ui'
import './welcome.css'
import './celebration.css'

const EASE = [0.22, 1, 0.36, 1] as const
const COINS = 7

/**
 * Muncul hanya setelah setoran warga benar-benar disetujui.
 * Urutan: cap → poin bergulir → koin terbang ke total → batang pangkat terisi (dan naik pangkat bila lewat).
 */
export function Celebration() {
  const nav = useNavigate()
  const snap = useSnap()
  const mark = useStore((s) => s.markCelebrated)
  const reduced = useReducedMotion()
  const fresh = useMemo(() => snap.subs.filter((s) => s.userId === ME && s.status === 'approved' && !s.celebrated), [snap.subs])
  const open = fresh.length > 0
  const total = pointsOf(snap, ME)
  const live = useMemo(() => {
    const gained = fresh.reduce((t, s) => t + (s.awarded ?? 0), 0)
    return { gained, total, before: total - gained, title: snap.quests.find((q) => q.id === fresh[0]?.questId)?.title, n: fresh.length }
  }, [fresh, total, snap.quests])
  const kept = useRef(live)
  if (open) kept.current = live
  const { gained, before, title, n } = kept.current
  const after = kept.current.total
  const rankBefore = rankOf(before)
  const rankAfter = rankOf(after)
  const levelUp = rankAfter.level > rankBefore.level

  /* 0 cap · 1 poin · 2 koin terbang · 3 total & pangkat · 4 naik pangkat */
  const [phase, setPhase] = useState(0)
  const [flight, setFlight] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const gainRef = useRef<HTMLParagraphElement>(null)
  const totalRef = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) {
      setPhase(0)
      setFlight(null)
      return
    }
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    primary.current?.focus()
    if (reduced) {
      setPhase(levelUp ? 4 : 3)
      return () => previous?.focus()
    }
    navigator.vibrate?.(40)
    const timers = [
      window.setTimeout(() => setPhase(1), 450),
      window.setTimeout(() => {
        const a = gainRef.current?.getBoundingClientRect()
        const b = totalRef.current?.getBoundingClientRect()
        if (a && b) setFlight({ x0: a.left + a.width / 2, y0: a.top + a.height / 2, x1: b.left + 28, y1: b.top + b.height / 2 })
        setPhase(2)
      }, 1500),
      window.setTimeout(() => {
        setPhase(3)
        navigator.vibrate?.([20, 40, 20, 40, 60])
      }, 2150),
      window.setTimeout(() => levelUp && setPhase(4), 3300),
    ]
    return () => {
      timers.forEach(clearTimeout)
      previous?.focus()
    }
  }, [open, reduced, levelUp])

  const close = (to?: string) => {
    mark(fresh.map((s) => s.id))
    if (to) nav(to)
  }

  const shownTotal = phase >= 3 ? after : before
  const shownRank = phase >= 4 || (phase >= 3 && !levelUp) ? rankAfter : rankBefore
  const upcoming = nextRank(phase >= 4 ? after : before)
  const fill = phase < 3 ? rankProgress(before) : levelUp && phase < 4 ? 1 : rankProgress(after)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="earned-celebration"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? {} : { opacity: 0 }}
          transition={{ duration: 0.25 }}
          role="dialog"
          aria-modal="true"
          aria-label="Setoran disetujui"
          onKeyDown={(e) => {
            if (e.key === 'Escape') close()
            if (e.key === 'Tab') {
              const controls = e.currentTarget.querySelectorAll<HTMLButtonElement>('button')
              const first = controls[0]
              const last = controls[controls.length - 1]
              if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
              if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
            }
          }}
        >
          <div className="cel">
            {/* cap disetujui */}
            <motion.div
              className="cel-stamp"
              initial={reduced ? false : { scale: 2.2, opacity: 0, rotate: -18 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 17, delay: 0.1 }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.38, delay: 0.32, ease: EASE }} />
              </svg>
              {!reduced && (
                <>
                  <motion.span className="cel-ring" initial={{ scale: 1, opacity: 0.5 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 0.7, delay: 0.28, ease: EASE }} />
                  <span className="cel-ticks" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => {
                      const ang = (i / 10) * Math.PI * 2
                      return (
                        <motion.span
                          key={i}
                          style={{ rotate: `${(ang * 180) / Math.PI + 90}deg` }}
                          initial={{ x: Math.cos(ang) * 52, y: Math.sin(ang) * 52, opacity: 0, scaleY: 0.4 }}
                          animate={{ x: Math.cos(ang) * 84, y: Math.sin(ang) * 84, opacity: [0, 1, 0], scaleY: [0.4, 1, 0.2] }}
                          transition={{ duration: 0.55, delay: 0.3 + i * 0.012, ease: EASE }}
                        />
                      )
                    })}
                  </span>
                </>
              )}
            </motion.div>

            <motion.h2 className="cel-title" initial={reduced ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.35, ease: EASE }}>
              Disetujui Ketua RT
            </motion.h2>
            <motion.p className="cel-mission" initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.42, ease: EASE }}>
              {n > 1 ? `${n} misi selesai` : title}
            </motion.p>

            {/* poin yang didapat */}
            <motion.p
              ref={gainRef}
              className="cel-gain"
              initial={reduced ? false : { opacity: 0, scale: 0.7 }}
              animate={{ opacity: phase >= 1 ? 1 : 0, scale: phase === 2 ? 0.92 : phase >= 1 ? 1 : 0.7 }}
              transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            >
              +<RollingNumber value={phase >= 1 ? gained : 0} />
              <small>poin</small>
            </motion.p>

            {/* total & pangkat */}
            <motion.div
              ref={totalRef}
              className="cel-total"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 16, scale: phase === 3 ? [1, 1.035, 1] : 1 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <div>
                <p className="cel-total-label">Total poinmu</p>
                <p className="cel-total-num">
                  <Coin size={22} />
                  <RollingNumber value={shownTotal} />
                </p>
              </div>
              <div className="cel-rank">
                <p className="cel-rank-name">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={shownRank.level} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
                      Level {shownRank.level} · {shownRank.name}
                    </motion.span>
                  </AnimatePresence>
                  <span>{levelUp && phase === 3 ? 'Naik!' : upcoming ? `${Math.max(0, upcoming.min - shownTotal)} lagi` : 'Tertinggi'}</span>
                </p>
                <div className="cel-track">
                  <motion.div className="cel-fill" initial={false} animate={{ scaleX: Math.max(0.02, fill) }} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 70, damping: 15 }} />
                </div>
              </div>
            </motion.div>

            <AnimatePresence>
              {phase >= 4 && (
                <motion.p className="cel-levelup" initial={reduced ? false : { opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 14 }}>
                  <ChevronsUp size={18} aria-hidden="true" /> Naik pangkat: {rankAfter.name}
                </motion.p>
              )}
            </AnimatePresence>

            <motion.div className="cel-actions" initial={reduced ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.6, ease: EASE }}>
              <button ref={primary} type="button" className="btn btn--primary w-full" onClick={() => close('/peringkat')}>Lihat klasemen</button>
              <Button tone="ghost" full onClick={() => close()}>Tutup</Button>
            </motion.div>
          </div>

          {/* koin terbang dari poin ke total */}
          {phase === 2 && flight && !reduced &&
            Array.from({ length: COINS }, (_, i) => {
              const spread = (i - (COINS - 1) / 2) * 16
              return (
                <motion.span
                  key={i}
                  className="cel-coin"
                  aria-hidden="true"
                  initial={{ x: flight.x0 + spread, y: flight.y0, scale: 0, opacity: 0 }}
                  animate={{
                    x: [flight.x0 + spread, flight.x0 + spread * 2.2, flight.x1],
                    y: [flight.y0, flight.y0 - 46 - Math.abs(spread) * 0.5, flight.y1],
                    scale: [0, 1.15, 0.6],
                    opacity: [0, 1, 1],
                  }}
                  transition={{ duration: 0.62, delay: i * 0.045, ease: [0.4, 0, 0.2, 1], times: [0, 0.4, 1] }}
                >
                  <Coin size={18} />
                </motion.span>
              )
            })}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
