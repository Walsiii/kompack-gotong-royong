import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronsUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { rankOf } from '../lib/catalog'
import { ME, pointsOf, useSnap, useStore } from '../lib/store'
import { Button, CountUp } from './ui'

/** Muncul di sisi warga saat setorannya disetujui: pita reflektif menyapu layar, poin menghitung naik. */
export function Celebration() {
  const nav = useNavigate()
  const snap = useSnap()
  const mark = useStore((s) => s.markCelebrated)
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

  useEffect(() => {
    if (open) navigator.vibrate?.([30, 50, 30, 50, 120])
  }, [open])

  const close = (to?: string) => {
    mark(fresh.map((s) => s.id))
    if (to) nav(to)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[1400] flex flex-col items-center justify-center overflow-hidden bg-plang px-6 text-center text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="dialog" aria-modal="true" aria-label="Setoran disetujui">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="reflect-stripes absolute h-10 w-[160%]"
              style={{ top: `${18 + i * 30}%`, rotate: -12 }}
              initial={{ x: '-120%' }}
              animate={{ x: '120%' }}
              transition={{ duration: 1.1, delay: i * 0.12, ease: [0.3, 0, 0.2, 1] }}
            />
          ))}
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mono text-[0.7rem] text-white/70">
            Disetujui Ketua RT
          </motion.p>
          <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-2 max-w-[18ch] text-[1.7rem]">
            {n > 1 ? `${n} misi selesai` : title}
          </motion.h2>
          <motion.p
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 13, delay: 0.7 }}
            className="font-display wd-wide mt-5 text-[6rem] font-bold leading-none"
          >
            +<CountUp value={gained} duration={1.2} />
          </motion.p>
          <p className="mono text-[0.8rem] text-rompi">poin</p>
          {after.level > before.level && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }} className="mt-6 flex flex-col items-center gap-2">
              <span className="flex items-center gap-1 text-[0.86rem] font-semibold text-white/80">
                <ChevronsUp size={16} className="text-rompi" /> Naik pangkat
              </span>
              <span className="plang !bg-white !px-4 !py-2 text-[1.2rem] !text-plang" style={{ boxShadow: 'inset 0 0 0 2px #fff, inset 0 0 0 3.5px #0D5E3F' }}>
                LV {after.level} · {after.name.toUpperCase()}
              </span>
            </motion.div>
          )}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }} className="mt-10 flex w-full max-w-[320px] flex-col gap-2.5">
            <Button full onClick={() => close('/peringkat')}>
              Lihat klasemen
            </Button>
            <button type="button" className="py-2 text-[0.9rem] font-semibold text-white/75" onClick={() => close()}>
              Tutup
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
