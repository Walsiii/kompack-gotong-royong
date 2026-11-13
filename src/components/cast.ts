/*
 * Warga Kompack! — desain karakter bergaya bersih (clean):
 * bentuk dasar sederhana, warna rata tanpa garis tepi dan tanpa motif, kepala besar,
 * mata putih dengan pupil hitam, kelopak & alis tebal untuk ekspresi, siluet tiap karakter berbeda.
 * Bidang gambar 200×240, tanah di y=232. Bagian statis berupa string SVG; mata, alis, mulut,
 * lengan dan aksesori dianimasikan oleh <Character>.
 */

export type CharacterId = 'kompi' | 'resik' | 'asih' | 'jaga' | 'tunas' | 'rt'

export const CHARACTERS: Record<CharacterId, { name: string; role: string }> = {
  kompi: { name: 'Kompi', role: 'Kucing oren paling kompak' },
  resik: { name: 'Resik', role: 'Jagoan kebersihan' },
  asih: { name: 'Bu Asih', role: 'Siap bantu tetangga' },
  tunas: { name: 'Mbah Tunas', role: 'Juru rawat taman' },
  jaga: { name: 'Mang Jaga', role: 'Teman ronda malam' },
  rt: { name: 'Pak RT', role: 'Pengurus kampung' },
}

export interface Limb {
  html: string
  /** titik putar di bahu */
  px: number
  py: number
  /** benda yang dipegang tangan ini (ikut berputar bersama lengan) */
  hold?: string
}
export interface Eye {
  x: number
  y: number
  w: number
  h: number
}
/** [x tengah, y atas, lebar, tebal, miring°] */
export type Brow = [number, number, number, number, number]
export interface Rig {
  /** skala tubuh dari titik tanah (karakter pendek < 1) */
  scale?: number
  back?: string
  legs: string
  neck?: string
  body: string
  armL: Limb
  armR: Limb
  /** lengan yang melambai */
  wave: 'L' | 'R'
  head: { px: number; py: number; back?: string; base: string; top?: string }
  sway?: { html: string; px: number; py: number; deg: number }
  eyes: { l: Eye; r: Eye; pupil: number; /** arah lirikan bawaan −1..1 */ look?: number; lid?: { color: string; amount: number } }
  brows?: { l: Brow; r: Brow; color: string }
  nose?: string
  glasses?: string
  /** kumis/kumis kucing, digambar di atas mulut */
  over?: string
  mouth: { x: number; y: number; w: number }
}

export const INK = '#171717'
export const WHITE = '#ffffff'
export const MOUTH = '#3d1418'
export const TONGUE = '#ff7d86'

/* ── konstruksi manusia baku (¾): kepala menempel ke badan, lengan keluar dari balik bahu,
      mata besar berdekatan yang melirik ke arah hadap, hidung & mulut berupa bidang ── */
interface HumanSpec {
  /** −1 menghadap kiri, 1 menghadap kanan */
  dir: -1 | 1
  skin: string
  shade: string
  head: { cx: number; top: number; w: number; h: number; r: number }
  faceShift?: number
  noEar?: boolean
  torso: { w: number; bottom: number; color: string; flare?: number; r?: number; extra?: string }
  sleeve: string
  long?: boolean
  arm?: { len?: number; w?: number; spread?: number }
  legs?: { color: string; w?: number; gap?: number }
  shoes: string
  hair?: string
  top?: string
  eyes?: { size?: number; lid?: number }
  brows: { color: string; tilt?: [number, number]; w?: number; h?: number }
  nose: number
  mouthW?: number
  glasses?: 'round' | 'square'
  glassColor?: string
  mustache?: string
  holdL?: (x: number, y: number) => string
  holdR?: (x: number, y: number) => string
  wave: 'L' | 'R'
  scale?: number
}

const darken = (hex: string, f = 0.86) =>
  '#' + hex.slice(1).match(/../g)!.map((c) => Math.round(parseInt(c, 16) * f).toString(16).padStart(2, '0')).join('')

