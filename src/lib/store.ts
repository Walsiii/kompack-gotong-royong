import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { del, get, set } from 'idb-keyval'
import { REWARDS, RULES } from './catalog'
import { circleInRing, distM, pointInRing, ringsOverlap, selfIntersects } from './geo'
import { shortCode } from './integrity'
import { LEADER, MY_GROUP, NPCS, rollDemoQuests, seedData, uid } from './seed'
import { questPhase, startOfDay } from './time'
import type {
  Bonus,
  Category,
  Channel,
  Check,
  Evidence,
  Fix,
  Group,
  LatLng,
  Person,
  Post,
  Quest,
  Redemption,
  Ring,
  Submission,
} from './types'

/* ───────────────────────── Penyimpanan ─────────────────────────
   Data disimpan di perangkat (IndexedDB). Jendela lain di browser yang sama ikut
   diperbarui lewat BroadcastChannel — jadi bisa buka dua jendela: warga & Ketua RT. */

const memory = new Map<string, string>()
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kompack-sync') : null

const storage: StateStorage = {
  getItem: async (name) => {
    try {
      return (await get<string>(name)) ?? memory.get(name) ?? null
    } catch {
      return memory.get(name) ?? null
    }
  },
  setItem: async (name, value) => {
    memory.set(name, value)
    try {
      await set(name, value)
      channel?.postMessage('changed')
    } catch {
      /* penyimpanan penuh / mode privat: data tetap ada selama aplikasi terbuka */
    }
  },
  removeItem: async (name) => {
    memory.delete(name)
    try {
      await del(name)
    } catch {
      /* abaikan */
    }
  },
}

export type Result<T = string> = { ok: true; value: T } | { ok: false; error: string }
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

export interface NewQuest {
  title: string
  category: Category
  desc: string
  place: string
  lat: number
  lng: number
  radius: number
  minMinutes: number
  startAt: number
  endAt: number
  points: number
  slots: number
}

interface Data {
  meId: string | null
  users: Person[]
  groups: Group[]
  quests: Quest[]
  posts: Post[]
  subs: Submission[]
  bonuses: Bonus[]
  redemptions: Redemption[]
  home: LatLng | null
  testMode: boolean
  simPos: LatLng | null
}

interface Actions {
  register: (input: { name: string; avatar: number; birthYear: number; home: LatLng; testMode: boolean }) => Promise<void>
  setTestMode: (on: boolean) => void
  setSimPos: (p: LatLng) => void
  /** kentongan: panggilan dari pengurus — hanya Ketua RT/RW grup itu */
  broadcast: (groupId: string, authorId: string, text: string) => Result<true>
  createReport: (input: { authorId: string; kind: 'laporan' | 'tolong'; category: Category; text: string; place: string; photo: Evidence }) => Result
  toggleWitness: (postId: string, userId: string) => void
  toggleReaction: (postId: string, key: string, userId: string) => void
  acceptReport: (postId: string, reviewerId: string, q: NewQuest) => Result
  dismissReport: (postId: string, reviewerId: string, reason: string) => Result<true>
  checkIn: (questId: string, userId: string, fix: Fix, dist: number) => Result
  setEvidence: (subId: string, kind: 'before' | 'after', ev: Evidence) => void
  submit: (subId: string, note: string, checks: Check[]) => void
  review: (subId: string, reviewerId: string, approve: boolean, reason?: string) => Result<true>
  markCelebrated: (ids: string[]) => void
  createQuest: (q: NewQuest, by: string) => Result
  closeQuest: (id: string) => void
  saveTerritory: (groupId: string, ring: Ring) => Result<true>
  redeem: (rewardId: string, userId: string) => Redemption | null
  fulfill: (id: string) => void
  rollDemo: () => void
  reset: () => void
}

const EMPTY: Data = {
  meId: null,
  users: [],
  groups: [],
  quests: [],
  posts: [],
  subs: [],
  bonuses: [],
  redemptions: [],
  home: null,
  testMode: false,
  simPos: null,
}

export const ME = 'me'

/* ───────────── Aturan (dipakai store & UI) ───────────── */

