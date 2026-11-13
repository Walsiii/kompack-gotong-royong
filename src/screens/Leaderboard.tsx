import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { TrendingUp } from 'lucide-react'
import { Avatar } from '../components/art'
import { RollingNumber, Page, Section, Segmented, TopBar } from '../components/ui'
import { rankOf } from '../lib/catalog'
import { groupPoints, pointsOf, standings, useMe, useMyGroup, useSnap } from '../lib/store'
import { useNow } from '../lib/time'
import type { Ring } from '../lib/types'

/** siluet wilayah RT kecil */
function Shape({ ring, active }: { ring: Ring; active: boolean }) {
  if (ring.length < 3) return null
  const xs = ring.map((p) => p.lng)
  const ys = ring.map((p) => p.lat)
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const s = 40 / Math.max(x1 - x0, y1 - y0)
  const d = ring.map((p, i) => `${i ? 'L' : 'M'}${((p.lng - x0) * s + 2).toFixed(1)} ${((y1 - p.lat) * s + 2).toFixed(1)}`).join(' ') + 'Z'
  return (
    <svg viewBox="0 0 44 44" width="44" height="44" className="flex-none" aria-hidden="true">
      <path d={d} fill={active ? 'var(--color-accent-soft)' : 'var(--color-surface)'} stroke={active ? 'var(--color-ink-3)' : 'var(--color-line)'} strokeWidth="1.6" strokeDasharray="3 2" strokeLinejoin="round" />
    </svg>
  )
}

type Row = { person: { id: string; name: string; avatar: number }; points: number; place: number }

/** podium juara 1–3: siapa di atas langsung terlihat */
function Podium({ rows, meId }: { rows: Row[]; meId?: string }) {
  if (rows.length < 3) return null
  const order = [rows[1], rows[0], rows[2]]
  const H = [92, 124, 72]
  const C = ['#d9d9d9', '#ffc23d', '#e0a679']
  return (
    <div className="podium" aria-label="Tiga teratas">
      {order.map((r, i) => (
        <div key={r.person.id} className={`podium-col ${r.person.id === meId ? 'is-me' : ''}`}>
          <motion.div className="podium-face" initial={{ y: 30, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.35 + [1, 0, 2][i] * 0.15 }}>
            {i === 1 && <span className="podium-crown" aria-hidden="true">👑</span>}
            <Avatar index={r.person.avatar} size={i === 1 ? 68 : 56} />
          </motion.div>
          <p className="podium-name">{r.person.id === meId ? 'Kamu' : r.person.name}</p>
          <p className="podium-pts tnum">{r.points}</p>
          <motion.div className="podium-block" style={{ height: H[i], background: C[i] }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ type: 'spring', stiffness: 120, damping: 16, delay: [1, 0, 2][i] * 0.12 }}>
            <b>{r.place}</b>
          </motion.div>
        </div>
      ))}
    </div>
  )
}

