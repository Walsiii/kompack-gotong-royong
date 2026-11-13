import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from 'react'
import { motion, useReducedMotion, useSpring } from 'motion/react'
import {
  CHARACTERS,
  INK,
  RIGS,
  browsSvg,
  characterSvg,
  eyeWhite,
  happyEyes,
  lidsSvg,
  openMouthSvg,
  pupils,
  shadowSvg,
  smileSvg,
  type CharacterId,
  type Rig,
} from './cast'

export { CHARACTERS, characterSvg, type CharacterId }
export type BuddyMood = 'hello' | 'thinking' | 'ready' | 'celebrate' | 'idle' | 'talk'

/** kompatibel dengan nama lama: maskot utama Kompi */
export const kompiSvg = (opts: { shadow?: boolean; viewBox?: string; bust?: boolean } = {}) => characterSvg('kompi', opts)

const Part = ({ html }: { html: string }) => <g dangerouslySetInnerHTML={{ __html: html }} />
const EASE = [0.22, 1, 0.36, 1] as const
/**
 * Poros transformasi yang pasti: Motion menghitung titik putar SVG dari kotak isi (50% 50%),
 * jadi isi dibungkus jangkar tak terlihat yang berpusat tepat di titik (x, y).
 */
function Pivot({ x, y, children, ...motionProps }: { x: number; y: number; children: ReactNode } & ComponentProps<typeof motion.g>) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <motion.g {...motionProps} style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}>
        <rect x={-600} y={-600} width={1200} height={1200} fill="none" pointerEvents="none" />
        <g transform={`translate(${-x} ${-y})`}>{children}</g>
      </motion.g>
    </g>
  )
}

/* ── mata mengikuti jari / kursor (satu pendengar untuk semua karakter) ── */
const lookers = new Set<() => void>()
let pointer: { x: number; y: number; at: number } | null = null
let frame = 0
const onPointer = (e: PointerEvent) => {
  pointer = { x: e.clientX, y: e.clientY, at: Date.now() }
  if (!frame)
    frame = requestAnimationFrame(() => {
      frame = 0
      lookers.forEach((f) => f())
    })
}

function useLook(ref: RefObject<SVGSVGElement | null>, r: Rig, active: boolean, fixed: { x: number; y: number } | null) {
  const max = Math.max(1.8, Math.min(r.eyes.l.w, r.eyes.r.w) - r.eyes.pupil - 0.8)
  const x = useSpring(0, { stiffness: 260, damping: 22 })
  const y = useSpring(0, { stiffness: 260, damping: 22 })
  useEffect(() => {
    if (fixed) {
      x.set(fixed.x * max)
      y.set(fixed.y * max)
      return
    }
    if (!active) {
      x.set(0)
      y.set(0)
      return
    }
    const aim = () => {
      const el = ref.current
      if (!el || !pointer) return
      const b = el.getBoundingClientRect()
      if (!b.width) return
      const cx = b.left + (b.width * (r.eyes.l.x + r.eyes.r.x)) / 2 / 200
      const cy = b.top + (b.height * r.eyes.l.y) / 240
      const dx = pointer.x - cx
      const dy = pointer.y - cy
      const d = Math.hypot(dx, dy) || 1
      const k = Math.min(1, d / 160)
      x.set((dx / d) * k * max)
      y.set((dy / d) * k * max * 0.8)
    }
    lookers.add(aim)
    if (lookers.size === 1) {
      window.addEventListener('pointermove', onPointer, { passive: true })
      window.addEventListener('pointerdown', onPointer, { passive: true })
    }
    aim()
    // tanpa gerakan: sesekali melirik sendiri supaya tetap hidup
    const t = window.setInterval(() => {
      if (pointer && Date.now() - pointer.at < 4000) return
      const glance = Math.random()
      x.set(glance < 0.4 ? 0 : (Math.random() * 2 - 1) * max)
      y.set(glance < 0.4 ? 0 : (Math.random() * 1.2 - 0.6) * max)
    }, 2600)
    return () => {
      window.clearInterval(t)
      lookers.delete(aim)
      if (!lookers.size) {
        window.removeEventListener('pointermove', onPointer)
        window.removeEventListener('pointerdown', onPointer)
      }
    }
  }, [active, fixed?.x, fixed?.y, max, r, ref, x, y]) // eslint-disable-line react-hooks/exhaustive-deps
  return { x, y }
}

