import { CATS } from './catalog'
import { offset } from './geo'
import { dHash, sealEvidence, shortCode } from './integrity'
import { demoPhoto } from './photo'
import type { Bonus, Category, Evidence, Group, LatLng, Person, Post, Quest, Ring, Submission } from './types'

export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

const MIN = 60000

export const MY_GROUP = 'rt04'
export const RW_GROUP = 'rw09'
export const LEADER = 'p_hendra'

const ring = (home: LatLng, pts: [number, number][]): Ring => pts.map(([e, n]) => offset(home, e, n))

/* Wilayah dibuat relatif terhadap titik rumah (meter timur, meter utara).
   RT tetangga dipisah jalan ±15 m supaya tidak bersinggungan. */
const RT04: [number, number][] = [
  [-230, -150], [-60, -210], [170, -190], [250, -20], [210, 170], [20, 230], [-200, 150], [-260, 10],
]
const RT03: [number, number][] = [
  [-215, 175], [-480, 200], [-560, 40], [-520, -170], [-245, -160], [-275, 12],
]
const RT05: [number, number][] = [
  [188, -200], [430, -220], [520, -30], [480, 190], [226, 178], [266, -24],
]

export function seedGroups(home: LatLng): Group[] {
  return [
    { id: 'rt04', kind: 'rt', name: 'RT 04', rw: 'RW 09', territory: ring(home, RT04), leaderId: LEADER, basePoints: 0, member: true },
    { id: 'rw09', kind: 'rw', name: 'RW 09', rw: 'RW 09', territory: [], leaderId: 'p_rahmat', basePoints: 0, member: true },
    { id: 'rt03', kind: 'rt', name: 'RT 03', rw: 'RW 09', territory: ring(home, RT03), leaderId: 'p_ani', basePoints: 1990, member: false },
    { id: 'rt05', kind: 'rt', name: 'RT 05', rw: 'RW 09', territory: ring(home, RT05), leaderId: 'p_rahmat', basePoints: 2480, member: false },
  ]
}

const person = (
  id: string,
  name: string,
  avatar: number,
  birthYear: number,
  basePoints = 0,
  baseWeek = 0,
  baseQuests = 0,
  extra: Partial<Person> = {},
): Person => ({ id, name, avatar, birthYear, groupId: MY_GROUP, role: 'warga', basePoints, baseWeek, baseQuests, trust: 100, ...extra })

export const NPCS: Person[] = [
  person(LEADER, 'Pak Hendra', 3, 1975, 0, 0, 0, { role: 'rt', title: 'Ketua RT 04' }),
  person('p_rahmat', 'Pak Rahmat', 4, 1968, 0, 0, 0, { groupId: 'rt05', role: 'rt', title: 'Ketua RW 09' }),
  person('p_ani', 'Bu Ani', 1, 1979, 0, 0, 0, { groupId: 'rt03', role: 'rt', title: 'Ketua RT 03' }),
  person('p_nabila', 'Nabila', 2, 2007, 540, 110, 11),
  person('p_raka', 'Raka', 0, 2005, 470, 90, 9),
  person('p_salsa', 'Salsa', 5, 2009, 410, 120, 8),
  person('p_dimas', 'Dimas', 6, 2006, 365, 45, 7),
  person('p_keisha', 'Keisha', 1, 2010, 300, 70, 6, { trust: 62 }),
  person('p_fajar', 'Fajar', 4, 2004, 240, 40, 5),
  person('p_alya', 'Alya', 7, 2008, 190, 50, 4),
  person('p_bagas', 'Bagas', 3, 2011, 130, 0, 3),
  person('p_citra', 'Citra', 2, 2006, 80, 40, 1),
  person('p_yoga', 'Yoga', 0, 2012, 40, 0, 1),
  person('p_yati', 'Bu Yati', 7, 1953),
  person('p_udin', 'Pak Udin', 4, 1958),
]

interface QSeed {
  key: string
  title: string
  category: Category
  desc: string
  place: string
  at: [number, number]
  radius: number
  minMinutes: number
  offsetMin: number
  durMin: number
  points: number
  slots: number
  source: Quest['source']
  requester?: string
}

