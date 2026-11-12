import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ClipboardCheck, Map, MessagesSquare, Plus, Trophy, UserRound, type LucideIcon } from 'lucide-react'
import { useChrome } from '../lib/chrome'
import { useIsRT, useMe, useMyGroup, useStore } from '../lib/store'
import { Avatar, Logo } from './art'

interface Item {
  to: string
  label: string
  icon: LucideIcon
  badge?: number
  end?: boolean
}

function useItems(): { items: Item[]; action: { to: string; label: string } } {
  const rt = useIsRT()
  const me = useMe()
  const subs = useStore((s) => s.subs)
  const posts = useStore((s) => s.posts)
  if (rt) {
    const waiting = subs.filter((s) => s.status === 'pending').length + posts.filter((p) => p.status === 'menunggu').length
    return {
      items: [
        { to: '/', label: 'Peta', icon: Map, end: true },
        { to: '/grup', label: 'Pos', icon: MessagesSquare },
        { to: '/rt/periksa', label: 'Periksa', icon: ClipboardCheck, badge: waiting },
        { to: '/aku', label: 'Aku', icon: UserRound },
      ],
      action: { to: '/rt/misi-baru', label: 'Misi' },
    }
  }
  const todo = subs.filter((s) => s.userId === me?.id && (s.status === 'checked_in' || s.status === 'rejected')).length
  return {
    items: [
      { to: '/', label: 'Peta', icon: Map, end: true },
      { to: '/grup', label: 'Pos', icon: MessagesSquare },
      { to: '/peringkat', label: 'Klasemen', icon: Trophy },
      { to: '/aku', label: 'Aku', icon: UserRound, badge: todo },
    ],
    action: { to: '/lapor', label: 'Lapor' },
  }
}

/** halaman alur penuh: tanpa navigasi bawah di ponsel */
const FULL = ['/misi/', '/lapor', '/rt/misi-baru', '/rt/cek/', '/rt/laporan/', '/rt/wilayah']

export function Shell({ children }: { children: ReactNode }) {
  const { items, action } = useItems()
  const { pathname } = useLocation()
  const nav = useNavigate()
  const me = useMe()
  const group = useMyGroup()
  const rt = useIsRT()
  const immersive = useChrome((s) => s.immersive)
  const hideBar = immersive || FULL.some((p) => pathname.startsWith(p))
  const half = Math.ceil(items.length / 2)

  const tab = (it: Item) => (
    <NavLink key={it.to} to={it.to} end={it.end} className="dock-tab relative flex min-w-0 flex-1 flex-col items-center gap-1 pb-1 pt-2">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="tab-ind" className="absolute top-1.5 h-8 w-11 rounded-xl bg-surface" transition={{ duration: 0.18 }} />
          )}
          <span className="relative">
            <it.icon size={21} strokeWidth={isActive ? 2.2 : 1.7} className={isActive ? 'text-ink' : 'text-ink-3'} />
            {!!it.badge && (
              <span className="mono tnum absolute -right-2.5 -top-1 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-rompi px-1 text-[0.8rem] font-semibold leading-none text-white ring-2 ring-white">
                {it.badge}
              </span>
            )}
          </span>
          <span className={`relative mt-1 text-[0.8rem] leading-tight ${isActive ? 'font-semibold text-ink' : 'font-medium text-ink-3'}`}>{it.label}</span>
        </>
      )}
    </NavLink>
  )

  return (
    <div className="app-frame flex h-full w-full bg-paper">
      {/* rel kiri — layar lebar */}
      <aside className="app-rail hidden w-[208px] flex-none flex-col bg-card lg:flex">
        <div className="px-6 pb-6 pt-8">
          <button type="button" aria-label="Kompack, ke peta" onClick={() => nav('/')}><Logo size={31} /></button>
          <div className="mt-4">
            <span className="text-[0.9rem] text-ink-3">
              {group?.name ?? 'RT'}, {group?.rw}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => nav(action.to)}
          className="btn btn--primary mx-4 mb-6"
        >
          <Plus size={18} strokeWidth={2.2} /> {rt ? 'Buat misi' : 'Buat laporan'}
        </button>
        <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Navigasi utama">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} className="rail-link relative flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[1rem] font-semibold">
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="rail-ind" className="absolute inset-0 rounded-2xl bg-ink" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
                  <it.icon size={21} strokeWidth={isActive ? 2.4 : 1.9} className={`relative ${isActive ? 'text-inverse' : 'text-ink-3'}`} />
                  <span className={`relative flex-1 ${isActive ? 'text-inverse' : 'text-ink-2'}`}>{it.label}</span>
                  {!!it.badge && (
                    <span className={`tnum relative grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[0.8rem] font-semibold ${isActive ? 'bg-inverse text-ink' : 'bg-surface text-ink'}`}>{it.badge}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        {me && (
          <button type="button" onClick={() => nav('/aku')} className="m-3 flex items-center gap-2.5 rounded-xl p-2 text-left hover:bg-paper">
            <Avatar index={me.avatar} size={34} />
            <span className="min-w-0">
              <span className="block truncate text-[0.9rem] font-semibold">{me.name}</span>
              <span className="block truncate text-[0.8rem] text-ink-3">{me.title ?? 'Warga'}</span>
            </span>
          </button>
        )}
      </aside>

      <div className="relative min-w-0 flex-1">
        {children}

        {/* navigasi bawah — ponsel */}
        {!hideBar && (
          <nav
            aria-label="Navigasi utama"
            className="app-dock absolute inset-x-0 bottom-0 z-[900] bg-card lg:hidden"
            style={{ paddingBottom: 'var(--safe-b)' }}
          >
            <div className="mx-auto flex h-[var(--nav-h)] max-w-[520px] items-stretch px-2">
              {items.slice(0, half).map(tab)}
              <div className="flex flex-1 items-center justify-center">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  onClick={() => nav(action.to)}
                  className="btn btn--primary !h-[48px] !min-h-[48px] !w-[48px] flex-col !gap-0 !rounded-[14px] !p-0"
                  aria-label={rt ? 'Buat misi' : 'Lapor atau minta tolong'}
                >
                  <Plus size={22} strokeWidth={2.8} />
                  <span className="text-[0.8rem] font-bold">{action.label}</span>
                </motion.button>
              </div>
              {items.slice(half).map(tab)}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}
