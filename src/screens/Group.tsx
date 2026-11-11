import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, BellRing, Check, Eye, Lock, MapPin, Megaphone, Users } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Avatar, CatTile } from '../components/art'
import { Button, Empty, Page, Points, Section, Segmented, Sheet, TopBar, toast } from '../components/ui'
import { CATS } from '../lib/catalog'
import { personById, takenSlots, useIsRT, useMe, useStore } from '../lib/store'
import { fmtAgo, phaseLabel, questPhase, useNow } from '../lib/time'
import type { Group as GroupT, Person, Post, Misi } from '../lib/types'

/* Pos Ronda — papan kasus RT. Bukan ruang obrolan: warga merespons dengan aksi
   (jadi saksi, gabung regu, sanggup bawa alat), dan hanya pengurus yang memukul kentongan. */

const TOOLS: { key: string; label: string }[] = [
  { key: 'karung', label: 'Karung' },
  { key: 'sapu', label: 'Sapu' },
  { key: 'cangkul', label: 'Cangkul' },
  { key: 'sarung', label: 'Sarung tangan' },
]

const CALLS = [
  { label: 'Kerja bakti', text: 'Kerja bakti hari ini jam 16.00. Kumpul di pos ronda ya.' },
  { label: 'Butuh regu', text: 'Masih butuh tenaga untuk misi hari ini. Yang senggang, gabung regu.' },
  { label: 'Info', text: '' },
]

/** jalur status sebuah kasus */
function Track({ steps, at }: { steps: string[]; at: number }) {
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => (
        <li key={s} className="flex min-w-0 flex-1 flex-col items-center">
          <div className="flex w-full items-center">
            <span className={`h-[2px] flex-1 ${i === 0 ? 'opacity-0' : i <= at ? 'bg-plang' : 'bg-surface'}`} />
            <motion.span
              initial={false}
              animate={i === at ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ repeat: i === at ? Infinity : 0, duration: 1.8 }}
              className={`grid h-4 w-4 flex-none place-items-center rounded-full ${i < at ? 'bg-plang' : i === at ? 'bg-rompi' : 'bg-surface'}`}
            >
              {i < at && <Check size={10} strokeWidth={4} color="var(--color-card)" />}
            </motion.span>
            <span className={`h-[2px] flex-1 ${i === steps.length - 1 ? 'opacity-0' : i < at ? 'bg-plang' : 'bg-surface'}`} />
          </div>
          <span className={`mono mt-1 px-0.5 text-center text-[0.8rem] leading-tight ${i === at ? 'font-semibold text-ink' : 'text-ink-3'}`}>{s}</span>
        </li>
      ))}
    </ol>
  )
}

function Faces({ people, max = 5 }: { people: Person[]; max?: number }) {
  return (
    <div className="flex -space-x-2">
      {people.slice(0, max).map((p) => (
        <Avatar key={p.id} index={p.avatar} size={26} className="ring-2 ring-white" />
      ))}
      {people.length > max && <span className="mono grid h-[26px] min-w-[26px] place-items-center rounded-full bg-paper px-1 text-[0.6rem] ring-2 ring-white">+{people.length - max}</span>}
    </div>
  )
}

