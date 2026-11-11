import { motion, useReducedMotion } from 'motion/react'

export type BuddyMood = 'hello' | 'thinking' | 'ready' | 'celebrate'

/** A little pos ronda: it perks up when its neighbour takes an action. */
export function KampungBuddy({ mood = 'hello', className = '' }: { mood?: BuddyMood; className?: string }) {
  const reduced = useReducedMotion()
  const happy = mood === 'celebrate' || mood === 'ready'
  return (
    <motion.svg
      viewBox="0 0 280 260"
      className={`kampung-buddy ${className}`}
      aria-hidden="true"
      key={mood}
      initial={false}
      animate={reduced ? {} : { rotate: mood === 'thinking' ? -3 : [0, -2, 0], y: mood === 'celebrate' ? [0, -10, 0] : 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <ellipse cx="140" cy="242" rx="73" ry="7" fill="var(--color-line)" />
      <path d="M108 204v26H88M171 204v26h20" fill="none" stroke="var(--color-ink)" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M79 143q-19 3-23 22" fill="none" stroke="var(--color-ink)" strokeWidth="10" strokeLinecap="round" />
      <path d="M52 161c-6 0-10 5-9 11l3 8c2 6 9 8 14 4l6-8c3-4 1-9-3-11l-2-4c-3-3-6-3-9 0Z" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="4" strokeLinejoin="round" />
      <motion.g
        style={{ transformOrigin: '201px 145px' }}
        animate={reduced ? {} : { rotate: mood === 'hello' || mood === 'celebrate' ? [0, -10, 5, 0] : 0 }}
        transition={{ duration: 0.45 }}
      >
        <path d="M201 145q17-1 27-25" fill="none" stroke="var(--color-ink)" strokeWidth="10" strokeLinecap="round" />
        <path d="M229 122c-6-2-9-7-12-12l-5-8c-2-4 2-7 5-4l6 6-3-17c-1-5 5-7 7-2l4 13-1-19c0-5 6-5 7 0l1 18 2-13c1-5 7-4 6 1l-2 23c-1 9-6 15-15 14Z" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m226 115 13 3" fill="none" stroke="var(--color-ink)" strokeWidth="3" strokeLinecap="round" />
      </motion.g>
      <path d="M78 88q0-16 16-16h92q16 0 16 16v103q0 20-20 20H98q-20 0-20-20z" fill="var(--color-ink)" />
      <path d="m63 91 65-54q12-10 24 0l65 54" fill="var(--color-card)" stroke="var(--color-ink)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M174 43V25h18v33" fill="var(--color-ink)" stroke="var(--color-ink)" strokeWidth="5" strokeLinejoin="round" />
      {happy ? (
        <g fill="none" stroke="var(--color-inverse)" strokeWidth="8" strokeLinecap="round">
          <path d="M104 127q9-12 18 0M155 127q9-12 18 0" />
        </g>
      ) : (
        <g fill="var(--color-inverse)">
          <rect x="107" y="113" width="15" height="26" rx="7.5" />
          <rect x="158" y="113" width="15" height="26" rx="7.5" />
        </g>
      )}
      <path d={happy ? 'M119 157q21 29 42 0z' : 'M122 159q18 16 36 0'} fill={happy ? 'var(--color-inverse)' : 'none'} stroke="var(--color-inverse)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M101 192h78" fill="none" stroke="var(--color-ink-3)" strokeWidth="4" strokeLinecap="round" />
    </motion.svg>
  )
}
