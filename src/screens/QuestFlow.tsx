import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Camera as CamIcon, Check, ChevronRight, Clock, Eye, Hourglass, LocateFixed, MapPin, RotateCcw, Send, ShieldCheck, Timer } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera } from '../components/Camera'
import { HoldButton } from '../components/HoldButton'
import { Map3D } from '../components/Map3D'
import { Avatar, CatTile } from '../components/art'
import { Bar, Button, CheckList, Empty, Note, Points, toast } from '../components/ui'
import { CATS } from '../lib/catalog'
import { fmtDist, offset } from '../lib/geo'
import { assessSubmission, validateFix, type Assessment, type EvidenceRef } from '../lib/integrity'
import { currentFix, useMyPos } from '../lib/location'
import { demoPhoto } from '../lib/photo'
import { useQuestView } from '../lib/quests'
import { personById, useIsRT, useMe, useMyGroup, useStore } from '../lib/store'
import { EARLY_MS, fmtAgo, fmtCountdown, fmtDateTime, fmtWindow, phaseLabel, useNow } from '../lib/time'
import type { Fix } from '../lib/types'

type Stage = 'checkin' | 'before' | 'work' | 'after' | 'send' | 'pending' | 'approved'

function Step({ n, title, state, children, summary }: { n: number; title: string; state: 'done' | 'active' | 'todo'; children?: ReactNode; summary?: ReactNode }) {
  return (
    <li className="relative flex gap-3.5 pb-1">
      <div className="flex flex-col items-center">
        <motion.span
          animate={state === 'active' ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          className={`mono grid h-8 w-8 flex-none place-items-center rounded-full text-[0.8rem] font-semibold ${
            state === 'done' ? 'bg-plang text-white' : state === 'active' ? 'bg-rompi text-white' : 'bg-[#E3E8E2] text-ink-3'
          }`}
        >
          {state === 'done' ? <Check size={16} strokeWidth={3} /> : n}
        </motion.span>
        <span className={`mt-1 w-[2px] flex-1 rounded-full ${state === 'done' ? 'bg-plang' : 'bg-[#E3E8E2]'}`} />
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <h3 className={`pt-1 text-[1.08rem] ${state === 'todo' ? 'text-ink-3' : ''}`}>{title}</h3>
        {state === 'done' && summary && <div className="mt-0.5 text-[0.82rem] text-ink-2">{summary}</div>}
        <AnimatePresence initial={false}>
          {state === 'active' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 34 }}
              className="overflow-hidden"
            >
              <div className="pt-2.5">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  )
}

