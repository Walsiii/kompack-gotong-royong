import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Layers, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import { fmtCoord } from '../lib/geo'
import { dHashFrom, sealEvidence, shortCode } from '../lib/integrity'
import { currentFix, useMyPos } from '../lib/location'
import { fmtStamp, useNow } from '../lib/time'
import type { Evidence, Fix } from '../lib/types'
import { Button } from './ui'

export interface CameraProps {
  open: boolean
  onClose: () => void
  /** foto disimpan ke bukti */
  onCapture: (ev: Evidence) => void
  title: string
  /** "SEBELUM" / "SESUDAH" / "LAPORAN" */
  tag: string
  userId: string
  /** id quest / laporan untuk segel */
  refId: string
  /** baris kedua watermark, mis. "RT 04 · Q-AB12CD" */
  caption: string
  /** foto sebelumnya sebagai panduan sudut (onion skin) */
  ghost?: string
  /** periksa lokasi saat jepret; kembalikan pesan bila ditolak */
  validate: (fix: Fix) => string | null
  /** mode uji: boleh pakai foto contoh bila kamera tidak ada */
  sample?: () => string
}

const MAX = 1080

/** Kamera di dalam aplikasi — tidak bisa memilih dari galeri. Foto diberi watermark waktu & lokasi lalu disegel. */
export function Camera(props: CameraProps) {
  if (!props.open) return null
  return createPortal(<CameraInner {...props} />, document.body)
}

