import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Box, Eye, LocateFixed, MapPinned, MousePointerClick, Navigation, Square, Users } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Map3D, type MapPin, type Neighbor } from '../components/Map3D'
import { Avatar, CatTile, Coin } from '../components/art'
import { Button, CountUp, Points, Segmented, toast, useIsWide } from '../components/ui'
import { CATS } from '../lib/catalog'
import { DEFAULT_HOME, distM, fmtDist, ringCenter } from '../lib/geo'
import { useMyPos } from '../lib/location'
import { useOpenReports, useQuestViews, type QuestView } from '../lib/quests'
import { activeSubOf, personById, useIsRT, useMe, useMyGroup, usePoints, useStore } from '../lib/store'
import { fmtAgo, fmtWindow, phaseLabel, useNow } from '../lib/time'
import type { Post } from '../lib/types'

/* kamera & animasi pembuka diingat selama aplikasi terbuka */
let introDone = false
let tilt = true

type Item = { key: string; type: 'quest'; view: QuestView } | { key: string; type: 'post'; post: Post; dist: number | null }

export function MapHome() {
  const nav = useNavigate()
  const wide = useIsWide()
  const now = useNow(20000)
  const me = useMe()
  const rt = useIsRT()
  const group = useMyGroup()
  const groups = useStore((s) => s.groups)
  const users = useStore((s) => s.users)
  const subs = useStore((s) => s.subs)
  const quests = useStore((s) => s.quests)
  const home = useStore((s) => s.home) ?? DEFAULT_HOME
  const testMode = useStore((s) => s.testMode)
  const setSimPos = useStore((s) => s.setSimPos)
  const toggleWitness = useStore((s) => s.toggleWitness)
  const { pos, status, retry } = useMyPos()
  const points = usePoints(me?.id)
  const views = useQuestViews(now)
  const reports = useOpenReports()

  const [tab, setTab] = useState<'quest' | 'laporan'>('quest')
  const [threeD, setThreeD] = useState(tilt)
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const fk = useRef(0)
  const [intro] = useState(() => !introDone)
  useEffect(() => {
    introDone = true
  }, [])
  useEffect(() => {
    tilt = threeD
  }, [threeD])

  const items: Item[] = useMemo(() => {
    const q: Item[] = views.map((v) => ({ key: `q:${v.quest.id}`, type: 'quest', view: v }))
    const r: Item[] = reports
      .map((p) => ({ key: `p:${p.id}`, type: 'post' as const, post: p, dist: pos && p.lat !== undefined ? distM(pos, { lat: p.lat, lng: p.lng! }) : null }))
      .sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9))
    return tab === 'quest' ? [...q, ...r] : [...r, ...q]
  }, [views, reports, pos, tab])

  const listed = items.filter((i) => (tab === 'quest' ? i.type === 'quest' : i.type === 'post'))

  useEffect(() => {
    if (!selected || !items.some((i) => i.key === selected)) setSelected(listed[0]?.key ?? items[0]?.key ?? null)
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const pins: MapPin[] = useMemo(
    () => [
      ...views.map((v) => ({
        id: `q:${v.quest.id}`,
        lat: v.quest.lat,
        lng: v.quest.lng,
        kind: 'quest' as const,
        category: v.quest.category,
        label: v.mySub?.status === 'approved' || v.mySub?.status === 'pending' ? '✓' : `+${v.quest.points}`,
        state: v.mySub && (v.mySub.status === 'approved' || v.mySub.status === 'pending') ? ('done' as const) : v.phase === 'live' ? ('live' as const) : ('off' as const),
      })),
      ...reports.map((p) => ({
        id: `p:${p.id}`,
        lat: p.lat!,
        lng: p.lng!,
        kind: p.kind === 'tolong' ? ('tolong' as const) : ('laporan' as const),
        category: p.category ?? 'sampah',
        state: 'live' as const,
      })),
    ],
    [views, reports],
  )

  const neighbors: Neighbor[] = useMemo(
    () => groups.filter((g) => g.kind === 'rt' && g.id !== group?.id).map((g) => ({ id: g.id, name: g.name, ring: g.territory })),
    [groups, group?.id],
  )

  const fly = useCallback((lat: number, lng: number) => {
    fk.current += 1
    setFocus({ lat, lng, key: fk.current })
  }, [])

  const pick = (key: string, collapse = true) => {
    setSelected(key)
    const it = items.find((i) => i.key === key)
    if (it?.type === 'quest') fly(it.view.quest.lat, it.view.quest.lng)
    if (it?.type === 'post' && it.post.lat !== undefined) fly(it.post.lat, it.post.lng!)
    if (it) setTab(it.type === 'quest' ? 'quest' : 'laporan')
    if (collapse) setExpanded(false)
  }

  // tautan dari Pos Ronda: /?pilih=p:<id>
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const p = params.get('pilih')
    if (!p) return
    setParams({}, { replace: true })
    const t = setTimeout(() => pick(p), 400)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sel = items.find((i) => i.key === selected) ?? null
  const active = me ? activeSubOf(subs, me.id) : undefined
  const activeQuest = active && quests.find((q) => q.id === active.questId)
  const selQuest = sel?.type === 'quest' ? sel.view.quest : null
  const center = useMemo(() => (group?.territory.length ? ringCenter(group.territory) : home), [group?.territory, home])

  const onMapClick = (p: { lat: number; lng: number }) => {
    if (testMode && !rt) setSimPos(p)
  }

  /* ───── isi panel ───── */

  const focusCard = sel && (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={sel.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
        {sel.type === 'quest' ? (
          <QuestFocus v={sel.view} now={now} rt={rt} onOpen={() => nav(`/quest/${sel.view.quest.id}`)} />
        ) : (
          <ReportFocus
            post={sel.post}
            dist={sel.dist}
            now={now}
            meId={me?.id}
            rt={rt}
            author={personById(users, sel.post.authorId)?.name ?? 'Warga'}
            onWitness={() => {
              if (!me) return
              toggleWitness(sel.post.id, me.id)
            }}
            onOpen={() => nav(rt ? `/rt/laporan/${sel.post.id}` : `/grup?ch=${sel.post.channel}&post=${sel.post.id}`)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )

  const list = (
    <div className="flex flex-col">
      {listed.length === 0 && (
        <p className="px-1 py-6 text-center text-[0.9rem] text-ink-2">
          {tab === 'quest' ? 'Belum ada quest berlangsung.' : 'Tidak ada laporan yang menunggu. Lingkunganmu sedang rapi.'}
        </p>
      )}
      {listed.map((it, i) => {
        const on = it.key === selected
        return (
          <motion.button
            key={it.key}
            type="button"
            layout="position"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 8) * 0.03 }}
            onClick={() => pick(it.key)}
            className={`flex items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors ${on ? 'bg-paper' : 'hover:bg-paper/60'}`}
          >
            {it.type === 'quest' ? (
              <>
                <CatTile cat={it.view.quest.category} size={40} muted={it.view.phase !== 'live'} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold leading-tight">{it.view.quest.title}</span>
                  <span className="block truncate text-[0.78rem] text-ink-2">
                    {phaseLabel(it.view.quest, now)}
                    {it.view.dist !== null && ` · ${fmtDist(it.view.dist)}`} · {it.view.taken}/{it.view.quest.slots} orang
                  </span>
                </span>
                <Points value={it.view.quest.points} plus />
              </>
            ) : (
              <>
                <span className="relative flex-none">
                  {it.post.photo ? (
                    <img src={it.post.photo.img} alt="" className="h-10 w-10 rounded-[12px] object-cover" />
                  ) : (
                    <CatTile cat={it.post.category ?? 'sampah'} size={40} />
                  )}
                  <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-white ${it.post.kind === 'tolong' ? 'bg-[#C6466E]' : 'bg-rompi'}`} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold leading-tight">{it.post.text}</span>
                  <span className="block truncate text-[0.78rem] text-ink-2">
                    {it.post.kind === 'tolong' ? 'Minta tolong' : 'Laporan'} · {personById(users, it.post.authorId)?.name} · {fmtAgo(it.post.at, now)}
                  </span>
                </span>
                <span className="mono flex flex-none items-center gap-1 text-[0.74rem] text-ink-2">
                  <Eye size={13} /> {it.post.witnesses?.length ?? 0}
                </span>
              </>
            )}
          </motion.button>
        )
      })}
    </div>
  )

  const tabs = (
    <Segmented
      id="maptab"
      value={tab}
      onChange={(v) => {
        setTab(v)
        const first = items.find((i) => (v === 'quest' ? i.type === 'quest' : i.type === 'post'))
        if (first) pick(first.key, false)
      }}
      options={[
        { value: 'quest', label: `Quest · ${views.length}` },
        { value: 'laporan', label: `Laporan · ${reports.length}` },
      ]}
      className="w-full"
    />
  )

  /* ───── tinggi lembar bawah (ponsel) ───── */
  const [vh, setVh] = useState(() => window.innerHeight)
  useEffect(() => {
    const on = () => setVh(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const sheetH = Math.round(vh * 0.72)
  const peek = 232
  const collapsedY = Math.max(0, sheetH - peek)

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#E6E9E2]">
      <Map3D
        center={center}
        zoom={16.4}
        pins={pins}
        selectedId={selected}
        onSelect={(id) => pick(id)}
        me={rt ? null : pos}
        meAvatar={me?.avatar ?? 0}
        territory={group?.territory}
        neighbors={neighbors}
        circle={selQuest ? { lat: selQuest.lat, lng: selQuest.lng, radius: selQuest.radius } : null}
        onMapClick={onMapClick}
        threeD={threeD}
        focus={focus}
        padding={wide ? { left: 400, top: 40, bottom: 40 } : { top: 120, bottom: peek + 80 }}
        intro={intro}
      />

      {/* ───── kepala mengambang ───── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[500] px-3 lg:left-[400px] lg:px-5"
        style={{ paddingTop: 'calc(var(--safe-t) + 10px)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <button type="button" onClick={() => nav('/grup')} className="plang pointer-events-auto text-[0.92rem] lg:hidden">
            {group?.name} · {group?.rw}
            <Users size={14} strokeWidth={2.6} />
          </button>
          <span className="hidden lg:block" />
          {me && !rt && (
            <button
              type="button"
              onClick={() => nav('/aku')}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-3 shadow-float"
              aria-label="Poin dan profil"
            >
              <Avatar index={me.avatar} size={30} />
              <Coin size={15} />
              <CountUp value={points.total} className="font-display wd-wide text-[1rem] font-extrabold" />
            </button>
          )}
          {rt && <span className="plang pointer-events-auto !bg-ink text-[0.82rem]" style={{ boxShadow: 'inset 0 0 0 2px #0F1F19, inset 0 0 0 3.5px #FF5A1F' }}>MODE KETUA RT</span>}
        </div>

        <AnimatePresence>
          {activeQuest && !rt && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={() => nav(`/quest/${activeQuest.id}`)}
              className="pointer-events-auto mt-2.5 flex w-full max-w-[420px] items-center gap-2.5 overflow-hidden rounded-2xl bg-ink py-2 pl-2 pr-3 text-left text-white shadow-lift"
            >
              <span className="reflect-stripes h-9 w-2 flex-none rounded-full" style={{ animation: 'kp-sweep 2s linear infinite' }} />
              <span className="min-w-0 flex-1">
                <span className="mono block text-[0.62rem] uppercase tracking-wider text-rompi">Misi aktif</span>
                <span className="block truncate text-[0.9rem] font-semibold">{activeQuest.title}</span>
              </span>
              <ArrowRight size={18} className="flex-none" />
            </motion.button>
          )}
        </AnimatePresence>

        {testMode && !rt && (
          <div className="pointer-events-auto mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#2E2452]/90 px-3 py-1.5 text-[0.76rem] font-semibold text-white backdrop-blur-sm">
            <MousePointerClick size={14} /> Mode uji · ketuk peta untuk pindah posisi
          </div>
        )}
        {!testMode && !rt && (status === 'denied' || status === 'unavailable' || status === 'locating') && (
          <div className="pointer-events-auto mt-2.5 flex max-w-[420px] items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[0.82rem] shadow-float">
            <LocateFixed size={16} className={status === 'locating' ? 'animate-pulse text-rompi' : 'text-bad'} />
            <span className="min-w-0 flex-1 font-medium">
              {status === 'locating' ? 'Mencari sinyal GPS…' : status === 'denied' ? 'Izin lokasi ditolak. Quest butuh lokasi untuk check-in.' : 'GPS belum dapat sinyal.'}
            </span>
            {status !== 'locating' && (
              <button type="button" onClick={retry} className="font-semibold text-rompi">
                Coba lagi
              </button>
            )}
          </div>
        )}
      </div>

      {/* ───── kendali peta ───── */}
      <div
        className="absolute right-3 z-[500] flex flex-col gap-2 lg:right-5"
        style={{ top: wide ? 72 : 'calc(var(--safe-t) + 64px)' }}
      >
        <motion.button
          type="button"
          onClick={() => setThreeD((t) => !t)}
          whileTap={{ scale: 0.9 }}
          className="btn btn--white btn--icon flex-col !gap-0"
          aria-label={threeD ? 'Lihat peta 2D' : 'Lihat peta 3D'}
          aria-pressed={threeD}
        >
          {threeD ? <Box size={18} strokeWidth={2.2} /> : <Square size={17} strokeWidth={2.2} />}
          <span className="mono text-[0.56rem] font-semibold">{threeD ? '3D' : '2D'}</span>
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            if (pos && !rt) fly(pos.lat, pos.lng)
            else fly(center.lat, center.lng)
          }}
          className="btn btn--white btn--icon"
          aria-label={rt ? 'Ke tengah wilayah' : 'Ke posisiku'}
        >
          <Navigation size={18} strokeWidth={2.2} />
        </motion.button>
        {rt && (
          <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={() => nav('/rt/wilayah')} className="btn btn--white btn--icon" aria-label="Atur wilayah RT">
            <MapPinned size={18} strokeWidth={2.2} />
          </motion.button>
        )}
      </div>

      {/* ───── panel ───── */}
      {wide ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[600] flex w-[400px] p-4">
          <div className="panel pointer-events-auto flex min-h-0 w-full flex-col overflow-hidden !shadow-lift">
            <div className="border-b border-line p-4">
              <p className="eyebrow">{group?.name} · {group?.rw}</p>
              <h1 className="mt-1 text-[1.6rem]">Di sekitarmu</h1>
            </div>
            <div className="border-b border-line p-4">{focusCard ?? <p className="text-ink-2">Pilih penanda di peta.</p>}</div>
            <div className="p-3 pb-2">{tabs}</div>
            <div className="scroll-y min-h-0 flex-1 px-2 pb-3">{list}</div>
          </div>
        </div>
      ) : (
        <motion.div
          className="absolute inset-x-0 z-[600] flex flex-col rounded-t-[26px] bg-white shadow-lift"
          style={{ height: sheetH, bottom: 'calc(var(--nav-h) + var(--safe-b))' }}
          initial={{ y: sheetH }}
          animate={{ y: expanded ? 0 : collapsedY }}
          transition={{ type: 'spring', stiffness: 360, damping: 38 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: collapsedY }}
          dragElastic={0.06}
          dragMomentum={false}
          onDragEnd={(_, i) => {
            if (i.velocity.y < -300 || i.offset.y < -60) setExpanded(true)
            else if (i.velocity.y > 300 || i.offset.y > 60) setExpanded(false)
          }}
        >
          <button
            type="button"
            className="flex w-full flex-none justify-center pb-1.5 pt-2.5"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? 'Kecilkan daftar' : 'Lihat semua'}
          >
            <span className="h-1.5 w-10 rounded-full bg-[#D3DAD3]" />
          </button>
          <div className="flex-none px-4">{focusCard}</div>
          <div className="mt-3 flex-none px-4">{tabs}</div>
          <div className="scroll-y min-h-0 flex-1 px-2 pb-10 pt-1" onPointerDownCapture={(e) => expanded && e.stopPropagation()}>
            {list}
          </div>
        </motion.div>
      )}
    </div>
  )
}

/* ───────────── Kartu fokus ───────────── */

function QuestFocus({ v, now, rt, onOpen }: { v: QuestView; now: number; rt: boolean; onOpen: () => void }) {
  const q = v.quest
  const s = v.mySub?.status
  const cta =
    rt ? 'Lihat peserta'
    : s === 'approved' ? 'Selesai · lihat'
    : s === 'pending' ? 'Menunggu dicek RT'
    : s === 'checked_in' ? 'Lanjutkan misi'
    : s === 'rejected' ? 'Perlu diulang'
    : v.own ? 'Laporanmu · lihat'
    : v.phase === 'upcoming' ? 'Lihat jadwal'
    : v.inRange ? 'Kamu di lokasi · mulai'
    : 'Buka quest'
  return (
    <div>
      <div className="flex items-start gap-3">
        <CatTile cat={q.category} size={48} muted={v.phase !== 'live'} />
        <div className="min-w-0 flex-1">
          <p className="eyebrow truncate" style={{ color: CATS[q.category].color }}>
            {q.source === 'rt' ? 'Quest RT' : q.source === 'laporan' ? 'Dari laporan warga' : 'Permintaan tolong'}
          </p>
          <h2 className="mt-0.5 line-clamp-2 text-[1.2rem]">{q.title}</h2>
          <p className="mt-0.5 truncate text-[0.8rem] text-ink-2">
            {v.phase === 'live' ? phaseLabel(q, now) : fmtWindow(q.startAt, q.endAt, now)}
            {v.dist !== null && ` · ${fmtDist(v.dist)}`} · {v.taken}/{q.slots} orang
          </p>
        </div>
        <div className="flex flex-none flex-col items-end">
          <span className="font-display wd-wide text-[1.5rem] font-extrabold leading-none text-rompi">+{q.points}</span>
          <span className="mono text-[0.6rem] text-ink-3">POIN</span>
        </div>
      </div>
      <Button full className="mt-3" tone={v.inRange && v.phase === 'live' && !s && !v.own && !rt ? 'primary' : 'dark'} onClick={onOpen}>
        {cta} <ArrowRight size={17} />
      </Button>
    </div>
  )
}

function ReportFocus({
  post,
  dist,
  now,
  meId,
  rt,
  author,
  onWitness,
  onOpen,
}: {
  post: Post
  dist: number | null
  now: number
  meId?: string
  rt: boolean
  author: string
  onWitness: () => void
  onOpen: () => void
}) {
  const mine = post.authorId === meId
  const seen = !!meId && (post.witnesses ?? []).includes(meId)
  return (
    <div>
      <div className="flex items-start gap-3">
        {post.photo && <img src={post.photo.img} alt="Foto laporan" className="h-[52px] w-[52px] flex-none rounded-[14px] object-cover" />}
        <div className="min-w-0 flex-1">
          <p className="eyebrow" style={{ color: post.kind === 'tolong' ? '#C6466E' : '#FF5A1F' }}>
            {post.kind === 'tolong' ? 'Minta tolong' : 'Laporan'} · menunggu RT
          </p>
          <p className="mt-0.5 line-clamp-2 font-semibold leading-snug">{post.text}</p>
          <p className="mt-0.5 truncate text-[0.8rem] text-ink-2">
            {mine ? 'Kamu' : author} · {fmtAgo(post.at, now)}
            {dist !== null && ` · ${fmtDist(dist)}`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        {!rt && !mine && (
          <Button
            tone={seen ? 'plang' : 'soft'}
            className="flex-1"
            onClick={() => {
              onWitness()
              if (!seen) toast('Terima kasih, kesaksianmu membantu RT memprioritaskan.')
            }}
          >
            <Eye size={17} /> {seen ? 'Kamu juga lihat' : 'Saya juga lihat'} · {post.witnesses?.length ?? 0}
          </Button>
        )}
        <Button tone="dark" className="flex-1" onClick={onOpen}>
          {rt ? 'Tinjau laporan' : 'Buka di grup'} <ArrowRight size={17} />
        </Button>
      </div>
    </div>
  )
}