/**
 * Karakter beranimasi: napas, kedip, mata mengikuti jari, aksesori bergoyang.
 * `mood`: hello (melambai), talk (bicara), ready (melompat kecil), celebrate (girang), thinking (berpikir).
 */
export function Character({ who = 'kompi', mood = 'idle', className = '', look = true }: { who?: CharacterId; mood?: BuddyMood; className?: string; look?: boolean }) {
  const reduced = useReducedMotion()
  const still = !!reduced
  const r = RIGS[who]
  const ref = useRef<SVGSVGElement>(null)
  const [talking, setTalking] = useState(mood === 'talk')
  useEffect(() => {
    if (mood !== 'talk') return setTalking(false)
    setTalking(true)
    const t = window.setTimeout(() => setTalking(false), 1700)
    return () => window.clearTimeout(t)
  }, [mood])

  const happy = mood === 'celebrate'
  const open = mood === 'hello' || mood === 'ready' || mood === 'celebrate'
  const eyes = useLook(ref, r, look && !still && !happy, mood === 'thinking' ? { x: -0.8, y: -0.8 } : null)

  const bodyAnim =
    still ? {}
    : mood === 'celebrate' ? { y: [0, -36, 0, -22, 0, 0], scaleY: [1, 1.05, 0.9, 1.04, 0.94, 1] }
    : mood === 'ready' ? { y: [0, -16, 0], scaleY: [1, 1.04, 0.93, 1] }
    : { y: 0, scaleY: 1 }
  const bodyT =
    mood === 'celebrate' ? { duration: 1.3, ease: EASE, repeat: 1, repeatDelay: 0.4 }
    : mood === 'ready' ? { duration: 0.7, ease: EASE }
    : { duration: 0.5, ease: EASE }
  const headAnim =
    still ? {}
    : mood === 'thinking' ? { rotate: -8 }
    : mood === 'hello' ? { rotate: [0, 6, -3, 5, 0] }
    : mood === 'talk' ? { rotate: [0, -3, 3, -2, 0] }
    : { rotate: 0 }
  const sign = r.wave === 'R' ? -1 : 1
  const waver =
    still ? {}
    : mood === 'hello' ? { rotate: [0, 122, 96, 122, 96, 118, 0].map((d) => d * sign) }
    : mood === 'celebrate' ? { rotate: [0, 128, 108, 128, 108, 128].map((d) => d * sign) }
    : mood === 'ready' ? { rotate: [0, 70 * sign, 0] }
    : mood === 'talk' ? { rotate: [0, 38, 20, 34, 0].map((d) => d * sign) }
    : { rotate: 0 }
  const other = still ? {} : mood === 'celebrate' ? { rotate: [0, 128, 108, 128, 108, 128].map((d) => -d * sign) } : mood === 'thinking' ? { rotate: -24 * sign } : { rotate: 0 }
  const armR = r.wave === 'R' ? waver : other
  const armL = r.wave === 'R' ? other : waver
  const sc = r.scale ?? 1
  const armT = mood === 'hello' || mood === 'talk' ? { duration: 1.7, ease: 'easeInOut' as const } : mood === 'celebrate' ? { duration: 1.6, ease: 'easeInOut' as const } : { duration: 0.6, ease: EASE }
  const browUp = !still && (mood === 'hello' || mood === 'celebrate' || mood === 'ready' || talking)

  return (
    <motion.svg ref={ref} viewBox="0 0 200 240" className={`kampung-buddy character character--${who} ${className}`} aria-hidden="true" overflow="visible">
      <Pivot x={100} y={230} animate={still ? {} : mood === 'celebrate' ? { scale: [1, 0.55, 1, 0.72, 1, 1] } : mood === 'ready' ? { scale: [1, 0.75, 1] } : { scale: 1 }} transition={bodyT}>
        <Part html={shadowSvg} />
      </Pivot>
      <Pivot x={100} y={232} animate={bodyAnim} transition={bodyT}>
        <g transform={sc === 1 ? undefined : `translate(${100 * (1 - sc)} ${232 * (1 - sc)}) scale(${sc})`}>
        <Pivot x={100} y={232} animate={still ? {} : { scaleY: [1, 1.018, 1], scaleX: [1, 0.993, 1] }} transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}>
          {r.back && <Part html={r.back} />}
          <Part html={r.legs} />
          <Pivot x={r.armL.px} y={r.armL.py} animate={armL} transition={armT}>
            {r.armL.hold && <Part html={r.armL.hold} />}
            <Part html={r.armL.html} />
          </Pivot>
          <Pivot x={r.armR.px} y={r.armR.py} animate={armR} transition={armT}>
            {r.armR.hold && <Part html={r.armR.hold} />}
            <Part html={r.armR.html} />
          </Pivot>
          {r.neck && <Part html={r.neck} />}
          {r.body && <Part html={r.body} />}
          <Pivot x={r.head.px} y={r.head.py} animate={headAnim} transition={{ duration: mood === 'thinking' ? 0.5 : 1.4, ease: 'easeInOut' }}>
            {r.head.back && <Part html={r.head.back} />}
            <Part html={r.head.base} />
            {happy ? (
              <Part html={happyEyes(r)} />
            ) : (
              <Pivot x={100} y={r.eyes.l.y} animate={still ? {} : { scaleY: [1, 1, 0.08, 1, 1] }} transition={{ duration: 4.4, times: [0, 0.9, 0.93, 0.96, 1], repeat: Infinity }}>
                <Part html={eyeWhite(r)} />
                <motion.g style={{ x: eyes.x, y: eyes.y }}>
                  <Part html={pupils(r)} />
                </motion.g>
                {r.eyes.lid && <Part html={lidsSvg(r)} />}
              </Pivot>
            )}
            {r.brows && (
              <motion.g animate={{ y: browUp ? -4 : mood === 'thinking' ? -2 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}>
                <Part html={browsSvg(r)} />
              </motion.g>
            )}
            {r.nose && <Part html={r.nose} />}
            {talking && !still ? (
              <Pivot x={r.mouth.x} y={r.mouth.y - 2} animate={{ scaleY: [0.25, 1, 0.35, 0.9, 0.3, 1, 0.25] }} transition={{ duration: 1.6, ease: 'easeInOut' }}>
                <Part html={openMouthSvg(r, 0.9)} />
              </Pivot>
            ) : open ? (
              <Pivot x={r.mouth.x} y={r.mouth.y - 2} key={mood} initial={still ? false : { scaleY: 0.2 }} animate={{ scaleY: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 18 }}>
                <Part html={openMouthSvg(r, happy ? 1.25 : 1)} />
              </Pivot>
            ) : mood === 'thinking' ? (
              <ellipse cx={r.mouth.x + 4} cy={r.mouth.y + 3} rx={4} ry={4.6} fill="#3d1418" />
            ) : (
              <Part html={smileSvg(r)} />
            )}
            {r.over && <Part html={r.over} />}
            {r.glasses && <Part html={r.glasses} />}
            {r.head.top && <Part html={r.head.top} />}
            {r.sway && (
              <Pivot x={r.sway.px} y={r.sway.py}
                animate={still ? {} : mood === 'celebrate' ? { rotate: [0, -r.sway.deg * 2, r.sway.deg * 2, 0] } : { rotate: [-r.sway.deg / 2, r.sway.deg / 2, -r.sway.deg / 2] }}
                transition={mood === 'celebrate' ? { duration: 0.7, repeat: 2 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Part html={r.sway.html} />
              </Pivot>
            )}
          </Pivot>
        </Pivot>
        </g>
      </Pivot>

      {mood === 'thinking' &&
        [0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={156 + i * 13}
            cy={46 - i * 7}
            r={4 + i}
            fill={INK}
            initial={{ opacity: 0, scale: 0 }}
            animate={still ? { opacity: 0.5, scale: 1 } : { opacity: [0, 0.6, 0.6, 0], scale: [0, 1, 1, 0.6] }}
            transition={{ duration: 1.8, delay: i * 0.25, repeat: Infinity, repeatDelay: 0.4 }}
          />
        ))}
      {mood === 'celebrate' &&
        !still &&
        Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2 - Math.PI / 2
          const colors = ['#ffc23d', '#ff6b4a', '#1c82c4', '#2c9a4c', '#d4447a']
          return (
            <motion.path
              key={i}
              d="M0-8L2.4-2.4L8 0L2.4 2.4L0 8L-2.4 2.4L-8 0L-2.4-2.4Z"
              fill={colors[i % colors.length]}
              initial={{ x: 100, y: 120, scale: 0, opacity: 0 }}
              animate={{ x: 100 + Math.cos(a) * 104, y: 120 + Math.sin(a) * 100, scale: [0, 1.3, 0.8], opacity: [0, 1, 0], rotate: 120 }}
              transition={{ duration: 1.1, delay: 0.2 + i * 0.035, ease: EASE, repeat: 1, repeatDelay: 0.6 }}
            />
          )
        })}
    </motion.svg>
  )
}