function human(s: HumanSpec): Rig {
  const { cx, top, w, h, r } = s.head
  const d = s.dir
  const fx = cx + d * (s.faceShift ?? 7)
  const es = s.eyes?.size ?? 1
  const ew = 9.5 * es
  const eh = 11 * es
  const ey = top + h * 0.53
  const eyeL = { x: fx - ew - 0.8, y: ey, w: d === -1 ? ew * 0.92 : ew, h: d === -1 ? eh * 0.96 : eh }
  const eyeR = { x: fx + ew + 0.8, y: ey, w: d === 1 ? ew * 0.92 : ew, h: d === 1 ? eh * 0.96 : eh }

  // badan
  const tt = top + h - 8
  const x0 = cx - s.torso.w / 2
  const x1 = cx + s.torso.w / 2
  const fl = s.torso.flare ?? 0
  const tr = s.torso.r ?? 14
  const tb = s.torso.bottom
  const body = `<path d="M${x0} ${tt + tr}Q${x0} ${tt} ${x0 + tr} ${tt}H${x1 - tr}Q${x1} ${tt} ${x1} ${tt + tr}L${x1 + fl} ${tb}H${x0 - fl}Z" fill="${s.torso.color}"/>${s.torso.extra ?? ''}`

  // lengan (di belakang badan, ujung membulat warna kulit)
  const len = s.arm?.len ?? 50
  const aw = s.arm?.w ?? 15
  const sp = ((s.arm?.spread ?? 19) * Math.PI) / 180
  const sy = tt + 12
  const sxL = x0 + 6
  const sxR = x1 - 6
  const sleeve = s.sleeve === s.torso.color ? darken(s.sleeve) : s.sleeve
  const hy = sy + Math.cos(sp) * len
  const hxL = sxL - Math.sin(sp) * len
  const hxR = sxR + Math.sin(sp) * len
  const k = s.long ? 0.78 : 0.4
  const armSvg = (sx: number, hx: number) =>
    `<path d="M${sx} ${sy}L${hx} ${hy}" stroke="${s.skin}" stroke-width="${aw}" stroke-linecap="round"/>
    <path d="M${sx} ${sy}L${sx + (hx - sx) * k} ${sy + (hy - sy) * k}" stroke="${sleeve}" stroke-width="${aw + 1.5}"/><circle cx="${sx}" cy="${sy}" r="${(aw + 1.5) / 2}" fill="${sleeve}"/>`

  // kaki & sepatu
  const lw = s.legs?.w ?? 13
  const lg = s.legs?.gap ?? 7
  const lcL = cx - lg / 2 - lw / 2
  const lcR = cx + lg / 2 + lw / 2
  const legTop = tb - 6
  const shoe = (c: number) => `<rect x="${c - 12 + d * 4}" y="223" width="24" height="10" rx="5" fill="${s.shoes}"/>`
  const legs = s.legs
    ? `<rect x="${lcL - lw / 2}" y="${legTop}" width="${lw}" height="${227 - legTop}" fill="${s.legs.color}"/><rect x="${lcR - lw / 2}" y="${legTop}" width="${lw}" height="${227 - legTop}" fill="${s.legs.color}"/>${shoe(lcL)}${shoe(lcR)}`
    : `${shoe(cx - 12)}${shoe(cx + 12)}`

  // kepala
  const earX = cx - d * (w / 2 - 1)
  const ear = s.noEar ? '' : `<ellipse cx="${earX}" cy="${ey + 3}" rx="7" ry="9.5" fill="${s.skin}"/><ellipse cx="${earX - d * 2}" cy="${ey + 3}" rx="3" ry="5" fill="${s.shade}"/>`
  const base = `${s.hair ?? ''}${ear}<rect x="${cx - w / 2}" y="${top}" width="${w}" height="${h}" rx="${r}" fill="${s.skin}"/>`

  const nx = fx + d * 4
  const ny = ey + eh + 4
  const n = s.nose / 6
  const nose = `<path d="M${nx - d * 3 * n} ${ny - 9 * n}Q${nx + d * 10 * n} ${ny + 2 * n} ${nx + d * 5 * n} ${ny + 6 * n}Q${nx - d * 2 * n} ${ny + 9 * n} ${nx - d * 6 * n} ${ny + 4 * n}Z" fill="${s.shade}"/>`
  const my = ny + 8 * n + 5
  const mx = fx + d * 2
  const mustache = s.mustache
    ? `<path d="M${mx - 17} ${my - 2}Q${mx - 8} ${my - 11} ${mx} ${my - 6}Q${mx + 8} ${my - 11} ${mx + 17} ${my - 2}Q${mx + 7} ${my + 4} ${mx} ${my}Q${mx - 7} ${my + 4} ${mx - 17} ${my - 2}Z" fill="${s.mustache}"/>`
    : undefined
  const gc = s.glassColor ?? INK
  const glasses =
    s.glasses === 'round'
      ? `<g fill="none" stroke="${gc}" stroke-width="2.6"><circle cx="${eyeL.x}" cy="${ey}" r="${eyeL.w + 3}"/><circle cx="${eyeR.x}" cy="${ey}" r="${eyeR.w + 3}"/></g>`
      : s.glasses === 'square'
        ? `<g fill="none" stroke="${gc}" stroke-width="2.6"><rect x="${eyeL.x - eyeL.w - 3}" y="${ey - eh - 2}" width="${eyeL.w * 2 + 6}" height="${eh * 2 + 4}" rx="6"/><rect x="${eyeR.x - eyeR.w - 3}" y="${ey - eh - 2}" width="${eyeR.w * 2 + 6}" height="${eh * 2 + 4}" rx="6"/></g>`
        : undefined
  const bw = s.brows.w ?? ew * 1.45
  const bh = s.brows.h ?? 5
  const [tl, trr] = s.brows.tilt ?? [-5, 5]

  return {
    scale: s.scale,
    legs,
    body,
    armL: { html: armSvg(sxL, hxL), px: sxL, py: sy, hold: s.holdL?.(hxL, hy) },
    armR: { html: armSvg(sxR, hxR), px: sxR, py: sy, hold: s.holdR?.(hxR, hy) },
    wave: s.wave,
    head: { px: cx, py: top + h, base, top: s.top },
    eyes: { l: eyeL, r: eyeR, pupil: ew * 0.6, look: d * 0.6, lid: s.eyes?.lid ? { color: s.skin, amount: s.eyes.lid } : undefined },
    brows: { l: [eyeL.x, ey - eh - 8, bw, bh, tl], r: [eyeR.x, ey - eh - 8, bw, bh, trr], color: s.brows.color },
    nose,
    glasses,
    over: mustache,
    mouth: { x: mx, y: my, w: s.mouthW ?? 19 },
  }
}

