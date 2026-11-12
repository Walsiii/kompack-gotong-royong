import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, Camera, Check, FlaskConical, LocateFixed, MapPinned, ShieldCheck, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AVATAR_COUNT, Avatar, Logo } from '../components/art'
import { KampungBuddy } from '../components/KampungBuddy'
import { Button, toast } from '../components/ui'
import { DEFAULT_HOME } from '../lib/geo'
import { locateOnce } from '../lib/location'
import { useSession, useStore } from '../lib/store'
import '../components/welcome.css'

const HOW = [
  { icon: MapPinned, title: 'Lihat misi di peta 3D RT-mu', text: 'Ketua RT memasang tugas; warga bisa melapor sampah atau minta tolong.' },
  { icon: Camera, title: 'Datang, check-in, foto', text: 'Check-in GPS di lokasi, foto sebelum dan sesudah dari kamera aplikasi.' },
  { icon: Trophy, title: 'Dapat poin, angkat RT-mu', text: 'Naik pangkat, tukar hadiah, dan menangkan lomba antar-RT.' },
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
            <button type="button" className="welcome-buddy-button" aria-label="Sapa teman kampungmu" onClick={() => setGreeting((g) => g + 1)}>
              <KampungBuddy key={`${step}-${greeting}`} mood={step === 1 ? (ok ? 'ready' : 'thinking') : step === 2 || greeting > 0 ? 'ready' : 'hello'} />
            </button>
            <p className="welcome-bubble" aria-live="polite">
              {step === 0 ? (greeting > 0 ? 'Senang kenalan.' : 'Tetangga dekat, cerita hebat.') : step === 1 ? (nameOk ? `Halo, ${name.trim()}.` : 'Panggil kamu siapa?') : 'Bikin perubahan yang kelihatan.'}
            </p>
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
                  <h1 className="welcome-title" tabIndex={-1}>Satu kampung.<br />Banyak jagoan.</h1>
                  <p className="welcome-intro">Kerja bakti jadi misi. Bareng tetangga, bikin perubahan.</p>
                  <div className="welcome-playbook" aria-label="Cara bermain">
                    <span><MapPinned size={22} /> Pilih misi</span>
                    <span><Camera size={22} /> Turun tangan</span>
                    <span><Trophy size={22} /> Dapat poin</span>
                  </div>
                  <details className="welcome-details">
                    <summary>Cara mainnya</summary>
                    <ol>{HOW.map((h) => <li key={h.title}><strong>{h.title}</strong><p>{h.text}</p></li>)}</ol>
                  </details>
                  <Button full className="welcome-primary" onClick={() => setStep(1)}>Mulai</Button>
                </>}
                {step === 1 && <>
                  <h1 className="welcome-title welcome-title--form" tabIndex={-1}>Kenalan dulu.</h1>
                  <p className="welcome-intro">Nama ini muncul di klasemen RT.</p>
                  <div className="welcome-form">
                    <label className="label" htmlFor="o-name">Nama panggilan</label>
                    <input id="o-name" name="given-name" className="field" maxLength={18} autoComplete="given-name" placeholder="mis. Farel" value={name} onChange={(e) => setName(e.target.value)} />
                    <span className="label mt-4">Pilih wajahmu</span>
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
                      <span>Aku di bawah 18 tahun dan <b>sudah izin orang tua atau wali</b> untuk ikut Kompack!</span>
                    </label>}
                  </div>
                  <Button full className="welcome-primary" disabled={!ok} onClick={() => setStep(2)}>Lanjut</Button>
                  <p className="welcome-helper" aria-live="polite">{ok ? 'Sip. Kita kenalan sama lingkunganmu, yuk.' : !nameOk ? 'Isi nama panggilan (minimal 2 huruf).' : year === '' ? 'Pilih tahun lahirmu.' : 'Centang izin orang tua untuk lanjut.'}</p>
                </>}
                {step === 2 && <>
                  <h1 className="welcome-title welcome-title--form" tabIndex={-1}>Main jujur.<br />Menang bareng.</h1>
                  <p className="welcome-intro">Poin hanya untuk yang benar-benar turun ke lapangan.</p>
                  <div className="welcome-fair-play"><ShieldCheck size={30} /><p>Datang ke lokasi. Foto hasil kerjamu.<br /><strong>Ketua RT yang menyetujui.</strong></p></div>
                  <details className="welcome-details">
                    <summary>Bagaimana bukti diperiksa?</summary>
                    <ul>{FAIR_PLAY.map((t) => <li key={t}>{t}</li>)}</ul>
                  </details>
                  <div className="welcome-actions">
                    <Button full disabled={!!busy} aria-busy={busy === 'gps'} onClick={() => finish('gps')}><LocateFixed size={19} /> {busy === 'gps' ? 'Mencari lokasimu…' : 'Pakai lokasiku (GPS)'}</Button>
                    <Button full tone="ghost" disabled={!!busy} aria-busy={busy === 'uji'} onClick={() => finish('uji')}><FlaskConical size={19} /> {busy === 'uji' ? 'Menyiapkan…' : 'Coba di PC (mode uji)'}</Button>
                  </div>
                  <p className="welcome-helper">Mode uji: lokasi tetap dari GPS, tapi boleh memakai foto contoh dan posisi uji lewat tombol. Semua hasilnya ditandai.</p>
                </>}
              </motion.section>
            </AnimatePresence>
          </div>
        </div>
        <footer className="welcome-footer">Dari tetangga. Buat tetangga.</footer>
      </div>
    </main>
  )
}
