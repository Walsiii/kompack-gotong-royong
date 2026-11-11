import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Camera, Check, FlaskConical, LocateFixed, MapPinned, ShieldCheck, Trophy } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AVATAR_COUNT, Avatar, Logo } from '../components/art'
import { Button, toast } from '../components/ui'
import { DEFAULT_HOME } from '../lib/geo'
import { locateOnce } from '../lib/location'
import { useSession, useStore } from '../lib/store'

const HOW = [
  { icon: MapPinned, title: 'Lihat quest di peta 3D RT-mu', text: 'Ketua RT memasang tugas; warga bisa melapor sampah atau minta tolong.' },
  { icon: Camera, title: 'Datang, check-in, foto', text: 'Check-in GPS di lokasi, foto sebelum dan sesudah dari kamera aplikasi.' },
  { icon: Trophy, title: 'Dapat poin, angkat RT-mu', text: 'Naik pangkat, tukar hadiah, dan menangkan lomba antar-RT.' },
]

export function Onboarding() {
  const nav = useNavigate()
  const register = useStore((s) => s.register)
  const setActing = useSession((s) => s.setActing)
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(0)
  const [year, setYear] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState<null | 'gps' | 'uji'>(null)

  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: 50 }, (_, i) => thisYear - 10 - i)
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
    await register({ name: name.trim(), avatar, birthYear: Number(year), home, testMode: test })
    nav('/', { replace: true })
  }

  return (
    <div className="scroll-y h-full bg-plang text-white">
      <div className="mx-auto flex min-h-full w-full max-w-[460px] flex-col px-5" style={{ paddingTop: 'calc(var(--safe-t) + 20px)', paddingBottom: 'calc(var(--safe-b) + 24px)' }}>
        <div className="mb-6 flex h-10 items-center gap-3">
          {step > 0 && (
            <button type="button" aria-label="Kembali" onClick={() => setStep(step - 1)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10">
              <ArrowLeft size={19} />
            </button>
          )}
          <div className="flex flex-1 justify-end gap-1.5" aria-label={`Langkah ${step + 1} dari 3`}>
            {[0, 1, 2].map((i) => (
              <motion.span key={i} animate={{ width: i === step ? 28 : 10 }} className={`h-1.5 rounded-full ${i <= step ? 'bg-rompi' : 'bg-white/25'}`} />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <motion.section key="a" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-1 flex-col">
              <Logo size={46} light />
              <h1 className="mt-6 text-[2.6rem] leading-[0.98]">
                Kerja bakti,
                <br />
                tapi jadi quest.
              </h1>
              <div className="reflect-stripes mt-5 h-2.5 w-28 rounded-full" style={{ animation: 'kp-sweep 3s linear infinite' }} />
              <ol className="mt-8 flex flex-col gap-5">
                {HOW.map((h, i) => (
                  <motion.li key={h.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.12 }} className="flex gap-4">
                    <span className="relative grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white/10">
                      <h.icon size={22} />
                      <span className="mono absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-rompi text-[0.62rem] font-semibold">{i + 1}</span>
                    </span>
                    <div>
                      <p className="font-display text-[1.12rem] font-bold leading-tight">{h.title}</p>
                      <p className="mt-0.5 text-[0.88rem] text-white/70">{h.text}</p>
                    </div>
                  </motion.li>
                ))}
              </ol>
              <div className="mt-auto pt-8">
                <Button full onClick={() => setStep(1)}>
                  Mulai <ArrowRight size={18} />
                </Button>
              </div>
            </motion.section>
          )}

          {step === 1 && (
            <motion.section key="b" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-1 flex-col">
              <h1 className="text-[2.1rem]">Kenalan dulu</h1>
              <p className="mt-1 text-white/70">Nama ini muncul di klasemen RT.</p>
              <div className="mt-5 rounded-[22px] bg-white p-4 text-ink">
                <label className="label" htmlFor="o-name">
                  Nama panggilan
                </label>
                <input id="o-name" className="field" maxLength={18} autoComplete="given-name" placeholder="mis. Farel" value={name} onChange={(e) => setName(e.target.value)} />
                <span className="label mt-4">Avatar</span>
                <div className="grid grid-cols-4 gap-2.5" role="radiogroup" aria-label="Avatar">
                  {Array.from({ length: AVATAR_COUNT }, (_, i) => (
                    <motion.button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={avatar === i}
                      aria-label={`Avatar ${i + 1}`}
                      whileTap={{ scale: 0.9 }}
                      animate={{ scale: avatar === i ? 1.06 : 1 }}
                      onClick={() => setAvatar(i)}
                      className={`relative aspect-square overflow-hidden rounded-2xl ${avatar === i ? 'ring-[3px] ring-rompi ring-offset-2' : ''}`}
                    >
                      <Avatar index={i} size={0} className="!h-full !w-full !rounded-none" />
                    </motion.button>
                  ))}
                </div>
                <label className="label mt-4" htmlFor="o-year">
                  Tahun lahir
                </label>
                <select id="o-year" className="field" value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">Pilih tahun</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                {minor && (
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl bg-paper p-3">
                    <input id="o-consent" type="checkbox" className="sr-only" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md ${consent ? 'bg-plang' : 'bg-white ring-1 ring-[#C9D1C9]'}`}>{consent && <Check size={15} strokeWidth={3.5} color="#fff" />}</span>
                    <span className="text-[0.86rem] leading-snug">
                      Aku di bawah 18 tahun dan <b>sudah izin orang tua atau wali</b> untuk ikut Kompack!
                    </span>
                  </label>
                )}
              </div>
              <div className="mt-auto pt-6">
                <Button full disabled={!ok} onClick={() => setStep(2)}>
                  Lanjut <ArrowRight size={18} />
                </Button>
                {!ok && <p className="mt-2 text-center text-[0.8rem] text-white/65">{!nameOk ? 'Isi nama panggilan (minimal 2 huruf).' : year === '' ? 'Pilih tahun lahirmu.' : 'Centang izin orang tua untuk lanjut.'}</p>}
              </div>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section key="c" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="flex flex-1 flex-col">
              <h1 className="text-[2.1rem]">Main jujur, ya</h1>
              <p className="mt-1 text-white/70">Poin hanya untuk yang benar-benar turun ke lapangan.</p>
              <ul className="mt-5 flex flex-col gap-3 rounded-[22px] bg-white/10 p-4 text-[0.9rem]">
                {[
                  'Check-in dicek GPS; aplikasi pemalsu lokasi terdeteksi dan ditolak.',
                  'Foto hanya dari kamera aplikasi, diberi watermark waktu & lokasi lalu disegel.',
                  'Ada waktu kerja minimal, dan foto sebelum–sesudah dibandingkan otomatis.',
                  'Kamu tidak bisa mengerjakan laporanmu sendiri. Ketua RT yang menyetujui.',
                  'Lokasimu tidak direkam terus-menerus, hanya saat check-in dan foto.',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <ShieldCheck size={17} className="mt-0.5 flex-none text-[#7BE0AC]" /> {t}
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-3 pt-6">
                <Button full disabled={!!busy} onClick={() => finish('gps')}>
                  <LocateFixed size={18} /> {busy === 'gps' ? 'Mencari lokasimu…' : 'Pakai lokasiku (GPS)'}
                </Button>
                <Button full tone="white" disabled={!!busy} onClick={() => finish('uji')}>
                  <FlaskConical size={18} /> {busy === 'uji' ? 'Menyiapkan…' : 'Coba di PC (mode uji)'}
                </Button>
                <p className="text-center text-[0.78rem] text-white/60">Mode uji: posisi dipindah dengan mengetuk peta dan boleh memakai foto contoh. Semua hasilnya ditandai.</p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
