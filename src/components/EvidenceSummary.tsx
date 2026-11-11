import { Camera, Check, ChevronDown, Clock3, MapPin, ShieldCheck, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import type { Check as EvidenceCheck, CheckStatus } from '../lib/types'
import './evidence.css'

const GROUPS: { title: string; icon: LucideIcon; ids: string[] }[] = [
  { title: 'Lokasi', icon: MapPin, ids: ['lokasi', 'gps', 'foto-lokasi'] },
  { title: 'Waktu', icon: Clock3, ids: ['durasi'] },
  { title: 'Foto', icon: Camera, ids: ['perubahan', 'foto-baru', 'kamera'] },
  { title: 'Keutuhan', icon: ShieldCheck, ids: ['segel', 'kepercayaan'] },
]

function statusOf(checks: EvidenceCheck[]): CheckStatus {
  return checks.some((c) => c.status === 'bad') ? 'bad' : checks.some((c) => c.status === 'warn' || /tidak diperiksa/i.test(c.detail)) ? 'warn' : 'ok'
}

function CheckMark({ status }: { status: CheckStatus }) {
  const Icon = status === 'ok' ? Check : status === 'bad' ? X : TriangleAlert
  return <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
}

function shortNote(check: EvidenceCheck): string {
  if (check.status === 'bad') return check.detail
  if (check.id === 'kamera' && /contoh|uji/i.test(check.detail)) return 'Foto simulasi, bukan hasil kamera.'
  if (check.id === 'lokasi' && /disimulasikan/i.test(check.detail)) return 'Check-in memakai lokasi simulasi.'
  if (check.id === 'durasi' && /dilewati/i.test(check.detail)) return 'Waktu kerja dilewati di mode uji.'
  return check.detail
}

/** A concise view of the existing checks; the original evidence never disappears. */
export function EvidenceSummary({ checks, simulated = false }: { checks: EvidenceCheck[] | null; simulated?: boolean }) {
  const concerns = checks?.filter((c) => c.status !== 'ok') ?? []
  const bad = concerns.filter((c) => c.status === 'bad')
  const gpsUnchecked = checks?.some((c) => c.id === 'gps' && /tidak diperiksa/i.test(c.detail))

  return (
    <section className="evidence-summary" aria-label="Pemeriksaan bukti" aria-busy={!checks}>
      <div className="evidence-summary-heading">
        <h2>Cek bukti</h2>
        <span>{checks ? `${checks.length} pemeriksaan` : 'Memeriksa…'}</span>
      </div>

      {!checks ? (
        <div className="evidence-loading" role="status">
          <span className="evidence-loading-line" /><span className="evidence-loading-line" />
          <p>Memeriksa foto, lokasi, dan segel…</p>
        </div>
      ) : (
        <>
          {simulated && <p className="evidence-test"><TriangleAlert size={16} aria-hidden="true" /><span>{gpsUnchecked ? 'Lokasi simulasi; GPS tidak diperiksa.' : 'Lokasi check-in disimulasikan.'}</span></p>}
          <div className="evidence-groups">
            {GROUPS.map(({ title, icon: Icon, ids }) => {
              const items = checks.filter((c) => ids.includes(c.id))
              if (!items.length) return null
              const status = statusOf(items)
              const isTest = simulated && title === 'Lokasi'
              return (
                <div className={`evidence-group evidence-group--${status}`} key={title}>
                  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                  <div><h3>{title}</h3><p>{status === 'bad' ? 'Bermasalah' : isTest ? 'Simulasi' : status === 'ok' ? 'Sesuai' : 'Perlu dicek'}</p></div>
                  <span className="evidence-group-status"><CheckMark status={status === 'bad' ? 'bad' : isTest ? 'warn' : status} /></span>
                </div>
              )
            })}
          </div>

          {concerns.length > 0 && (
            <div className={`evidence-concerns ${bad.length ? 'has-problem' : ''}`}>
              <ul>{concerns.map((c) => <li key={c.id}><TriangleAlert size={15} aria-hidden="true" /><span>{shortNote(c)}</span></li>)}</ul>
            </div>
          )}

          <details className="evidence-details">
            <summary>Detail pemeriksaan <ChevronDown size={16} aria-hidden="true" /></summary>
            <ul>
              {checks.map((c) => (
                <li key={c.id} className={`evidence-detail evidence-detail--${c.status}`}>
                  <span className="evidence-detail-icon"><CheckMark status={/tidak diperiksa/i.test(c.detail) ? 'warn' : c.status} /></span>
                  <div><strong>{c.label}</strong><p>{c.detail}</p></div>
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </section>
  )
}
