import { useState } from 'react'
import { Check, Eye, MapPin, Sparkles, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Map3D } from '../../components/Map3D'
import { Avatar, CatTile } from '../../components/art'
import { Button, Empty, Note, Page, Section, Sheet, TopBar, toast } from '../../components/ui'
import { CATS, DISMISS_REASONS, RULES } from '../../lib/catalog'
import { fmtCoord, pointInRing } from '../../lib/geo'
import { personById, useMe, useMyGroup, useStore } from '../../lib/store'
import { fmtDateTime } from '../../lib/time'

export function ReviewReport() {
  const { id } = useParams()
  const nav = useNavigate()
  const me = useMe()
  const group = useMyGroup()
  const posts = useStore((s) => s.posts)
  const users = useStore((s) => s.users)
  const dismiss = useStore((s) => s.dismissReport)
  const [ask, setAsk] = useState(false)

  const post = posts.find((p) => p.id === id)
  const who = personById(users, post?.authorId)
  if (!post || !who || !me || !group || post.lat === undefined) {
    return (
      <Page bare>
        <TopBar back="/rt/periksa" title="Laporan tidak ditemukan" />
        <Empty title="Tidak ada laporan" text="Laporan ini mungkin sudah diproses." />
      </Page>
    )
  }
  const loc = { lat: post.lat, lng: post.lng! }
  const inside = pointInRing(loc, group.territory)
  const cat = post.category ?? 'sampah'
  const witnesses = (post.witnesses ?? []).map((w) => personById(users, w)).filter(Boolean)

  return (
    <Page bare>
      <TopBar back="/rt/periksa" title={post.kind === 'tolong' ? 'Permintaan tolong' : 'Laporan warga'} sub={`${who.name} · ${fmtDateTime(post.at)}`} />
      <Section className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3">
          {post.photo && <img src={post.photo.img} alt="Foto laporan" className="aspect-[4/3] w-full rounded-[20px] object-cover" />}
          <div className="relative h-[200px] overflow-hidden rounded-[20px]">
            <Map3D center={loc} zoom={17.2} territory={group.territory} interactive={false} pins={[{ id: post.id, lat: loc.lat, lng: loc.lng, kind: post.kind === 'tolong' ? 'tolong' : 'laporan', category: cat, state: 'live' }]} />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar index={who.avatar} size={46} />
            <div className="min-w-0">
              <p className="font-display text-[1.2rem] font-bold leading-tight">{who.name}</p>
              <p className="text-[0.86rem] text-ink-2">{new Date().getFullYear() - who.birthYear} tahun · kepercayaan {who.trust}/100</p>
            </div>
          </div>
          <p className="text-[1.05rem] leading-snug">“{post.text}”</p>
          <ul className="panel flex flex-col gap-2.5 p-4 text-[0.9rem]">
            <li className="flex items-center gap-2.5">
              <CatTile cat={cat} size={24} /> <b>{CATS[cat].label}</b> {post.place && <span className="text-ink-2">· {post.place}</span>}
            </li>
            <li className="flex items-center gap-2.5">
              <MapPin size={17} className={inside ? 'text-ok' : 'text-bad'} />
              <span>
                {inside ? `Di dalam wilayah ${group.name}` : `Di luar wilayah ${group.name}`} <span className="mono text-[0.8rem] text-ink-3">{fmtCoord(loc)}</span>
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Check size={17} className="text-ok" /> Foto diambil dari kamera aplikasi{post.photo?.sample ? ' (foto contoh, mode uji)' : ''}
            </li>
            <li className="flex items-center gap-2.5">
              <Eye size={17} className="text-ink-2" />
              {witnesses.length ? `${witnesses.length} warga juga lihat: ${witnesses.map((w) => w!.name).join(', ')}` : 'Belum ada warga lain yang menyaksikan'}
            </li>
          </ul>
          {post.status === 'menunggu' ? (
            <>
              <Note tone="info">
                Kalau dijadikan misi, {who.name} dapat +{RULES.reporterBonus} poin pelapor dan tidak bisa mengerjakannya sendiri.
              </Note>
              <div className="flex gap-3">
                <Button tone="soft" className="flex-1" onClick={() => setAsk(true)}>
                  <X size={18} /> Tolak
                </Button>
                <Button className="flex-[1.6]" disabled={!inside} onClick={() => nav(`/rt/misi-baru?dari=${post.id}`)}>
                  <Sparkles size={18} /> Jadikan misi
                </Button>
              </div>
            </>
          ) : (
            <Note tone="info">Laporan ini sudah diproses.</Note>
          )}
        </div>
      </Section>

      <Sheet open={ask} onClose={() => setAsk(false)} title="Tolak laporan?">
        <div className="flex flex-col gap-2">
          {DISMISS_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              className="rounded-xl bg-paper px-3.5 py-3 text-left font-medium hover:bg-[#E3E8E2]"
              onClick={() => {
                const res = dismiss(post.id, me.id, r)
                setAsk(false)
                if (!res.ok) toast(res.error, 'warn')
                else {
                  toast('Laporan ditolak.')
                  nav('/rt/periksa', { replace: true })
                }
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </Sheet>
    </Page>
  )
}
