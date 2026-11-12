import { useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'

export type BuddyMood = 'hello' | 'thinking' | 'ready' | 'celebrate' | 'idle'
export type CharacterId = 'kompi' | 'resik' | 'jaga' | 'asih' | 'tunas'

/*
 * Warga Kompack! — keluarga karakter hitam-putih (garis tinta, tangan bulat tanpa jari).
 * Kompi adalah maskot utama: semangat kompak & gotong royong, memakai iket (ikat kepala) kerja bakti.
 * Karakter lain muncul sesuai konteks: Resik (kebersihan), Jaga (ronda malam), Asih (bantuan), Tunas (taman).
 * Warna tetap (identitas), tidak ikut tema.
 */
const INK = '#171717'
const PAPER = '#ffffff'
const GRAY = '#d9d9d9'
const SOFT = '#efefef'
const SW = 6 // tebal garis

export const CHARACTERS: Record<CharacterId, { name: string; role: string }> = {
  kompi: { name: 'Kompi', role: 'Si paling kompak' },
  resik: { name: 'Resik', role: 'Jagoan kebersihan' },
  jaga: { name: 'Jaga', role: 'Teman ronda malam' },
  asih: { name: 'Asih', role: 'Siap bantu tetangga' },
  tunas: { name: 'Tunas', role: 'Perawat taman' },
}

interface Arm {
  cx: number
  cy: number
  rot: number
  /** titik putar di bahu */
  px: number
  py: number
}
interface Rig {
  /** tubuh & aksesori di belakang wajah */
  back: string
  /** aksesori di depan (di atas wajah/tubuh) */
  front?: string
  /** aksesori yang bergoyang pelan & titik putarnya */
  sway?: { html: string; px: number; py: number; deg: number }
  eyeY: number
  eyeDX: number
  mouthY: number
  cheekY: number
  armL: Arm
  armR: Arm
  /** sesuatu yang dipegang tangan kanan (ikut lengan) */
  holdR?: string
  feet?: boolean
}

const stroke = `stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round" stroke-linecap="round"`
const body = (d: string) => `<path d="${d}" fill="${PAPER}" ${stroke}/>`

const RIGS: Record<CharacterId, Rig> = {
  kompi: {
    back: `${body('M100 58C141 58 160 88 160 122C160 157 135 178 100 178C65 178 40 157 40 122C40 88 59 58 100 58Z')}
      <path d="M93 59C88 45 101 37 109 45" fill="none" ${stroke}/>
      <path d="M44 88Q100 66 156 88L154 103Q100 83 46 103Z" fill="${INK}"/>`,
    sway: {
      html: `<circle cx="154" cy="95" r="8" fill="${INK}"/>
        <path d="M159 90Q181 80 190 64Q171 70 157 85Z" fill="${INK}"/>
        <path d="M160 97Q186 98 196 86Q178 106 158 102Z" fill="${INK}"/>`,
      px: 154,
      py: 95,
      deg: 9,
    },
    eyeY: 116,
    eyeDX: 20,
    mouthY: 134,
    cheekY: 132,
    armL: { cx: 41, cy: 138, rot: 26, px: 50, py: 126 },
    armR: { cx: 159, cy: 138, rot: -26, px: 150, py: 126 },
    feet: true,
  },
  resik: {
    back: `${body('M62 64Q62 52 74 52H126Q138 52 138 64V158Q138 178 118 178H82Q62 178 62 158Z')}
      <path d="M62 150H138" stroke="${INK}" stroke-width="4" opacity=".25"/>
      <path d="M60 76Q60 44 100 44Q140 44 140 76Z" fill="${INK}"/>
      <path d="M118 74H164Q168 82 156 84H118Z" fill="${INK}"/>`,
    eyeY: 100,
    eyeDX: 17,
    mouthY: 118,
    cheekY: 116,
    armL: { cx: 56, cy: 132, rot: 22, px: 64, py: 120 },
    armR: { cx: 144, cy: 132, rot: -22, px: 136, py: 120 },
    holdR: `<path d="M152 92L168 178" fill="none" ${stroke}/>
      <path d="M161 166L148 196M165 166L160 198M169 166L172 198M173 166L184 196" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <path d="M157 160H178" stroke="${INK}" stroke-width="7" stroke-linecap="round"/>`,
    feet: true,
  },
  jaga: {
    back: `<path d="M168 40A16 16 0 1 1 152 22A12 12 0 1 0 168 40Z" fill="${GRAY}"/>
      <circle cx="40" cy="44" r="3" fill="${GRAY}"/><circle cx="28" cy="70" r="2" fill="${GRAY}"/>
      ${body('M100 66C146 66 162 98 162 128C162 161 136 178 100 178C64 178 38 161 38 128C38 98 54 66 100 66Z')}
      <path d="M72 74Q72 54 100 54Q128 54 128 74Q100 80 72 74Z" fill="${INK}"/>`,
    front: `<path d="M41 146Q100 162 159 146L156 163Q100 180 44 163Z" fill="${GRAY}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
      <path d="M62 153V169M82 157V173M102 158V175M122 157V173M142 153V169" stroke="${INK}" stroke-width="3" stroke-linecap="round" opacity=".45"/>`,
    eyeY: 112,
    eyeDX: 20,
    mouthY: 130,
    cheekY: 128,
    armL: { cx: 40, cy: 140, rot: 26, px: 48, py: 128 },
    armR: { cx: 160, cy: 140, rot: -26, px: 152, py: 128 },
    holdR: `<path d="M150 150L196 108L204 126Z" fill="${GRAY}" opacity=".7"/>
      <rect x="160" y="140" width="22" height="14" rx="4" transform="rotate(-40 171 147)" fill="${INK}"/>`,
    feet: true,
  },
  asih: {
    back: `<circle cx="100" cy="48" r="14" fill="${INK}"/>
      ${body('M100 60C134 60 150 86 152 116C156 154 134 178 100 178C66 178 44 154 48 116C50 86 66 60 100 60Z')}
      <path d="M52 100Q54 60 100 60Q146 60 148 100Q134 80 100 80Q66 80 52 100Z" fill="${INK}"/>`,
    front: `<path d="M100 166C88 156 80 150 80 142C80 136 85 132 90 132C95 132 98 135 100 138C102 135 105 132 110 132C115 132 120 136 120 142C120 150 112 156 100 166Z" fill="${INK}"/>`,
    eyeY: 108,
    eyeDX: 19,
    mouthY: 125,
    cheekY: 123,
    armL: { cx: 44, cy: 132, rot: 26, px: 53, py: 120 },
    armR: { cx: 156, cy: 132, rot: -26, px: 147, py: 120 },
    feet: true,
  },
  tunas: {
    back: body('M100 80C134 80 150 106 150 134C150 161 130 178 100 178C70 178 50 161 50 134C50 106 66 80 100 80Z'),
    sway: {
      html: `<path d="M100 80V56" fill="none" ${stroke}/>
        <path d="M100 62C88 62 76 54 74 40C88 40 98 48 100 62Z" fill="${PAPER}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M100 58C104 44 116 36 130 38C128 52 116 60 100 58Z" fill="${INK}"/>`,
      px: 100,
      py: 80,
      deg: 8,
    },
    eyeY: 126,
    eyeDX: 17,
    mouthY: 142,
    cheekY: 140,
    armL: { cx: 52, cy: 146, rot: 24, px: 60, py: 136 },
    armR: { cx: 148, cy: 146, rot: -24, px: 140, py: 136 },
    feet: true,
  },
}

const arm = (a: Arm) => `<ellipse cx="${a.cx}" cy="${a.cy}" rx="11" ry="17" transform="rotate(${a.rot} ${a.cx} ${a.cy})" fill="${PAPER}" stroke="${INK}" stroke-width="5"/>`
const feet = `<ellipse cx="80" cy="179" rx="15" ry="8" fill="${INK}"/><ellipse cx="120" cy="179" rx="15" ry="8" fill="${INK}"/>`
const shadow = `<ellipse cx="100" cy="190" rx="46" ry="6" fill="${INK}" opacity=".1"/>`
const eyes = (r: Rig) =>
  `<ellipse cx="${100 - r.eyeDX}" cy="${r.eyeY}" rx="7.5" ry="9.5" fill="${INK}"/><ellipse cx="${100 + r.eyeDX}" cy="${r.eyeY}" rx="7.5" ry="9.5" fill="${INK}"/>` +
  `<circle cx="${103 - r.eyeDX}" cy="${r.eyeY - 4}" r="2.8" fill="${PAPER}"/><circle cx="${103 + r.eyeDX}" cy="${r.eyeY - 4}" r="2.8" fill="${PAPER}"/>`
const eyesHappy = (r: Rig) =>
  `<path d="M${92 - r.eyeDX} ${r.eyeY + 3}Q${100 - r.eyeDX} ${r.eyeY - 7} ${108 - r.eyeDX} ${r.eyeY + 3}M${92 + r.eyeDX} ${r.eyeY + 3}Q${100 + r.eyeDX} ${r.eyeY - 7} ${108 + r.eyeDX} ${r.eyeY + 3}" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`
const cheeks = (r: Rig) => `<ellipse cx="${100 - r.eyeDX - 15}" cy="${r.cheekY}" rx="7" ry="5" fill="${GRAY}"/><ellipse cx="${100 + r.eyeDX + 15}" cy="${r.cheekY}" rx="7" ry="5" fill="${GRAY}"/>`
const smile = (r: Rig) => `<path d="M92 ${r.mouthY - 3}Q100 ${r.mouthY + 5} 108 ${r.mouthY - 3}" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
const grin = (r: Rig) =>
  `<path d="M89 ${r.mouthY - 4}Q100 ${r.mouthY + 13} 111 ${r.mouthY - 4}Z" fill="${INK}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M95 ${r.mouthY + 3}Q100 ${r.mouthY + 7} 105 ${r.mouthY + 3}" fill="none" stroke="${SOFT}" stroke-width="3" stroke-linecap="round"/>`

/** SVG statis — untuk ikon aplikasi, logo, dan tempat tanpa animasi */
export function characterSvg(who: CharacterId = 'kompi', opts: { shadow?: boolean; viewBox?: string } = {}): string {
  const r = RIGS[who]
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${opts.viewBox ?? '0 0 200 200'}">${opts.shadow === false ? '' : shadow}${r.feet ? feet : ''}${arm(r.armL)}${r.holdR ?? ''}${arm(r.armR)}${r.back}${r.sway?.html ?? ''}${r.front ?? ''}${cheeks(r)}${eyes(r)}${smile(r)}</svg>`
}

