import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, MessageSquareText, TriangleAlert, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Compare } from '../../components/Compare'
import { EvidenceSummary } from '../../components/EvidenceSummary'
import { Avatar } from '../../components/art'
import { Button, Empty, Note, Page, Section, Sheet, TopBar, toast } from '../../components/ui'
import { REJECT_REASONS } from '../../lib/catalog'
import { fmtDist } from '../../lib/geo'
import { assessSubmission, riskOf, type EvidenceRef } from '../../lib/integrity'
import { personById, useMe, useStore } from '../../lib/store'
import type { Check as CheckT } from '../../lib/types'
import { RISK } from './Inbox'

export function ReviewSub() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const subs = useStore((s) => s.subs)
  const quests = useStore((s) => s.quests)
  const users = useStore((s) => s.users)
  const posts = useStore((s) => s.posts)
  const review = useStore((s) => s.review)
  const [checks, setChecks] = useState<CheckT[] | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState(REJECT_REASONS[0])
  const [custom, setCustom] = useState('')
  const [verdict, setVerdict] = useState<'ok' | 'no' | null>(null)
  const timer = useRef<number | null>(null)
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])

  const sub = subs.find((s) => s.id === id)
  const misi = sub && quests.find((q) => q.id === sub.questId)
  const who = sub && personById(users, sub.userId)

  // periksa ulang di sisi RT (termasuk segel bukti)
  useEffect(() => {
    setChecks(null)
    if (!sub || !misi || !who) return
    let alive = true
    const others: EvidenceRef[] = []
    for (const s of subs) {
      if (s.id === sub.id) continue
      const n = personById(users, s.userId)?.name ?? 'warga'
      if (s.before) others.push({ ref: s.id, label: `setoran ${n}`, ev: s.before })
      if (s.after) others.push({ ref: s.id, label: `setoran ${n}`, ev: s.after })
    }
    for (const p of posts) if (p.photo) others.push({ ref: p.id, label: `laporan ${personById(users, p.authorId)?.name ?? 'warga'}`, ev: p.photo })
    void assessSubmission(sub, misi, who, others).then((a) => alive && setChecks(a.checks))
    return () => {
      alive = false
    }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!sub || !misi || !who || !sub.before || !sub.after || !me) {
    return (
      <Page bare>
        <TopBar back="/rt/periksa" title="Setoran tidak ditemukan" />
        <Empty title="Tidak ada yang perlu dicek" text="Setoran ini mungkin sudah diproses." />
      </Page>
    )
  }

  const risk = checks ? RISK[riskOf(checks)] : null
  const open = sub.status === 'pending' && !verdict
  const self = sub.userId === me.id

  const decide = (approve: boolean) => {
    setRejecting(false)
    const r = review(sub.id, me.id, approve, approve ? undefined : custom.trim() || reason)
    if (!r.ok) {
      toast(r.error, 'warn')
      return
    }
    setVerdict(approve ? 'ok' : 'no')
    navigator.vibrate?.(approve ? [30, 40, 70] : 50)
    timer.current = window.setTimeout(() => {
      const next = useStore.getState().subs.find((s) => s.status === 'pending')
      setVerdict(null)
      nav(next ? `/rt/cek/${next.id}` : '/rt/periksa', { replace: true })
    }, 1200)
  }

  return (
    <Page bare>
      <TopBar back="/rt/periksa" title="Periksa setoran" />
      <Section className="review-workspace">
        <div className="review-visual">
          <h2 className="review-mission-title">{misi.title}</h2>
          <div className="review-compare-wrap">
            <Compare before={sub.before.img} after={sub.after.img} />
            <AnimatePresence>
              {verdict && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="review-verdict" role="status">
                  <motion.span initial={{ scale: 1.2, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: -4, opacity: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }}>
                    {verdict === 'ok' ? <Check size={28} aria-hidden="true" /> : <X size={28} aria-hidden="true" />}
                    {verdict === 'ok' ? 'Disetujui!' : 'Minta ulang'}
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <p className="review-compare-caption"><span>Geser untuk membandingkan.</span>{(sub.before.sample || sub.after.sample) && <span className="review-example-label">Gambar simulasi</span>}</p>
          <div className="review-mission-facts">
            <p>{misi.place}</p>
            <dl>
              <div><dt>Jarak check-in</dt><dd>{fmtDist(sub.checkin.dist)} <span>/ radius {misi.radius} m</span></dd></div>
              <div><dt>Waktu di foto</dt><dd>{Math.max(0, Math.round((sub.after.at - sub.before.at) / 60000))} menit <span>/ min. {misi.minMinutes} menit</span></dd></div>
            </dl>
          </div>
        </div>

        <div className="review-decision">
          <div className="review-person">
            <Avatar index={who.avatar} size={36} />
            <div className="review-person-info">
              <p>{who.name}</p>
              <p>Kepercayaan {who.trust}/100</p>
            </div>
            {risk && <span className={`review-risk ${risk.cls}`}>{riskOf(checks!) !== 'rendah' && <TriangleAlert size={13} aria-hidden="true" />}{risk.text}</span>}
          </div>

          {sub.note && (
            <p className="review-note">
              <MessageSquareText size={16} aria-hidden="true" /> <span>“{sub.note}”</span>
            </p>
          )}

          <EvidenceSummary checks={checks} simulated={sub.checkin.simulated} />

          {self ? (
            <Note tone="warn">Ini setoranmu sendiri. Kamu tidak bisa memeriksanya.</Note>
          ) : open ? (
            <div className="review-actions">
              <Button tone="soft" className="flex-1" onClick={() => setRejecting(true)}>
                <X size={18} /> Tolak
              </Button>
              <Button tone="primary" className="flex-[1.6]" disabled={!checks} onClick={() => decide(true)}>
                <Check size={18} strokeWidth={2.6} /> Setujui +{misi.points}
              </Button>
            </div>
          ) : (
            !verdict && <Note tone="info">Setoran ini sudah {sub.status === 'approved' ? 'disetujui' : 'ditolak'}.</Note>
          )}
        </div>
      </Section>

      <Sheet open={rejecting} onClose={() => setRejecting(false)} title="Kenapa ditolak?">
        <p className="mb-3 text-ink-2">{who.name} melihat alasan ini dan bisa mengulang. Skor kepercayaannya turun 12.</p>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Alasan">
          {REJECT_REASONS.map((r) => {
            const on = reason === r && !custom.trim()
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setReason(r)
                  setCustom('')
                }}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-left font-medium ${on ? 'bg-ink text-white' : 'bg-paper'}`}
              >
                <span className={`grid h-5 w-5 flex-none place-items-center rounded-full ${on ? 'bg-rompi' : 'bg-white ring-1 ring-line'}`}>{on && <Check size={12} strokeWidth={3.5} />}</span>
                {r}
              </button>
            )
          })}
        </div>
        <label className="label mt-4" htmlFor="rj">
          Atau tulis sendiri
        </label>
        <input id="rj" className="field" maxLength={80} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="mis. Masih ada sampah di pojok kiri" />
        <Button full className="mt-4" onClick={() => decide(false)}>
          Tolak & minta ulang
        </Button>
      </Sheet>
    </Page>
  )
}
