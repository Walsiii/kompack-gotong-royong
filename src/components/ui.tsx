import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, animate, motion, useDragControls, useReducedMotion } from 'motion/react'
import { AlertTriangle, ArrowLeft, Check, FlaskConical, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { create } from 'zustand'
import type { Check as CheckT } from '../lib/types'
import { Coin } from './art'

/* ───────────── Tombol ───────────── */

type Tone = 'primary' | 'dark' | 'plang' | 'soft' | 'ghost' | 'white'

export function Button({
  tone = 'primary',
  small,
  full,
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; small?: boolean; full?: boolean }) {
  return (
    <button type="button" {...rest} className={`btn btn--${tone} ${small ? 'btn--sm' : ''} ${full ? 'w-full' : ''} ${className}`}>
      {children}
    </button>
  )
}

export function IconButton({ label, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest} className={`btn btn--white btn--icon ${className}`}>
      {children}
    </button>
  )
}

/* ───────────── Kepala halaman ───────────── */

export function TopBar({ title, sub, back, right }: { title: ReactNode; sub?: ReactNode; back?: string | true; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="page-heading sticky top-0 z-20 bg-paper" style={{ paddingTop: 'var(--safe-t)' }}>
      <div className="mx-auto flex w-full max-w-[960px] items-center gap-3 px-4 py-3 lg:px-8">
        {back && (
          <button
            type="button"
            aria-label="Kembali"
            onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
            className="btn btn--white btn--icon !h-10 !min-h-10 !w-10 flex-none"
          >
            <ArrowLeft size={19} strokeWidth={2.4} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[1.6rem] lg:text-[1.8rem]">{title}</h1>
          {sub && <p className="truncate text-[0.86rem] font-medium text-ink-2">{sub}</p>}
        </div>
        {right && <div className="flex flex-none items-center gap-2">{right}</div>}
      </div>
    </header>
  )
}

/** Wadah halaman bergulir dengan ruang untuk navigasi bawah */
export function Page({ children, className = '', bare }: { children: ReactNode; className?: string; bare?: boolean }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      className={`scroll-y h-full overflow-x-hidden ${className}`}
      style={{ paddingBottom: bare ? 'calc(var(--safe-b) + 24px)' : 'calc(var(--nav-h) + var(--safe-b) + 24px)' }}
    >
      {children}
    </motion.main>
  )
}

export function Section({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[960px] px-4 lg:px-8 ${className}`}>{children}</div>
}

/* ───────────── Poin ───────────── */

export function Points({ value, plus, className = '' }: { value: number; plus?: boolean; className?: string }) {
  return (
    <span className={`mono tnum inline-flex items-center gap-1 text-[0.8rem] font-semibold ${className}`}>
      <Coin size={14} />
      {plus ? '+' : ''}
      {value}
    </span>
  )
}

export function CountUp({ value, className, duration = 0.9 }: { value: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  const reduced = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const from = prev.current
    prev.current = value
    if (from === value || reduced) {
      el.textContent = String(value)
      return
    }
    const c = animate(from, value, { duration, ease: [0.2, 0.8, 0.2, 1], onUpdate: (v) => (el.textContent = String(Math.round(v))) })
    return () => c.stop()
  }, [value, duration, reduced])
  return (
    <span ref={ref} className={`tnum ${className ?? ''}`}>
      {value}
    </span>
  )
}

export function Bar({ value, className = '', tone = 'rompi', height = 8 }: { value: number; className?: string; tone?: 'rompi' | 'plang'; height?: number }) {
  return (
    <div
      className={`overflow-hidden rounded-full bg-surface ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={`h-full w-full origin-left rounded-full ${tone === 'rompi' ? 'bg-rompi' : 'bg-plang'}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: Math.max(0, Math.min(1, value)) }}
        transition={{ type: 'spring', stiffness: 80, damping: 18, delay: 0.1 }}
      />
    </div>
  )
}

/* ───────────── Status ───────────── */

export function StatusDot({ status }: { status: CheckT['status'] }) {
  const cls = status === 'ok' ? 'bg-ok' : status === 'warn' ? 'bg-warn' : 'bg-bad'
  return (
    <span className={`grid h-5 w-5 flex-none place-items-center rounded-full ${cls}`}>
      {status === 'ok' ? <Check size={12} strokeWidth={3.5} color="var(--color-card)" /> : status === 'warn' ? <span className="text-[11px] font-bold leading-none text-white">!</span> : <X size={12} strokeWidth={3.5} color="var(--color-card)" />}
    </span>
  )
}

export function CheckList({ checks, compact }: { checks: CheckT[]; compact?: boolean }) {
  return (
    <ul className={`flex flex-col ${compact ? 'gap-2' : 'gap-2.5'}`}>
      {checks.map((c, i) => (
        <motion.li
          key={c.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05 }}
          className="flex items-start gap-2.5"
        >
          <span className="mt-0.5">
            <StatusDot status={c.status} />
          </span>
          <span className="min-w-0">
            <span className="block text-[0.9rem] font-semibold leading-tight">{c.label}</span>
            <span className="block text-[0.8rem] text-ink-2">{c.detail}</span>
          </span>
        </motion.li>
      ))}
    </ul>
  )
}

export function Note({ children, tone = 'test', className = '' }: { children: ReactNode; tone?: 'test' | 'warn' | 'info'; className?: string }) {
  const map = {
    test: { cls: 'bg-surface text-ink', icon: <FlaskConical size={15} strokeWidth={2.4} /> },
    warn: { cls: 'bg-surface text-ink', icon: <AlertTriangle size={15} strokeWidth={2.4} /> },
    info: { cls: 'bg-surface text-plang-2', icon: <Check size={15} strokeWidth={2.6} /> },
  }[tone]
  return (
    <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-[0.86rem] font-medium leading-snug ${map.cls} ${className}`}>
      <span className="mt-px flex-none">{map.icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function Empty({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="reflect-stripes h-3 w-24 rounded-full opacity-80" style={{ animation: 'kp-sweep 3s linear infinite' }} />
      <h3 className="mt-5 text-xl">{title}</h3>
      <p className="mt-1.5 max-w-[34ch] text-ink-2">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ───────────── Lembar dialog ───────────── */

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const dragControls = useDragControls()
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const frame = requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button, input, select, textarea, [tabindex="0"]')?.focus())
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current() }
      if (e.key !== 'Tab') return
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') ?? [])
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); last?.focus() }
      else if (!e.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) { e.preventDefault(); first?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', onKey); if (previous?.isConnected) previous.focus() }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1200] flex items-end justify-center bg-ink/45 lg:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : 'Pilihan'}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 110 || i.velocity.y > 600) && onClose()}
            className="scroll-y max-h-[90%] w-full max-w-[520px] rounded-t-[26px] bg-white shadow-lift lg:rounded-[26px]"
            style={{ paddingBottom: 'calc(var(--safe-b) + 20px)' }}
          >
            <div className="sticky top-0 z-10 bg-white px-5 pb-2 pt-2.5">
              <div className="flex h-5 touch-none items-center justify-center lg:hidden" onPointerDown={(e) => dragControls.start(e)}><span className="h-1 w-10 rounded-full bg-line" /></div>
              <div className="flex items-center gap-3">
                <h2 className="min-w-0 flex-1 text-[1.3rem]">{title}</h2>
                <button type="button" aria-label="Tutup" onClick={onClose} className="btn btn--soft btn--icon !h-11 !min-h-11 !w-11 flex-none">
                  <X size={17} strokeWidth={2.6} />
                </button>
              </div>
            </div>
            <div className="px-5 pt-1">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ───────────── Toast ───────────── */

interface ToastState {
  msg: string | null
  tone: 'ok' | 'warn'
  id: number
  show: (msg: string, tone?: 'ok' | 'warn') => void
  hide: () => void
}

const useToast = create<ToastState>()((set) => ({
  msg: null,
  tone: 'ok',
  id: 0,
  show: (msg, tone = 'ok') => set((s) => ({ msg, tone, id: s.id + 1 })),
  hide: () => set({ msg: null }),
}))

export function toast(msg: string, tone: 'ok' | 'warn' = 'ok') {
  useToast.getState().show(msg, tone)
}

export function ToastHost() {
  const { msg, tone, id, hide } = useToast()
  useEffect(() => {
    if (!msg) return
    const t = setTimeout(hide, tone === 'warn' ? 4600 : 3000)
    return () => clearTimeout(t)
  }, [msg, id, tone, hide])
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[1500] flex justify-center px-4" style={{ top: 'calc(var(--safe-t) + 12px)' }} aria-live="polite">
      <AnimatePresence>
        {msg && (
          <motion.div
            key={id}
            initial={{ y: -30, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 32 }}
            className={`flex max-w-[440px] items-start gap-2.5 rounded-2xl px-4 py-3 text-[0.92rem] font-semibold text-white shadow-lift ${tone === 'ok' ? 'bg-plang' : 'bg-ink'}`}
          >
            {tone === 'ok' ? <Check size={18} strokeWidth={3} className="mt-px flex-none" /> : <AlertTriangle size={18} strokeWidth={2.4} className="mt-px flex-none text-inverse" />}
            <span>{msg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ───────────── Pilihan segmen ───────────── */

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  id,
  className = '',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  id: string
  className?: string
}) {
  return (
    <div className={`inline-flex rounded-[13px] bg-surface p-1 ${className}`} role="tablist" aria-label={id}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
            e.preventDefault()
            const index = options.findIndex((option) => option.value === value)
            const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (index + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length
            onChange(options[next].value)
            e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
          }}
          className="relative min-h-11 flex-1 whitespace-nowrap rounded-[10px] px-3.5 py-1.5 text-[0.94rem] font-semibold"
        >
          {value === o.value && (
            <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-[10px] bg-white shadow-float" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />
          )}
          <span className={`relative ${value === o.value ? 'text-ink' : 'text-ink-2'}`}>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function useIsWide(): boolean {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 60rem)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 60rem)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}