export function territoryProblem(ring: Ring, groupId: string, groups: Group[], quests: Quest[]): string | null {
  if (ring.length < 3) return 'Wilayah butuh minimal 3 titik sudut.'
  if (selfIntersects(ring)) return 'Garis batas saling menyilang. Geser titik supaya tidak berpotongan.'
  for (const g of groups) {
    if (g.id === groupId || g.kind !== 'rt' || g.territory.length < 3) continue
    if (ringsOverlap(ring, g.territory)) return `Bertabrakan dengan wilayah ${g.name}. Geser batas supaya tidak menimpa RT tetangga.`
  }
  const out = quests.filter((q) => q.groupId === groupId && !q.closed && questPhase(q) !== 'ended' && !circleInRing(q, q.radius, ring))
  if (out.length) return `Quest "${out[0].title}" jadi berada di luar wilayah. Tutup quest itu dulu atau perluas wilayah.`
  return null
}

export function questProblem(q: Pick<NewQuest, 'lat' | 'lng' | 'radius'>, group: Group | undefined): string | null {
  if (!group || group.territory.length < 3) return 'Wilayah RT belum diatur.'
  if (!pointInRing(q, group.territory)) return `Titik quest di luar wilayah ${group.name}.`
  if (!circleInRing(q, q.radius, group.territory)) return `Area check-in ${q.radius} m keluar dari batas ${group.name}. Kecilkan radius atau geser titik.`
  return null
}

export function activeSubOf(subs: Submission[], userId: string, exceptQuest?: string): Submission | undefined {
  return subs.find((s) => s.userId === userId && s.status === 'checked_in' && s.questId !== exceptQuest)
}

export function todayCount(subs: Submission[], userId: string, now = Date.now()): number {
  const t0 = startOfDay(now)
  return subs.filter((s) => s.userId === userId && s.checkin.at >= t0 && s.status !== 'rejected').length
}

export function takenSlots(subs: Submission[], questId: string): number {
  return subs.filter((x) => x.questId === questId && x.status !== 'rejected').length
}

