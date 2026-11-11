import { create } from 'zustand'
import { createWorldActions, EMPTY, type Data } from './world'
import { uid } from './seed'
import { set as saveBackup } from 'idb-keyval'

export const WORLD_KEYS = ['users', 'groups', 'quests', 'posts', 'subs', 'bonuses', 'redemptions'] as const
export const useLive = create<{ ready: boolean; mode: 'checking' | 'local' | 'server'; connected: boolean; canRT: boolean; error: string | null }>()(() => ({ ready: false, mode: 'checking', connected: false, canRT: true, error: null }))
type Store = { getState: () => Data; setState: (value: Partial<Data>) => void }
let store: Store | null = null
let events: EventSource | null = null
let revision = -1
let init: Promise<void> | null = null
const pending = new Map<string, Promise<unknown>>()

async function request(path: string, body?: unknown) {
  const response = await fetch(`/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000), cache: 'no-store' })
  if (!response.ok) throw new Error(response.status === 401 ? 'Sesi server berakhir. Muat ulang aplikasi.' : 'Server lokal belum terhubung. Jalankan Kompack di PC lalu coba lagi.')
  return response.json()
}

function apply(snapshot: { revision: number; world: Partial<Data>; meId?: string; home?: Data['home']; canRT?: boolean }) {
  if (!store || snapshot.revision < revision) return
  revision = snapshot.revision
  const shared = Object.fromEntries(WORLD_KEYS.map(k => [k, snapshot.world[k] ?? []]))
  store.setState({ ...shared, ...(snapshot.meId ? { meId: snapshot.meId, home: snapshot.home } : {}) })
  useLive.setState({ connected: true, error: null, ...(snapshot.canRT === undefined ? {} : { canRT: snapshot.canRT }) })
}

function listen() {
  events?.close()
  events = new EventSource('/api/events')
  events.onmessage = () => { void request('state').then(apply).catch(() => useLive.setState({ connected: false })) }
  events.onopen = () => { void request('state').then(apply).catch(() => useLive.setState({ connected: false })) }
  events.onerror = () => useLive.setState({ connected: false })
}

export function connectLive(next: Store): Promise<void> {
  store = next
  return init ??= (async () => {
    try {
      const response = await fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(5000) })
      if (!response.ok || !(response.headers.get('content-type') ?? '').includes('application/json')) {
        if (localStorage.getItem('kompack-server-origin')) throw new Error('Server lokal belum terhubung.')
        useLive.setState({ mode: 'local', ready: true }); return
      }
      const config = await response.json()
      if (config.service !== 'kompack-local') { useLive.setState({ mode: 'local', ready: true }); return }
      localStorage.setItem('kompack-server-origin', 'yes')
      useLive.setState({ mode: 'server', canRT: false })
      const session = await request('session')
      if (session.meId) { apply(session); listen() }
      else {
        // Preserve an existing standalone profile before explicitly joining this server.
        const old = next.getState()
        if (old.meId) {
          await saveBackup(`kompack-offline-backup-${Date.now()}`, JSON.stringify(old))
          next.setState({ meId: null })
        }
      }
    } catch { useLive.setState({ mode: 'server', connected: false, error: 'Server lokal belum terhubung.' }) }
    finally { useLive.setState({ ready: true }) }
  })()
}

const PRIVATE = new Set(['setTestMode', 'setSimPos'])
export function liveAction(name: string, args: unknown[], local: () => unknown, get: () => Data, set: (value: Partial<Data>) => void): unknown {
  if (useLive.getState().mode !== 'server' || PRIVATE.has(name)) return local()
  if (name === 'reset') return request('logout', {}).then(() => { events?.close(); revision = -1; return local() })
  if (name === 'register') return (async () => {
    let seed = { ...EMPTY }
    const temporary = createWorldActions(update => { seed = { ...seed, ...(typeof update === 'function' ? update(seed) : update) } }, () => seed)
    await temporary.register(args[0] as Parameters<typeof temporary.register>[0])
    const snapshot = await request('register', { profile: args[0], seed: Object.fromEntries(WORLD_KEYS.map(k => [k, seed[k]])) })
    set({ testMode: seed.testMode, simPos: snapshot.home })
    apply(snapshot); listen()
  })()
  const actingRT = localStorage.getItem('kompack-acting') === 'rt'
  const key = JSON.stringify([name, args, actingRT])
  const running = pending.get(key)
  if (running) return running
  const operation = request('command', { id: uid('cmd'), action: name, args, actingRT, userId: get().meId })
    .then(snapshot => { apply(snapshot); if (snapshot.result?.ok === false) useLive.setState({ error: snapshot.result.error }); return snapshot.result })
    .catch(() => {
      const error = 'Server lokal terputus. Perubahan belum tersimpan; sambungkan lalu coba lagi.'
      useLive.setState({ connected: false, error })
      return name === 'redeem' ? null : { ok: false, error }
    })
    .finally(() => pending.delete(key))
  pending.set(key, operation)
  return operation
}
