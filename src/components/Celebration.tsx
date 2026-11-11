import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Check, ChevronsUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { rankOf } from '../lib/catalog'
import { ME, pointsOf, useSnap, useStore } from '../lib/store'
import { KampungBuddy } from './KampungBuddy'
import { Button, CountUp } from './ui'
import './welcome.css'

/** An earned response, shown only after the resident's actual submission is approved. */
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
    return { gained, before: rankOf(total - gained), after: rankOf(total), title: snap.quests.find((q) => q.id === fresh[0]?.questId)?.title, n: fresh.length }
  }, [fresh, total, snap.quests])
  const kept = useRef(live)
  if (open) kept.current = live
  const { gained, before, after, title, n } = kept.current
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    navigator.vibrate?.([30, 50, 30, 50, 120])
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    primary.current?.focus()
    return () => previous?.focus()
  }, [open])

  const close = (to?: string) => {
    mark(fresh.map((s) => s.id))
    if (to) nav(to)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="earned-celebration"
          initial={false}
          animate={reduced ? {} : { opacity: [0.5, 1] }}
          exit={reduced ? {} : { opacity: 0 }}
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
          <div className="earned-content">
            {!reduced && <div className="earned-rays" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => {
              const angle = (i * Math.PI) / 4
              return <motion.span key={i} initial={{ x: 0, y: 0, opacity: 0 }} animate={{ x: [0, Math.cos(angle) * 160], y: [0, Math.sin(angle) * 140], rotate: i * 45, opacity: [0, 1, 0] }} transition={{ duration: 0.8, delay: 0.15 }} />
            })}</div>}
            <KampungBuddy mood="celebrate" />
            <h2>Kampungmu<br />makin kompak.</h2>
            <p className="earned-mission">{n > 1 ? `${n} misi selesai` : title}</p>
            <motion.p className="earned-points" initial={false} animate={reduced ? {} : { scale: [0.9, 1.04, 1] }} transition={{ duration: 0.45 }}>
              +<CountUp value={gained} duration={reduced ? 0 : 1} />
            </motion.p>
            <p className="earned-unit">poin buat aksimu</p>
            <p className="earned-approval"><Check size={18} strokeWidth={2.5} /> Disetujui Ketua RT</p>
            {after.level > before.level && (
              <div className="earned-rank">
                <p><ChevronsUp size={18} /> Naik pangkat</p>
                <strong>Level {after.level}: {after.name}</strong>
              </div>
            )}
            <div className="earned-actions">
              <button ref={primary} type="button" className="btn btn--primary w-full" onClick={() => close('/peringkat')}>Lihat klasemen</button>
              <Button tone="ghost" full onClick={() => close()}>Tutup</Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
