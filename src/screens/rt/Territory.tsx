import { useEffect, useMemo, useRef, useState } from 'react'
import maplibregl, { type Map as MLMap } from 'maplibre-gl'
import { Check, RotateCcw, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Map3D, type Neighbor } from '../../components/Map3D'
import { Button, Note, TopBar, toast } from '../../components/ui'
import { fmtArea, ringArea, ringCenter, ringPerimeter } from '../../lib/geo'
import { territoryProblem, useMyGroup, useStore } from '../../lib/store'
import type { Ring } from '../../lib/types'

/** Editor batas wilayah RT: seret titik sudut, ketuk "+" di tengah sisi untuk menambah titik. */
export function Territory() {
  const nav = useNavigate()
  const group = useMyGroup()
  const groups = useStore((s) => s.groups)
  const quests = useStore((s) => s.quests)
  const save = useStore((s) => s.saveTerritory)
  const [ring, setRing] = useState<Ring>(() => group?.territory ?? [])
  const [sel, setSel] = useState<number | null>(null)
  const [map, setMap] = useState<MLMap | null>(null)
  const ringRef = useRef(ring)
  ringRef.current = ring
  const verts = useRef<maplibregl.Marker[]>([])
  const mids = useRef<maplibregl.Marker[]>([])
  const dragging = useRef(false)

  const neighbors: Neighbor[] = useMemo(() => groups.filter((g) => g.kind === 'rt' && g.id !== group?.id).map((g) => ({ id: g.id, name: g.name, ring: g.territory })), [groups, group?.id])
  const problem = group ? territoryProblem(ring, group.id, groups, quests) : 'Wilayah tidak ditemukan.'
  const center = useMemo(() => ringCenter(group?.territory ?? []), []) // eslint-disable-line react-hooks/exhaustive-deps

  // bangun ulang penanda saat jumlah titik berubah
  useEffect(() => {
    if (!map) return
    verts.current.forEach((m) => m.remove())
    mids.current.forEach((m) => m.remove())
    verts.current = ringRef.current.map((p, i) => {
      const el = document.createElement('div')
      el.className = 'vx'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setSel(i)
      })
      const m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([p.lng, p.lat]).addTo(map)
      m.on('dragstart', () => {
        dragging.current = true
        setSel(i)
      })
      m.on('drag', () => {
        const ll = m.getLngLat()
        setRing((r) => r.map((q, k) => (k === i ? { lat: ll.lat, lng: ll.lng } : q)))
      })
      m.on('dragend', () => (dragging.current = false))
      return m
    })
    mids.current = ringRef.current.map((_, i) => {
      const el = document.createElement('div')
      el.className = 'vx-mid'
      el.textContent = '+'
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        setRing((r) => {
          const a = r[i]
          const b = r[(i + 1) % r.length]
          const next = [...r]
          next.splice(i + 1, 0, { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 })
          return next
        })
        setSel(i + 1)
      })
      return new maplibregl.Marker({ element: el }).setLngLat([0, 0]).addTo(map)
    })
    return () => {
      verts.current.forEach((m) => m.remove())
      mids.current.forEach((m) => m.remove())
    }
  }, [map, ring.length])

  // posisi penanda mengikuti data
  useEffect(() => {
    ring.forEach((p, i) => {
      if (!dragging.current) verts.current[i]?.setLngLat([p.lng, p.lat])
      const b = ring[(i + 1) % ring.length]
      mids.current[i]?.setLngLat([(p.lng + b.lng) / 2, (p.lat + b.lat) / 2])
    })
    verts.current.forEach((m, i) => m.getElement().classList.toggle('is-sel', i === sel))
  }, [ring, sel, map])

  if (!group) return null

  return (
    <div className="flex h-full flex-col bg-paper">
      <TopBar back title={`Wilayah ${group.name}`} sub="Seret titik sudut. Batas tidak boleh menimpa RT tetangga." />
      <div className="relative min-h-0 flex-1">
        <Map3D center={center} zoom={16} threeD={false} territory={ring} territoryBad={!!problem} neighbors={neighbors} onReady={setMap} onMapClick={() => setSel(null)} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3" style={{ paddingBottom: 'calc(var(--safe-b) + 12px)' }}>
          <div className="panel pointer-events-auto mx-auto max-w-[560px] p-4 !shadow-lift">
            <dl className="grid grid-cols-3 divide-x divide-line text-center">
              {[
                ['Luas', fmtArea(ringArea(ring))],
                ['Keliling', `${Math.round(ringPerimeter(ring)).toLocaleString('id-ID')} m`],
                ['Titik sudut', String(ring.length)],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="meta-label">{k}</dt>
                  <dd className="font-display wd-wide text-[1.05rem] font-bold">{v}</dd>
                </div>
              ))}
            </dl>
            {problem ? (
              <Note tone="warn" className="mt-3">
                {problem}
              </Note>
            ) : (
              <Note tone="info" className="mt-3">
                Batas sah: tidak menimpa RT tetangga dan semua misi aktif masih di dalam.
              </Note>
            )}
            <div className="mt-3 flex gap-2">
              <Button tone="soft" small disabled={sel === null || ring.length <= 3} onClick={() => (setRing((r) => r.filter((_, i) => i !== sel)), setSel(null))}>
                <Trash2 size={15} /> Hapus titik
              </Button>
              <Button tone="soft" small onClick={() => (setRing(group.territory), setSel(null))}>
                <RotateCcw size={15} /> Batal ubah
              </Button>
              <Button
                small
                className="ml-auto"
                disabled={!!problem}
                onClick={async () => {
                  const r = await save(group.id, ring)
                  if (!r.ok) return toast(r.error, 'warn')
                  toast(`Wilayah ${group.name} disimpan.`)
                  nav(-1)
                }}
              >
                <Check size={15} strokeWidth={3} /> Simpan
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