const RIGS: Record<CharacterId, Rig> = {
  /* ── Kompi: kucing oren — maskot utama ── */
  kompi: {
    back: `<path d="M146 206Q182 204 180 166Q179 150 168 142" stroke="#f08a24" stroke-width="14" fill="none" stroke-linecap="round"/>`,
    legs: `<rect x="66" y="221" width="30" height="12" rx="6" fill="#ffd9a8"/><rect x="104" y="221" width="30" height="12" rx="6" fill="#ffd9a8"/>`,
    body: '',
    armL: { html: `<path d="M54 150L40 182" stroke="#f08a24" stroke-width="18" stroke-linecap="round"/><circle cx="39" cy="185" r="9.5" fill="#ffd9a8"/>`, px: 56, py: 148 },
    armR: { html: `<path d="M146 150L160 182" stroke="#f08a24" stroke-width="18" stroke-linecap="round"/><circle cx="161" cy="185" r="9.5" fill="#ffd9a8"/>`, px: 144, py: 148 },
    wave: 'R',
    head: {
      px: 100,
      py: 226,
      base: `<path d="M48 90L56 26L94 52Z" fill="#f5902a"/><path d="M152 90L144 26L106 52Z" fill="#f5902a"/>
        <path d="M60 68L63 42L82 55Z" fill="#ff9fb0"/><path d="M140 68L137 42L118 55Z" fill="#ff9fb0"/>
        <path d="M100 44C140 44 156 70 156 106L160 198Q160 226 132 226H68Q40 226 40 198L44 106C44 70 60 44 100 44Z" fill="#f5902a"/>
        <ellipse cx="100" cy="190" rx="34" ry="30" fill="#ffd9a8"/>
        <ellipse cx="100" cy="128" rx="30" ry="19" fill="#ffd9a8"/>
        <g fill="#d9700f"><rect x="84" y="44" width="7" height="20" rx="3.5"/><rect x="96.5" y="44" width="7" height="24" rx="3.5"/><rect x="109" y="44" width="7" height="20" rx="3.5"/>
        <rect x="40" y="112" width="16" height="6" rx="3"/><rect x="42" y="126" width="12" height="6" rx="3"/><rect x="144" y="112" width="16" height="6" rx="3"/><rect x="146" y="126" width="12" height="6" rx="3"/></g>`,
    },
    eyes: { l: { x: 80, y: 98, w: 14, h: 16 }, r: { x: 120, y: 98, w: 14, h: 16 }, pupil: 7.5 },
    brows: { l: [80, 74, 14, 5, -6], r: [120, 74, 14, 5, 6], color: '#b85c0e' },
    nose: `<path d="M93 116H107L100 124Z" fill="#ff7d93"/>`,
    over: `<g stroke="#b85c0e" stroke-width="2.5" stroke-linecap="round"><path d="M66 124L48 120"/><path d="M66 131L50 134"/><path d="M134 124L152 120"/><path d="M134 131L150 134"/></g>`,
    mouth: { x: 100, y: 130, w: 16 },
  },

  resik: human({
    dir: -1,
    skin: '#c47a45',
    shade: '#a3602f',
    head: { cx: 104, top: 28, w: 74, h: 76, r: 26 },
    torso: { w: 56, bottom: 168, color: '#ff7a1a', extra: `<path d="M96 96L104 116L112 96Z" fill="#e6e6e6"/>` },
    sleeve: '#e6e6e6',
    legs: { color: '#2f4b7c' },
    shoes: '#e8453c',
    top: `<path d="M64 47Q64 8 104 8Q144 8 144 47Q104 37 64 47Z" fill="#e8453c"/><rect x="130" y="36" width="34" height="10" rx="5" fill="#c2342b"/>
      <path d="M66 47Q72 39 88 41L86 49Z" fill="#2a1d15"/>`,
    eyes: { lid: 0.22 },
    brows: { color: '#2a1d15', tilt: [-8, 6] },
    nose: 6,
    holdL: (x, y) => `<rect x="${x - 3}" y="${y - 46}" width="6" height="${232 - 26 - (y - 46)}" rx="3" fill="#a8763a"/><path d="M${x - 15} 233L${x - 6} 205H${x + 6}L${x + 15} 233Z" fill="#e2b45f"/>`,
    wave: 'R',
  }),

  asih: human({
    dir: 1,
    skin: '#e0a679',
    shade: '#c4875a',
    head: { cx: 104, top: 36, w: 60, h: 68, r: 29 },
    faceShift: 5,
    noEar: true,
    torso: { w: 60, bottom: 226, flare: 14, r: 20, color: '#1f8f8a' },
    sleeve: '#1f8f8a',
    long: true,
    shoes: '#6b4430',
    hair: `<path d="M56 80Q56 22 102 22Q148 22 148 80L152 132Q102 150 52 132Z" fill="#e2574c"/>`,
    top: `<path d="M72 56Q74 27 104 27Q134 27 136 56Q104 42 72 56Z" fill="#e2574c"/>`,
    brows: { color: '#4a2c1d', tilt: [-4, 5], h: 4 },
    nose: 5,
    holdL: (x, y) => `<path d="M${x - 10} ${y + 9}Q${x} ${y - 8} ${x + 10} ${y + 9}" stroke="#8d989f" stroke-width="4" fill="none"/><rect x="${x - 15}" y="${y + 6}" width="30" height="34" rx="7" fill="#cfd6db"/><rect x="${x - 15}" y="${y + 17}" width="30" height="3" fill="#8d989f"/><rect x="${x - 15}" y="${y + 28}" width="30" height="3" fill="#8d989f"/>`,
    wave: 'R',
  }),

  tunas: human({
    dir: -1,
    scale: 0.9,
    skin: '#b97a4f',
    shade: '#9a5f38',
    head: { cx: 104, top: 46, w: 70, h: 68, r: 28 },
    torso: {
      w: 54,
      bottom: 226,
      flare: 3,
      color: '#8a4b2a',
      extra: `<path d="M77 120Q77 106 91 106H117Q131 106 131 120L133 170H75Z" fill="#3f8f5a"/><path d="M97 106L104 120L111 106Z" fill="#b97a4f"/>`,
    },
    sleeve: '#3f8f5a',
    long: true,
    shoes: '#5b3d2b',
    hair: `<rect x="66" y="62" width="76" height="30" rx="12" fill="#d0d0d0"/>`,
    top: `<path d="M28 58L106 12L184 58Z" fill="#e2b866"/><path d="M106 12L184 58H106Z" fill="#cfa04e"/><rect x="28" y="55" width="156" height="7" rx="3.5" fill="#bb8d3c"/>`,
    eyes: { size: 0.86, lid: 0.3 },
    brows: { color: '#cfcfcf', tilt: [-4, 4], h: 4 },
    nose: 5.5,
    glasses: 'round',
    glassColor: '#3a2a20',
    mouthW: 16,
    holdL: (x, y) => `<path d="M${x - 12} ${y + 3}Q${x} ${y - 10} ${x + 12} ${y + 3}" stroke="#1f7a3a" stroke-width="4" fill="none"/><rect x="${x - 14}" y="${y + 1}" width="28" height="30" rx="6" fill="#2c9a4c"/><path d="M${x - 13} ${y + 9}L${x - 36} ${y - 5}L${x - 38} ${y + 1}L${x - 13} ${y + 21}Z" fill="#2c9a4c"/>`,
    wave: 'R',
  }),

  jaga: human({
    dir: 1,
    skin: '#a86b43',
    shade: '#8a5636',
    head: { cx: 102, top: 26, w: 80, h: 80, r: 26 },
    torso: {
      w: 76,
      bottom: 190,
      flare: 4,
      r: 20,
      color: '#2b3f6b',
      extra: `<path d="M68 108L90 98L144 176L140 190Z" fill="#2c7a4b"/>`,
    },
    sleeve: '#2b3f6b',
    arm: { w: 17, len: 48 },
    legs: { color: '#2a2a2e', w: 15 },
    shoes: '#6b4a33',
    top: `<path d="M63 47L67 10H137L141 47Q102 39 63 47Z" fill="#1b1b1b"/><rect x="64" y="45" width="9" height="22" rx="4.5" fill="#1b1b1b"/>`,
    eyes: { lid: 0.46 },
    brows: { color: '#1b1b1b', tilt: [-3, 5], h: 6.5, w: 16 },
    nose: 8.5,
    mustache: '#1b1b1b',
    holdR: (x, y) => `<path d="M${x + 20} ${y - 6}L200 ${y - 30}V${y + 26}Z" fill="#ffe27a" opacity=".55"/><rect x="${x - 6}" y="${y - 6}" width="27" height="12" rx="4" fill="#3a3a3a"/><rect x="${x + 17}" y="${y - 8}" width="7" height="16" rx="2" fill="#ffd84d"/>`,
    wave: 'L',
  }),

  rt: human({
    dir: -1,
    skin: '#b97a4f',
    shade: '#9a5f38',
    head: { cx: 104, top: 22, w: 66, h: 80, r: 24 },
    torso: { w: 52, bottom: 160, color: '#c26a1e', extra: `<path d="M96 94L104 108L112 94Z" fill="#8a4512"/>` },
    sleeve: '#c26a1e',
    long: true,
    arm: { w: 13, len: 52 },
    legs: { color: '#3b3b40', w: 12 },
    shoes: '#1f1f1f',
    top: `<path d="M67 43L70 8H138L141 43Q104 34 67 43Z" fill="#1b1b1b"/><rect x="128" y="41" width="8" height="20" rx="4" fill="#8f8f8f"/>`,
    eyes: { size: 0.92, lid: 0.15 },
    brows: { color: '#2a2a2a', tilt: [-6, 4] },
    nose: 6,
    glasses: 'square',
    glassColor: '#1b1b1b',
    mustache: '#2a2a2a',
    holdL: (x, y) => `<g transform="rotate(8 ${x} ${y})"><rect x="${x - 15}" y="${y - 12}" width="28" height="38" rx="4" fill="#a8763a"/><rect x="${x - 11}" y="${y - 6}" width="20" height="28" rx="2" fill="#ffffff"/></g>`,
    wave: 'R',
  }),
}

