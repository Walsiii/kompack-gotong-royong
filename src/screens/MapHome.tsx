import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { ChevronDown, ChevronUp, Clock3, Compass, Eye, Flame, Search, X, MapPin as PinIcon, MapPinned, Navigation, Users, Plus, Minus } from 'lucide-react'
import type { Map as MLMap } from 'maplibre-gl'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Map3D, type MapPin, type Neighbor } from '../components/Map3D'
import { Avatar, CatTile, Coin } from '../components/art'
import { Button, Points, RollingNumber, Segmented, toast, useIsWide } from '../components/ui'
import { CATS } from '../lib/catalog'
import { DEFAULT_HOME, distM, fmtDist, ringCenter } from '../lib/geo'
import { useGeo, useMyPos, useTestPos } from '../lib/location'
import { useOpenReports, useQuestViews, type QuestView } from '../lib/quests'
import { activeSubOf, personById, useIsRT, useMe, useMyGroup, usePoints, useSnap, useStore } from '../lib/store'
import { streakOf } from '../lib/streak'
import { MapGreeting } from '../components/MapGreeting'
import { fmtAgo, fmtWindow, phaseLabel, useNow } from '../lib/time'
import { useWalkingRoute, type RoadSource } from '../lib/routing'
import type { RoadLine } from '../lib/localRoute'
import { NavigationMode } from '../components/NavigationMode'
import { useChrome } from '../lib/chrome'
import maplibregl from 'maplibre-gl'
import type { Category, Post } from '../lib/types'
import '../components/map-redesign.css'

/* kamera & animasi pembuka diingat selama aplikasi terbuka */
let introDone = false

