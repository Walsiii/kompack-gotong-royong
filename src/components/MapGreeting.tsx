import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { TapCharacter } from './KampungBuddy'

let greeted = false

/**
 * Sapaan singkat saat peta dibuka: Kompi di siang hari, Jaga (teman ronda) di malam hari.
 * Muncul sekali per sesi, hilang sendiri, dan tidak menutupi tombol peta.
 */
export function MapGreeting({ hour, name, line, style, className = '' }: { hour: number; name: string; line: string; style?: React.CSSProperties; className?: string }) {
  const reduced = useReducedMotion()
  const [open, setOpen] = useState(() => !greeted)
  useEffect(() => {
    if (!open) return
    greeted = true
    const t = window.setTimeout(() => setOpen(false), 7000)
    return () => window.clearTimeout(t)
  }, [open])

  const night = hour >= 18 || hour < 5
  const salam = hour < 5 ? 'Malam' : hour < 11 ? 'Pagi' : hour < 15 ? 'Siang' : hour < 18 ? 'Sore' : 'Malam'
  const first = name.split(' ')[0]

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`map-greeting ${className}`}
          style={style}
          role="status"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, y: 28, transition: { duration: 0.25 } }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.9 }}
        >
          <TapCharacter who={night ? 'jaga' : 'kompi'} intro="hello" className="map-greeting-char" />
          <button type="button" className="map-greeting-bubble" onClick={() => setOpen(false)} aria-label={`${salam}, ${first}. ${line} Ketuk untuk menutup.`}>
            <strong>{salam}, {first}!</strong>
            <span>{line}</span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
