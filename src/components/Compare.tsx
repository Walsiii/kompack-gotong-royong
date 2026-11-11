import { useRef, useState } from 'react'
import { ChevronsLeftRight } from 'lucide-react'

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
      className="relative aspect-[4/3] w-full touch-none select-none overflow-hidden rounded-[20px] bg-ink"
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
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') setPct((p) => Math.max(3, p - 6))
        if (e.key === 'ArrowRight') setPct((p) => Math.min(97, p + 6))
      }}
    >
      <img src={after} alt="Foto sesudah" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <img src={before} alt="Foto sebelum" draggable={false} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
      <span className="mono absolute left-2.5 top-2.5 rounded bg-ink/75 px-2 py-0.5 text-[0.8rem] text-white">SEBELUM</span>
      <span className="mono absolute right-2.5 top-2.5 rounded bg-rompi px-2 py-0.5 text-[0.8rem] text-white">SESUDAH</span>
      <div className="absolute inset-y-0 w-[2px] -translate-x-1/2 bg-white" style={{ left: `${pct}%` }}>
        <span className="absolute left-1/2 top-1/2 -ml-5 -mt-5 grid h-10 w-10 place-items-center rounded-full bg-white text-ink shadow-lift">
          <ChevronsLeftRight size={19} strokeWidth={2.4} />
        </span>
      </div>
    </div>
  )
}