export function Group() {
  const nav = useNavigate()
  const now = useNow(30000)
  const [params, setParams] = useSearchParams()
  const me = useMe()
  const rt = useIsRT()
  const groups = useStore((s) => s.groups)
  const posts = useStore((s) => s.posts)
  const quests = useStore((s) => s.quests)
  const subs = useStore((s) => s.subs)
  const users = useStore((s) => s.users)
  const toggleReaction = useStore((s) => s.toggleReaction)
  const toggleWitness = useStore((s) => s.toggleWitness)
  const broadcast = useStore((s) => s.broadcast)

  const [groupId, setGroupId] = useState('rt04')
  const [lane, setLane] = useState<'regu' | 'laporan' | 'kabar'>(() => (params.get('post') ? 'laporan' : 'regu'))
  const [focusPost, setFocusPost] = useState<string | null>(() => params.get('post'))
  const [calling, setCalling] = useState(false)
  const [callText, setCallText] = useState(CALLS[0].text)
  const [members, setMembers] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (params.toString()) setParams({}, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const group = groups.find((g) => g.id === groupId)
  const mine = posts.filter((p) => p.groupId === groupId)
  const calls = mine.filter((p) => p.kind === 'umum').sort((a, b) => b.at - a.at)
  const call = calls[0]
  const questPosts = useMemo(
    () =>
      mine
        .filter((p) => p.kind === 'misi' && p.questId)
        .map((p) => ({ p, q: quests.find((q) => q.id === p.questId) }))
        .filter((x): x is { p: Post; q: Misi } => !!x.q && questPhase(x.q, now) !== 'ended')
        .sort((a, b) => a.q.startAt - b.q.startAt),
    [mine, quests, now],
  )
  const reports = mine.filter((p) => p.kind === 'laporan' || p.kind === 'tolong').sort((a, b) => Number(a.status !== 'menunggu') - Number(b.status !== 'menunggu') || b.at - a.at)
  const news = mine.filter((p) => p.kind === 'sistem').sort((a, b) => b.at - a.at)
  const waiting = reports.filter((p) => p.status === 'menunggu').length
  const memberList = group?.kind === 'rw' ? users.filter((u) => u.role === 'rt') : users.filter((u) => u.groupId === groupId)

  useEffect(() => {
    if (!focusPost) return
    const el = boardRef.current?.querySelector<HTMLElement>(`[data-post="${focusPost}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const t = setTimeout(() => setFocusPost(null), 2600)
    return () => clearTimeout(t)
  }, [focusPost, lane])

  const pickGroup = (g: GroupT) => {
    if (!g.member) {
      toast(`Pos ${g.name} hanya untuk warga ${g.name}.`, 'warn')
      return
    }
    setGroupId(g.id)
  }
  const who = (ids: string[] | undefined) => (ids ?? []).map((id) => personById(users, id)).filter(Boolean) as Person[]

  return (
    <Page>
      <TopBar
        title="Pos Ronda"
        sub={group?.kind === 'rw' ? `Antar-RT se-${group.name}` : `${group?.name} / ${memberList.length} warga`}
        right={
          <button type="button" onClick={() => setMembers(true)} className="btn btn--white btn--icon !h-10 !min-h-10 !w-10" aria-label="Lihat warga">
            <Users size={18} />
          </button>
        }
      />
      <Section className="flex flex-col gap-4">
        {/* pilih pos */}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {groups.map((g) => (
            <button key={g.id} type="button" onClick={() => pickGroup(g)} className={`chip flex-none ${g.id === groupId ? 'is-on' : ''} ${g.member ? '' : 'opacity-55'}`}>
              {!g.member && <Lock size={12} />}
              {g.kind === 'rw' ? `${g.name} / antar-RT` : g.name}
            </button>
          ))}
        </div>

        {/* kentongan */}
        <div className="relative overflow-hidden rounded-[22px] bg-ink p-4 text-white">
          <div className="pointer-events-none absolute right-6 top-6" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} className="absolute left-0 top-0 h-20 w-20 rounded-full border border-rompi/60" style={{ animation: 'kp-pulse 3s ease-out infinite', animationDelay: `${i}s` }} />
            ))}
          </div>
          <p className="mono flex items-center gap-1.5 text-[0.8rem] text-inverse">
            <BellRing size={13} /> Kentongan {group?.name}
          </p>
          {call ? (
            <>
              <p className="mt-2 max-w-[52ch] text-[1.02rem] font-medium leading-snug">{call.text}</p>
              <p className="mt-1 text-[0.86rem] text-white/60">
                {personById(users, call.authorId)?.name} / {fmtAgo(call.at, now)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {me && !rt && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.93 }}
                    onClick={() => toggleReaction(call.id, 'siap', me.id)}
                    className={`btn btn--sm ${call.reactions?.siap?.includes(me.id) ? 'btn--plang' : 'btn--primary'}`}
                  >
                    <Check size={15} strokeWidth={3} /> {call.reactions?.siap?.includes(me.id) ? 'Kamu siap' : 'Siap'}
                  </motion.button>
                )}
                <Faces people={who(call.reactions?.siap)} />
                <span className="text-[0.8rem] text-white/70">{call.reactions?.siap?.length ?? 0} warga siap</span>
              </div>
            </>
          ) : (
            <p className="mt-2 text-white/70">Belum ada panggilan dari pengurus.</p>
          )}
          {rt && group?.leaderId === me?.id && (
            <Button small className="mt-3" onClick={() => setCalling(true)}>
              <Megaphone size={15} /> Pukul kentongan
            </Button>
          )}
        </div>

        {group?.kind === 'rt' && (
          <>
            <Segmented
              id="lane"
              value={lane}
              onChange={setLane}
              className="w-full max-w-[460px]"
              options={[
                { value: 'regu', label: `Butuh regu / ${questPosts.length}` },
                { value: 'laporan', label: `Laporan${waiting ? ` / ${waiting}` : ''}` },
                { value: 'kabar', label: 'Kabar' },
              ]}
            />

            <div ref={boardRef} className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {lane === 'regu' &&
                (questPosts.length === 0 ? (
                  <Empty title="Belum ada misi" text="Misi dari Ketua RT muncul di sini." />
                ) : (
                  questPosts.map(({ p, q }, i) => {
                    const regu = who(p.reactions?.ikut)
                    const joined = !!me && !!p.reactions?.ikut?.includes(me.id)
                    const own = q.requesterId === me?.id
                    const done = takenSlots(subs, q.id)
                    return (
                      <motion.article key={p.id} data-post={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="panel p-4">
                        <div className="flex items-start gap-3">
                          <CatTile cat={q.category} size={44} muted={questPhase(q, now) !== 'live'} />
                          <div className="min-w-0 flex-1">
                            <h3 className="text-[1.12rem]">{q.title}</h3>
                            <p className="mt-0.5 truncate text-[0.8rem] text-ink-2">
                              {phaseLabel(q, now)} / {q.place}
                            </p>
                          </div>
                          <Points value={q.points} plus />
                        </div>

                        <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                          <Faces people={regu} />
                          <span className="min-w-[120px] flex-1 text-[0.86rem] text-ink-2">
                            {regu.length ? `${regu.length} sanggup datang` : 'Belum ada regu'} / {done}/{q.slots} sudah check-in
                          </span>
                          {me && !rt && !own && (
                            <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => toggleReaction(p.id, 'ikut', me.id)} className={`btn btn--sm ${joined ? 'btn--plang' : 'btn--soft'}`}>
                              {joined ? <Check size={14} strokeWidth={3} /> : <Users size={14} />} {joined ? 'Ikut regu' : 'Gabung regu'}
                            </motion.button>
                          )}
                        </div>

                        <div className="mt-3 border-t border-line pt-3">
                          <p className="meta-label mb-2">Siapa bawa apa</p>
                          <div className="flex flex-wrap gap-1.5">
                            {TOOLS.map((t) => {
                              const ids = p.reactions?.[t.key] ?? []
                              const on = !!me && ids.includes(me.id)
                              return (
                                <button
                                  key={t.key}
                                  type="button"
                                  disabled={!me || rt || own}
                                  aria-pressed={on}
                                  onClick={() => me && toggleReaction(p.id, t.key, me.id)}
                                  className={`chip !text-[0.86rem] ${ids.length && !on ? '!bg-surface !text-plang-2 !shadow-none' : ''}`}
                                >
                                  {ids.length > 0 && <Check size={12} strokeWidth={3} />}
                                  {t.label}
                                  {ids.length > 0 && <span className="opacity-70">· {who(ids).map((x) => (x.id === me?.id ? 'kamu' : x.name)).join(', ')}</span>}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <Button tone="dark" small full className="mt-3.5" onClick={() => nav(`/misi/${q.id}`)}>
                          {rt ? 'Lihat peserta' : own ? 'Dari laporanmu / lihat' : 'Buka misi'} <ArrowRight size={15} />
                        </Button>
                      </motion.article>
                    )
                  })
                ))}

              {lane === 'laporan' &&
                (reports.length === 0 ? (
                  <Empty title="Belum ada laporan" text="Lihat sampah menumpuk atau fasilitas rusak? Tekan tombol Lapor." />
                ) : (
                  reports.map((p, i) => {
                    const a = personById(users, p.authorId)
                    const mineP = p.authorId === me?.id
                    const seen = !!me && !!p.witnesses?.includes(me.id)
                    const at = p.status === 'menunggu' ? 1 : p.status === 'jadi_quest' ? 2 : p.status === 'beres' ? 3 : 1
                    return (
                      <motion.article
                        key={p.id}
                        data-post={p.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0, boxShadow: focusPost === p.id ? '0 0 0 3px var(--color-ink-3)' : '0 0 0 0px var(--color-ink-3)' }}
                        transition={{ delay: i * 0.05 }}
                        className="panel overflow-hidden"
                      >
                        <div className="flex gap-3 p-4 pb-3">
                          {p.photo && <img src={p.photo.img} alt="Foto laporan" className="h-[84px] w-[84px] flex-none rounded-2xl object-cover" />}
                          <div className="min-w-0 flex-1">
                            <p className="meta-label" style={{ color: p.kind === 'tolong' ? 'var(--color-ink-3)' : 'var(--color-ink-3)' }}>
                              {p.kind === 'tolong' ? 'Minta tolong' : `Laporan ${CATS[p.category ?? 'sampah'].label.toLowerCase()}`}
                            </p>
                            <p className="mt-0.5 line-clamp-3 font-medium leading-snug">{p.text}</p>
                            <p className="mt-1 flex items-center gap-1 truncate text-[0.86rem] text-ink-3">
                              {mineP ? 'Kamu' : a?.name} / {fmtAgo(p.at, now)}
                              {p.place && (
                                <>
                                  {' / '}
                                  <MapPin size={11} className="flex-none" /> <span className="truncate">{p.place}</span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="px-3">
                          {p.status === 'ditolak' ? (
                            <p className="rounded-xl bg-surface px-3 py-2 text-[0.86rem] font-medium text-bad">Ditolak RT: {p.statusNote}</p>
                          ) : (
                            <Track steps={['Dilaporkan', 'Dicek RT', 'Jadi misi', 'Beres']} at={at} />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 p-4 pt-3">
                          <Faces people={who(p.witnesses)} max={4} />
                          <span className="min-w-0 flex-1 text-[0.8rem] text-ink-2">{p.witnesses?.length ? `${p.witnesses.length} saksi` : 'Belum ada saksi'}</span>
                          {p.status === 'menunggu' && me && !rt && !mineP && (
                            <motion.button type="button" whileTap={{ scale: 0.92 }} onClick={() => toggleWitness(p.id, me.id)} className={`btn btn--sm ${seen ? 'btn--plang' : 'btn--soft'}`}>
                              <Eye size={14} /> {seen ? 'Kamu saksi' : 'Saya juga lihat'}
                            </motion.button>
                          )}
                          {p.status === 'menunggu' && rt && (
                            <Button small onClick={() => nav(`/rt/laporan/${p.id}`)}>
                              Tinjau
                            </Button>
                          )}
                          {p.status === 'menunggu' && (
                            <Button small tone="ghost" onClick={() => nav(`/?pilih=p:${p.id}`)}>
                              <MapPin size={14} /> Peta
                            </Button>
                          )}
                          {(p.status === 'jadi_quest' || p.status === 'beres') && p.questId && (
                            <Button small tone="dark" onClick={() => nav(`/misi/${p.questId}`)}>
                              {mineP ? 'Lihat misi' : p.status === 'beres' ? 'Lihat hasil' : 'Ambil misi'} <ArrowRight size={14} />
                            </Button>
                          )}
                        </div>
                      </motion.article>
                    )
                  })
                ))}

              {lane === 'kabar' && (
                <ol className="panel divide-y divide-line lg:col-span-2">
                  {news.length === 0 && <li className="p-4 text-ink-2">Belum ada kabar.</li>}
                  {news.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-3.5">
                      <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-surface">
                        <Check size={14} strokeWidth={3} className="text-ok" />
                      </span>
                      <span className="min-w-0 flex-1 text-[0.9rem]">{p.text}</span>
                      <span className="mono flex-none text-[0.8rem] text-ink-3">{fmtAgo(p.at, now)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}

        {group?.kind === 'rw' && calls.length > 1 && (
          <ol className="panel divide-y divide-line">
            {calls.slice(1).map((c) => (
              <li key={c.id} className="p-3.5">
                <p className="text-[0.92rem]">{c.text}</p>
                <p className="mt-0.5 text-[0.8rem] text-ink-3">
                  {personById(users, c.authorId)?.name} / {fmtAgo(c.at, now)}
                </p>
              </li>
            ))}
          </ol>
        )}
        {group?.kind === 'rw' && (
          <Button tone="dark" onClick={() => nav('/peringkat')} className="self-start">
            Lihat klasemen antar-RT <ArrowRight size={16} />
          </Button>
        )}
      </Section>

      <Sheet open={calling} onClose={() => setCalling(false)} title="Pukul kentongan">
        <p className="mb-3 text-ink-2">Panggilan ini muncul paling atas di Pos Ronda semua warga {group?.name}.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          {CALLS.map((c) => (
            <button key={c.label} type="button" className="chip" onClick={() => setCallText(c.text)}>
              {c.label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="call-text">
          Isi panggilan
        </label>
        <textarea id="call-text" className="field" maxLength={240} value={callText} onChange={(e) => setCallText(e.target.value)} placeholder="Tulis panggilan untuk warga" />
        <Button
          full
          className="mt-3"
          onClick={async () => {
            if (!me) return
            const r = await broadcast(groupId, me.id, callText)
            if (!r.ok) return toast(r.error, 'warn')
            setCalling(false)
            navigator.vibrate?.([60, 80, 60, 80, 120])
            toast('Tok tok tok! Kentongan dipukul.')
          }}
        >
          <BellRing size={17} /> Pukul sekarang
        </Button>
      </Sheet>

      <Sheet open={members} onClose={() => setMembers(false)} title={`Warga ${group?.name ?? ''}`}>
        <ul className="flex flex-col">
          {memberList.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Avatar index={p.avatar} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.id === me?.id ? `${p.name} (kamu)` : p.name}</span>
                <span className="block text-[0.8rem] text-ink-3">{p.title ?? `${new Date().getFullYear() - p.birthYear} tahun`}</span>
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </Page>
  )
}