const REACTIONS: BuddyMood[] = ['hello', 'celebrate', 'talk', 'ready']

/** Karakter yang bisa diketuk: tiap ketukan memberi reaksi berbeda. */
export function TapCharacter({
  who = 'kompi',
  intro = 'idle',
  react,
  className = '',
  label,
}: {
  who?: CharacterId
  intro?: BuddyMood
  react?: BuddyMood
  className?: string
  label?: string
}) {
  const [taps, setTaps] = useState(0)
  const mood = taps === 0 ? intro : (react ?? REACTIONS[(taps - 1) % REACTIONS.length])
  return (
    <motion.button
      type="button"
      className={`tap-char ${className}`}
      aria-label={label ?? `${CHARACTERS[who].name}, ${CHARACTERS[who].role}. Ketuk untuk menyapa.`}
      whileTap={{ scale: 0.92 }}
      onClick={() => {
        setTaps((n) => n + 1)
        navigator.vibrate?.(12)
      }}
    >
      <Character key={taps} who={who} mood={mood} />
    </motion.button>
  )
}

/** Gelembung saran dari karakter yang cocok dengan konteksnya. Karakter "bicara" saat gelembung muncul. */
export function BuddyTip({ who, children, className = '' }: { who: CharacterId; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <div className={`buddy-tip ${className}`}>
      <TapCharacter who={who} intro="talk" className="buddy-tip-char" />
      <motion.div
        className="buddy-bubble"
        initial={reduced ? false : { opacity: 0, x: -10, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 340, damping: 22, delay: 0.1 }}
        style={{ transformOrigin: '0% 100%' }}
      >
        <p className="buddy-name">{CHARACTERS[who].name}</p>
        <div className="buddy-text">{children}</div>
      </motion.div>
    </div>
  )
}

/** Maskot utama (Kompi) — nama lama dipertahankan untuk komponen yang sudah memakainya */
export function KampungBuddy({ mood = 'idle', className = '' }: { mood?: BuddyMood; className?: string }) {
  return <Character who="kompi" mood={mood} className={className} />
}