export function QuestFlow() {
  const { id } = useParams()
  const nav = useNavigate()
  const now = useNow(1000)
  const view = useQuestView(id, now)
  const me = useMe()
  const rt = useIsRT()
  const group = useMyGroup()
  const users = useStore((s) => s.users)
  const subs = useStore((s) => s.subs)
  const posts = useStore((s) => s.posts)
  const testMode = useStore((s) => s.testMode)
  const checkIn = useStore((s) => s.checkIn)
  const setEvidence = useStore((s) => s.setEvidence)
  const submit = useStore((s) => s.submit)
  const setSimPos = useStore((s) => s.setSimPos)
  const { pos, jumpAt } = useMyPos()

  const [cam, setCam] = useState<'before' | 'after' | null>(null)
  const [holdKey, setHoldKey] = useState(0)
  const [checking, setChecking] = useState(false)
  const [skipWait, setSkipWait] = useState(false)
  const [note, setNote] = useState('')
  const [assess, setAssess] = useState<Assessment | null>(null)
  const [sending, setSending] = useState(false)
  const [hadir, setHadir] = useState(false)
  const t = useRef<number | null>(null)
  useEffect(() => () => void (t.current && clearTimeout(t.current)), [])

  const sub = view?.mySub && view.mySub.status !== 'rejected' ? view.mySub : undefined
  const rejected = view?.mySub?.status === 'rejected' ? view.mySub : undefined
  const q = view?.quest
  const workLeft = sub?.before && q ? q.minMinutes * 60000 - (now - sub.before.at) : 0

  const stage: Stage = useMemo(() => {
    if (!sub) return 'checkin'
    if (sub.status === 'pending') return 'pending'
    if (sub.status === 'approved') return 'approved'
    if (!sub.before) return 'before'
    if (!sub.after) return workLeft > 0 && !skipWait ? 'work' : 'after'
    return 'send'
  }, [sub, workLeft, skipWait])

  /* pemeriksaan otomatis sebelum kirim */
  useEffect(() => {
    if (stage !== 'send' || !sub || !q || !me) return
    let alive = true
    const others: EvidenceRef[] = []
    for (const s of subs) {
      if (s.id === sub.id) continue
      const who = personById(users, s.userId)?.name ?? 'warga'
      if (s.before) others.push({ ref: s.id, label: `setoran ${who}`, ev: s.before })
      if (s.after) others.push({ ref: s.id, label: `setoran ${who}`, ev: s.after })
    }
    for (const p of posts) if (p.photo) others.push({ ref: p.id, label: `laporan ${personById(users, p.authorId)?.name ?? 'warga'}`, ev: p.photo })
    void assessSubmission(sub, q, me, others).then((a) => alive && setAssess(a))
    return () => {
      alive = false
    }
  }, [stage, sub?.before?.seal, sub?.after?.seal]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!view || !q) {
    return (
      <div className="h-full">
        <Empty title="Quest tidak ditemukan" text="Mungkin sudah ditutup Ketua RT." action={<Button onClick={() => nav('/')}>Kembali ke peta</Button>} />
      </div>
    )
  }

  const cat = CATS[q.category]
  const fromPost = q.fromPostId ? posts.find((p) => p.id === q.fromPostId) : undefined
  const requester = personById(users, q.requesterId)
  const canHold = view.phase === 'live' && !view.full && view.inRange && !view.own && !rt

  const doCheckIn = async () => {
    if (!me) return
    setChecking(true)
    const fix = await currentFix()
    const r = validateFix(fix, q, jumpAt)
    if (!r.ok || !fix) {
      setChecking(false)
      toast(r.reason ?? 'Lokasi tidak valid.', 'warn')
      setHoldKey((k) => k + 1)
      return
    }
    const res = checkIn(q.id, me.id, fix, r.dist)
    setChecking(false)
    if (!res.ok) {
      toast(res.error, 'warn')
      setHoldKey((k) => k + 1)
      return
    }
    setHadir(true)
    t.current = window.setTimeout(() => setHadir(false), 1800)
  }

  const validatePhoto = (kind: 'before' | 'after') => (fix: Fix) => {
    const r = validateFix(fix, { lat: q.lat, lng: q.lng, radius: q.radius + 15 }, jumpAt)
    if (!r.ok) return r.reason ?? 'Lokasi tidak valid.'
    if (kind === 'after' && sub?.before && !skipWait && Date.now() - sub.before.at < q.minMinutes * 60000) return 'Waktu kerja minimal belum selesai.'
    return null
  }

  const doSubmit = () => {
    if (!sub || !assess || assess.block) return
    setSending(true)
    t.current = window.setTimeout(() => {
      submit(sub.id, note, assess.checks)
      setSending(false)
      navigator.vibrate?.(50)
    }, 700)
  }

  const order: Record<Stage, number> = { checkin: 0, before: 1, work: 2, after: 3, send: 4, pending: 5, approved: 5 }
  const st = (i: number): 'done' | 'active' | 'todo' => (i < order[stage] ? 'done' : i === order[stage] ? 'active' : 'todo')
  const participants = subs.filter((s) => s.questId === q.id)

  return (
    <div className="h-full lg:grid lg:grid-cols-[minmax(0,1fr)_480px]">
      {/* peta */}
      <div className="relative h-[38vh] min-h-[240px] lg:h-full">
        <Map3D
          center={q}
          zoom={17.6}
          pins={[{ id: q.id, lat: q.lat, lng: q.lng, kind: 'quest', category: q.category, label: `+${q.points}`, state: view.phase === 'live' ? 'live' : 'off' }]}
          selectedId={q.id}
          me={rt ? null : pos}
          meAvatar={me?.avatar ?? 0}
          territory={group?.territory}
          circle={{ lat: q.lat, lng: q.lng, radius: q.radius }}
          orbit
          onMapClick={(p) => testMode && !rt && setSimPos(p)}
        />
        <div className="absolute left-3 top-0 z-10 flex items-center gap-2" style={{ paddingTop: 'calc(var(--safe-t) + 10px)' }}>
          <button type="button" aria-label="Kembali" onClick={() => nav(-1)} className="btn btn--white btn--icon !h-10 !min-h-10 !w-10">
            <ArrowLeft size={19} strokeWidth={2.4} />
          </button>
          <span className="plang text-[0.82rem]">{q.code}</span>
        </div>
        <AnimatePresence>
          {(checking || hadir) && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-10 grid place-items-center bg-ink/40">
              {checking ? (
                <div className="relative grid h-32 w-32 place-items-center">
                  <span className="absolute inset-0 rounded-full border-2 border-white/60" />
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(255,90,31,.85) 70deg, transparent 72deg)', animation: 'kp-spin 0.9s linear infinite' }}
                  />
                  <LocateFixed size={30} className="relative text-white" />
                </div>
              ) : (
                <motion.div
                  initial={{ scale: 2.2, rotate: -14, opacity: 0 }}
                  animate={{ scale: 1, rotate: -6, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  className="plang !px-5 !py-3 text-[2rem]"
                >
                  HADIR ✓
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* isi */}
      <div className="scroll-y relative -mt-6 h-[calc(62vh+24px)] rounded-t-[26px] bg-white lg:mt-0 lg:h-full lg:rounded-none lg:border-l lg:border-line">
        <div className="px-5 pb-10 pt-5 lg:px-7 lg:pt-8" style={{ paddingBottom: 'calc(var(--safe-b) + 40px)' }}>
          <div className="flex items-start gap-3">
            <CatTile cat={q.category} size={50} muted={view.phase !== 'live'} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow" style={{ color: cat.color }}>
                {q.source === 'rt' ? 'Quest dari RT' : q.source === 'laporan' ? 'Dari laporan warga' : 'Permintaan tolong'}
              </p>
              <h1 className="mt-0.5 text-[1.6rem]">{q.title}</h1>
              <p className="mt-1 flex items-center gap-1 text-[0.86rem] text-ink-2">
                <MapPin size={14} className="flex-none" /> {q.place}
              </p>
            </div>
          </div>

          {/* angka utama */}
          <dl className="mt-5 grid grid-cols-4 divide-x divide-line rounded-2xl bg-paper py-3 text-center">
            {[
              ['Poin', <span className="text-rompi">+{q.points}</span>],
              ['Jarak', view.dist !== null ? fmtDist(view.dist) : '—'],
              ['Peserta', `${view.taken}/${q.slots}`],
              ['Kerja', `≥${q.minMinutes}m`],
            ].map(([k, v]) => (
              <div key={k as string} className="px-1">
                <dt className="eyebrow">{k}</dt>
                <dd className="font-display wd-wide mt-0.5 text-[1.05rem] font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 flex items-center gap-1.5 text-[0.86rem] font-medium">
            <Clock size={15} className="flex-none text-ink-3" /> {fmtWindow(q.startAt, q.endAt, now)} · <span className="text-ink-2">{phaseLabel(q, now)}</span>
          </p>
          <p className="mt-2 leading-relaxed text-ink-2">{q.desc}</p>

          {fromPost && requester && (
            <button
              type="button"
              onClick={() => nav(`/grup?ch=${fromPost.channel}&post=${fromPost.id}`)}
              className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-paper p-2.5 text-left"
            >
              {fromPost.photo && <img src={fromPost.photo.img} alt="" className="h-12 w-12 flex-none rounded-xl object-cover" />}
              <span className="min-w-0 flex-1">
                <span className="block text-[0.8rem] text-ink-2">
                  {fromPost.kind === 'tolong' ? 'Diminta oleh' : 'Dilaporkan oleh'} <b className="text-ink">{requester.name}</b> · {fmtAgo(fromPost.at, now)}
                </span>
                <span className="block truncate text-[0.88rem] font-medium">“{fromPost.text}”</span>
              </span>
              <span className="mono flex flex-none items-center gap-1 text-[0.72rem] text-ink-2">
                <Eye size={13} /> {fromPost.witnesses?.length ?? 0}
              </span>
            </button>
          )}

          <div className="my-6 h-px bg-line" />

          {rt ? (
            <section>
              <h2 className="text-[1.2rem]">Peserta</h2>
              <Note tone="info" className="mt-2">
                Ketua RT tidak ikut mengerjakan quest supaya pemeriksaan tetap adil.
              </Note>
              <ul className="mt-3 flex flex-col gap-1">
                {participants.length === 0 && <li className="py-3 text-ink-2">Belum ada yang check-in.</li>}
                {participants.map((s) => {
                  const who = personById(users, s.userId)
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={s.status !== 'pending'}
                        onClick={() => nav(`/rt/cek/${s.id}`)}
                        className="flex w-full items-center gap-3 rounded-xl p-2 text-left enabled:hover:bg-paper"
                      >
                        <Avatar index={who?.avatar ?? 0} size={36} />
                        <span className="min-w-0 flex-1 font-semibold">{who?.name}</span>
                        <span className="chip !text-[0.74rem]">
                          {s.status === 'pending' ? 'Perlu dicek' : s.status === 'approved' ? 'Disetujui' : s.status === 'rejected' ? 'Ditolak' : 'Sedang kerja'}
                        </span>
                        {s.status === 'pending' && <ChevronRight size={16} />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : view.own ? (
            <Note tone="warn">
              Ini {q.source === 'tolong' ? 'permintaan tolongmu' : 'laporanmu'} sendiri, jadi warga lain yang mengerjakan. Kamu sudah dapat poin pelapor saat RT menerimanya.
            </Note>
          ) : (
            <section>
              {rejected && stage === 'checkin' && (
                <Note tone="warn" className="mb-4">
                  Setoranmu ditolak: “{rejected.rejectReason}”. Check-in lagi dan ambil foto baru.
                </Note>
              )}
              <ol>
                <Step n={1} title="Datang & check-in" state={st(0)} summary={sub && `${fmtDateTime(sub.checkin.at, now)} · ${fmtDist(sub.checkin.dist)} dari titik`}>
                  {view.phase === 'upcoming' ? (
                    <p className="text-ink-2">
                      Check-in dibuka <b className="text-ink">{fmtDateTime(q.startAt - EARLY_MS, now)}</b>.
                    </p>
                  ) : view.phase === 'ended' ? (
                    <p className="text-ink-2">Quest ini sudah selesai.</p>
                  ) : view.full ? (
                    <p className="text-ink-2">Kuota peserta sudah penuh.</p>
                  ) : (
                    <>
                      <div className={`mb-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 ${view.inRange ? 'bg-[#E1EEE6]' : 'bg-paper'}`} aria-live="polite">
                        <LocateFixed size={18} className={view.inRange ? 'text-ok' : 'text-ink-3'} />
                        <span className="text-[0.88rem] font-medium">
                          {view.dist === null
                            ? 'Mencari posisimu…'
                            : view.inRange
                              ? `Kamu di dalam area (${fmtDist(view.dist)} dari titik)`
                              : `${fmtDist(view.dist - q.radius)} lagi ke area check-in`}
                        </span>
                      </div>
                      <HoldButton key={holdKey} disabled={!canHold || checking} onComplete={doCheckIn} doneLabel="Memeriksa lokasi…">
                        <LocateFixed size={19} /> Tahan untuk check-in
                      </HoldButton>
                      {testMode && !view.inRange && (
                        <Note className="mt-3">
                          Mode uji: ketuk peta di atas, atau{' '}
                          <button type="button" className="font-semibold underline" onClick={() => setSimPos(offset(q, 8, -6))}>
                            pindah ke lokasi quest
                          </button>
                          .
                        </Note>
                      )}
                    </>
                  )}
                </Step>

                <Step n={2} title="Foto sebelum mulai" state={st(1)} summary={sub?.before && `Difoto ${fmtDateTime(sub.before.at, now)}`}>
                  <p className="mb-3 text-[0.9rem] text-ink-2">Foto kondisi lokasi sebelum dikerjakan. Hanya bisa dari kamera aplikasi.</p>
                  <Button onClick={() => setCam('before')}>
                    <CamIcon size={18} /> Buka kamera
                  </Button>
                </Step>

                <Step n={3} title="Kerjakan" state={st(2)} summary={sub?.before && `Minimal ${q.minMinutes} menit kerja`}>
                  <div className="rounded-2xl bg-ink p-4 text-white">
                    <p className="mono flex items-center gap-1.5 text-[0.66rem] uppercase tracking-widest text-rompi">
                      <Timer size={13} /> Foto sesudah terbuka dalam
                    </p>
                    <p className="font-display wd-wide mt-1 text-[2.6rem] font-extrabold leading-none tnum">{fmtCountdown(workLeft)}</p>
                    <div className="mt-3">
                      <Bar value={sub?.before ? 1 - workLeft / (q.minMinutes * 60000) : 0} height={6} />
                    </div>
                    <p className="mt-2.5 text-[0.82rem] text-white/70">Waktu minimal ini mencegah setoran asal-asalan. Selesaikan pekerjaannya dengan tenang.</p>
                  </div>
                  {testMode && (
                    <Note className="mt-3">
                      Mode uji:{' '}
                      <button type="button" className="font-semibold underline" onClick={() => setSkipWait(true)}>
                        lewati waktu tunggu
                      </button>{' '}
                      (akan ditandai untuk Ketua RT).
                    </Note>
                  )}
                </Step>

                <Step n={4} title="Foto sesudah" state={st(3)} summary={sub?.after && `Difoto ${fmtDateTime(sub.after.at, now)}`}>
                  <p className="mb-3 text-[0.9rem] text-ink-2">Ambil dari sudut yang sama. Foto sebelum tampil samar sebagai panduan.</p>
                  <Button onClick={() => setCam('after')}>
                    <CamIcon size={18} /> Buka kamera
                  </Button>
                </Step>

                <Step n={5} title="Pemeriksaan & kirim" state={st(4)}>
                  {sub?.before && sub.after && (
                    <div className="grid grid-cols-2 gap-2">
                      {[sub.before, sub.after].map((e, i) => (
                        <figure key={i} className="relative overflow-hidden rounded-xl">
                          <img src={e.img} alt={i ? 'Sesudah' : 'Sebelum'} className="aspect-[4/3] w-full object-cover" />
                          <figcaption className="mono absolute left-1.5 top-1.5 rounded bg-ink/75 px-1.5 text-[0.6rem] text-white">{i ? 'SESUDAH' : 'SEBELUM'}</figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 rounded-2xl bg-paper p-3.5">
                    <p className="flex items-center gap-1.5 text-[0.86rem] font-semibold">
                      <ShieldCheck size={16} className="text-plang" /> Pemeriksaan otomatis
                    </p>
                    <div className="mt-3">{assess ? <CheckList checks={assess.checks} compact /> : <p className="text-[0.84rem] text-ink-2">Memeriksa…</p>}</div>
                  </div>
                  {assess?.block ? (
                    <>
                      <Note tone="warn" className="mt-3">
                        {assess.block}
                      </Note>
                      <Button tone="soft" className="mt-3" onClick={() => setCam('after')}>
                        <RotateCcw size={17} /> Foto ulang
                      </Button>
                    </>
                  ) : (
                    <>
                      <label className="label mt-4" htmlFor="q-note">
                        Catatan untuk Ketua RT <span className="font-normal text-ink-3">(boleh kosong)</span>
                      </label>
                      <textarea id="q-note" className="field" maxLength={140} placeholder="mis. Dapat dua karung sampah plastik" value={note} onChange={(e) => setNote(e.target.value)} />
                      <Button full className="mt-3" disabled={!assess || sending} onClick={doSubmit}>
                        <Send size={17} /> {sending ? 'Mengirim…' : 'Kirim ke Ketua RT'}
                      </Button>
                    </>
                  )}
                </Step>
              </ol>

              {stage === 'pending' && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-paper p-4">
                  <p className="flex items-center gap-2 font-display text-[1.15rem] font-bold">
                    <Hourglass size={18} className="text-rompi" /> Menunggu diperiksa Ketua RT
                  </p>
                  <p className="mt-1 text-[0.88rem] text-ink-2">
                    <Points value={q.points} plus /> masuk setelah disetujui. Hasil pemeriksaan otomatis ikut terkirim.
                  </p>
                  {sub?.checks && (
                    <div className="mt-3">
                      <CheckList checks={sub.checks} compact />
                    </div>
                  )}
                </motion.div>
              )}
              {stage === 'approved' && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl bg-plang p-4 text-white">
                  <p className="font-display wd-wide text-[2rem] font-extrabold leading-none">+{sub?.awarded ?? q.points}</p>
                  <p className="mt-1 font-semibold">Disetujui {sub?.reviewedAt ? fmtDateTime(sub.reviewedAt, now) : ''}. Terima kasih sudah turun!</p>
                  <Button tone="white" small className="mt-3" onClick={() => nav('/peringkat')}>
                    Lihat klasemen
                  </Button>
                </motion.div>
              )}
            </section>
          )}
        </div>
      </div>

      {me && sub && (
        <Camera
          open={cam !== null}
          onClose={() => setCam(null)}
          onCapture={(ev) => {
            if (cam) setEvidence(sub.id, cam, ev)
            if (cam === 'after') setAssess(null)
          }}
          title={q.title}
          tag={cam === 'after' ? 'SESUDAH' : 'SEBELUM'}
          userId={me.id}
          refId={q.id}
          caption={`${group?.name ?? ''} · ${q.code}`}
          ghost={cam === 'after' ? sub.before?.img : undefined}
          validate={validatePhoto(cam ?? 'before')}
          sample={testMode ? () => demoPhoto(cam === 'after' ? 'after' : 'before', q.category, Math.floor(Math.random() * 7)) : undefined}
        />
      )}
    </div>
  )
}