export const useStore = create<Data & Actions>()(
  persist(
    (setState, getState) => {
      const sysPost = (groupId: string, ch: Channel, text: string, extra: Partial<Post> = {}): Post => ({
        id: uid('m'),
        groupId,
        channel: ch,
        kind: 'sistem',
        authorId: LEADER,
        at: Date.now(),
        text,
        ...extra,
      })

      return {
        ...EMPTY,

        register: async ({ name, avatar, birthYear, home, testMode }) => {
          const seeded = await seedData(home)
          const me: Person = {
            id: ME,
            name,
            avatar,
            birthYear,
            groupId: MY_GROUP,
            role: 'warga',
            basePoints: 0,
            baseWeek: 0,
            baseQuests: 0,
            trust: 100,
          }
          setState({
            ...seeded,
            meId: ME,
            users: [...NPCS, me],
            redemptions: [],
            home,
            testMode,
            simPos: home,
            posts: [
              ...seeded.posts,
              sysPost(MY_GROUP, 'obrolan', `${name} bergabung ke grup RT 04. Selamat datang!`, { at: Date.now() }),
            ],
          })
        },

        setTestMode: (testMode) => setState((s) => ({ testMode, simPos: s.simPos ?? s.home })),
        setSimPos: (simPos) => setState({ simPos }),

        broadcast: (groupId, authorId, text) => {
          const s = getState()
          const g = s.groups.find((x) => x.id === groupId)
          if (!g || g.leaderId !== authorId) return fail('Hanya pengurus yang bisa memukul kentongan.')
          const t = text.trim()
          if (t.length < 8) return fail('Tulis panggilannya minimal 8 huruf.')
          setState({ posts: [...s.posts, { id: uid('m'), groupId, channel: 'obrolan', kind: 'umum', authorId, at: Date.now(), text: t.slice(0, 240) }] })
          return { ok: true, value: true }
        },

        createReport: ({ authorId, kind, category, text, place, photo }) => {
          const s = getState()
          const author = s.users.find((u) => u.id === authorId)
          const group = s.groups.find((g) => g.id === author?.groupId)
          if (!author || !group) return fail('Akun tidak ditemukan.')
          if (!pointInRing(photo, group.territory)) return fail(`Lokasimu di luar wilayah ${group.name}. Laporan hanya bisa dibuat di dalam wilayah RT-mu.`)
          const t0 = startOfDay()
          const today = s.posts.filter((p) => p.authorId === authorId && (p.kind === 'laporan' || p.kind === 'tolong') && p.at >= t0).length
          if (today >= RULES.dailyReports) return fail(`Batas ${RULES.dailyReports} laporan per hari sudah tercapai. Coba lagi besok.`)
          if (text.trim().length < 10) return fail('Ceritakan masalahnya minimal 10 huruf.')
          const post: Post = {
            id: uid('m'),
            groupId: group.id,
            channel: kind,
            kind,
            authorId,
            at: Date.now(),
            text: text.trim(),
            place: place.trim() || undefined,
            category,
            photo,
            lat: photo.lat,
            lng: photo.lng,
            status: 'menunggu',
            witnesses: [],
          }
          setState({ posts: [...s.posts, post] })
          return { ok: true, value: post.id }
        },

        toggleWitness: (postId, userId) =>
          setState((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId || p.authorId === userId || p.status !== 'menunggu') return p
              const w = p.witnesses ?? []
              return { ...p, witnesses: w.includes(userId) ? w.filter((x) => x !== userId) : [...w, userId] }
            }),
          })),

        toggleReaction: (postId, key, userId) =>
          setState((s) => ({
            posts: s.posts.map((p) => {
              if (p.id !== postId) return p
              const r = { ...(p.reactions ?? {}) }
              const list = r[key] ?? []
              r[key] = list.includes(userId) ? list.filter((x) => x !== userId) : [...list, userId]
              if (r[key].length === 0) delete r[key]
              return { ...p, reactions: r }
            }),
          })),

        acceptReport: (postId, reviewerId, input) => {
          const s = getState()
          const post = s.posts.find((p) => p.id === postId)
          if (!post || post.status !== 'menunggu') return fail('Laporan ini sudah diproses.')
          const group = s.groups.find((g) => g.id === post.groupId)
          if (group?.leaderId !== reviewerId) return fail('Hanya Ketua RT yang bisa memproses laporan.')
          if (post.authorId === reviewerId) return fail('Laporanmu sendiri tidak bisa kamu setujui.')
          const prob = questProblem(input, group)
          if (prob) return fail(prob)
          const id = uid('q')
          const quest: Quest = {
            ...input,
            id,
            code: `Q-${shortCode(id)}`,
            groupId: post.groupId,
            createdAt: Date.now(),
            createdBy: reviewerId,
            source: post.kind === 'tolong' ? 'tolong' : 'laporan',
            fromPostId: post.id,
            requesterId: post.authorId,
          }
          const author = s.users.find((u) => u.id === post.authorId)
          setState({
            quests: [...s.quests, quest],
            posts: [
              ...s.posts.map((p) => (p.id === postId ? { ...p, status: 'jadi_quest' as const, questId: id } : p)),
              {
                id: uid('m'),
                groupId: post.groupId,
                channel: 'quest',
                kind: 'quest',
                authorId: reviewerId,
                at: Date.now(),
                text: post.kind === 'tolong' ? `Permintaan tolong ${author?.name ?? 'warga'} sekarang jadi quest.` : `Laporan ${author?.name ?? 'warga'} sekarang jadi quest.`,
                questId: id,
              },
            ],
            bonuses: [...s.bonuses, { id: uid('b'), userId: post.authorId, points: RULES.reporterBonus, at: Date.now(), reason: 'Laporan diterima RT' }],
          })
          return { ok: true, value: id }
        },

        dismissReport: (postId, reviewerId, reason) => {
          const s = getState()
          const post = s.posts.find((p) => p.id === postId)
          if (!post || post.status !== 'menunggu') return fail('Laporan ini sudah diproses.')
          const group = s.groups.find((g) => g.id === post.groupId)
          if (group?.leaderId !== reviewerId) return fail('Hanya Ketua RT yang bisa memproses laporan.')
          setState({ posts: s.posts.map((p) => (p.id === postId ? { ...p, status: 'ditolak' as const, statusNote: reason } : p)) })
          return { ok: true, value: true }
        },

        checkIn: (questId, userId, fix, dist) => {
          const s = getState()
          const q = s.quests.find((x) => x.id === questId)
          if (!q) return fail('Quest tidak ditemukan.')
          const existing = s.subs.find((x) => x.questId === questId && x.userId === userId)
          if (existing && existing.status !== 'rejected') return { ok: true, value: existing.id }
          if (q.requesterId === userId) return fail('Ini laporanmu sendiri. Biar warga lain yang mengerjakan.')
          if (questPhase(q) !== 'live') return fail('Quest ini belum dibuka atau sudah selesai.')
          if (takenSlots(s.subs, questId) >= q.slots) return fail('Kuota peserta sudah penuh.')
          const active = activeSubOf(s.subs, userId, questId)
          if (active) {
            const aq = s.quests.find((x) => x.id === active.questId)
            return fail(`Selesaikan dulu quest "${aq?.title ?? 'sebelumnya'}". Satu quest dalam satu waktu.`)
          }
          if (todayCount(s.subs, userId) >= RULES.dailyQuests) return fail(`Batas ${RULES.dailyQuests} quest per hari sudah tercapai. Istirahat dulu, lanjut besok.`)
          if (dist > q.radius) return fail('Kamu di luar area check-in.')
          const sub: Submission = { id: uid('s'), questId, userId, checkin: { ...fix, dist: Math.round(dist) }, status: 'checked_in' }
          setState({ subs: [...s.subs.filter((x) => x.id !== existing?.id), sub] })
          return { ok: true, value: sub.id }
        },

        setEvidence: (subId, kind, ev) =>
          setState((s) => ({ subs: s.subs.map((x) => (x.id === subId ? { ...x, [kind]: ev } : x)) })),

        submit: (subId, note, checks) =>
          setState((s) => ({
            subs: s.subs.map(
              (x): Submission =>
                x.id === subId ? { ...x, note: note.trim() || undefined, status: 'pending', submittedAt: Date.now(), checks } : x,
            ),
          })),

        review: (subId, reviewerId, approve, reason) => {
          const s = getState()
          const sub = s.subs.find((x) => x.id === subId)
          if (!sub || sub.status !== 'pending') return fail('Setoran ini sudah diproses.')
          const q = s.quests.find((x) => x.id === sub.questId)
          const group = s.groups.find((g) => g.id === q?.groupId)
          if (!q || group?.leaderId !== reviewerId) return fail('Hanya Ketua RT wilayah ini yang bisa memeriksa.')
          if (sub.userId === reviewerId) return fail('Kamu tidak bisa memeriksa setoranmu sendiri.')
          const now = Date.now()
          const worker = s.users.find((u) => u.id === sub.userId)
          const extra: Post[] = []
          let posts = s.posts
          if (approve) {
            extra.push(sysPost(q.groupId, 'quest', `${worker?.name ?? 'Warga'} menyelesaikan "${q.title}" · +${q.points} poin`, { questId: q.id }))
            if (q.fromPostId) posts = posts.map((p) => (p.id === q.fromPostId ? { ...p, status: 'beres' as const } : p))
          }
          setState({
            subs: s.subs.map(
              (x): Submission =>
                x.id !== subId
                  ? x
                  : approve
                    ? { ...x, status: 'approved', reviewedAt: now, reviewerId, awarded: q.points, celebrated: x.userId !== ME }
                    : { ...x, status: 'rejected', reviewedAt: now, reviewerId, rejectReason: reason || 'Perlu diulang' },
            ),
            users: s.users.map((u) =>
              u.id === sub.userId ? { ...u, trust: approve ? Math.min(100, u.trust + 2) : Math.max(0, u.trust - 12) } : u,
            ),
            posts: [...posts, ...extra],
          })
          return { ok: true, value: true }
        },

        markCelebrated: (ids) =>
          setState((s) => ({ subs: s.subs.map((x) => (ids.includes(x.id) ? { ...x, celebrated: true } : x)) })),

        createQuest: (input, by) => {
          const s = getState()
          const by_ = s.users.find((u) => u.id === by)
          const group = s.groups.find((g) => g.leaderId === by && g.id === by_?.groupId)
          if (!group) return fail('Hanya Ketua RT yang bisa membuat quest.')
          const prob = questProblem(input, group)
          if (prob) return fail(prob)
          const id = uid('q')
          const quest: Quest = { ...input, id, code: `Q-${shortCode(id)}`, groupId: group.id, createdAt: Date.now(), createdBy: by, source: 'rt' }
          setState({
            quests: [...s.quests, quest],
            posts: [
              ...s.posts,
              { id: uid('m'), groupId: group.id, channel: 'quest', kind: 'quest', authorId: by, at: Date.now(), text: 'Quest baru dari pengurus RT.', questId: id },
            ],
          })
          return { ok: true, value: id }
        },

        closeQuest: (id) =>
          setState((s) => ({ quests: s.quests.map((q) => (q.id === id ? { ...q, closed: true, demo: undefined } : q)) })),

        saveTerritory: (groupId, ring) => {
          const s = getState()
          const prob = territoryProblem(ring, groupId, s.groups, s.quests)
          if (prob) return fail(prob)
          setState({ groups: s.groups.map((g) => (g.id === groupId ? { ...g, territory: ring } : g)) })
          return { ok: true, value: true }
        },

        redeem: (rewardId, userId) => {
          const s = getState()
          const reward = REWARDS.find((r) => r.id === rewardId)
          if (!reward) return null
          if (spendable(s, userId) < reward.cost) return null
          const red: Redemption = { id: uid('r'), rewardId, userId, code: `KMP-${shortCode(uid()).slice(0, 4)}`, at: Date.now() }
          setState({ redemptions: [...s.redemptions, red] })
          return red
        },

        fulfill: (id) =>
          setState((s) => ({ redemptions: s.redemptions.map((r) => (r.id === id ? { ...r, fulfilledAt: Date.now() } : r)) })),

        rollDemo: () => {
          const rolled = rollDemoQuests(getState().quests)
          if (rolled) setState({ quests: rolled })
        },

        reset: () => setState({ ...EMPTY }),
      }
    },
    {
      name: 'kompack-v2',
      version: 2,
      storage: createJSONStorage(() => storage),
      partialize: (s): Data => ({
        meId: s.meId,
        users: s.users,
        groups: s.groups,
        quests: s.quests,
        posts: s.posts,
        subs: s.subs,
        bonuses: s.bonuses,
        redemptions: s.redemptions,
        home: s.home,
        testMode: s.testMode,
        simPos: s.simPos,
      }),
    },
  ),
)

