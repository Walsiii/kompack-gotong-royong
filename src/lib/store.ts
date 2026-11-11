import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import { del, get, set } from 'idb-keyval'
import { LEADER, MY_GROUP } from './seed'
import type { Person, Group } from './types'
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

import { createWorldActions, type Data, type Actions, type Snap, pointsOf, spendable, questsDoneOf } from './world'
import { liveAction, useLive } from './live'
export * from './world'
export type StoreActions = { [K in keyof Actions]: (...args: Parameters<Actions[K]>) => ReturnType<Actions[K]> | Promise<Awaited<ReturnType<Actions[K]>>> }

export const useStore = create<Data & StoreActions>()(
  persist(
    (setState, getState) => {
      const local = createWorldActions(setState, getState)
      const actions = Object.fromEntries(Object.entries(local).map(([name, action]) => [name,
        typeof action === 'function' ? (...args: unknown[]) => liveAction(name, args, () => (action as (...input: unknown[]) => unknown)(...args), getState, setState) : action,
      ]))
      return actions as unknown as Data & StoreActions
    },
    {
      name: 'kompack-v3',
      version: 3,
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
  const canRT = useLive(s => s.canRT)
  const users = useStore((s) => s.users)
  const meId = useStore((s) => s.meId)
  return useMemo(() => users.find((u) => u.id === (acting === 'rt' && canRT ? LEADER : meId)) ?? null, [users, acting, meId, canRT])
}

export function useIsRT(): boolean {
  return useMe()?.role === 'rt'
}

export function useMyGroup(): Group | undefined {
  const groups = useStore((s) => s.groups)
  return groups.find((g) => g.id === MY_GROUP)
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
