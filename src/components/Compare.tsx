import { useRef, useState } from 'react'
import { ChevronsLeftRight } from 'lucide-react'
import './evidence.css'

/** Pembanding foto sebelum–sesudah: geser pegangan untuk membandingkan. */
export function Compare({ before, after }: { before: string; after: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(50)
  const dragging = useRef(false)
  const move = (x: number) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPct(Math.min(97, Math.max(3, ((x - r.left) / r.width) * 100)))
  }
  return (
    <div
      ref={ref}
      className="photo-compare"
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        move(e.clientX)
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      role="slider"
      tabIndex={0}
      aria-label="Geser untuk membandingkan foto sebelum dan sesudah"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${Math.round(pct)} persen foto sebelum terlihat`}
      onKeyDown={(e) => {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault()
        if (e.key === 'ArrowLeft') setPct((p) => Math.max(3, p - 6))
        if (e.key === 'ArrowRight') setPct((p) => Math.min(97, p + 6))
        if (e.key === 'Home') setPct(3)
        if (e.key === 'End') setPct(97)
      }}
    >
      <img src={after} alt="Foto sesudah" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <img src={before} alt="Foto sebelum" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
      <span className="photo-compare-label photo-compare-label--before">Sebelum</span>
      <span className="photo-compare-label photo-compare-label--after">Sesudah</span>
      <div className="photo-compare-divider" style={{ left: `${pct}%` }}>
        <span className="photo-compare-handle">
          <ChevronsLeftRight size={21} strokeWidth={2.4} aria-hidden="true" />
        </span>
      </div>
    </div>
  )
}