channel?.addEventListener('message', () => {
  void useStore.persist.rehydrate()
})

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated())
  useEffect(() => {
    const off = useStore.persist.onFinishHydration(() => setHydrated(true))
    setHydrated(useStore.persist.hasHydrated())
    return off
  }, [])
  return hydrated
}

/* ───────────── Sesi per jendela: warga (akunmu) atau akun demo Ketua RT ───────────── */

const SESSION_KEY = 'kompack-acting'
function readActing(): 'me' | 'rt' {
  try {
    return localStorage.getItem(SESSION_KEY) === 'rt' ? 'rt' : 'me'
  } catch {
    return 'me'
  }
}

export const useSession = create<{ acting: 'me' | 'rt'; setActing: (a: 'me' | 'rt') => void }>()((setState) => ({
  acting: readActing(),
  setActing: (acting) => {
    try {
      localStorage.setItem(SESSION_KEY, acting)
    } catch {
      /* abaikan */
    }
    setState({ acting })
  },
}))

/** Pengguna yang sedang aktif di jendela ini */
export function useMe(): Person | null {
  const acting = useSession((s) => s.acting)
  const users = useStore((s) => s.users)
  const meId = useStore((s) => s.meId)
  return useMemo(() => users.find((u) => u.id === (acting === 'rt' ? LEADER : meId)) ?? null, [users, acting, meId])
}

