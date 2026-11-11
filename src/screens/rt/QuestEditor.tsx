import { useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { Map as MLMap } from 'maplibre-gl'
import { Minus, Plus, Rocket } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Map3D } from '../../components/Map3D'
import { CatIcon } from '../../components/art'
import { Button, Note, Page, Section, TopBar, toast } from '../../components/ui'
import { CATS, CAT_LIST } from '../../lib/catalog'
import { DEFAULT_HOME, distToEdge, ringCenter } from '../../lib/geo'
import { questProblem, useMe, useMyGroup, useStore } from '../../lib/store'
import { fmtWindow, fromInputs, toDateInput, toTimeInput } from '../../lib/time'
import type { Category, LatLng } from '../../lib/types'

const DAY = 86400000

function Stepper({ value, set, min, max, step, label, unit }: { value: number; set: (v: number) => void; min: number; max: number; step: number; label: string; unit?: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2 rounded-[13px] bg-[#F3F5F2] p-1">
        <button type="button" aria-label={`Kurangi ${label}`} disabled={value <= min} onClick={() => set(Math.max(min, value - step))} className="btn btn--white btn--icon !h-10 !min-h-10 !w-10">
          <Minus size={17} />
        </button>
        <motion.span key={value} initial={{ y: -5, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="font-display wd-wide tnum flex-1 text-center text-[1.15rem] font-bold" aria-live="polite">
          {value}
          {unit && <span className="mono ml-1 text-[0.8rem] font-medium text-ink-3">{unit}</span>}
        </motion.span>
        <button type="button" aria-label={`Tambah ${label}`} disabled={value >= max} onClick={() => set(Math.min(max, value + step))} className="btn btn--white btn--icon !h-10 !min-h-10 !w-10">
          <Plus size={17} />
        </button>
      </div>
    </div>
  )
}

export function QuestEditor() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const me = useMe()
  const group = useMyGroup()
  const posts = useStore((s) => s.posts)
  const users = useStore((s) => s.users)
  const createQuest = useStore((s) => s.createQuest)
  const acceptReport = useStore((s) => s.acceptReport)
  const from = posts.find((p) => p.id === params.get('dari') && p.status === 'menunggu')

  const start0 = useMemo(() => (from?.lat !== undefined ? { lat: from.lat, lng: from.lng! } : group?.territory.length ? ringCenter(group.territory) : DEFAULT_HOME), []) // eslint-disable-line react-hooks/exhaustive-deps
  const cat0: Category = from?.category ?? 'sampah'
  const [cat, setCat] = useState<Category>(cat0)
  const [title, setTitle] = useState(from?.kind === 'tolong' ? `Bantu ${users.find((u) => u.id === from.authorId)?.name ?? 'warga'}` : CATS[cat0].title)
  const [desc, setDesc] = useState(from?.text ?? CATS[cat0].desc)
  const [place, setPlace] = useState(from?.place ?? '')
  const [pin, setPin] = useState<LatLng>(start0)
  const [points, setPoints] = useState(CATS[cat0].points)
  const [slots, setSlots] = useState(from?.kind === 'tolong' ? 2 : 5)
  const [radius, setRadius] = useState(45)
  const [minMinutes, setMinMinutes] = useState(10)
  const touched = useRef(!!from)

  const base = useMemo(() => {
    const d = new Date()
    d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
    return d.getTime()
  }, [])
  const [date, setDate] = useState(toDateInput(base))
  const [start, setStart] = useState(toTimeInput(base))
  const [end, setEnd] = useState(toTimeInput(Math.min(base + 3 * 3600000, new Date(base).setHours(23, 45, 0, 0))))

  const onReady = (map: MLMap) => {
    map.on('move', () => {
      const c = map.getCenter()
      setPin({ lat: c.lat, lng: c.lng })
    })
  }

  const startAt = fromInputs(date, start)
  const endAt = fromInputs(date, end)
  const now = Date.now()
  const areaProblem = questProblem({ ...pin, radius }, group)
  const room = group ? Math.floor(distToEdge(pin, group.territory)) : 0
  const errors: string[] = []
  if (areaProblem) errors.push(areaProblem)
  if (title.trim().length < 4) errors.push('Judul minimal 4 huruf.')
  if (place.trim().length < 3) errors.push('Isi patokan tempat.')
  if (!(endAt > startAt)) errors.push('Jam selesai harus setelah jam mulai.')
  else if (endAt <= now) errors.push('Waktu misi sudah lewat.')

  if (!me || !group) return null

  const publish = () => {
    if (errors.length) return
    const input = { title: title.trim(), category: cat, desc: desc.trim(), place: place.trim(), lat: pin.lat, lng: pin.lng, radius, minMinutes, startAt, endAt, points, slots }
    const r = from ? acceptReport(from.id, me.id, input) : createQuest(input, me.id)
    if (!r.ok) return toast(r.error, 'warn')
    navigator.vibrate?.([30, 40, 70])
    toast('Misi terbit. Warga sudah bisa melihatnya di peta.')
    nav('/', { replace: true })
  }

  return (
    <Page bare>
      <TopBar back title={from ? 'Jadikan misi' : 'Misi baru'} sub={from ? 'Dari laporan warga' : `Untuk warga ${group.name}`} />
      <Section className="grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        {/* peta: geser peta, pin tetap di tengah */}
        <div className="lg:sticky lg:top-20">
          <div className="relative h-[300px] overflow-hidden rounded-[22px] lg:h-[460px]">
            <Map3D center={start0} zoom={17.2} threeD={false} territory={group.territory} circle={{ ...pin, radius, bad: !!areaProblem }} onReady={onReady} />
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-full" aria-hidden="true">
              <svg width="38" height="48" viewBox="0 0 38 48">
                <path d="M19 2C9.6 2 3 9 3 17.6 3 28.6 19 46 19 46s16-17.4 16-28.4C35 9 28.4 2 19 2z" fill={areaProblem ? '#D23A2A' : '#FF5A1F'} stroke="#fff" strokeWidth="2.5" />
                <circle cx="19" cy="17.5" r="5.5" fill="#fff" />
              </svg>
            </div>
            <p className="mono absolute left-2.5 top-2.5 z-10 rounded-lg bg-ink/75 px-2 py-1 text-[0.8rem] text-white">Geser peta untuk memindahkan titik</p>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <label className="label !mb-0" htmlFor="q-radius">
                Radius area check-in
              </label>
              <span className="font-display wd-wide tnum font-bold">{radius} m</span>
            </div>
            <input id="q-radius" type="range" min={20} max={150} step={5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="mt-2 w-full accent-[#FF5A1F]" />
            <p className={`mt-1 text-[0.8rem] ${areaProblem ? 'font-semibold text-bad' : 'text-ink-3'}`}>
              {areaProblem ?? `Jarak ke batas ${group.name}: ${room} m. Area check-in tidak boleh keluar dari wilayah RT.`}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {from?.photo && (
            <div className="flex items-center gap-3 rounded-2xl bg-white p-2.5 shadow-float">
              <img src={from.photo.img} alt="" className="h-14 w-14 rounded-xl object-cover" />
              <p className="min-w-0 text-[0.86rem] text-ink-2">
                Laporan <b className="text-ink">{users.find((u) => u.id === from.authorId)?.name}</b>: “{from.text}”
              </p>
            </div>
          )}
          <div>
            <span className="label">Jenis</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Jenis misi">
              {CAT_LIST.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={cat === c.id}
                  onClick={() => {
                    setCat(c.id)
                    if (!touched.current) {
                      setTitle(c.title)
                      setDesc(c.desc)
                      setPoints(c.points)
                    }
                  }}
                  className={`chip !py-2 ${cat === c.id ? 'is-on' : ''}`}
                >
                  <span className="grid h-5 w-5 place-items-center rounded-md" style={{ background: c.color }}>
                    <CatIcon cat={c.id} size={14} />
                  </span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="q-title">
              Judul
            </label>
            <input id="q-title" className="field" maxLength={48} value={title} onChange={(e) => ((touched.current = true), setTitle(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="q-desc">
              Yang perlu dikerjakan
            </label>
            <textarea id="q-desc" className="field" maxLength={240} value={desc} onChange={(e) => ((touched.current = true), setDesc(e.target.value))} />
          </div>
          <div>
            <label className="label" htmlFor="q-place">
              Patokan tempat
            </label>
            <input id="q-place" className="field" maxLength={48} placeholder="mis. Samping pos ronda" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
          <div>
            <span className="label">Waktu</span>
            <div className="flex flex-wrap gap-2">
              {[
                ['Hari ini', toDateInput(now)],
                ['Besok', toDateInput(now + DAY)],
                ['Lusa', toDateInput(now + 2 * DAY)],
              ].map(([l, v]) => (
                <button key={v} type="button" aria-pressed={date === v} onClick={() => setDate(v)} className="chip">
                  {l}
                </button>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <label className="sr-only" htmlFor="q-start">
                  Jam mulai
                </label>
                <input id="q-start" type="time" className="field" value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
              </div>
              <div>
                <label className="sr-only" htmlFor="q-end">
                  Jam selesai
                </label>
                <input id="q-end" type="time" className="field" value={end} onChange={(e) => e.target.value && setEnd(e.target.value)} />
              </div>
            </div>
            {endAt > startAt && <p className="mono mt-1.5 text-[0.8rem] text-ink-3">{fmtWindow(startAt, endAt, now)}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stepper label="Poin" value={points} set={(v) => ((touched.current = true), setPoints(v))} min={10} max={150} step={5} />
            <Stepper label="Kuota" value={slots} set={setSlots} min={1} max={30} step={1} />
            <Stepper label="Kerja min." value={minMinutes} set={setMinMinutes} min={5} max={60} step={5} unit="mnt" />
          </div>
          {errors.length > 0 && <Note tone="warn">{errors[0]}</Note>}
          <Button full disabled={errors.length > 0} onClick={publish}>
            <Rocket size={18} /> Terbitkan misi
          </Button>
        </div>
      </Section>
    </Page>
  )
}
