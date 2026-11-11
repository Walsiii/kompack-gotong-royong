import type { Category, Reward } from './types'

export interface CatInfo {
  id: Category
  label: string
  /** warna kategori: dipakai di penanda peta dan ikon */
  color: string
  /** judul & deskripsi bawaan saat Ketua RT membuat misi */
  title: string
  desc: string
  points: number
  /** contoh isi laporan (placeholder) */
  hint: string
}

export const CATS: Record<Category, CatInfo> = {
  sampah: {
    id: 'sampah',
    label: 'Sampah',
    color: 'var(--color-ink)',
    title: 'Angkut sampah liar',
    desc: 'Kumpulkan sampah yang menumpuk ke karung, pisahkan plastik, lalu bawa ke titik kumpul.',
    points: 50,
    hint: 'mis. Tumpukan sampah plastik di pojok gang, sudah 3 hari',
  },
  got: {
    id: 'got',
    label: 'Selokan',
    color: 'var(--color-ink)',
    title: 'Bersihkan selokan',
    desc: 'Angkat sampah dan lumpur dari selokan supaya air mengalir. Pakai sarung tangan.',
    points: 70,
    hint: 'mis. Selokan depan warung mampet, air meluap kalau hujan',
  },
  rusak: {
    id: 'rusak',
    label: 'Fasilitas rusak',
    color: 'var(--color-ink)',
    title: 'Perbaiki fasilitas',
    desc: 'Bantu perbaiki fasilitas umum yang rusak bersama pengurus RT. Alat disediakan.',
    points: 80,
    hint: 'mis. Lampu jalan depan musala mati sejak minggu lalu',
  },
  taman: {
    id: 'taman',
    label: 'Taman',
    color: 'var(--color-ink)',
    title: 'Rawat taman warga',
    desc: 'Siram tanaman, cabut rumput liar, dan rapikan pot di taman RT.',
    points: 45,
    hint: 'mis. Taman dekat pos ronda penuh rumput liar',
  },
  bantu: {
    id: 'bantu',
    label: 'Bantu warga',
    color: 'var(--color-ink)',
    title: 'Bantu tetangga',
    desc: 'Bantu warga yang butuh tenaga, misalnya lansia yang tidak kuat mengangkat barang.',
    points: 60,
    hint: 'mis. Minta tolong angkat lemari ke lantai atas, saya sudah sepuh',
  },
}

export const CAT_LIST = Object.values(CATS)
export const REPORT_CATS: Category[] = ['sampah', 'got', 'rusak', 'taman']

export interface Rank {
  level: number
  name: string
  min: number
  blurb: string
}

export const RANKS: Rank[] = [
  { level: 1, name: 'Warga Baru', min: 0, blurb: 'Baru mulai kenal lingkungan.' },
  { level: 2, name: 'Anak Ronda', min: 50, blurb: 'Sudah mulai kelihatan di gang.' },
  { level: 3, name: 'Jagoan Gang', min: 150, blurb: 'Tetangga mulai hafal namamu.' },
  { level: 4, name: 'Pendekar RT', min: 300, blurb: 'Andalan tiap kerja bakti.' },
  { level: 5, name: 'Sesepuh Muda', min: 500, blurb: 'Dituakan walau masih muda.' },
  { level: 6, name: 'Legenda Kampung', min: 800, blurb: 'Namamu disebut di rapat RT.' },
]

export function rankOf(points: number): Rank {
  let r = RANKS[0]
  for (const k of RANKS) if (points >= k.min) r = k
  return r
}

export function nextRank(points: number): Rank | null {
  return RANKS.find((k) => k.min > points) ?? null
}

export function rankProgress(points: number): number {
  const cur = rankOf(points)
  const nxt = nextRank(points)
  if (!nxt) return 1
  return Math.min(1, Math.max(0, (points - cur.min) / (nxt.min - cur.min)))
}

export const REWARDS: Reward[] = [
  { id: 'esteh', title: 'Es teh jumbo', desc: 'Tunjukkan kode ke Bu Tini.', partner: 'Warung Bu Tini', cost: 60 },
  { id: 'print', title: 'Print 20 lembar', desc: 'Pas buat tugas sekolah atau kuliah.', partner: 'Fotokopi Barokah', cost: 90 },
  { id: 'cukur', title: 'Potong rambut −50%', desc: 'Sekali pakai, semua model.', partner: 'Pangkas Mas Agus', cost: 150 },
  {
    id: 'sertifikat',
    title: 'Sertifikat Bakti Lingkungan',
    desc: 'Ditandatangani Ketua RT. Untuk portofolio, OSIS, atau beasiswa.',
    partner: 'Pengurus RT',
    cost: 200,
  },
]

export const COMMUNITY = {
  kampung: 'Kampung Sukamaju',
  goalTitle: 'Nobar + bakar jagung',
  goalDesc: 'Kalau poin warga muda RT ini terkumpul, pengurus menggelar layar tancap di lapangan.',
  goalTarget: 3000,
}

/* ───────────── Aturan anti-curang ───────────── */

export const RULES = {
  /** akurasi GPS terburuk yang diterima untuk check-in & foto (meter) */
  maxAccuracy: 40,
  /** kecepatan wajar maksimal antar pembacaan GPS (m/detik) — di atasnya dianggap "lompat" */
  maxSpeed: 40,
  /** check-in diblokir selama ini setelah lokasi melompat */
  jumpCooldownMs: 3 * 60000,
  /** misi per hari per warga */
  dailyQuests: 4,
  /** laporan/minta tolong per hari per warga */
  dailyReports: 3,
  /** batas kemiripan foto sebelum–sesudah (jarak Hamming dHash 64-bit) */
  sameHash: 5,
  /** batas foto dianggap dipakai ulang */
  dupHash: 3,
  /** sudut foto sesudah dianggap terlalu berbeda */
  farHash: 34,
  /** poin untuk pelapor bila laporannya diterima RT */
  reporterBonus: 10,
  /** usia warga muda yang masuk klasemen */
  youthMin: 13,
  youthMax: 25,
}

export const REJECT_REASONS = [
  'Lokasi belum bersih',
  'Foto tidak jelas',
  'Foto bukan di lokasi misi',
  'Pekerjaan belum selesai',
]

export const DISMISS_REASONS = ['Sudah dibereskan', 'Di luar tanggung jawab RT', 'Laporan ganda', 'Foto tidak sesuai']