export function useIsRT(): boolean {
  return useMe()?.role === 'rt'
}

export function useMyGroup(): Group | undefined {
  const groups = useStore((s) => s.groups)
  return groups.find((g) => g.id === MY_GROUP)
}

/* ───────────── Hitungan poin ───────────── */

type Snap = Pick<Data, 'users' | 'subs' | 'redemptions' | 'bonuses' | 'quests' | 'groups'>

export const isYouth = (p: Person, year = new Date().getFullYear()) =>
  p.role === 'warga' && year - p.birthYear >= RULES.youthMin && year - p.birthYear <= RULES.youthMax

export function pointsOf(s: Snap, userId: string): number {
  const u = s.users.find((x) => x.id === userId)
  let p = u?.basePoints ?? 0
  for (const x of s.subs) if (x.userId === userId && x.status === 'approved') p += x.awarded ?? 0
  for (const b of s.bonuses) if (b.userId === userId) p += b.points
  return p
}

const WEEK = 7 * 86400000

export function weekPointsOf(s: Snap, userId: string, now = Date.now()): number {
  const u = s.users.find((x) => x.id === userId)
  let p = u?.baseWeek ?? 0
  for (const x of s.subs) if (x.userId === userId && x.status === 'approved' && (x.reviewedAt ?? 0) > now - WEEK) p += x.awarded ?? 0
  for (const b of s.bonuses) if (b.userId === userId && b.at > now - WEEK) p += b.points
  return p
}

