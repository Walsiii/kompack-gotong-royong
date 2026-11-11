import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, MessageSquareText, ShieldCheck, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Compare } from '../../components/Compare'
import { Avatar } from '../../components/art'
import { Button, CheckList, Empty, Note, Page, Section, Sheet, TopBar, toast } from '../../components/ui'
import { REJECT_REASONS } from '../../lib/catalog'
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
      <TopBar back="/rt/periksa" title="Periksa setoran" sub={misi.title} />
      <Section className="grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div className="relative">
          <Compare before={sub.before.img} after={sub.after.img} />
          <p className="mt-2 text-center text-[0.8rem] text-ink-3">Geser pegangan untuk membandingkan sebelum dan sesudah.</p>
          <AnimatePresence>
            {verdict && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bottom-7 grid place-items-center rounded-[20px] bg-white/70">
                <motion.div
                  initial={{ scale: 2.4, rotate: -16, opacity: 0 }}
                  animate={{ scale: 1, rotate: -6, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 18 }}
                  className={`plang !px-5 !py-3 text-[1.8rem] ${verdict === 'no' ? '!bg-bad' : ''}`}
                  style={verdict === 'no' ? { boxShadow: 'inset 0 0 0 2px #D23A2A, inset 0 0 0 3.5px #fff' } : undefined}
                >
                  {verdict === 'ok' ? 'DISETUJUI' : 'DITOLAK'}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar index={who.avatar} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[1.25rem] font-bold leading-tight">{who.name}</p>
              <p className="text-[0.86rem] text-ink-2">{new Date().getFullYear() - who.birthYear} tahun · kepercayaan {who.trust}/100</p>
            </div>
            {risk && <span className={`rounded-full px-3 py-1.5 text-[0.86rem] font-semibold ${risk.cls}`}>{risk.text}</span>}
          </div>

          {sub.note && (
            <p className="flex items-start gap-2 rounded-xl bg-white p-3 text-[0.9rem] italic shadow-float">
              <MessageSquareText size={16} className="mt-0.5 flex-none text-ink-3" /> “{sub.note}”
            </p>
          )}

          <div className="panel p-4">
            <p className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck size={17} className="text-plang" /> Pemeriksaan anti-curang
            </p>
            <div className="mt-3">{checks ? <CheckList checks={checks} /> : <p className="text-ink-2">Memeriksa bukti…</p>}</div>
          </div>

          {self ? (
            <Note tone="warn">Ini setoranmu sendiri. Kamu tidak bisa memeriksanya.</Note>
          ) : open ? (
            <div className="flex gap-3">
              <Button tone="soft" className="flex-1" onClick={() => setRejecting(true)}>
                <X size={18} /> Tolak
              </Button>
              <Button tone="plang" className="flex-[1.6]" onClick={() => decide(true)}>
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