export { RIGS }

/* ── wajah: potongan yang dipakai komponen beranimasi & SVG statis ── */
const eyesOf = (r: Rig) => [r.eyes.l, r.eyes.r]
export const eyeWhite = (r: Rig) => eyesOf(r).map((e) => `<ellipse cx="${e.x}" cy="${e.y}" rx="${e.w}" ry="${e.h}" fill="${WHITE}"/>`).join('')
export const pupils = (r: Rig) => {
  const p = r.eyes.pupil
  const big = Math.max(r.eyes.l.w, r.eyes.r.w)
  return eyesOf(r)
    .map((e) => {
      const pr = p * Math.min(1, e.w / big + 0.08)
      const lx = (r.eyes.look ?? 0) * Math.max(1.2, e.w - pr - 0.5)
      return `<circle cx="${e.x + lx}" cy="${e.y + 1.5}" r="${pr}" fill="${INK}"/>`
    })
    .join('')
}
/** kelopak mata atas (warna kulit): santai, mengantuk */
export const lidsSvg = (r: Rig) => {
  const lid = r.eyes.lid
  if (!lid) return ''
  return eyesOf(r)
    .map((e) => {
      const y = e.y - e.h + e.h * 2 * lid.amount
      return `<path d="M${e.x - e.w - 2} ${e.y - e.h - 2}H${e.x + e.w + 2}V${y - 1.5}Q${e.x} ${y + 3} ${e.x - e.w - 2} ${y - 1.5}Z" fill="${lid.color}"/>`
    })
    .join('')
}
export const happyEyes = (r: Rig) =>
  eyesOf(r)
    .map((e) => `<path d="M${e.x - e.w} ${e.y + 3}Q${e.x} ${e.y - e.h - 2} ${e.x + e.w} ${e.y + 3}" fill="none" stroke="${INK}" stroke-width="${Math.max(3.5, e.w * 0.42)}" stroke-linecap="round"/>`)
    .join('')
