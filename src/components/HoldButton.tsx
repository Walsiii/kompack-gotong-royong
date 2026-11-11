import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion } from 'motion/react'

/**
 * Tombol "tahan untuk konfirmasi". Mencegah check-in tak sengaja dan memberi rasa fisik:
 * pita oranye mengisi tombol selama ditekan, lalu bergetar saat selesai.
 */
export function HoldButton({
  onComplete,
  disabled,
  children,
  doneLabel,
  ms = 1100,
}: {
  onComplete: () => void
  disabled?: boolean
  children: ReactNode
  doneLabel?: ReactNode
  ms?: number
}) {
  const [p, setP] = useState(0)
  const [done, setDone] = useState(false)
  const raf = useRef<number | null>(null)
  const t0 = useRef(0)
  const holding = useRef(false)

  const stop = (reset = true) => {
    holding.current = false
    if (raf.current) cancelAnimationFrame(raf.current)
    raf.current = null
    if (reset && !done) setP(0)
  }

  const start = () => {
    if (disabled || done || holding.current) return
    holding.current = true
    t0.current = performance.now()
    navigator.vibrate?.(12)
    const tick = (t: number) => {
      if (!holding.current) return
      const k = Math.min(1, (t - t0.current) / ms)
      setP(k)
      if (k >= 1) {
        stop(false)
        setDone(true)
        navigator.vibrate?.([30, 40, 80])
        onComplete()
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => stop(), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (disabled) {
      setDone(false)
      setP(0)
    }
  }, [disabled])

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        start()
      }}
      onPointerUp={() => stop()}
      onPointerCancel={() => stop()}
      onBlur={() => stop()}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault()
          start()
        }
      }}
      onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && stop()}
      onContextMenu={(e) => e.preventDefault()}
      animate={done ? { scale: [1, 1.04, 1] } : { scale: 1 - p * 0.03 }}
      className="btn relative w-full select-none overflow-hidden !bg-ink text-white disabled:!bg-surface"
      style={{ minHeight: 58, touchAction: 'none' }}
    >
      <span
        className="hold-progress absolute inset-0 origin-left"
        style={{ transform: `scaleX(${done ? 1 : p})` }}
        aria-hidden="true"
      />
      <span className="relative flex items-center gap-2">{done && doneLabel ? doneLabel : children}</span>
    </motion.button>
  )
}