const QUESTS: QSeed[] = [
  {
    key: 'kenari',
    title: 'Angkut sampah liar Gang Kenari',
    category: 'sampah',
    desc: 'Tumpukan sampah plastik di mulut Gang Kenari. Masukkan ke karung, pisahkan botol, bawa ke titik kumpul bank sampah.',
    place: 'Mulut Gang Kenari',
    at: [40, 30],
    radius: 45,
    minMinutes: 10,
    offsetMin: -40,
    durMin: 240,
    points: 50,
    slots: 6,
    source: 'laporan',
    requester: 'p_dimas',
  },
  {
    key: 'selokan',
    title: 'Bersihkan selokan pos ronda',
    category: 'got',
    desc: 'Angkat sampah dan lumpur dari selokan samping pos ronda sebelum musim hujan. Sarung tangan dan cangkul ada di pos.',
    place: 'Samping Pos Ronda RT 04',
    at: [-120, 90],
    radius: 50,
    minMinutes: 15,
    offsetMin: -20,
    durMin: 200,
    points: 70,
    slots: 5,
    source: 'rt',
  },
  {
    key: 'yati',
    title: 'Bantu Bu Yati bersihkan saluran',
    category: 'bantu',
    desc: 'Saluran air depan rumah Bu Yati mampet. Beliau sudah sepuh dan tidak kuat mengangkat penutup saluran.',
    place: 'Rumah Bu Yati, Gang Sawo no. 7',
    at: [130, -80],
    radius: 40,
    minMinutes: 10,
    offsetMin: -60,
    durMin: 300,
    points: 60,
    slots: 2,
    source: 'tolong',
    requester: 'p_yati',
  },
  {
    key: 'taman',
    title: 'Rawat taman dekat musala',
    category: 'taman',
    desc: 'Siram tanaman, cabut rumput liar, dan rapikan pot di taman kecil dekat Musala Al-Ikhlas.',
    place: 'Taman Musala Al-Ikhlas',
    at: [-150, -80],
    radius: 50,
    minMinutes: 10,
    offsetMin: 130,
    durMin: 120,
    points: 45,
    slots: 6,
    source: 'rt',
  },
  {
    key: 'lampu',
    title: 'Ganti lampu jalan gang buntu',
    category: 'rusak',
    desc: 'Bantu Pak RT memasang lampu jalan baru. Tangga dan lampu disediakan, cukup bantu pegang dan rapikan kabel.',
    place: 'Ujung Gang Melati (buntu)',
    at: [90, 150],
    radius: 40,
    minMinutes: 15,
    offsetMin: 21 * 60,
    durMin: 180,
    points: 80,
    slots: 3,
    source: 'rt',
  },
]

/** regu & alat yang sudah disanggupi warga contoh */
const PLEDGES: Record<string, Record<string, string[]>> = {
  kenari: { ikut: ['p_nabila', 'p_keisha'], karung: ['p_nabila'] },
  selokan: { ikut: ['p_raka', 'p_nabila', 'p_fajar'], cangkul: ['p_raka'], sarung: ['p_fajar'] },
  yati: { ikut: ['p_salsa'] },
  taman: { ikut: ['p_alya'], sapu: ['p_alya'] },
  lampu: {},
}

async function evidence(
  img: string,
  at: number,
  p: LatLng,
  userId: string,
  ref: string,
): Promise<Evidence> {
  const base = { img, at, lat: p.lat, lng: p.lng, acc: 8, hash: await dHash(img), sample: true }
  return { ...base, seal: await sealEvidence(base, userId, ref) }
}