export const browsSvg = (r: Rig) =>
  r.brows
    ? [r.brows.l, r.brows.r]
        .map(([x, y, w, h, a]) => `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${r.brows!.color}" transform="rotate(${a} ${x} ${y + h / 2})"/>`)
        .join('')
    : ''
export const smileSvg = (r: Rig) => {
  const { x, y, w } = r.mouth
  return `<path d="M${x - w / 2} ${y - 1}Q${x} ${y + w * 0.6} ${x + w / 2} ${y - 1}Q${x} ${y + w * 0.18} ${x - w / 2} ${y - 1}Z" fill="${MOUTH}"/>`
}
export const openMouthSvg = (r: Rig, big = 1) => {
  const { x, y } = r.mouth
  const w = r.mouth.w * big
  const h = w * 0.75
  return `<path d="M${x - w / 2} ${y - 2}H${x + w / 2}Q${x + w / 2} ${y + h} ${x} ${y + h}Q${x - w / 2} ${y + h} ${x - w / 2} ${y - 2}Z" fill="${MOUTH}"/>
    <ellipse cx="${x}" cy="${y + h * 0.66}" rx="${w * 0.26}" ry="${h * 0.2}" fill="${TONGUE}"/>`
}
export const shadowSvg = `<ellipse cx="102" cy="233" rx="50" ry="5" fill="${INK}" opacity=".1"/>`

