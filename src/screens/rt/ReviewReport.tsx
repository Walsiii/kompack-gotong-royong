import { useState } from 'react'
import { Camera, Eye, MapPin, Plus, TriangleAlert, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Map3D } from '../../components/Map3D'
import { Avatar, CatTile } from '../../components/art'
import { Button, Empty, Note, Page, Section, Sheet, TopBar, toast } from '../../components/ui'
import { CATS, DISMISS_REASONS, RULES } from '../../lib/catalog'
import { fmtCoord, pointInRing } from '../../lib/geo'
import { personById, useMe, useMyGroup, useStore } from '../../lib/store'
import { fmtDateTime } from '../../lib/time'
import '../../components/evidence.css'

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
      <TopBar back="/rt/periksa" title={post.kind === 'tolong' ? 'Permintaan tolong' : 'Laporan warga'} />
      <Section className="review-workspace">
        <div className="review-visual">
          <h2 className="review-mission-title">{post.place || CATS[cat].label}</h2>
          {post.photo && <img src={post.photo.img} alt="Foto laporan" width={800} height={600} className="report-photo" />}
          {post.photo?.sample && <p className="review-compare-caption"><span className="review-example-label">Gambar simulasi</span></p>}
          <div className="report-map">
            <Map3D center={loc} zoom={17.2} territory={group.territory} interactive={false} pins={[{ id: post.id, lat: loc.lat, lng: loc.lng, kind: post.kind === 'tolong' ? 'tolong' : 'laporan', category: cat, state: 'live' }]} />
          </div>
        </div>
        <div className="review-decision">
          <div className="review-person">
            <Avatar index={who.avatar} size={36} />
            <div className="review-person-info">
              <p>{who.name}</p>
              <p>{new Date().getFullYear() - who.birthYear} tahun / kepercayaan {who.trust}/100</p>
            </div>
          </div>
          <p className="report-copy">“{post.text}”</p>
          <p className="review-action-caption">Dikirim {fmtDateTime(post.at)}</p>
          <ul className="report-facts">
            <li>
              <CatTile cat={cat} size={24} /> <div><p><strong>{CATS[cat].label}</strong></p>{post.place && <small>{post.place}</small>}</div>
            </li>
            <li>
              {inside ? <MapPin size={21} aria-hidden="true" /> : <TriangleAlert size={21} aria-hidden="true" />}
              <div><p>{inside ? `Di dalam wilayah ${group.name}` : `Di luar wilayah ${group.name}`}</p><small>{fmtCoord(loc)}</small></div>
            </li>
            <li>
              <Camera size={21} aria-hidden="true" /><div><p>{post.photo?.sample ? 'Foto contoh, mode uji' : post.photo ? 'Foto dari kamera aplikasi' : 'Belum ada foto'}</p><small>{post.photo?.sample ? 'Foto ini bukan bukti kamera di lokasi.' : 'Lihat kondisi yang dilaporkan di foto.'}</small></div>
            </li>
            <li>
              <Eye size={21} aria-hidden="true" />
              <div><p>{witnesses.length ? `${witnesses.length} warga juga lihat` : 'Belum ada saksi lain'}</p>{witnesses.length > 0 && <div className="report-witnesses"><span className="report-witness-stack">{witnesses.slice(0, 4).map((w) => <Avatar key={w!.id} index={w!.avatar} size={27} />)}</span><small>{witnesses.map((w) => w!.name).join(', ')}</small></div>}</div>
            </li>
          </ul>
          {post.status === 'menunggu' ? (
            <>
              <Note tone="info">
                Kalau dijadikan misi, {who.name} dapat +{RULES.reporterBonus} poin pelapor dan tidak bisa mengerjakannya sendiri.
              </Note>
              <div className="review-actions">
                <Button tone="soft" className="flex-1" onClick={() => setAsk(true)}>
                  <X size={18} /> Tolak
                </Button>
                <Button className="flex-[1.6]" disabled={!inside} onClick={() => nav(`/rt/misi-baru?dari=${post.id}`)}>
                  <Plus size={18} /> Jadikan misi
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
              className="rounded-xl bg-paper px-3.5 py-3 text-left font-medium hover:bg-surface"
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