type Item = { key: string; type: 'misi'; view: QuestView } | { key: string; type: 'post'; post: Post; dist: number | null }

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
  const toggleWitness = useStore((s) => s.toggleWitness)
  const { pos, acc, heading: facing, status, retry } = useMyPos()
  const gpsTimestamp = useGeo((s) => s.at)
  const mapApi = useRef<MLMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [following, setFollowing] = useState(false)
  const [bearing, setBearing] = useState(0)
  const points = usePoints(me?.id)
  const views = useQuestViews(now)
  const reports = useOpenReports()

  const [params, setParams] = useSearchParams()
  const initialView = params.get('view')
  const [tab, setTab] = useState<'misi' | 'laporan'>(initialView === 'laporan' ? 'laporan' : 'misi')
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const [category, setCategory] = useState<Category | 'all'>(() => {
    const value = params.get('category')
    return value && Object.hasOwn(CATS, value) ? value as Category : 'all'
  })
  const [queryScope, setQueryScope] = useState<'all' | 'misi' | 'laporan'>(initialView === 'misi' || initialView === 'laporan' ? initialView : 'all')
  const normalizedQuery = query.trim().toLocaleLowerCase('id-ID')
  const filteredViews = useMemo(() => views.filter(({ misi: q }) => (category === 'all' || q.category === category) && [q.title, q.desc, q.place, CATS[q.category].label].some((value) => value.toLocaleLowerCase('id-ID').includes(normalizedQuery))), [views, category, normalizedQuery])
  const filteredReports = useMemo(() => reports.filter((p) => (category === 'all' || (p.category ?? (p.kind === 'tolong' ? 'bantu' : 'sampah')) === category) && [p.text, p.place ?? '', personById(users, p.authorId)?.name ?? '', CATS[p.category ?? (p.kind === 'tolong' ? 'bantu' : 'sampah')].label].some((value) => value.toLocaleLowerCase('id-ID').includes(normalizedQuery))), [reports, users, category, normalizedQuery])
  const threeD = false
  const [selected, setSelected] = useState<string | null>(null)
  const [focus, setFocus] = useState<{ lat: number; lng: number; key: number } | null>(null)
  const [expanded, setExpanded] = useState(Boolean(params.get('q')?.trim()))
  const fk = useRef(0)
  const [intro] = useState(() => !introDone)
  useEffect(() => {
    introDone = true
  }, [])

  const items: Item[] = useMemo(() => {
    const q: Item[] = filteredViews.map((v) => ({ key: `q:${v.misi.id}`, type: 'misi', view: v }))
    const r: Item[] = filteredReports
      .map((p) => ({ key: `p:${p.id}`, type: 'post' as const, post: p, dist: pos && p.lat !== undefined ? distM(pos, { lat: p.lat, lng: p.lng! }) : null }))
      .sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9))
    return tab === 'misi' ? [...q, ...r] : [...r, ...q]
  }, [filteredViews, filteredReports, pos, tab])

  const listed = items.filter((i) => normalizedQuery ? queryScope === 'all' || (queryScope === 'misi' ? i.type === 'misi' : i.type === 'post') : (tab === 'misi' ? i.type === 'misi' : i.type === 'post'))

  useEffect(() => {
    if (!selected || !items.some((i) => i.key === selected)) setSelected(listed[0]?.key ?? items[0]?.key ?? null)
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const pins: MapPin[] = useMemo(
    () => [
      ...filteredViews.map((v) => ({
        id: `q:${v.misi.id}`,
        lat: v.misi.lat,
        lng: v.misi.lng,
        kind: 'misi' as const,
        category: v.misi.category,
        label: v.mySub?.status === 'approved' || v.mySub?.status === 'pending' ? '✓' : `+${v.misi.points}`,
        state: v.mySub && (v.mySub.status === 'approved' || v.mySub.status === 'pending') ? ('done' as const) : v.phase === 'live' ? ('live' as const) : ('off' as const),
      })),
      ...filteredReports.map((p) => ({
        id: `p:${p.id}`,
        lat: p.lat!,
        lng: p.lng!,
        kind: p.kind === 'tolong' ? ('tolong' as const) : ('laporan' as const),
        category: p.category ?? 'sampah',
        state: 'live' as const,
      })),
    ],
    [filteredViews, filteredReports],
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
    if (it?.type === 'misi') fly(it.view.misi.lat, it.view.misi.lng)
    if (it?.type === 'post' && it.post.lat !== undefined) fly(it.post.lat, it.post.lng!)
    if (it) setTab(it.type === 'misi' ? 'misi' : 'laporan')
    if (collapse) setExpanded(false)
  }

  // Filters replace this map history entry, so opening a mission and going back
  // restores the same search without adding a history entry per keystroke.
  useEffect(() => {
    const next = new URLSearchParams(params)
    if (normalizedQuery) next.set('q', query.trim()); else next.delete('q')
    if (category !== 'all') next.set('category', category); else next.delete('category')
    const view = normalizedQuery ? queryScope : tab
    if (view !== 'all' && (normalizedQuery || view !== 'misi')) next.set('view', view); else next.delete('view')
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [query, normalizedQuery, category, tab, queryScope, params, setParams])

  // tautan dari Pos Ronda: /?pilih=p:<id>
  useEffect(() => {
    const p = params.get('pilih')
    if (!p) return
    const next = new URLSearchParams(params)
    next.delete('pilih')
    setParams(next, { replace: true })
    const t = setTimeout(() => pick(p), 400)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sel = items.find((i) => i.key === selected) ?? null
  const active = me ? activeSubOf(subs, me.id) : undefined
  const activeQuest = active && quests.find((q) => q.id === active.questId)
  const snap = useSnap()
  const streak = useMemo(() => (me ? streakOf(snap, me.id, now) : null), [snap, me, now])
  const greetLine = useMemo(() => {
    if (activeQuest) return `Lanjut: ${activeQuest.title}`
    if (streak && streak.weeks > 0 && !streak.thisWeek) return `🔥 ${streak.weeks} pekan beruntun. Jaga, ya!`
    const open = views.filter((v) => v.phase === 'live' && !v.own && !v.mySub && !v.full)
    if (open.length) {
      const near = [...open].sort((a, b) => (a.dist ?? 1e9) - (b.dist ?? 1e9))[0]
      return `${open.length} misi menunggu. Terdekat ${near.dist !== null ? fmtDist(near.dist) : 'di dekatmu'}.`
    }
    return 'Cek laporan warga, yuk!'
  }, [activeQuest, streak, views, group])
  const selQuest = sel?.type === 'misi' ? sel.view.misi : null
  const navigationTarget = useMemo(() => selQuest ? { id: selQuest.id, title: selQuest.title, lat: selQuest.lat, lng: selQuest.lng, radius: selQuest.radius } : null, [selQuest?.id, selQuest?.title, selQuest?.lat, selQuest?.lng, selQuest?.radius])
  /* data jalan dari ubin peta yang sudah termuat, untuk rute di perangkat */
  const roads: RoadSource = useCallback(async (from, to) => {
    const map = mapApi.current
    if (!map || !map.getSource('ofm')) return null
    const view = map.getBounds()
    if (!view.contains([from.lng, from.lat]) || !view.contains([to.lng, to.lat])) {
      const b = new maplibregl.LngLatBounds([from.lng, from.lat], [from.lng, from.lat]).extend([to.lng, to.lat])
      map.fitBounds(b, { padding: 60, duration: 0, maxZoom: 16 })
      await new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, 4000)
        map.once('idle', () => { window.clearTimeout(t); resolve() })
      })
    }
    const toLines = (layer: string, withName: boolean, filter?: maplibregl.FilterSpecification): RoadLine[] => {
      const out: RoadLine[] = []
      for (const f of map.querySourceFeatures('ofm', { sourceLayer: layer, filter })) {
        const g = f.geometry
        const name = withName ? String(f.properties?.['name:latin'] ?? f.properties?.name ?? '') || undefined : undefined
        if (g.type === 'LineString') out.push({ coords: g.coordinates as [number, number][], name })
        else if (g.type === 'MultiLineString') for (const c of g.coordinates) out.push({ coords: c as [number, number][], name })
      }
      return out
    }
    const WALKABLE = ['trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track', 'path', 'busway']
    const lines = toLines('transportation', false, ['in', ['get', 'class'], ['literal', WALKABLE]] as maplibregl.FilterSpecification)
    const named = toLines('transportation_name', true)
    return { lines, named }
  }, [])
  const walking = useWalkingRoute(navigationTarget, pos, { accuracyM: acc, simulated: testMode, at: gpsTimestamp }, { roads, allowSimulated: testMode })
  const navActive = walking.active && !!selQuest && !rt
  const setImmersive = useChrome((s) => s.setImmersive)
  useEffect(() => {
    setImmersive(navActive)
    return () => setImmersive(false)
  }, [navActive, setImmersive])
  useEffect(() => { if (!walking.active) setFollowing(false) }, [walking.active])

  /* mode uji: berjalan otomatis sepanjang rute (±15 m/detik, dipercepat untuk demo) */
  const [simulating, setSimulating] = useState(false)
  useEffect(() => { if (!walking.active || walking.arrived || walking.status !== 'ready') setSimulating(false) }, [walking.active, walking.arrived, walking.status])
  useEffect(() => {
    const route = walking.route
    if (!simulating || !route || !testMode) return
    const coords = route.coordinates
    const cum = [0]
    for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + distM({ lng: coords[i - 1][0], lat: coords[i - 1][1] }, { lng: coords[i][0], lat: coords[i][1] }))
    let walked = walking.projection?.progressM ?? 0
    const id = window.setInterval(() => {
      walked = Math.min(cum[cum.length - 1], walked + 6)
      let i = 1
      while (i < cum.length - 1 && cum[i] < walked) i++
      const f = (walked - cum[i - 1]) / Math.max(0.01, cum[i] - cum[i - 1])
      const a = coords[i - 1]
      const b = coords[i]
      useTestPos.getState().set({ lng: a[0] + (b[0] - a[0]) * f, lat: a[1] + (b[1] - a[1]) * f })
      if (walked >= cum[cum.length - 1]) {
        const t = navigationTarget
        if (t) useTestPos.getState().set({ lat: t.lat, lng: t.lng })
        window.clearInterval(id)
      }
    }, 400)
    return () => window.clearInterval(id)
  }, [simulating, walking.route]) // eslint-disable-line react-hooks/exhaustive-deps
  const exitNavigation = () => {
    setSimulating(false)
    walking.cancel()
  }
  const recenter = () => {
    if (pos && !rt) {
      setFollowing(walking.active)
      fly(pos.lat, pos.lng)
    } else fly(center.lat, center.lng)
  }
  const startDirections = () => {
    setExpanded(false)
    setFollowing(true)
    if (!walking.active) void walking.start()
  }
  const recenterNav = () => {
    setFollowing(true)
    if (pos) fly(pos.lat, pos.lng)
  }
  const center = useMemo(() => (group?.territory.length ? ringCenter(group.territory) : home), [group?.territory, home])

  // Mengetuk peta hanya memilih penanda; posisimu selalu dari GPS.
  const onMapClick = undefined

  /* ───── isi panel ───── */

  const focusCard = sel && (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={sel.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
        {sel.type === 'misi' ? (
          <QuestFocus v={sel.view} now={now} rt={rt} onOpen={() => nav(`/misi/${sel.view.misi.id}`)} onDirections={startDirections} />
        ) : (
          <ReportFocus
            post={sel.post}
            dist={sel.dist}
            now={now}
            meId={me?.id}
            rt={rt}
            author={personById(users, sel.post.authorId)?.name ?? 'Warga'}
            onWitness={async () => {
              if (!me) return false
              const wasSeen = (sel.post.witnesses ?? []).includes(me.id)
              await toggleWitness(sel.post.id, me.id)
              return (useStore.getState().posts.find(p => p.id === sel.post.id)?.witnesses ?? []).includes(me.id) !== wasSeen
            }}
            onOpen={() => nav(rt ? `/rt/laporan/${sel.post.id}` : `/grup?ch=${sel.post.channel}&post=${sel.post.id}`)}
          />
        )}
      </motion.div>
    </AnimatePresence>
  )

  const list = (
    <div className="map-mission-list">
      {listed.length === 0 && (
        <div className="map-list-empty">
          <MapPinned size={32} aria-hidden="true" />
          <h2>{normalizedQuery || category !== 'all' ? 'Belum ketemu.' : tab === 'misi' ? 'Gangmu sedang tenang.' : 'Belum ada laporan.'}</h2>
          <p>{normalizedQuery || category !== 'all' ? 'Coba kata lain atau tampilkan semua kategori.' : tab === 'misi' ? 'Misi baru dari RT akan muncul di sini.' : 'Ada yang perlu dibantu? Mulai dari tombol Lapor.'}</p>
          {(normalizedQuery || category !== 'all') && <Button tone="soft" className="mt-4" onClick={() => { setQuery(''); setCategory('all'); setQueryScope('all') }}>Tampilkan semua</Button>}
        </div>
      )}
      {listed.map((it, index) => {
        const on = it.key === selected
        return (
          <motion.button
            key={it.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.035, ease: [0.22, 1, 0.36, 1] }}
            whileTap={{ scale: 0.985 }}
            type="button"
            onClick={() => pick(it.key)}
            aria-pressed={on}
            className={`map-mission-row ${on ? 'is-selected' : ''}`}
          >
            {it.type === 'misi' ? (
              <>
                <CatTile cat={it.view.misi.category} size={42} muted={it.view.phase !== 'live'} />
                <span className="map-row-copy">
                  <span className="map-row-title">{it.view.misi.title}</span>
                  <span className="map-row-meta">
                    <span>{it.view.dist !== null ? fmtDist(it.view.dist) : phaseLabel(it.view.misi, now)}</span>
                    <span>{it.view.taken}/{it.view.misi.slots} orang</span>
                  </span>
                </span>
                <Points value={it.view.misi.points} plus />
              </>
            ) : (
              <>
                {it.post.photo ? (
                  <img src={it.post.photo.img} alt="" width={42} height={42} className="map-row-photo" />
                ) : <CatTile cat={it.post.category ?? 'sampah'} size={42} />}
                <span className="map-row-copy">
                  <span className="map-row-title">{it.post.text}</span>
                  <span className="map-row-meta">
                    <span>{it.post.kind === 'tolong' ? 'Minta tolong' : 'Laporan'}</span>
                    <span>{personById(users, it.post.authorId)?.name}</span>
                  </span>
                </span>
                <span className="map-witness-count"><Eye size={16} aria-hidden="true" /> {it.post.witnesses?.length ?? 0}</span>
              </>
            )}
          </motion.button>
        )
      })}
    </div>
  )

  const tabs = normalizedQuery ? (
    <Segmented id="mapsearchtab" value={queryScope} onChange={setQueryScope} className="w-full" options={[{ value: 'all', label: `Semua (${items.length})` }, { value: 'misi', label: `Misi (${filteredViews.length})` }, { value: 'laporan', label: `Laporan (${filteredReports.length})` }]} />
  ) : (
    <Segmented
      id="maptab"
      value={tab}
      onChange={(v) => {
        setTab(v)
        const first = items.find((i) => (v === 'misi' ? i.type === 'misi' : i.type === 'post'))
        if (first) pick(first.key, false)
      }}
      options={[
        { value: 'misi', label: `Misi (${filteredViews.length})` },
        { value: 'laporan', label: `Laporan (${filteredReports.length})` },
      ]}
      className="w-full"
    />
  )

  const avatarMenu = me && (
    <details className="map-avatar-menu">
      <summary aria-label="Poin dan profil"><Avatar index={me.avatar} size={32} /></summary>
      <div className="map-avatar-content">
        <strong>{me.name}</strong>
        <p>{rt ? 'Ketua RT' : `${points.total} poin`}</p>
        <button type="button" onClick={() => nav('/aku')}>Profil dan pengaturan</button>
        <button type="button" onClick={() => nav('/grup')}>{group?.name}, {group?.rw}</button>
        {testMode && !rt && <p>Mode uji. Posisi tetap dari GPS; tombol jalan otomatis ada saat navigasi. Bukti ditandai sebagai percobaan.</p>}
        {activeQuest && !rt && <button type="button" onClick={() => nav(`/misi/${activeQuest.id}`)}>Lanjutkan: {activeQuest.title}</button>}
        {!testMode && !rt && status !== 'ok' && <button type="button" onClick={retry}>{status === 'locating' ? 'Mencari GPS…' : 'Coba lokasi lagi'}</button>}
      </div>
    </details>
  )
  const pointsHud = me && !rt ? (
    <span className="map-points" aria-label={`${points.total} poin${streak?.weeks ? `, ${streak.weeks} pekan beruntun` : ''}`}>
      {!!streak?.weeks && <span className="map-streak"><Flame size={15} strokeWidth={2.4} aria-hidden="true" />{streak.weeks}</span>}
      <Coin size={16} />
      <RollingNumber value={points.total} />
    </span>
  ) : null

  const searchControl = (
    <div className="map-search-shell">
      <Search size={22} aria-hidden="true" />
      <input type="search" aria-label="Cari misi atau laporan" placeholder="Cari misi atau laporan" value={query} onChange={(e) => { setQuery(e.target.value); setQueryScope('all'); if (e.target.value.trim()) setExpanded(true) }} autoComplete="off" />
      {query && <button type="button" onClick={() => { setQuery(''); setQueryScope('all') }} aria-label="Hapus pencarian"><X size={20} aria-hidden="true" /></button>}
      {!wide && pointsHud}
      {!wide && avatarMenu}
    </div>
  )
  const categoryControl = (
    <div className="map-category-strip no-scrollbar" role="group" aria-label="Kategori di peta">
      <button type="button" className="map-category-chip" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>Semua</button>
      {Object.values(CATS).map((cat) => <button type="button" key={cat.id} className="map-category-chip" aria-pressed={category === cat.id} onClick={() => setCategory(cat.id)}>{cat.label}</button>)}
    </div>
  )

  const [vh, setVh] = useState(() => window.innerHeight)
  const dragControls = useDragControls()
  const skipHandleClick = useRef(false)
  useEffect(() => {
    const on = () => setVh(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const sheetH = Math.round(vh * 0.75)
  const peek = walking.active ? 224 : 180
  const collapsedY = Math.max(0, sheetH - peek)

  return (
    <div className="neighborhood-map" data-navigating={navActive}>
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
        circle={selQuest && !navActive ? { lat: selQuest.lat, lng: selQuest.lng, radius: selQuest.radius } : null}
        walkingRoute={walking.route?.geometry ?? null}
        walkingTarget={navigationTarget}
        followMe={following && navActive}
        navigating={navActive && walking.status === 'ready'}
        meHeading={navActive && walking.status === 'ready' ? walking.heading : null}
        meAccuracy={acc}
        meFacing={facing}
        routeProgress={walking.progressFraction}
        onFollowChange={setFollowing}
        onReady={(map) => { mapApi.current = map; setMapReady(true) }}
        onBearing={setBearing}
        fitTerritory
        onMapClick={onMapClick}
        threeD={threeD}
        focus={focus}
        padding={navActive ? (wide ? { left: 452, top: 40, bottom: 40 } : { top: 170, bottom: 150 }) : wide ? { left: 388, top: 64, bottom: 40 } : { top: 132, bottom: peek + 76 }}
        intro={intro}
      />

      {navActive && selQuest && (
        <NavigationMode
          nav={walking}
          targetTitle={selQuest.title}
          following={following}
          onRecenter={recenterNav}
          onExit={exitNavigation}
          onOpenMission={() => {
            const id = selQuest.id
            exitNavigation()
            nav(`/misi/${id}`)
          }}
          testMode={testMode}
          simulating={simulating}
          onSimulate={setSimulating}
        />
      )}

      {!navActive && <>
      <div className="map-floating-header" style={{ paddingTop: 'calc(var(--safe-t) + 16px)' }}>
        {!wide && <>{searchControl}{categoryControl}</>}
        {wide && <div className="map-desktop-avatar">{pointsHud}{avatarMenu}</div>}

      </div>

      {me && !rt && (
        <MapGreeting
          hour={new Date(now).getHours()}
          name={me.name}
          line={greetLine}
          style={wide ? { left: 404, bottom: 28, right: 'auto' } : { left: 12, right: 72, bottom: `calc(var(--nav-h) + var(--safe-b) + ${peek + 12}px)` }}
        />
      )}

      <div className="map-tools" role="group" aria-label="Kendali peta" style={{ bottom: wide ? 32 : `calc(var(--nav-h) + var(--safe-b) + ${peek + 16}px)` }}>
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={recenter}
          className="map-tool"
          aria-label={rt ? 'Ke tengah wilayah' : 'Ke posisiku'}
        ><Navigation size={21} aria-hidden="true" /></motion.button>
        <button type="button" className="map-tool" aria-label="Perbesar peta" disabled={!mapReady} onClick={() => mapApi.current?.zoomIn({ duration: 180 })}><Plus size={20} aria-hidden="true" /></button>
        <button type="button" className="map-tool" aria-label="Perkecil peta" disabled={!mapReady} onClick={() => mapApi.current?.zoomOut({ duration: 180 })}><Minus size={20} aria-hidden="true" /></button>
        <AnimatePresence>
          {Math.abs(bearing) > 2 && (
            <motion.button
              key="compass"
              type="button"
              className="map-tool"
              aria-label="Putar peta kembali ke utara"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              onClick={() => mapApi.current?.easeTo({ bearing: 0, duration: 500 })}
            >
              <Compass size={21} aria-hidden="true" style={{ transform: `rotate(${-bearing - 45}deg)` }} />
            </motion.button>
          )}
        </AnimatePresence>
        {rt && <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={() => nav('/rt/wilayah')} className="map-tool" aria-label="Atur wilayah RT"><MapPinned size={21} aria-hidden="true" /></motion.button>}
      </div>

      {wide ? (
        <section className="map-desktop-panel" aria-label="Misi di sekitarmu">
          <div className="map-panel-heading">{searchControl}{categoryControl}<h1>{normalizedQuery ? 'Hasil pencarian' : 'Di sekitarmu'}</h1><p role="status">{normalizedQuery ? `${listed.length} hasil di lingkunganmu` : `${group?.name ?? 'Wilayahmu'}, ${group?.rw ?? ''}`}</p></div>
          <div className="map-focus-wrap">{focusCard ?? <p className="text-ink-2">Pilih penanda di peta.</p>}</div>
          <div className="map-panel-tabs">{tabs}</div>
          <div className="scroll-y map-panel-list">{list}</div>
        </section>
      ) : (
        <motion.section
          aria-label="Misi di sekitarmu"
          className="map-mobile-sheet"
          data-expanded={expanded}
          style={{ height: sheetH, bottom: 'calc(var(--nav-h) + var(--safe-b))' }}
          initial={false}
          animate={{ y: expanded ? 0 : collapsedY }}
          transition={{ type: 'spring', stiffness: 360, damping: 38 }}
          drag="y"
          dragControls={dragControls}
          dragListener={false}
          dragConstraints={{ top: 0, bottom: collapsedY }}
          dragElastic={0.04}
          dragMomentum={false}
          onDragEnd={(_, i) => {
            if (Math.abs(i.offset.y) > 8) skipHandleClick.current = true
            if (i.velocity.y < -300 || i.offset.y < -60) setExpanded(true)
            else if (i.velocity.y > 300 || i.offset.y > 60) setExpanded(false)
          }}
        >
          <button
            type="button"
            className="map-sheet-handle"
            onPointerDown={(e) => { skipHandleClick.current = false; dragControls.start(e) }}
            onClick={() => { if (skipHandleClick.current) { skipHandleClick.current = false; return }; setExpanded((e) => !e) }}
            aria-label={expanded ? 'Kecilkan daftar' : 'Lihat semua'}
            aria-expanded={expanded}
            aria-controls="map-mobile-missions"
          >
            <span className="map-handle-line" aria-hidden="true" />
            <span>{expanded ? 'Kembali ke peta' : walking.active ? 'Navigasi jalan kaki' : 'Detail misi'}</span>
            {expanded ? <ChevronDown size={17} aria-hidden="true" /> : <ChevronUp size={17} aria-hidden="true" />}
          </button>
          <div className="map-focus-wrap">{focusCard ?? <p className="map-selection-empty">{normalizedQuery || category !== 'all' ? 'Belum ada yang cocok. Coba kata atau kategori lain.' : 'Pilih misi atau laporan di peta.'}</p>}{walking.active && expanded && focusCard}</div>
          <div className="map-panel-tabs">{tabs}</div>
          <div id="map-mobile-missions" className="scroll-y map-panel-list">{list}</div>
        </motion.section>
      )}
      </>}
    </div>
  )
}

function QuestFocus({ v, now, rt, onOpen, onDirections }: { v: QuestView; now: number; rt: boolean; onOpen: () => void; onDirections: () => void }) {
  const q = v.misi
  const s = v.mySub?.status
  const cta =
    rt ? 'Lihat peserta'
    : s === 'approved' ? 'Misi selesai'
    : s === 'pending' ? 'Menunggu RT'
    : s === 'checked_in' ? 'Lanjutkan'
    : s === 'rejected' ? 'Perlu diulang'
    : v.own ? 'Lihat laporan'
    : v.phase === 'upcoming' ? 'Lihat jadwal'
    : v.inRange ? 'Mulai misi'
    : 'Buka misi'
  return (
    <article className="mission-ticket">
      <div className="mission-ticket-main">
        <div className="mission-ticket-copy">
          <h2>{q.title}</h2>
          <div className="mission-category"><CatTile cat={q.category} size={26} /><span>{CATS[q.category].label}</span></div>
        </div>
        <div className="mission-reward" aria-label={`${q.points} poin`}><strong>+{q.points}</strong><span>poin</span></div>
      </div>
      <div className="mission-compact-meta"><span>{v.dist !== null ? fmtDist(v.dist) : 'Di wilayahmu'}</span><span>{q.minMinutes} menit kerja</span></div>
      <div className="mission-ticket-meta">
        <span><PinIcon size={15} aria-hidden="true" /> {v.dist !== null ? fmtDist(v.dist) : 'Di wilayahmu'}</span>
        <span><Users size={15} aria-hidden="true" /> {v.taken}/{q.slots} orang</span>
        <span><Clock3 size={15} aria-hidden="true" /> {q.minMinutes} menit</span>
      </div>
      <p className="mission-window">{v.phase === 'live' ? phaseLabel(q, now) : fmtWindow(q.startAt, q.endAt, now)}<span>{q.source === 'rt' ? 'Misi RT' : q.source === 'laporan' ? 'Dari laporan warga' : 'Permintaan tolong'}</span></p>
      <div className="mission-actions"><Button className="mission-directions-action" tone="dark" onClick={onDirections}><Navigation size={16} aria-hidden="true" />Mulai navigasi</Button><Button className="mission-ticket-action" tone="white" onClick={onOpen}>{cta}</Button></div>
    </article>
  )
}

function ReportFocus({ post, dist, now, meId, rt, author, onWitness, onOpen }: {
  post: Post; dist: number | null; now: number; meId?: string; rt: boolean; author: string; onWitness: () => Promise<boolean>; onOpen: () => void
}) {
  const mine = post.authorId === meId
  const seen = !!meId && (post.witnesses ?? []).includes(meId)
  return (
    <article className="mission-ticket report-ticket">
      <div className="mission-ticket-main">
        {post.photo && <img src={post.photo.img} alt="Foto laporan" width={56} height={56} className="map-report-photo" />}
        <div className="mission-ticket-copy"><h2>{post.text}</h2><p className="report-state">{post.kind === 'tolong' ? 'Minta tolong' : 'Laporan'} menunggu RT</p></div>
      </div>
      <div className="mission-ticket-meta"><span>{mine ? 'Kamu' : author}</span><span>{fmtAgo(post.at, now)}</span>{dist !== null && <span>{fmtDist(dist)}</span>}</div>
      <div className="map-report-actions">
        {!rt && !mine && <Button tone={seen ? 'plang' : 'soft'} className="flex-1" onClick={async () => { const saved = await onWitness(); if (saved && !seen) toast('Terima kasih, kesaksianmu membantu RT memprioritaskan.') }}><Eye size={17} aria-hidden="true" />{seen ? 'Ikut melihat' : 'Saya juga lihat'} ({post.witnesses?.length ?? 0})</Button>}
        <Button tone="dark" className="flex-1" onClick={onOpen}>{rt ? 'Tinjau laporan' : 'Buka di grup'}</Button>
      </div>
    </article>
  )
}
