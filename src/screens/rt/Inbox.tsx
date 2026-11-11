import { useMemo, useState } from 'react'
import { ChevronRight, Eye, TriangleAlert } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../../components/art'
import { Empty, Page, Section, Segmented, TopBar } from '../../components/ui'
import { riskOf } from '../../lib/integrity'
import { personById, useStore } from '../../lib/store'
import { fmtAgo, useNow } from '../../lib/time'
import '../../components/evidence.css'

export const RISK = {
  rendah: { text: 'Tanpa catatan', cls: 'review-risk--low' },
  sedang: { text: 'Perlu dicek', cls: 'review-risk--medium' },
  tinggi: { text: 'Risiko tinggi', cls: 'review-risk--high' },
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
      <TopBar title="Periksa" />
      <Section className="review-inbox">
        <div className="review-inbox-intro">
          <div><h2>Menunggu diperiksa</h2></div>
          <span className="review-queue-count" aria-label={`${pending.length + reports.length} menunggu diperiksa`}>{pending.length + reports.length}</span>
        </div>
        <Segmented
          id="inbox"
          value={tab}
          onChange={setTab}
          className="w-full max-w-[420px]"
          options={[
            { value: 'setoran', label: `Setoran (${pending.length})` },
            { value: 'laporan', label: `Laporan (${reports.length})` },
          ]}
        />
        {tab === 'setoran' ? (
          pending.length === 0 ? (
            <Empty title="Semua setoran sudah dicek" text="Setoran baru dari warga muncul di sini." />
          ) : (
            <div className="review-queue">
              {pending.map((s) => {
                const q = quests.find((x) => x.id === s.questId)
                const w = personById(users, s.userId)
                const risk = RISK[riskOf(s.checks ?? [])]
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => nav(`/rt/cek/${s.id}`)}
                    className="review-queue-item"
                  >
                    <span className="review-queue-photos">
                      {s.before && <img src={s.before.img} alt="Foto sebelum" width={100} height={100} />}
                      {s.after && <img src={s.after.img} alt="Foto sesudah" width={100} height={100} />}
                    </span>
                    <span className="review-queue-copy">
                      <span className="review-queue-name">{w?.name}</span>
                      <span className="review-queue-title">{q?.title}</span>
                      <span className="review-queue-meta"><span>{fmtAgo(s.submittedAt ?? s.checkin.at, now)}</span><span className="review-queue-reward">+{q?.points} poin</span></span>
                      <span className={`review-risk ${risk.cls}`}>{riskOf(s.checks ?? []) !== 'rendah' && <TriangleAlert size={13} aria-hidden="true" />}{risk.text}</span>
                    </span>
                    <ChevronRight size={22} className="review-queue-next" aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          )
        ) : reports.length === 0 ? (
          <Empty title="Tidak ada laporan menunggu" text="Laporan dan permintaan tolong warga muncul di sini." />
        ) : (
          <div className="review-queue">
            {reports.map((p) => {
              const w = personById(users, p.authorId)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => nav(`/rt/laporan/${p.id}`)}
                  className="review-queue-item"
                >
                  {p.photo ? <img src={p.photo.img} alt="Foto laporan warga" width={100} height={100} className="review-queue-photo" /> : <Avatar index={w?.avatar ?? 0} size={48} />}
                  <span className="review-queue-copy">
                    <span className="review-queue-name">{w?.name}</span>
                    <span className="review-queue-title">{p.text}</span>
                    <span className="review-queue-meta"><span>{p.kind === 'tolong' ? 'Minta tolong' : 'Laporan'}</span><span>{fmtAgo(p.at, now)}</span></span>
                    <span className="review-queue-meta"><Eye size={15} aria-hidden="true" />{p.witnesses?.length ?? 0} warga juga lihat</span>
                  </span>
                  <ChevronRight size={22} className="review-queue-next" aria-hidden="true" />
                </button>
              )
            })}
          </div>
        )}
      </Section>
    </Page>
  )
}