/** Data awal sebuah RT: quest contoh, laporan, obrolan, dan beberapa setoran untuk dicek Ketua RT. */
export async function seedData(home: LatLng, now = Date.now()) {
  const groups = seedGroups(home)
  const posts: Post[] = []
  const pos = (e: number, n: number) => offset(home, e, n)
  const post = (p: Omit<Post, 'id'>): Post => {
    const full = { id: uid('m'), ...p }
    posts.push(full)
    return full
  }

  // laporan & permintaan tolong yang sudah jadi quest
  const dimasReport = post({
    groupId: MY_GROUP,
    channel: 'laporan',
    kind: 'laporan',
    authorId: 'p_dimas',
    at: now - 26 * 60 * MIN,
    text: 'Sampah plastik numpuk di mulut Gang Kenari, baunya sampai ke rumah warga.',
    place: 'Mulut Gang Kenari',
    category: 'sampah',
    ...pos(40, 30),
    status: 'jadi_quest',
    witnesses: ['p_salsa', 'p_raka', 'p_alya'],
  })
  dimasReport.photo = await evidence(demoPhoto('before', 'sampah', 3), dimasReport.at, pos(40, 30), 'p_dimas', dimasReport.id)

  const yatiPost = post({
    groupId: MY_GROUP,
    channel: 'tolong',
    kind: 'tolong',
    authorId: 'p_yati',
    at: now - 20 * 60 * MIN,
    text: 'Assalamualaikum. Saluran depan rumah saya mampet, saya sudah tidak kuat mengangkat penutupnya. Minta tolong adik-adik.',
    place: 'Rumah Bu Yati, Gang Sawo no. 7',
    category: 'bantu',
    ...pos(130, -80),
    status: 'jadi_quest',
    witnesses: ['p_udin'],
  })
  yatiPost.photo = await evidence(demoPhoto('before', 'got', 5), yatiPost.at, pos(130, -80), 'p_yati', yatiPost.id)

  // quest
  const quests: Quest[] = QUESTS.map((d) => {
    const p = pos(d.at[0], d.at[1])
    const startAt = now + d.offsetMin * MIN
    const id = uid('q')
    const fromPostId = d.key === 'kenari' ? dimasReport.id : d.key === 'yati' ? yatiPost.id : undefined
    return {
      id,
      code: `Q-${shortCode(id)}`,
      groupId: MY_GROUP,
      title: d.title,
      category: d.category,
      desc: d.desc,
      place: d.place,
      lat: p.lat,
      lng: p.lng,
      radius: d.radius,
      minMinutes: d.minMinutes,
      startAt,
      endAt: startAt + d.durMin * MIN,
      points: d.points,
      slots: d.slots,
      createdAt: now - 25 * 60 * MIN,
      createdBy: LEADER,
      source: d.source,
      fromPostId,
      requesterId: d.requester,
      demo: { offsetMin: d.offsetMin, durMin: d.durMin },
    }
  })
  const q = (k: string) => quests[QUESTS.findIndex((d) => d.key === k)]
  dimasReport.questId = q('kenari').id
  yatiPost.questId = q('yati').id

  // laporan yang menunggu keputusan RT
  const salsa = post({
    groupId: MY_GROUP,
    channel: 'laporan',
    kind: 'laporan',
    authorId: 'p_salsa',
    at: now - 34 * MIN,
    text: 'Tumpukan kantong sampah di belakang warung Bu Tini, sudah tiga hari belum diangkut.',
    place: 'Belakang Warung Bu Tini',
    category: 'sampah',
    ...pos(-30, -120),
    status: 'menunggu',
    witnesses: ['p_raka', 'p_keisha'],
  })
  salsa.photo = await evidence(demoPhoto('before', 'sampah', 1), salsa.at, pos(-30, -120), 'p_salsa', salsa.id)

  const keishaReport = post({
    groupId: MY_GROUP,
    channel: 'laporan',
    kind: 'laporan',
    authorId: 'p_keisha',
    at: now - 3 * 60 * MIN,
    text: 'Jalan berlubang di Gang Sawo, kemarin ada motor jatuh.',
    place: 'Gang Sawo dekat tiang listrik',
    category: 'rusak',
    ...pos(170, 40),
    status: 'menunggu',
    witnesses: [],
  })
  keishaReport.photo = await evidence(demoPhoto('before', 'rusak', 2), keishaReport.at, pos(170, 40), 'p_keisha', keishaReport.id)

  const udin = post({
    groupId: MY_GROUP,
    channel: 'tolong',
    kind: 'tolong',
    authorId: 'p_udin',
    at: now - 75 * MIN,
    text: 'Minta tolong bantu angkat galon dan beras ke lantai dua. Lutut saya sedang sakit.',
    place: 'Rumah Pak Udin, Gang Melati no. 3',
    category: 'bantu',
    ...pos(-60, 170),
    status: 'menunggu',
    witnesses: [],
  })
  udin.photo = await evidence(demoPhoto('before', 'bantu', 4), udin.at, pos(-60, 170), 'p_udin', udin.id)

  // kentongan (panggilan pengurus)
  post({
    groupId: MY_GROUP,
    channel: 'obrolan',
    kind: 'umum',
    authorId: LEADER,
    at: now - 5 * 60 * MIN,
    text: 'Kerja bakti selokan sore ini jam 16.00 sebelum musim hujan. Sarung tangan ada di pos ronda, ambil saja.',
    reactions: { siap: ['p_nabila', 'p_raka', 'p_dimas', 'p_alya', 'p_yati'] },
  })

  // pengumuman quest
  for (const k of ['kenari', 'selokan', 'yati', 'taman', 'lampu']) {
    const qq = q(k)
    post({
      groupId: MY_GROUP,
      channel: 'quest',
      kind: 'quest',
      authorId: LEADER,
      at: qq.createdAt,
      text: qq.source === 'rt' ? 'Quest baru dari pengurus RT.' : qq.source === 'laporan' ? 'Dari laporan warga, sekarang jadi quest.' : 'Permintaan tolong warga, sekarang jadi quest.',
      questId: qq.id,
      reactions: PLEDGES[k],
    })
  }

  // grup RW
  post({
    groupId: RW_GROUP,
    channel: 'obrolan',
    kind: 'umum',
    authorId: 'p_rahmat',
    at: now - 9 * 60 * MIN,
    text: 'Lomba kebersihan antar-RT bulan ini dimulai. RT dengan poin warga muda tertinggi dapat dana kas Rp500.000 untuk kegiatan pemuda.',
    reactions: { siap: ['p_raka', 'p_nabila', 'p_salsa', 'p_ani', LEADER] },
  })

  // setoran
  const subs: Submission[] = []
  const sub = async (questKey: string, userId: string, minsAgo: number, workMin: number, status: Submission['status'], note?: string) => {
    const qq = q(questKey)
    const p = { lat: qq.lat, lng: qq.lng }
    const afterAt = now - minsAgo * MIN
    const beforeAt = afterAt - workMin * MIN
    const v = subs.length + 1
    const s: Submission = {
      id: uid('s'),
      questId: qq.id,
      userId,
      checkin: { ...offset(p, 6, -4), acc: 9, at: beforeAt - 2 * MIN, simulated: false, mock: false, emulator: false, dist: 7 + v * 3 },
      before: await evidence(demoPhoto('before', qq.category, v), beforeAt, offset(p, 5, -3), userId, qq.id),
      after: await evidence(demoPhoto('after', qq.category, v), afterAt, offset(p, 4, -5), userId, qq.id),
      note,
      status,
      submittedAt: afterAt + MIN,
    }
    if (status === 'approved') Object.assign(s, { reviewedAt: afterAt + 5 * MIN, reviewerId: LEADER, awarded: qq.points, celebrated: true })
    subs.push(s)
  }
  await sub('kenari', 'p_nabila', 160, 18, 'approved', 'Dapat empat karung, botolnya sudah dipisah.')
  await sub('selokan', 'p_raka', 9, 22, 'pending', 'Lumpurnya lumayan tebal, sudah diangkat tiga karung.')
  await sub('kenari', 'p_keisha', 14, 3, 'pending')
  await sub('yati', 'p_salsa', 20, 14, 'pending', 'Penutup saluran sudah dibuka, airnya lancar lagi.')

  const bonuses: Bonus[] = [{ id: uid('b'), userId: 'p_dimas', points: 10, at: now - 25 * 60 * MIN, reason: 'Laporan diterima RT' }]

  return { groups, quests, posts, subs, bonuses }
}

/**
 * Quest contoh yang sudah lewat jadwalnya dibuat ulang dengan jadwal baru,
 * supaya demo selalu punya quest aktif. Quest lama ditutup dan tetap jadi riwayat.
 */
export function rollDemoQuests(quests: Quest[], now = Date.now()): Quest[] | null {
  let changed = false
  const out: Quest[] = []
  for (const q of quests) {
    if (q.demo && !q.closed && now > q.endAt) {
      changed = true
      out.push({ ...q, closed: true, demo: undefined })
      const startAt = now + Math.max(-30, q.demo.offsetMin) * MIN
      const id = uid('q')
      out.push({ ...q, id, code: `Q-${shortCode(id)}`, startAt, endAt: startAt + q.demo.durMin * MIN, createdAt: now - 60 * MIN })
    } else {
      out.push(q)
    }
  }
  return changed ? out : null
}

export function defaultQuestFor(cat: Category) {
  return { title: CATS[cat].title, desc: CATS[cat].desc, points: CATS[cat].points }
}