function CameraInner({ onClose, onCapture, title, tag, userId, refId, caption, ghost, validate, sample }: CameraProps) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [state, setState] = useState<'starting' | 'live' | 'nocam'>('starting')
  const [shot, setShot] = useState<Evidence | null>(null)
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showGhost, setShowGhost] = useState(true)
  const now = useNow(1000)
  const { pos, acc, test } = useMyPos()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no media')
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        })
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream.current = s
        if (video.current) {
          video.current.srcObject = s
          await video.current.play().catch(() => undefined)
        }
        setState('live')
      } catch {
        if (!cancelled) setState('nocam')
      }
    })()
    return () => {
      cancelled = true
      stream.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const finish = async (source: CanvasImageSource, w: number, h: number, isSample: boolean) => {
    setError(null)
    setBusy(true)
    try {
      const fix = await currentFix()
      if (!fix) throw new Error('Posisimu belum diketahui. Izinkan akses lokasi lalu coba lagi.')
      const problem = validate(fix)
      if (problem) throw new Error(problem)

      const scale = Math.min(1, MAX / Math.max(w, h))
      const cw = Math.round(w * scale)
      const ch = Math.round(h * scale)
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = ch
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Kanvas tidak tersedia')
      ctx.drawImage(source, 0, 0, cw, ch)
      // sidik visual dihitung dari foto murni (sebelum watermark)
      const hash = dHashFrom(canvas)

      // watermark bukti
      const at = Date.now()
      const band = Math.round(ch * 0.13)
      const fs = Math.max(11, Math.round(band * 0.27))
      ctx.fillStyle = 'rgba(15,31,25,.78)'
      ctx.fillRect(0, ch - band, cw, band)
      ctx.fillStyle = '#FF5A1F'
      ctx.fillRect(0, ch - band, Math.round(cw * 0.012), band)
      ctx.fillStyle = '#fff'
      ctx.font = `600 ${fs}px "Martian Mono", ui-monospace, monospace`
      ctx.textBaseline = 'middle'
      const pad = Math.round(cw * 0.03)
      ctx.fillText(`${tag} · ${fmtStamp(at)}`, pad, ch - band * 0.68)
      ctx.globalAlpha = 0.85
      ctx.font = `400 ${Math.round(fs * 0.86)}px "Martian Mono", ui-monospace, monospace`
      const code = shortCode(`${userId}${refId}${at}`)
      ctx.fillText(`${fmtCoord(fix)} ±${Math.round(fix.acc)}m · ${caption} · #${code}${isSample || fix.simulated ? ' · UJI' : ''}`, pad, ch - band * 0.3)
      ctx.globalAlpha = 1

      const img = canvas.toDataURL('image/jpeg', 0.72)
      const base = { img, at, lat: fix.lat, lng: fix.lng, acc: fix.acc, hash, sample: isSample || undefined, simulated: fix.simulated || undefined }
      const seal = await sealEvidence(base, userId, refId)
      setShot({ ...base, seal })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Foto gagal diambil')
    } finally {
      setBusy(false)
    }
  }

  const snap = () => {
    const v = video.current
    if (!v || !v.videoWidth) return
    setFlash((f) => f + 1)
    navigator.vibrate?.(20)
    void finish(v, v.videoWidth, v.videoHeight, false)
  }

  const useSample = async () => {
    if (!sample) return
    const img = new Image()
    img.src = sample()
    await img.decode().catch(() => undefined)
    void finish(img, 800, 600, true)
  }

  const accept = () => {
    if (!shot) return
    onCapture(shot)
    onClose()
  }

  return (
    <motion.div
      className="fixed inset-0 z-[1600] flex flex-col bg-[#05100c] text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Kamera: ${title}`}
    >
      {/* kepala */}
      <div className="flex items-center gap-3 px-4 pb-3" style={{ paddingTop: 'calc(var(--safe-t) + 12px)' }}>
        <button type="button" aria-label="Tutup kamera" onClick={onClose} className="grid h-10 w-10 flex-none place-items-center rounded-full bg-white/10">
          <X size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="mono text-[0.66rem] uppercase tracking-widest text-rompi">{tag}</p>
          <p className="truncate font-display text-[1.05rem] font-bold">{title}</p>
        </div>
        {ghost && state === 'live' && !shot && (
          <button
            type="button"
            onClick={() => setShowGhost((g) => !g)}
            aria-pressed={showGhost}
            className={`flex h-10 flex-none items-center gap-1.5 rounded-full px-3 text-[0.8rem] font-semibold ${showGhost ? 'bg-white text-ink' : 'bg-white/10'}`}
          >
            <Layers size={16} /> Panduan
          </button>
        )}
      </div>

      {/* jendela bidik */}
      <div className="relative mx-auto w-full max-w-[720px] flex-1 overflow-hidden">
        <video ref={video} playsInline muted className={`absolute inset-0 h-full w-full object-cover ${shot ? 'opacity-0' : ''}`} />
        {ghost && showGhost && !shot && state === 'live' && (
          <img src={ghost} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-screen" />
        )}
        {state === 'live' && !shot && (
          <>
            {/* garis bantu sepertiga */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
            </div>
            {/* watermark langsung */}
            <div className="mono pointer-events-none absolute inset-x-3 bottom-3 rounded-lg bg-black/55 px-3 py-2 text-[0.66rem] leading-relaxed backdrop-blur-sm">
              <span className="text-rompi">● REC</span> {fmtStamp(now)}
              <br />
              {pos ? `${fmtCoord(pos)} ±${Math.round(acc ?? 0)}m` : 'mencari lokasi…'} {test ? '· UJI' : ''}
            </div>
          </>
        )}
        {state === 'starting' && <div className="absolute inset-0 grid place-items-center text-white/70">Membuka kamera…</div>}
        {state === 'nocam' && !shot && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <p className="font-display text-xl font-bold">Kamera tidak bisa dibuka</p>
            <p className="text-white/70">Izinkan akses kamera. Foto hanya bisa diambil langsung dari kamera aplikasi, bukan dari galeri.</p>
            {sample && (
              <Button tone="white" onClick={useSample} disabled={busy}>
                Pakai foto contoh (mode uji)
              </Button>
            )}
          </div>
        )}
        <AnimatePresence>
          {shot && (
            <motion.img
              key={shot.at}
              src={shot.img}
              alt="Hasil foto"
              initial={{ scale: 1.08, filter: 'brightness(2.2)' }}
              animate={{ scale: 1, filter: 'brightness(1)' }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 h-full w-full object-contain"
            />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {flash > 0 && (
            <motion.div key={flash} className="pointer-events-none absolute inset-0 bg-white" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.35 }} />
          )}
        </AnimatePresence>
      </div>

      {/* kendali */}
      <div className="px-5 pt-4" style={{ paddingBottom: 'calc(var(--safe-b) + 20px)' }}>
        {error && <p className="mx-auto mb-3 max-w-[520px] rounded-xl bg-bad/90 px-3 py-2 text-center text-[0.86rem] font-semibold">{error}</p>}
        {shot ? (
          <div className="mx-auto flex max-w-[520px] flex-col gap-2.5">
            <p className="flex items-center justify-center gap-1.5 text-[0.8rem] text-white/75">
              <ShieldCheck size={15} className="text-[#6BE3A4]" /> Disegel: waktu, lokasi, dan foto terkunci
            </p>
            <div className="flex gap-3">
              <Button tone="soft" className="flex-1" onClick={() => setShot(null)}>
                <RotateCcw size={17} /> Ulangi
              </Button>
              <Button className="flex-[1.6]" onClick={accept}>
                Pakai foto ini
              </Button>
            </div>
          </div>
        ) : state === 'live' ? (
          <div className="flex items-center justify-center gap-8">
            {sample ? (
              <button type="button" onClick={useSample} disabled={busy} className="w-16 text-[0.7rem] font-semibold text-white/60 underline">
                Foto contoh
              </button>
            ) : (
              <span className="w-16" />
            )}
            <button
              type="button"
              aria-label="Ambil foto"
              disabled={busy}
              onClick={snap}
              className="grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-white/90 transition-transform active:scale-90"
            >
              <span className={`h-[60px] w-[60px] rounded-full ${busy ? 'animate-pulse bg-white/50' : 'bg-rompi'}`} />
            </button>
            <span className="w-16" />
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}
