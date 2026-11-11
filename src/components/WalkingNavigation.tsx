import { ArrowUp, Check, ChevronDown, CornerUpLeft, CornerUpRight, ExternalLink, Footprints, LocateFixed, RotateCcw, X } from 'lucide-react'
import { fmtDist } from '../lib/geo'
import type { WalkingNavigationState } from '../lib/routing'
import './walking-navigation.css'

interface Props {
  navigation: WalkingNavigationState
  targetTitle: string
  onRecenter: () => void
  positionAccuracyM: number | null
  simulated: boolean
  onOpenMission?: () => void
}

function minutes(seconds: number) { return `${Math.max(1, Math.round(seconds / 60))} menit` }

/** Directions from a pedestrian routing service; GPS arrival never completes a mission. */
export function WalkingNavigation({ navigation: nav, targetTitle, onRecenter, positionAccuracyM, simulated, onOpenMission }: Props) {
  if (!nav.active && nav.status === 'idle') return null
  const route = nav.route
  const progress = nav.remainingDistanceM !== null && nav.remainingDurationS !== null
  const instruction = (nav.currentInstruction ?? route?.instructions[0])?.text ?? ''
  const Direction = /kanan/.test(instruction) ? CornerUpRight : /kiri/.test(instruction) ? CornerUpLeft : /balik|bundaran/.test(instruction) ? RotateCcw : ArrowUp
  return (
    <section className="walking-navigation" aria-label={`Navigasi jalan kaki ke ${targetTitle}`}>
      <div className="walking-navigation-top">
        <span><Footprints size={19} aria-hidden="true" />
          {nav.status === 'ready' && route ? <span className="walking-estimate"><strong>{minutes(progress ? nav.remainingDurationS! : route.durationS)}</strong><span>{fmtDist(progress ? nav.remainingDistanceM! : route.distanceM)}{progress ? ' lagi' : ' total'}</span></span> : 'Jalan kaki'}
        </span>
        <button type="button" className="walking-close" onClick={nav.cancel} aria-label="Hentikan navigasi"><X size={20} aria-hidden="true" /></button>
      </div>
      <div role="status" aria-live="polite" className="walking-status">
        {nav.status === 'loading' && <p>Mencari jalur jalan kaki…</p>}
        {nav.status === 'error' && <p>{nav.error}</p>}
        {nav.status === 'ready' && route && <>
          {nav.arrived ? <p className="walking-arrival"><Check size={21} aria-hidden="true" /> Kamu sudah di area misi.</p> :
            nav.offRoute ? <p>Kamu di luar jalur jalan kaki.</p> :
              <p className="walking-next"><Direction size={22} aria-hidden="true" /><span>{instruction}</span></p>}
        </>}
      </div>
      {simulated ? <p className="walking-notice">Mode uji, tanpa progres GPS.</p> : nav.status === 'ready' && !nav.reliablePosition &&
        <p className="walking-notice">{positionAccuracyM !== null && positionAccuracyM > 50 ? `GPS ±${Math.round(positionAccuracyM)} m, menunggu lebih akurat.` : 'Menunggu GPS terbaru.'}</p>}
      <div className="walking-actions">
        {nav.arrived && onOpenMission ? <button type="button" onClick={onOpenMission}>Buka misi</button> : nav.status === 'ready' && (nav.offRoute ?
          <button type="button" onClick={() => { void nav.retry() }} aria-label="Cari ulang rute dari posisiku"><RotateCcw size={19} aria-hidden="true" /></button> :
          <button type="button" onClick={onRecenter} aria-label="Pusatkan peta ke posisiku"><LocateFixed size={19} aria-hidden="true" /></button>)}
        {nav.status === 'error' && <button type="button" onClick={() => { void nav.retry() }}><RotateCcw size={18} aria-hidden="true" /> Coba lagi</button>}
        {nav.status === 'ready' && route && <details className="walking-directions">
          <summary>Langkah <ChevronDown size={15} aria-hidden="true" /></summary>
          <div className="walking-directions-panel"><p>Ke {targetTitle}</p><ol>{route.instructions.map((step, i) => <li key={`${step.beginShapeIndex}-${i}`}><span>{step.text}</span>{step.distanceM > 0 && <small>{fmtDist(step.distanceM)}</small>}</li>)}</ol></div>
        </details>}
        {nav.mapsLink && <a href={nav.mapsLink} target="_blank" rel="noopener noreferrer">Google Maps <ExternalLink size={16} aria-hidden="true" /></a>}
      </div>
    </section>
  )
}