/** kompatibel dengan nama lama */
export const kompiSvg = (opts: { shadow?: boolean; viewBox?: string } = {}) => characterSvg('kompi', opts)

const Part = ({ html }: { html: string }) => <g dangerouslySetInnerHTML={{ __html: html }} />
const EASE = [0.22, 1, 0.36, 1] as const
const at = (x: number, y: number) => ({ transformBox: 'view-box' as const, transformOrigin: `${x}px ${y}px` })

/** Karakter beranimasi: napas, kedip, aksesori bergoyang; `mood` untuk melambai, berpikir, girang. */
export function Character({ who = 'kompi', mood = 'idle', className = '' }: { who?: CharacterId; mood?: BuddyMood; className?: string }) {
  const reduced = useReducedMotion()
  const still = !!reduced
  const r = RIGS[who]
  const happy = mood === 'ready' || mood === 'celebrate'

  const bodyAnim =
    still ? {}
    : mood === 'celebrate' ? { y: [0, -34, 0, -20, 0, 0], scaleY: [1, 1.04, 0.9, 1.03, 0.94, 1] }
    : mood === 'ready' ? { y: [0, -16, 0], scaleY: [1, 1.03, 0.93, 1] }
    : mood === 'thinking' ? { rotate: -6 }
    : { y: 0, rotate: 0 }
  const bodyT =
    mood === 'celebrate' ? { duration: 1.3, ease: EASE, repeat: 1, repeatDelay: 0.5 }
    : mood === 'ready' ? { duration: 0.7, ease: EASE }
    : { duration: 0.5, ease: EASE }
  const armR =
    still ? {}
    : mood === 'hello' ? { rotate: [0, -105, -78, -110, -82, -100, 0] }
    : mood === 'celebrate' ? { rotate: [0, -118, -100, -118] }
    : mood === 'ready' ? { rotate: [0, -70, 0] }
    : { rotate: 0 }
  const armL = still ? {} : mood === 'celebrate' ? { rotate: [0, 118, 100, 118] } : mood === 'thinking' ? { rotate: 110 } : { rotate: 0 }
  const armT = mood === 'hello' ? { duration: 1.8, ease: 'easeInOut' as const } : { duration: 0.6, ease: EASE }

  return (
    <motion.svg viewBox="0 0 200 200" className={`kampung-buddy character character--${who} ${className}`} aria-hidden="true" overflow="visible">
      <motion.g
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        animate={still ? {} : mood === 'celebrate' ? { scale: [1, 0.6, 1, 0.75, 1, 1] } : mood === 'ready' ? { scale: [1, 0.75, 1] } : { scale: 1 }}
        transition={bodyT}
      >
        <Part html={shadow} />
      </motion.g>
      <motion.g style={at(100, 180)} animate={bodyAnim} transition={bodyT}>
        <motion.g style={at(100, 180)} animate={still ? {} : { scaleY: [1, 1.025, 1], scaleX: [1, 0.99, 1] }} transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
          {r.feet && <Part html={feet} />}
          <motion.g style={at(r.armL.px, r.armL.py)} animate={armL} transition={armT}>
            <Part html={arm(r.armL)} />
          </motion.g>
          <motion.g style={at(r.armR.px, r.armR.py)} animate={armR} transition={armT}>
            {r.holdR && <Part html={r.holdR} />}
            <Part html={arm(r.armR)} />
          </motion.g>
          <Part html={r.back} />
          {r.sway && (
            <motion.g
              style={at(r.sway.px, r.sway.py)}
              animate={still ? {} : mood === 'celebrate' ? { rotate: [0, -r.sway.deg * 2, r.sway.deg * 2, 0] } : { rotate: [-r.sway.deg / 2, r.sway.deg / 2, -r.sway.deg / 2] }}
              transition={mood === 'celebrate' ? { duration: 0.8, repeat: 2 } : { duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Part html={r.sway.html} />
            </motion.g>
          )}
          {r.front && <Part html={r.front} />}
          <Part html={cheeks(r)} />
          {happy ? (
            <Part html={eyesHappy(r)} />
          ) : (
            <motion.g animate={mood === 'thinking' && !still ? { x: -4, y: -3 } : { x: 0, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
              <motion.g style={at(100, r.eyeY)} animate={still ? {} : { scaleY: [1, 1, 0.1, 1, 1] }} transition={{ duration: 4.2, times: [0, 0.9, 0.93, 0.96, 1], repeat: Infinity }}>
                <Part html={eyes(r)} />
              </motion.g>
            </motion.g>
          )}
          <Part html={happy ? grin(r) : smile(r)} />
        </motion.g>
      </motion.g>

      {mood === 'thinking' &&
        [0, 1, 2].map((i) => (
          <motion.circle
            key={i}
            cx={150 + i * 13}
            cy={42 - i * 6}
            r={4 + i}
            fill={INK}
            initial={{ opacity: 0, scale: 0 }}
            animate={still ? { opacity: 0.5, scale: 1 } : { opacity: [0, 0.6, 0.6, 0], scale: [0, 1, 1, 0.6] }}
            transition={{ duration: 1.8, delay: i * 0.25, repeat: Infinity, repeatDelay: 0.4 }}
          />
        ))}
      {mood === 'celebrate' &&
        !still &&
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2
          return (
            <motion.path
              key={i}
              d="M0-7L2-2L7 0L2 2L0 7L-2 2L-7 0L-2-2Z"
              fill={i % 2 ? INK : GRAY}
              initial={{ x: 100, y: 110, scale: 0, opacity: 0 }}
              animate={{ x: 100 + Math.cos(a) * 96, y: 110 + Math.sin(a) * 90, scale: [0, 1.3, 0.8], opacity: [0, 1, 0], rotate: 90 }}
              transition={{ duration: 1.1, delay: 0.25 + i * 0.04, ease: EASE, repeat: 1, repeatDelay: 0.7 }}
            />
          )
        })}
    </motion.svg>
  )
}

/** Maskot utama (Kompi) — nama lama dipertahankan untuk komponen yang sudah memakainya */
export function KampungBuddy({ mood = 'idle', className = '' }: { mood?: BuddyMood; className?: string }) {
  return <Character who="kompi" mood={mood} className={className} />
}

/** Karakter yang bisa diketuk: melambai (atau girang) setiap disentuh, seperti teman yang menyapa balik. */
export function TapCharacter({
  who = 'kompi',
  intro = 'idle',
  react = 'hello',
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
  return (
    <button
      type="button"
      className={`tap-char ${className}`}
      aria-label={label ?? `${CHARACTERS[who].name}, ${CHARACTERS[who].role}. Ketuk untuk menyapa.`}
      onClick={() => {
        setTaps((n) => n + 1)
        navigator.vibrate?.(12)
      }}
    >
      <Character key={taps} who={who} mood={taps > 0 ? react : intro} />
    </button>
  )
}

/** Gelembung saran dari karakter yang cocok dengan konteksnya. */
export function BuddyTip({ who, children, className = '' }: { who: CharacterId; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion()
  return (
    <div className={`buddy-tip ${className}`}>
      <TapCharacter who={who} intro="hello" className="buddy-tip-char" />
      <motion.div
        className="buddy-bubble"
        initial={reduced ? false : { opacity: 0, x: -10, scale: 0.94 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24, delay: 0.15 }}
        style={{ transformOrigin: '0% 100%' }}
      >
        <p className="buddy-name">
          {CHARACTERS[who].name} <span>/ {CHARACTERS[who].role}</span>
        </p>
        <div className="buddy-text">{children}</div>
      </motion.div>
    </div>
  )
}
