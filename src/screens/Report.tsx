import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { Camera as CamIcon, Check, MapPin, RotateCcw, Send, ShieldCheck, X } from 'lucide-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Camera } from '../components/Camera'
import { Map3D } from '../components/Map3D'
import { CatIcon } from '../components/art'
import { Button, Note, Segmented, TopBar, toast } from '../components/ui'
import { CATS, REPORT_CATS, RULES } from '../lib/catalog'
import { DEFAULT_HOME, pointInRing } from '../lib/geo'
import { validateFix } from '../lib/integrity'
import { useMyPos } from '../lib/location'
import { demoPhoto } from '../lib/photo'
import { uid } from '../lib/seed'
import { useIsRT, useMe, useMyGroup, useStore } from '../lib/store'
import type { Category, Evidence, Fix } from '../lib/types'

export function Report() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const me = useMe()
  const rt = useIsRT()
  const group = useMyGroup()
  const home = useStore((s) => s.home) ?? DEFAULT_HOME
  const testMode = useStore((s) => s.testMode)
  const createReport = useStore((s) => s.createReport)
  const { pos, jumpAt } = useMyPos()

  const [kind, setKind] = useState<'laporan' | 'tolong'>(params.get('jenis') === 'tolong' ? 'tolong' : 'laporan')
  const [cat, setCat] = useState<Category>('sampah')
  const [text, setText] = useState('')
  const [place, setPlace] = useState('')
  const [photo, setPhoto] = useState<Evidence | null>(null)
  const [cam, setCam] = useState(false)
  const draft = useMemo(() => uid('lapor'), [])

  const category: Category = kind === 'tolong' ? 'bantu' : cat
  const inside = pos && group ? pointInRing(pos, group.territory) : null

  if (rt) return <Navigate to="/rt/misi-baru" replace />
  if (!me || !group) return null

  const validate = (fix: Fix) => {
    if (!pointInRing(fix, group.territory)) return `Kamu di luar wilayah ${group.name}. Laporan hanya bisa dibuat di dalam wilayah RT-mu.`
    const r = validateFix(fix, { lat: fix.lat, lng: fix.lng, radius: 1 }, jumpAt)
    return r.ok ? null : (r.reason ?? 'Lokasi tidak valid.')
  }

  const problems: string[] = []
  if (!photo) problems.push('Ambil foto di lokasi.')
  if (text.trim().length < 10) problems.push('Ceritakan masalahnya (minimal 10 huruf).')

  const send = async () => {
    if (!photo || problems.length) return
    const r = await createReport({ authorId: me.id, kind, category, text, place, photo })
    if (!r.ok) {
      toast(r.error, 'warn')
      return
    }
    toast(kind === 'tolong' ? 'Permintaan tolong terkirim ke grup RT.' : 'Laporan terkirim ke grup RT.')
    nav(`/grup?ch=${kind}&post=${r.value}`, { replace: true })
  }

  return (
    <div className="scroll-y h-full bg-paper" style={{ paddingBottom: 'calc(var(--safe-b) + 32px)' }}>
      <TopBar back title={kind === 'tolong' ? 'Minta tolong' : 'Lapor masalah'} sub={`Dikirim ke grup ${group.name}`} />

      <div className="mx-auto grid w-full max-w-[960px] gap-5 px-4 lg:grid-cols-[1fr_1fr] lg:px-8">
        <div className="flex flex-col gap-5">
          <Segmented
            id="kind"
            value={kind}
            onChange={setKind}
            className="w-full"
            options={[
              { value: 'laporan', label: 'Laporan masalah' },
              { value: 'tolong', label: 'Minta tolong' },
            ]}
          />

          {kind === 'laporan' && (
            <div>
              <span className="label">Jenis masalah</span>
              <div className="flex flex-wrap gap-2">
                {REPORT_CATS.map((c) => (
                  <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className="chip !py-2">
                    <span className="grid h-5 w-5 place-items-center rounded-md" style={{ background: 'var(--color-accent-soft)' }}>
                      <CatIcon cat={c} size={14} />
                    </span>
                    {CATS[c].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* foto */}
          <div>
            <span className="label">Foto di lokasi</span>
            {photo ? (
              <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="relative overflow-hidden rounded-2xl bg-ink">
                <img src={photo.img} alt="Foto laporan" className="aspect-[4/3] w-full object-cover" />
                <div className="absolute right-2 top-2 flex gap-2">
                  <button type="button" onClick={() => setCam(true)} className="btn btn--white btn--sm">
                    <RotateCcw size={15} /> Ulangi
                  </button>
                  <button type="button" aria-label="Hapus foto" onClick={() => setPhoto(null)} className="btn btn--white btn--sm !px-2">
                    <X size={16} />
                  </button>
                </div>
                <p className="absolute left-2 top-2 flex items-center gap-1 rounded-lg bg-ink/70 px-2 py-1 text-[0.8rem] font-semibold text-white">
                  <ShieldCheck size={13} className="text-ink-2" /> Disegel
                </p>
              </motion.div>
            ) : (
              <button
                type="button"
                aria-label="Buka kamera"
                aria-describedby="report-camera-help"
                onClick={() => setCam(true)}
                className="group flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-surface bg-white text-ink-2 transition-colors hover:border-rompi"
              >
                <span className="grid h-16 w-16 place-items-center rounded-full bg-rompi text-white shadow-float transition-transform group-active:scale-90">
                  <CamIcon size={26} />
                </span>
                <span className="font-semibold text-ink">Buka kamera</span>
                <span id="report-camera-help" className="max-w-[28ch] text-center text-[0.9rem]">Foto langsung di tempat. Galeri tidak bisa dipakai supaya laporan tidak dipalsukan.</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          {/* lokasi */}
          <div>
            <span className="label">Lokasi</span>
            <div className="relative h-[170px] overflow-hidden rounded-2xl">
              <Map3D center={pos ?? home} zoom={16.8} me={pos} meAvatar={me.avatar} territory={group.territory} interactive={false} threeD={false} focus={pos ? { ...pos, key: `${pos.lat},${pos.lng}` } : null} />
            </div>
            <p className={`mt-2 flex items-center gap-1.5 text-[0.86rem] font-semibold ${inside ? 'text-ok' : 'text-bad'}`}>
              {inside ? <Check size={15} strokeWidth={3} /> : <MapPin size={15} />}
              {inside === null ? 'Mencari posisimu…' : inside ? `Di dalam wilayah ${group.name}` : `Di luar wilayah ${group.name} — laporan tidak bisa dikirim`}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="r-text">
              {kind === 'tolong' ? 'Butuh bantuan apa?' : 'Apa masalahnya?'}
            </label>
            <textarea id="r-text" className="field" maxLength={280} placeholder={CATS[category].hint} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="r-place">
              Patokan tempat <span className="font-normal text-ink-3">(boleh kosong)</span>
            </label>
            <input id="r-place" className="field" maxLength={60} placeholder="mis. Depan warung Bu Tini" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>

          <Note tone="info">
            Ketua RT memeriksa dulu. Kalau diterima, ini jadi misi untuk warga lain dan kamu dapat +{RULES.reporterBonus} poin pelapor. Kamu tidak bisa mengerjakan misi dari {kind === 'tolong' ? 'permintaanmu' : 'laporanmu'} sendiri.
          </Note>

          <div>
            <Button full disabled={problems.length > 0 || !inside} onClick={send}>
              <Send size={17} /> Kirim ke grup {group.name}
            </Button>
            {problems.length > 0 && <p className="mt-2 text-center text-[0.8rem] text-ink-2">{problems[0]}</p>}
          </div>
        </div>
      </div>

      <Camera
        open={cam}
        onClose={() => setCam(false)}
        onCapture={setPhoto}
        title={kind === 'tolong' ? 'Minta tolong' : `Laporan ${CATS[category].label.toLowerCase()}`}
        tag={kind === 'tolong' ? 'MINTA TOLONG' : 'LAPORAN'}
        userId={me.id}
        refId={draft}
        caption={group.name}
        validate={validate}
        sample={testMode ? () => demoPhoto('before', category, Math.floor(Math.random() * 7)) : undefined}
      />
    </div>
  )
}
