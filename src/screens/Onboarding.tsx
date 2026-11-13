import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, BadgeCheck, Camera, Check, ChevronRight, FlaskConical, LocateFixed, MapPin, MapPinned, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AVATAR_COUNT, Avatar, Logo } from '../components/art'
import { Character, KampungBuddy, type CharacterId } from '../components/KampungBuddy'
import { Button, toast } from '../components/ui'
import { DEFAULT_HOME } from '../lib/geo'
import { locateOnce } from '../lib/location'
import { useSession, useStore } from '../lib/store'
import '../components/welcome.css'

const HOW = [
  { icon: MapPinned, label: 'Pilih misi', bg: 'var(--cat-sampah-soft)', fg: 'var(--cat-sampah)' },
  { icon: Camera, label: 'Foto kerjamu', bg: 'var(--cat-got-soft)', fg: 'var(--cat-got)' },
  { icon: Trophy, label: 'Dapat poin', bg: 'var(--cat-taman-soft)', fg: 'var(--cat-taman)' },
]
const RULES_VISUAL = [
  { icon: MapPin, label: 'Datang ke lokasi' },
  { icon: Camera, label: 'Foto di tempat' },
  { icon: BadgeCheck, label: 'RT menyetujui' },
]
/** warga yang ikut menyambut di layar pertama */
const CROWD: { who: CharacterId; x: number; s: number; d: number }[] = [
  { who: 'resik', x: -86, s: 0.58, d: 0.15 },
  { who: 'asih', x: -50, s: 0.66, d: 0.3 },
  { who: 'tunas', x: 50, s: 0.66, d: 0.45 },
  { who: 'rt', x: 86, s: 0.58, d: 0.6 },
]
const FAIR_PLAY = [
  'Check-in dicek GPS; aplikasi pemalsu lokasi terdeteksi dan ditolak.',
  'Foto hanya dari kamera aplikasi, diberi watermark waktu & lokasi lalu disegel.',
  'Ada waktu kerja minimal, dan foto sebelum–sesudah dibandingkan otomatis.',
  'Kamu tidak bisa mengerjakan laporanmu sendiri. Ketua RT yang menyetujui.',
  'Lokasi dipakai untuk check-in dan foto. Saat mulai navigasi, titik awal dan tujuan dikirim ke layanan rute.',
]
const STEP_NAMES = ['Kenali kampungmu', 'Kenalan dulu', 'Siap turun tangan']