export function questsDoneOf(s: Snap, userId: string): number {
  const u = s.users.find((x) => x.id === userId)
  return (u?.baseQuests ?? 0) + s.subs.filter((x) => x.userId === userId && x.status === 'approved').length
}

export function spendable(s: Snap, userId: string): number {
  let spent = 0
  for (const r of s.redemptions) if (r.userId === userId) spent += REWARDS.find((w) => w.id === r.rewardId)?.cost ?? 0
  return pointsOf(s, userId) - spent
}

export interface Standing {
  person: Person
  points: number
  quests: number
  place: number
}

export function standings(s: Snap, groupId: string, mode: 'week' | 'all', now = Date.now()): Standing[] {
  const rows = s.users
    .filter((u) => u.groupId === groupId && isYouth(u))
    .map((person) => ({
      person,
      points: mode === 'week' ? weekPointsOf(s, person.id, now) : pointsOf(s, person.id),
      quests: questsDoneOf(s, person.id),
      place: 0,
    }))
  rows.sort((a, b) => b.points - a.points || a.person.name.localeCompare(b.person.name))
  rows.forEach((r, i) => (r.place = i + 1))
  return rows
}

export function groupPoints(s: Snap, groupId: string): number {
  const g = s.groups.find((x) => x.id === groupId)
  return (g?.basePoints ?? 0) + s.users.filter((u) => u.groupId === groupId && isYouth(u)).reduce((t, u) => t + pointsOf(s, u.id), 0)
}

export function useSnap(): Snap {
  const users = useStore((s) => s.users)
  const subs = useStore((s) => s.subs)
  const redemptions = useStore((s) => s.redemptions)
  const bonuses = useStore((s) => s.bonuses)
  const quests = useStore((s) => s.quests)
  const groups = useStore((s) => s.groups)
  return useMemo(() => ({ users, subs, redemptions, bonuses, quests, groups }), [users, subs, redemptions, bonuses, quests, groups])
}

export function usePoints(userId: string | undefined) {
  const snap = useSnap()
  return useMemo(
    () =>
      userId
        ? { total: pointsOf(snap, userId), spendable: spendable(snap, userId), quests: questsDoneOf(snap, userId) }
        : { total: 0, spendable: 0, quests: 0 },
    [snap, userId],
  )
}

export function personById(users: Person[], id: string | undefined): Person | undefined {
  return users.find((u) => u.id === id)
}

export { distM }
