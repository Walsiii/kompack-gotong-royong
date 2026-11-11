export type Category = 'sampah' | 'got' | 'rusak' | 'taman' | 'bantu'

export interface LatLng {
  lat: number
  lng: number
}

/** Poligon wilayah (titik-titik sudut, tidak ditutup) */
export type Ring = LatLng[]

export interface Group {
  id: string
  kind: 'rt' | 'rw'
  /** "RT 04" atau "RW 09" */
  name: string
  /** "RW 09" */
  rw: string
  /** wilayah RT; kosong untuk grup RW */
  territory: Ring
  leaderId: string
  /** poin warga muda sebelum periode demo (untuk klasemen antar-RT) */
  basePoints: number
  member: boolean
}

export type Role = 'warga' | 'rt'

export interface Person {
  id: string
  name: string
  avatar: number
  birthYear: number
  groupId: string
  role: Role
  basePoints: number
  baseWeek: number
  baseQuests: number
  /** skor kepercayaan 0–100: turun bila setoran ditolak */
  trust: number
  /** jabatan yang ditampilkan, mis. "Ketua RT 04" */
  title?: string
}

export type QuestSource = 'rt' | 'laporan' | 'tolong'

export interface Quest {
  id: string
  code: string
  groupId: string
  title: string
  category: Category
  desc: string
  place: string
  lat: number
  lng: number
  /** radius check-in (meter), diatur Ketua RT */
  radius: number
  /** lama kerja minimal antara foto sebelum & sesudah (menit) */
  minMinutes: number
  startAt: number
  endAt: number
  points: number
  slots: number
  createdAt: number
  createdBy: string
  source: QuestSource
  fromPostId?: string
  /** pelapor / peminta tolong — tidak boleh mengambil quest ini */
  requesterId?: string
  closed?: boolean
  demo?: { offsetMin: number; durMin: number }
}

/** Bukti foto yang diambil langsung dari kamera aplikasi */
export interface Evidence {
  img: string
  at: number
  lat: number
  lng: number
  acc: number
  /** sidik visual 64-bit (dHash), hex */
  hash: string
  /** segel SHA-256 atas foto + waktu + lokasi + pengguna */
  seal: string
  /** foto contoh dari mode uji (bukan kamera) */
  sample?: boolean
  /** lokasi disimulasikan (mode uji) */
  simulated?: boolean
}

export interface Fix {
  lat: number
  lng: number
  acc: number
  at: number
  simulated: boolean
  mock: boolean
  emulator: boolean
}

export type CheckStatus = 'ok' | 'warn' | 'bad'

export interface Check {
  id: string
  label: string
  status: CheckStatus
  detail: string
}

export type SubStatus = 'checked_in' | 'pending' | 'approved' | 'rejected'

export interface Submission {
  id: string
  questId: string
  userId: string
  checkin: Fix & { dist: number }
  before?: Evidence
  after?: Evidence
  note?: string
  status: SubStatus
  submittedAt?: number
  reviewedAt?: number
  reviewerId?: string
  rejectReason?: string
  awarded?: number
  celebrated?: boolean
  checks?: Check[]
}

export type Channel = 'obrolan' | 'laporan' | 'tolong' | 'quest'
export type PostKind = 'chat' | 'laporan' | 'tolong' | 'quest' | 'umum' | 'sistem'
export type PostStatus = 'menunggu' | 'jadi_quest' | 'ditolak' | 'beres'

export interface Post {
  id: string
  groupId: string
  channel: Channel
  kind: PostKind
  authorId: string
  at: number
  text: string
  place?: string
  category?: Category
  photo?: Evidence
  lat?: number
  lng?: number
  status?: PostStatus
  statusNote?: string
  questId?: string
  witnesses?: string[]
  reactions?: Record<string, string[]>
  replyTo?: string
}

export interface Bonus {
  id: string
  userId: string
  points: number
  at: number
  reason: string
}

export interface Reward {
  id: string
  title: string
  desc: string
  partner: string
  cost: number
}

export interface Redemption {
  id: string
  rewardId: string
  userId: string
  code: string
  at: number
  fulfilledAt?: number
}