export function Leaderboard() {
  const snap = useSnap()
  const now = useNow(60000)
  const me = useMe()
  const group = useMyGroup()
  const [view, setView] = useState<'rt' | 'antar'>('rt')
  const [mode, setMode] = useState<'week' | 'all'>('week')

  const rows = useMemo(() => (group ? standings(snap, group.id, mode, now) : []), [snap, group, mode, now])
  const max = Math.max(1, ...rows.map((r) => r.points))
  const mine = rows.find((r) => r.person.id === me?.id)
  const ahead = mine && mine.place > 1 ? rows[mine.place - 2] : null

  const rts = useMemo(
    () =>
      snap.groups
        .filter((g) => g.kind === 'rt')
        .map((g) => ({ g, points: groupPoints(snap, g.id) }))
        .sort((a, b) => b.points - a.points),
    [snap],
  )
  const rtMax = Math.max(1, ...rts.map((r) => r.points))

  return (
    <Page>
      <TopBar title="Klasemen" sub="Warga muda 13–25 tahun" />
      <Section className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <Segmented
            id="lbv"
            value={view}
            onChange={setView}
            options={[
              { value: 'rt', label: `Warga ${group?.name ?? ''}` },
              { value: 'antar', label: 'Antar RT' },
            ]}
          />
          {view === 'rt' && (
            <Segmented
              id="lbm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'week', label: 'Minggu ini' },
                { value: 'all', label: 'Total' },
              ]}
            />
          )}
        </div>

        {view === 'rt' ? (
          <>
            {mine && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 overflow-hidden rounded-[22px] bg-ink p-4 text-white">
                <div>
                  <p className="mono text-[0.8rem] text-inverse">Posisimu</p>
                  <p className="font-display wd-wide text-[2.6rem] font-bold leading-none">
                    #<RollingNumber value={mine.place} />
                  </p>
                </div>
                <div className="min-w-0 flex-1 border-l border-white/15 pl-4">
                  <p className="font-semibold">dari {rows.length}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[0.9rem] text-white/80">
                    <TrendingUp size={15} className="flex-none text-inverse" />
                    {ahead ? <>+{ahead.points - mine.points + 1} salip <Avatar index={ahead.person.avatar} size={22} /> {ahead.person.name}</> : 'Juara! 👑'}
                  </p>
                </div>
              </motion.div>
            )}

            <Podium rows={rows.slice(0, 3)} meId={me?.id} />

            <ol className="panel flex flex-col p-2">
              {rows.slice(3).map((r, i) => {
                const isMe = r.person.id === me?.id
                return (
                  <motion.li
                    key={r.person.id}
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 12) * 0.03 }}
                    className={`grid grid-cols-[28px_36px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl px-2.5 py-2.5 ${isMe ? 'bg-surface' : ''}`}
                  >
                    <span className={`mono tnum text-center text-[0.9rem] font-semibold ${r.place <= 3 ? 'text-rompi' : 'text-ink-3'}`}>{r.place}</span>
                    <Avatar index={r.person.avatar} size={36} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold leading-tight">
                        {r.person.name}
                        {isMe && <span className="ml-1.5 text-[0.8rem] font-medium text-rompi">kamu</span>}
                      </p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                        <motion.div
                          className={`h-full w-full origin-left rounded-full ${isMe ? 'bg-rompi' : 'bg-plang'}`}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: r.points / max }}
                          transition={{ type: 'spring', stiffness: 70, damping: 16, delay: 0.1 + Math.min(i, 12) * 0.03 }}
                        />
                      </div>
                      <p className="mt-1 truncate text-[0.8rem] text-ink-3">
                        {rankOf(pointsOf(snap, r.person.id)).name} / {r.quests} misi
                      </p>
                    </div>
                    <span className="font-display wd-wide tnum text-right text-[1.1rem] font-bold">{r.points}</span>
                  </motion.li>
                )
              })}
            </ol>
          </>
        ) : (
          <>
            <div className="reflect-stripes overflow-hidden rounded-[22px] p-[3px]" style={{ animation: 'kp-sweep 6s linear infinite' }}>
              <div className="rounded-[19px] bg-white p-4">
                <p className="flex items-center gap-3">
                  <span className="text-[2.2rem] leading-none" aria-hidden="true">🏆</span>
                  <span>
                    <span className="meta-label block">Juara {group?.rw} bulan ini</span>
                    <span className="font-display text-[1.5rem] font-bold leading-tight">Rp500.000</span>
                  </span>
                </p>
              </div>
            </div>
            <ol className="panel flex flex-col gap-1 p-2">
              {rts.map((r, i) => {
                const mineRt = r.g.id === group?.id
                return (
                  <motion.li
                    key={r.g.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${mineRt ? 'bg-surface' : ''}`}
                  >
                    <span className={`mono w-5 text-center font-semibold ${i === 0 ? 'text-rompi' : 'text-ink-3'}`}>{i + 1}</span>
                    <Shape ring={r.g.territory} active={mineRt} />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[1.1rem] font-bold leading-tight">
                        {r.g.name} {mineRt && <span className="text-[0.8rem] font-medium text-rompi">RT-mu</span>}
                      </p>
                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                        <motion.div
                          className={`h-full w-full origin-left rounded-full ${mineRt ? 'bg-rompi' : 'bg-plang'}`}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: r.points / rtMax }}
                          transition={{ type: 'spring', stiffness: 60, damping: 16, delay: 0.2 + i * 0.08 }}
                        />
                      </div>
                    </div>
                    <span className="font-display wd-wide tnum text-[1.2rem] font-bold">
                      <RollingNumber value={r.points} />
                    </span>
                  </motion.li>
                )
              })}
            </ol>
          </>
        )}
      </Section>
    </Page>
  )
}