/** SVG statis (ikon aplikasi, logo, render server) */
export function characterSvg(who: CharacterId = 'kompi', opts: { shadow?: boolean; viewBox?: string; happy?: boolean; /** hanya kepala & badan (ikon) */ bust?: boolean } = {}): string {
  const r = RIGS[who]
  const eyes = opts.happy ? happyEyes(r) : `${eyeWhite(r)}${pupils(r)}${lidsSvg(r)}`
  const face = `${eyes}${browsSvg(r)}${r.nose ?? ''}${opts.happy ? openMouthSvg(r) : smileSvg(r)}${r.over ?? ''}${r.glasses ?? ''}`
  const s = r.scale ?? 1
  const limbs = opts.bust ? '' : `${r.back ?? ''}${r.legs}${r.armL.hold ?? ''}${r.armL.html}${r.armR.hold ?? ''}${r.armR.html}${r.neck ?? ''}${r.body}`
  const body = `${limbs}${r.head.back ?? ''}${r.head.base}${face}${r.head.top ?? ''}${r.sway?.html ?? ''}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${opts.viewBox ?? '0 0 200 240'}">${opts.shadow === false ? '' : shadowSvg}${s === 1 ? body : `<g transform="translate(${100 * (1 - s)} ${232 * (1 - s)}) scale(${s})">${body}</g>`}</svg>`
}
