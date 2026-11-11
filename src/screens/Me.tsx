import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowLeftRight, Check, ChevronRight, FlaskConical, MapPinned, RotateCcw, ShieldCheck, Ticket } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Avatar, CatTile, Coin } from '../components/art'
import { Bar, Button, CountUp, Note, Page, Section, Sheet, TopBar, toast } from '../components/ui'
import { COMMUNITY, REWARDS, nextRank, rankOf, rankProgress } from '../lib/catalog'
import { fmtArea, ringArea } from '../lib/geo'
import { isNative } from '../lib/location'
import { groupPoints, personById, useIsRT, useMe, useMyGroup, usePoints, useSession, useSnap, useStore } from '../lib/store'
import { fmtDateTime, useNow } from '../lib/time'
import type { Redemption, Reward } from '../lib/types'

function Switch({ on, onChange, id, label }: { on: boolean; onChange: (v: boolean) => void; id: string; label: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 flex-none rounded-full transition-colors ${on ? 'bg-rompi' : 'bg-[#CFD6CF]'}`}
    >
      <motion.span layout className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow ${on ? 'right-1' : 'left-1'}`} transition={{ type: 'spring', stiffness: 600, damping: 34 }} />
    </button>
  )
}

export function Me() {
  const nav = useNavigate()
  const now = useNow(60000)
  const me = useMe()
  const rt = useIsRT()
  const group = useMyGroup()
  const snap = useSnap()
  const users = useStore((s) => s.users)
  const testMode = useStore((s) => s.testMode)
  const setTestMode = useStore((s) => s.setTestMode)
  const redeem = useStore((s) => s.redeem)
  const fulfill = useStore((s) => s.fulfill)
  const reset = useStore((s) => s.reset)
  const setActing = useSession((s) => s.setActing)
  const pts = usePoints(me?.id)
  const [confirm, setConfirm] = useState<Reward | null>(null)
  const [ticket, setTicket] = useState<Redemption | null>(null)
  const [askReset, setAskReset] = useState(false)

  const mySubs = useMemo(
    () =>
      snap.subs
        .filter((s) => s.userId === me?.id)
        .map((s) => ({ s, q: snap.quests.find((q) => q.id === s.questId) }))
        .filter((x) => x.q)
        .sort((a, b) => b.s.checkin.at - a.s.checkin.at),
    [snap, me?.id],
  )
  const myRed = snap.redemptions.filter((r) => r.userId === me?.id).sort((a, b) => b.at - a.at)
  const team = group ? groupPoints(snap, group.id) - group.basePoints : 0

  if (!me) return null
  const rank = rankOf(pts.total)
  const next = nextRank(pts.total)
  const age = new Date().getFullYear() - me.birthYear

  const switchAccount = () => {
    setActing(rt ? 'me' : 'rt')
    toast(rt ? 'Kembali ke akunmu.' : 'Masuk sebagai Pak Hendra, Ketua RT 04 (akun demo).')
    nav('/')
  }

  return (
    <Page>
      <TopBar title={rt ? 'Akun Ketua RT' : 'Aku'} sub={rt ? `${group?.name} · ${group?.rw}` : undefined} />
      <Section className="flex flex-col gap-5">
        {/* profil */}
        <div className="flex items-center gap-4">
          <Avatar index={me.avatar} size={68} />
          <div className="min-w-0">
            <h2 className="truncate text-[1.7rem]">{me.name}</h2>
            <p className="text-[0.88rem] text-ink-2">{me.title ?? `${age} tahun · ${group?.name}`}</p>
            {!rt && <span className="plang mt-1.5 text-[0.86rem]">LV {rank.level} · {rank.name.toUpperCase()}</span>}
          </div>
        </div>

        {!rt && (
          <>
            <div className="panel p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="eyebrow">Total poin</p>
                  <p className="font-display wd-wide flex items-center gap-1.5 text-[2.4rem] font-bold leading-none">
                    <CountUp value={pts.total} />
                  </p>
                </div>
                <p className="pb-1 text-right text-[0.86rem] text-ink-2">
                  {next ? (
                    <>
                      <b className="text-ink">{next.min - pts.total} poin</b> lagi
                      <br />
                      menuju {next.name}
                    </>
                  ) : (
                    'Pangkat tertinggi!'
                  )}
                </p>
              </div>
              <Bar value={rankProgress(pts.total)} className="mt-3" />
              <dl className="mt-4 divide-y divide-line border-t border-line">
                {[
                  ['Misi selesai', pts.quests],
                  ['Poin yang bisa ditukar', pts.spendable],
                  ['Skor kepercayaan', `${me.trust} dari 100`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className="text-[1.1rem] font-bold tnum">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-3 flex items-start gap-1.5 text-[0.86rem] text-ink-3">
                <ShieldCheck size={14} className="mt-px flex-none text-plang" />
                Skor kepercayaan turun bila setoran ditolak Ketua RT, dan ikut dilihat saat pemeriksaan.
              </p>
            </div>

            {/* misi */}
            <section>
              <h3 className="mb-2 text-[1.2rem]">Misi-ku</h3>
              <div className="panel divide-y divide-line">
                {mySubs.length === 0 && <p className="p-4 text-ink-2">Belum ada. Pilih misi di peta dan check-in di lokasinya.</p>}
                {mySubs.map(({ s, q }) => (
                  <button key={s.id} type="button" onClick={() => nav(`/misi/${q!.id}`)} className="flex w-full items-center gap-3 p-3 text-left">
                    <CatTile cat={q!.category} size={38} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{q!.title}</span>
                      <span className="block text-[0.86rem] text-ink-3">{fmtDateTime(s.checkin.at, now)}</span>
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[0.8rem] font-semibold ${
                        s.status === 'approved'
                          ? 'bg-[#E1EEE6] text-plang-2'
                          : s.status === 'pending'
                            ? 'bg-[#E6EEF3] text-[#22566B]'
                            : s.status === 'rejected'
                              ? 'bg-[#F1E3E1] text-bad'
                              : 'bg-[#FDECDD] text-[#8A3A0E]'
                      }`}
                    >
                      {s.status === 'approved' ? `+${s.awarded}` : s.status === 'pending' ? 'Dicek RT' : s.status === 'rejected' ? 'Ditolak' : 'Lanjutkan'}
                    </span>
                    <ChevronRight size={16} className="flex-none text-ink-3" />
                  </button>
                ))}
              </div>
            </section>

            {/* hadiah */}
            <section>
              <h3 className="mb-2 text-[1.2rem]">Hadiah</h3>
              <div className="panel overflow-hidden">
                <div className="bg-plang p-4 text-white">
                  <p className="mono text-[0.8rem] text-white/70">Hadiah bersama {group?.name}</p>
                  <p className="font-display mt-1 text-[1.3rem] font-bold">{COMMUNITY.goalTitle}</p>
                  <p className="mt-0.5 text-[0.86rem] text-white/75">{COMMUNITY.goalDesc}</p>
                  <div className="mt-3">
                    <Bar value={Math.min(1, team / COMMUNITY.goalTarget)} height={10} />
                  </div>
                  <p className="mono mt-1.5 text-[0.8rem]">
                    {team.toLocaleString('id-ID')} / {COMMUNITY.goalTarget.toLocaleString('id-ID')} poin
                  </p>
                </div>
                <ul className="divide-y divide-line">
                  {REWARDS.map((r) => {
                    const lack = r.cost - pts.spendable
                    return (
                      <li key={r.id} className="flex items-center gap-3 p-3.5">
                        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-paper">
                          <Ticket size={18} className="text-ink-2" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{r.title}</span>
                          <span className="block truncate text-[0.86rem] text-ink-3">{r.partner}</span>
                        </span>
                        <Button small tone={lack > 0 ? 'soft' : 'primary'} disabled={lack > 0} onClick={() => setConfirm(r)}>
                          <Coin size={13} /> {r.cost}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </div>
              {myRed.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {myRed.map((red) => (
                    <button key={red.id} type="button" onClick={() => setTicket(red)} className="flex items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-float">
                      <span className="reflect-stripes h-10 w-1.5 flex-none rounded-full" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{REWARDS.find((x) => x.id === red.rewardId)?.title}</span>
                        <span className="mono block text-[0.8rem] text-ink-3">{red.code}</span>
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-[0.8rem] font-semibold ${red.fulfilledAt ? 'bg-[#E1EEE6] text-plang-2' : 'bg-[#FDECDD] text-[#8A3A0E]'}`}>
                        {red.fulfilledAt ? 'Sudah diambil' : 'Siap ditukar'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        {rt && group && (
          <>
            <section className="panel p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-[#FFF1EA] text-rompi">
                  <MapPinned size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[1.15rem]">Wilayah {group.name}</h3>
                  <p className="mono text-[0.86rem] text-ink-2">
                    {group.territory.length} titik sudut · luas {fmtArea(ringArea(group.territory))}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[0.86rem] text-ink-2">Laporan dan misi hanya bisa dibuat di dalam wilayah ini. Batas tidak boleh menimpa RT tetangga.</p>
              <Button tone="dark" className="mt-3" onClick={() => nav('/rt/wilayah')}>
                Atur batas wilayah
              </Button>
            </section>

            <section>
              <h3 className="mb-2 text-[1.2rem]">Klaim hadiah warga</h3>
              <div className="panel divide-y divide-line">
                {snap.redemptions.length === 0 && <p className="p-4 text-ink-2">Belum ada warga yang menukar poin.</p>}
                {[...snap.redemptions]
                  .sort((a, b) => Number(!!a.fulfilledAt) - Number(!!b.fulfilledAt) || b.at - a.at)
                  .map((red) => {
                    const w = personById(users, red.userId)
                    return (
                      <div key={red.id} className="flex items-center gap-3 p-3">
                        <Avatar index={w?.avatar ?? 0} size={34} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{REWARDS.find((x) => x.id === red.rewardId)?.title}</span>
                          <span className="mono block text-[0.8rem] text-ink-3">
                            {w?.name} · {red.code}
                          </span>
                        </span>
                        {red.fulfilledAt ? (
                          <span className="flex items-center gap-1 text-[0.86rem] font-semibold text-ok">
                            <Check size={14} /> Diberikan
                          </span>
                        ) : (
                          <Button small tone="plang" onClick={() => fulfill(red.id)}>
                            Tandai diberikan
                          </Button>
                        )}
                      </div>
                    )
                  })}
              </div>
            </section>
          </>
        )}

        {/* pengaturan */}
        <section>
          <h3 className="mb-2 text-[1.2rem]">Pengaturan</h3>
          <div className="panel divide-y divide-line">
            {!rt && (
              <div className="flex items-start gap-3 p-4">
                <FlaskConical size={20} className="mt-0.5 flex-none text-[#5B4A9E]" />
                <div className="min-w-0 flex-1">
                  <label htmlFor="sw-test" className="block font-semibold">
                    Mode uji (coba di PC)
                  </label>
                  <p className="text-[0.86rem] text-ink-2">
                    Posisi dipindah dengan mengetuk peta, boleh pakai foto contoh, dan waktu tunggu bisa dilewati. Semua setoran mode uji ditandai untuk Ketua RT.
                  </p>
                </div>
                <Switch
                  id="sw-test"
                  label="Mode uji"
                  on={testMode}
                  onChange={(v) => {
                    setTestMode(v)
                    toast(v ? 'Mode uji aktif.' : 'Mode uji mati. Memakai GPS perangkat.')
                  }}
                />
              </div>
            )}
            <div className="flex items-start gap-3 p-4">
              <ArrowLeftRight size={20} className="mt-0.5 flex-none text-ink-2" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{rt ? 'Kembali ke akun warga' : 'Akun demo Ketua RT'}</p>
                <p className="text-[0.86rem] text-ink-2">
                  {rt
                    ? 'Kembali ke akunmu sendiri.'
                    : 'Masuk sebagai Pak Hendra untuk mencoba memeriksa setoran dan laporan. Ini akun terpisah: kamu tetap tidak bisa menyetujui setoranmu sendiri.'}
                </p>
                <Button small tone="dark" className="mt-2.5" onClick={switchAccount}>
                  {rt ? 'Kembali ke akunku' : 'Masuk sebagai Ketua RT'}
                </Button>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4">
              <RotateCcw size={20} className="mt-0.5 flex-none text-ink-2" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Mulai ulang demo</p>
                <p className="text-[0.86rem] text-ink-2">Hapus semua data di perangkat ini.</p>
                <Button small tone="ghost" className="mt-2.5" onClick={() => setAskReset(true)}>
                  Hapus data
                </Button>
              </div>
            </div>
          </div>
          <p className="mt-3 px-1 text-[0.8rem] text-ink-3">
            Kompack! 2.0 · {isNative ? 'Android' : 'Web'} · purwarupa tim Batak Intelligence. Data tersimpan di perangkat ini.
          </p>
        </section>
      </Section>

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title="Tukar poin?">
        {confirm && (
          <>
            <p className="text-ink-2">
              <b className="text-ink">{confirm.title}</b> dari {confirm.partner} seharga <b className="text-ink">{confirm.cost} poin</b>. Sisa poin tukarmu jadi {pts.spendable - confirm.cost}. Pangkat
              dan klasemen tidak berkurang.
            </p>
            <div className="mt-5 flex gap-3">
              <Button tone="soft" className="flex-1" onClick={() => setConfirm(null)}>
                Batal
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const r = redeem(confirm.id, me.id)
                  setConfirm(null)
                  if (r) setTicket(r)
                  else toast('Poinmu belum cukup.', 'warn')
                }}
              >
                Tukar
              </Button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={!!ticket} onClose={() => setTicket(null)} title="Kode hadiah">
        {ticket && (
          <div className="overflow-hidden rounded-2xl bg-ink text-white">
            <div className="reflect-stripes h-3" style={{ animation: 'kp-sweep 2s linear infinite' }} />
            <div className="p-5 text-center">
              <p className="font-semibold">{REWARDS.find((x) => x.id === ticket.rewardId)?.title}</p>
              <p className="mono mt-3 select-all text-[2rem] font-semibold">{ticket.code}</p>
              <p className="mt-2 text-[0.86rem] text-white/70">Tunjukkan ke {REWARDS.find((x) => x.id === ticket.rewardId)?.partner}. Ketua RT menandai saat hadiah diberikan.</p>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={askReset} onClose={() => setAskReset(false)} title="Hapus semua data?">
        <Note tone="warn">Profil, poin, laporan, foto, dan misi buatan di perangkat ini akan hilang.</Note>
        <div className="mt-5 flex gap-3">
          <Button tone="soft" className="flex-1" onClick={() => setAskReset(false)}>
            Batal
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setAskReset(false)
              setActing('me')
              reset()
              nav('/', { replace: true })
            }}
          >
            Hapus
          </Button>
        </div>
      </Sheet>
    </Page>
  )
}
