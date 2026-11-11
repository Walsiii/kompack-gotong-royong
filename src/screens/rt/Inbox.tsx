import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronRight, Eye } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../components/art'
import { Empty, Page, Section, Segmented, TopBar } from '../../components/ui'
import { riskOf } from '../../lib/integrity'
import { personById, useStore } from '../../lib/store'
import { fmtAgo, useNow } from '../../lib/time'

export const RISK = {
  rendah: { text: 'Aman', cls: 'bg-[#E1EEE6] text-plang-2' },
  sedang: { text: 'Perlu dicek', cls: 'bg-[#FBF0D9] text-[#7A5200]' },
  tinggi: { text: 'Risiko tinggi', cls: 'bg-[#F6E0DC] text-bad' },
}

export function Inbox() {
  const nav = useNavigate()
  const now = useNow(30000)
  const subs = useStore((s) => s.subs)
  const posts = useStore((s) => s.posts)
  const quests = useStore((s) => s.quests)
  const users = useStore((s) => s.users)
  const [tab, setTab] = useState<'setoran' | 'laporan'>('setoran')

  const pending = useMemo(() => subs.filter((s) => s.status === 'pending').sort((a, b) => (a.submittedAt ?? 0) - (b.submittedAt ?? 0)), [subs])
  const reports = useMemo(() => posts.filter((p) => p.status === 'menunggu').sort((a, b) => (b.witnesses?.length ?? 0) - (a.witnesses?.length ?? 0) || a.at - b.at), [posts])

  return (
    <Page>
      <TopBar title="Periksa" sub="Setoran misi dan laporan warga yang menunggu keputusanmu" />
      <Section className="flex flex-col gap-4">
        <Segmented
          id="inbox"
          value={tab}
          onChange={setTab}
          className="w-full max-w-[420px]"
          options={[
            { value: 'setoran', label: `Setoran · ${pending.length}` },
            { value: 'laporan', label: `Laporan · ${reports.length}` },
          ]}
        />
        {tab === 'setoran' ? (
          pending.length === 0 ? (
            <Empty title="Semua setoran sudah dicek" text="Setoran baru dari warga muncul di sini." />
          ) : (
            <div className="panel divide-y divide-line">
              {pending.map((s, i) => {
                const q = quests.find((x) => x.id === s.questId)
                const w = personById(users, s.userId)
                const risk = RISK[riskOf(s.checks ?? [])]
                return (
                  <motion.button
                    key={s.id}
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => nav(`/rt/cek/${s.id}`)}
                    className="flex w-full items-center gap-3 p-3.5 text-left"
                  >
                    <div className="flex flex-none">
                      {s.before && <img src={s.before.img} alt="" className="h-12 w-12 rounded-xl object-cover" />}
                      {s.after && <img src={s.after.img} alt="" className="-ml-4 h-12 w-12 rounded-xl object-cover ring-2 ring-white" />}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{w?.name} · {q?.title}</span>
                      <span className="block text-[0.86rem] text-ink-3">Dikirim {fmtAgo(s.submittedAt ?? s.checkin.at, now)} · +{q?.points} poin</span>
                    </span>
                    <span className={`flex-none rounded-full px-2.5 py-1 text-[0.8rem] font-semibold ${risk.cls}`}>{risk.text}</span>
                    <ChevronRight size={16} className="flex-none text-ink-3" />
                  </motion.button>
                )
              })}
            </div>
          )
        ) : reports.length === 0 ? (
          <Empty title="Tidak ada laporan menunggu" text="Laporan dan permintaan tolong warga muncul di sini." />
        ) : (
          <div className="panel divide-y divide-line">
            {reports.map((p, i) => {
              const w = personById(users, p.authorId)
              return (
                <motion.button
                  key={p.id}
                  type="button"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => nav(`/rt/laporan/${p.id}`)}
                  className="flex w-full items-center gap-3 p-3.5 text-left"
                >
                  {p.photo ? <img src={p.photo.img} alt="" className="h-12 w-12 flex-none rounded-xl object-cover" /> : <Avatar index={w?.avatar ?? 0} size={48} />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.text}</span>
                    <span className="block text-[0.86rem] text-ink-3">
                      {p.kind === 'tolong' ? 'Minta tolong' : 'Laporan'} · {w?.name} · {fmtAgo(p.at, now)}
                    </span>
                  </span>
                  <span className="mono flex flex-none items-center gap-1 text-[0.86rem] text-ink-2">
                    <Eye size={14} /> {p.witnesses?.length ?? 0}
                  </span>
                  <ChevronRight size={16} className="flex-none text-ink-3" />
                </motion.button>
              )
            })}
          </div>
        )}
      </Section>
    </Page>
  )
}