export function Onboarding() {
  const nav = useNavigate()
  const register = useStore((s) => s.register)
  const setActing = useSession((s) => s.setActing)
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(0)
  const [year, setYear] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<null | 'gps' | 'uji'>(null)
  const [greeting, setGreeting] = useState(0)
  const focusedStep = useRef(0)
  const focusStep = useCallback((section: HTMLElement | null) => {
    if (!section || focusedStep.current === step) return
    focusedStep.current = step
    const target = step === 1 ? section.querySelector<HTMLInputElement>('#o-name') : section.querySelector<HTMLHeadingElement>('h1')
    target?.focus({ preventScroll: true })
  }, [step])

  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 101 }, (_, i) => thisYear - 10 - i)
  const age = year ? thisYear - Number(year) : null
  const minor = age !== null && age < 18
  const nameOk = name.trim().length >= 2
  const ok = nameOk && year !== '' && (!minor || consent)

  const finish = async (mode: 'gps' | 'uji') => {
    setBusy(mode)
    let home = DEFAULT_HOME
    let test = mode === 'uji'
    if (mode === 'gps') {
      const p = await locateOnce()
      if (p) home = p
      else {
        test = true
        toast('Lokasi tidak tersedia. Kamu masuk dengan mode uji.', 'warn')
      }
    }
    setActing('me')
    try {
      await register({ name: name.trim(), avatar, birthYear: Number(year), home, testMode: test })
      nav('/', { replace: true })
    } catch {
      toast('Pendaftaran belum tersimpan. Periksa sambungan ke server lokal lalu coba lagi.', 'warn')
    } finally { setBusy(null) }
  }

  return (
    <main className="welcome scroll-y">
      <div className="welcome-wrap">
        <header className="welcome-header">
          <Logo size={27} />
          <span className="welcome-step-label">{step + 1} dari 3</span>
        </header>
        <div className="welcome-layout">
          <div className={`welcome-companion welcome-companion--step-${step}`}>
            <div className="welcome-stage">
              {step === 0 &&
                CROWD.map((c) => (
                  <motion.div
                    key={c.who}
                    className="welcome-crowd"
                    style={{ x: `${c.x}%`, scale: c.s }}
                    initial={reduced ? false : { y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 220, damping: 16, delay: c.d }}
                  >
                    <Character who={c.who} mood={greeting > 0 ? 'celebrate' : 'idle'} key={greeting} />
                  </motion.div>
                ))}
              <button type="button" className="welcome-buddy-button" aria-label="Sapa Kompi" onClick={() => setGreeting((g) => g + 1)}>
                <KampungBuddy key={`${step}-${greeting}`} mood={step === 1 ? (ok ? 'ready' : 'thinking') : step === 2 ? 'talk' : greeting > 0 ? 'celebrate' : 'hello'} />
              </button>
            </div>
            <motion.p key={`${step}-${nameOk}`} className="welcome-bubble" aria-live="polite" initial={reduced ? false : { opacity: 0, y: 6, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 22 }}>
              {step === 0 ? (greeting > 0 ? 'Yeay! Kompak!' : 'Halo! Aku Kompi.') : step === 1 ? (nameOk ? `Halo, ${name.trim()}!` : 'Siapa namamu?') : 'Siap turun tangan?'}
            </motion.p>
          </div>
          <div className="welcome-content">
            <nav className="welcome-progress" aria-label={`Langkah ${step + 1} dari 3`}>
              {STEP_NAMES.map((label, i) => (
                <span key={label} className={`welcome-progress-item ${i <= step ? 'is-complete' : ''}`} aria-current={i === step ? 'step' : undefined}>
                  <span>{i < step ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                  <span className="welcome-progress-name">{label}</span>
                </span>
              ))}
            </nav>
            {step > 0 && <button type="button" className="welcome-back" aria-label="Kembali" onClick={() => setStep(step - 1)}><ArrowLeft size={18} /> Kembali</button>}
            <AnimatePresence mode="wait" initial={false}>
              <motion.section
                key={step}
                ref={focusStep}
                className="welcome-step"
                initial={false}
                animate={reduced ? {} : { x: [12, 0] }}
                exit={reduced ? {} : { opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {step === 0 && <>
                  <h1 className="welcome-title" tabIndex={-1}>Kerja bakti<br />jadi misi.</h1>
                  <ol className="welcome-how" aria-label="Cara bermain">
                    {HOW.map((h, i) => (
                      <motion.li key={h.label} initial={reduced ? false : { opacity: 0, y: 18, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.25 + i * 0.12 }}>
                        <span className="welcome-how-icon" style={{ background: h.bg, color: h.fg }}>
                          <h.icon size={30} strokeWidth={2.2} aria-hidden="true" />
                          <b>{i + 1}</b>
                        </span>
                        <span className="welcome-how-label">{h.label}</span>
                        {i < HOW.length - 1 && <ChevronRight className="welcome-how-arrow" size={18} aria-hidden="true" />}
                      </motion.li>
                    ))}
                  </ol>
                  <Button full className="welcome-primary" onClick={() => setStep(1)}>Mulai</Button>
                </>}
                {step === 1 && <>
                  <h1 className="welcome-title welcome-title--form" tabIndex={-1}>Kenalan dulu.</h1>
                  <div className="welcome-form">
                    <label className="label" htmlFor="o-name">Nama</label>
                    <input id="o-name" name="given-name" className="field" maxLength={18} autoComplete="given-name" placeholder="mis. Farel" value={name} onChange={(e) => setName(e.target.value)} />
                    <span className="label mt-4">Wajahmu</span>
                    <div className="welcome-avatars" role="radiogroup" aria-label="Avatar">
                      {Array.from({ length: AVATAR_COUNT }, (_, i) => (
                        <button key={i} type="button" role="radio" aria-checked={avatar === i} tabIndex={avatar === i ? 0 : -1} aria-label={`Avatar ${i + 1}`} className={`welcome-avatar ${avatar === i ? 'is-selected' : ''}`} onClick={() => setAvatar(i)} onKeyDown={(e) => {
                          if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) {
                            e.preventDefault()
                            const next = (i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1) + AVATAR_COUNT) % AVATAR_COUNT
                            setAvatar(next)
                            const siblings = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                            siblings?.[next]?.focus()
                          }
                        }}>
                          <Avatar index={i} size={48} />
                          {avatar === i && <span className="welcome-avatar-check"><Check size={12} strokeWidth={3} /></span>}
                        </button>
                      ))}
                    </div>
                    <label className="label mt-4" htmlFor="o-year">Tahun lahir</label>
                    <select id="o-year" name="bday-year" autoComplete="bday-year" className="field" value={year} onChange={(e) => setYear(e.target.value)}>
                      <option value="">Pilih tahun</option>
                      {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    {minor && <label className="welcome-consent" htmlFor="o-consent">
                      <input id="o-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      <span><b>Sudah izin orang tua/wali</b></span>
                    </label>}
                  </div>
                  <Button full className="welcome-primary" disabled={!ok} onClick={() => setStep(2)}>Lanjut</Button>
                  {!ok && <p className="welcome-helper" aria-live="polite">{!nameOk ? 'Isi nama (min. 2 huruf)' : year === '' ? 'Pilih tahun lahir' : 'Centang izin orang tua'}</p>}
                </>}
                {step === 2 && <>
                  <h1 className="welcome-title welcome-title--form" tabIndex={-1}>Main jujur.</h1>
                  <ol className="welcome-rules" aria-label="Aturan main">
                    {RULES_VISUAL.map((r, i) => (
                      <motion.li key={r.label} initial={reduced ? false : { opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.15 + i * 0.12 }}>
                        <span className="welcome-rule-icon"><r.icon size={24} strokeWidth={2.3} aria-hidden="true" /></span>
                        <span>{r.label}</span>
                      </motion.li>
                    ))}
                  </ol>
                  <details className="welcome-details">
                    <summary>Cara bukti diperiksa</summary>
                    <ul>{FAIR_PLAY.map((t) => <li key={t}>{t}</li>)}</ul>
                  </details>
                  <div className="welcome-actions">
                    <Button full disabled={!!busy} aria-busy={busy === 'gps'} onClick={() => finish('gps')}><LocateFixed size={19} /> {busy === 'gps' ? 'Mencari lokasimu…' : 'Pakai lokasiku (GPS)'}</Button>
                    <Button full tone="ghost" disabled={!!busy} aria-busy={busy === 'uji'} onClick={() => finish('uji')}><FlaskConical size={19} /> {busy === 'uji' ? 'Menyiapkan…' : 'Coba di PC (mode uji)'}</Button>
                  </div>
                  <p className="welcome-helper">Hasil mode uji ditandai.</p>
                </>}
              </motion.section>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  )
}
