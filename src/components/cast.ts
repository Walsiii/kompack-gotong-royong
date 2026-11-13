/*
 * Warga Kompack! — desain karakter (gaya datar & geometris, tanpa garis tepi).
 * Semua karakter memakai bidang gambar 200×240, tanah di y=230.
 * Bagian statis berupa string SVG; mata, alis, mulut, lengan dan aksesori dianimasikan oleh <Character>.
 */

export type CharacterId = 'kompi' | 'resik' | 'asih' | 'jaga' | 'tunas' | 'rt'

export const CHARACTERS: Record<CharacterId, { name: string; role: string }> = {
  kompi: { name: 'Kompi', role: 'Semut paling kompak' },
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
}
export interface Rig {
  back?: string
  legs: string
  neck?: string
  body: string
  armL: Limb
  armR: Limb & { hold?: string }
  head: { px: number; py: number; back?: string; base: string; top?: string }
  sway?: { html: string; px: number; py: number; deg: number }
  eyes: { y: number; lx: number; rx: number; w: number; h: number; pupil: number }
  brows?: { y: number; w: number; h: number; color: string }
  nose?: string
  glasses?: string
  mouth: { x: number; y: number; w: number; light?: boolean }
  cheeks?: { y: number; lx: number; rx: number; color: string; opacity: number }
}

export const INK = '#171717'
export const WHITE = '#ffffff'
export const MOUTH = '#5b1d24'
export const TONGUE = '#ff8a8a'

/* ── potongan tubuh manusia ── */
const leg = (x: number, color: string, top = 172) => `<rect x="${x}" y="${top}" width="17" height="${222 - top}" rx="8.5" fill="${color}"/>`
const legs = (pants: string, shoe: string, sole?: string, top?: number) =>
  `${leg(80, pants, top)}${leg(103, pants, top)}
  <path d="M72 229Q72 214 87 214H94Q99 214 99 220V229Z" fill="${shoe}"/>
  <path d="M128 229Q128 214 113 214H106Q101 214 101 220V229Z" fill="${shoe}"/>
  ${sole ? `<rect x="72" y="225" width="27" height="5" rx="2.5" fill="${sole}"/><rect x="101" y="225" width="27" height="5" rx="2.5" fill="${sole}"/>` : ''}`
const torso = (fill: string) => `<path d="M77 118H123Q140 118 141 136L137 177Q136 187 125 187H75Q64 187 63 177L59 136Q60 118 77 118Z" fill="${fill}"/>`
/** lengan menggantung dari bahu (sx,sy) ke tangan (hx,hy) */
const arm = (sx: number, sy: number, hx: number, hy: number, sleeve: string, skin: string, long = false) => {
  const mx = sx + (hx - sx) * (long ? 0.86 : 0.42)
  const my = sy + (hy - sy) * (long ? 0.86 : 0.42)
  return `<path d="M${sx} ${sy}L${hx} ${hy}" stroke="${skin}" stroke-width="13" stroke-linecap="round"/>
    <path d="M${sx} ${sy}L${mx} ${my}" stroke="${sleeve}" stroke-width="17" stroke-linecap="round"/>
    <circle cx="${hx}" cy="${hy + 2}" r="8.5" fill="${skin}"/>`
}
const head = (skin: string, shade: string) =>
  `<ellipse cx="59" cy="80" rx="7" ry="10" fill="${shade}"/><ellipse cx="141" cy="80" rx="7" ry="10" fill="${shade}"/>
  <rect x="58" y="32" width="84" height="84" rx="36" fill="${skin}"/>`
const nose = (shade: string, y = 86) => `<path d="M95 ${y}Q100 ${y + 9} 105 ${y}Z" fill="${shade}"/>`

const RIGS: Record<CharacterId, Rig> = {
  /* ── Kompi: semut hitam berikat kepala, maskot utama ── */
  kompi: {
    back: `<ellipse cx="146" cy="184" rx="34" ry="29" fill="${INK}" transform="rotate(-18 146 184)"/>
      <path d="M134 162Q148 182 140 208" stroke="#2f2f2f" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M152 158Q166 178 160 202" stroke="#2f2f2f" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    legs: `<path d="M92 196Q86 210 84 224" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round"/>
      <path d="M108 196Q114 210 116 224" stroke="${INK}" stroke-width="9" fill="none" stroke-linecap="round"/>
      <ellipse cx="80" cy="226" rx="13" ry="6.5" fill="${INK}"/><ellipse cx="120" cy="226" rx="13" ry="6.5" fill="${INK}"/>
      <path d="M88 186Q72 192 66 204" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M112 186Q128 192 134 204" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>`,
    body: `<ellipse cx="100" cy="178" rx="22" ry="23" fill="${INK}"/>`,
    armL: { html: `<path d="M86 170Q72 184 68 198" stroke="${INK}" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="67" cy="201" r="9" fill="${WHITE}"/>`, px: 88, py: 168 },
    armR: { html: `<path d="M114 170Q128 184 132 198" stroke="${INK}" stroke-width="8" fill="none" stroke-linecap="round"/><circle cx="133" cy="201" r="9" fill="${WHITE}"/>`, px: 112, py: 168 },
    head: {
      px: 100,
      py: 160,
      base: `<circle cx="100" cy="100" r="58" fill="${INK}"/>
        <path d="M58 82Q66 52 96 44Q72 58 66 86Z" fill="#2c2c2c"/>`,
      top: `<path d="M44 86Q100 62 156 86L155 101Q100 77 45 101Z" fill="#ffc23d"/>`,
    },
    sway: {
      html: `<path d="M80 48Q70 24 54 16" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="52" cy="15" r="8" fill="${INK}"/>
        <path d="M120 48Q130 24 146 16" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="148" cy="15" r="8" fill="${INK}"/>
        <circle cx="155" cy="93" r="9" fill="#ffc23d"/>
        <path d="M161 88Q182 78 192 62Q176 70 157 84Z" fill="#f0ad1a"/><path d="M162 98Q187 100 197 87Q182 108 158 103Z" fill="#d38d0b"/>`,
      px: 100,
      py: 60,
      deg: 6,
    },
    eyes: { y: 116, lx: 78, rx: 122, w: 17, h: 19, pupil: 9 },
    mouth: { x: 100, y: 142, w: 22, light: true },
    cheeks: { y: 138, lx: 58, rx: 142, color: '#ff6b4a', opacity: 0.9 },
  },

  /* ── Resik: remaja berompi oranye dengan sapu lidi ── */
  resik: {
    legs: legs('#2d3e63', '#f4f4f4', '#e8453c'),
    neck: `<rect x="92" y="104" width="16" height="20" fill="#a5692f"/>`,
    body: `${torso('#f1f1f1')}
      <path d="M70 118H90L100 142L110 118H130Q140 118 141 136L137 177Q136 187 125 187H75Q64 187 63 177L59 136Q60 118 70 118Z" fill="#ff7a1a"/>
      <rect x="61" y="154" width="78" height="8" fill="#ffe14d"/><rect x="63" y="170" width="74" height="5" fill="#ffe14d" opacity=".7"/>`,
    armL: { html: arm(66, 126, 56, 172, '#f1f1f1', '#c68642'), px: 66, py: 126 },
    armR: {
      html: arm(134, 126, 144, 172, '#f1f1f1', '#c68642'),
      hold: `<g stroke="#c99a50" stroke-width="2.6" stroke-linecap="round">
          <path d="M146 170L150 229"/><path d="M147 170L157 229"/><path d="M148 170L164 228"/><path d="M149 170L171 227"/><path d="M150 170L177 225"/>
        </g><rect x="141" y="184" width="16" height="7" rx="3" fill="#e8453c" transform="rotate(-14 149 187)"/>`,
      px: 134,
      py: 126,
    },
    head: {
      px: 100,
      py: 112,
      base: `${head('#c68642', '#a5692f')}
        <rect x="60" y="66" width="8" height="18" rx="4" fill="#231a14"/><rect x="132" y="66" width="8" height="18" rx="4" fill="#231a14"/>`,
      top: `<path d="M62 64Q66 40 100 38Q134 40 138 64Q120 54 100 56Q80 54 62 64Z" fill="#231a14"/>
        <path d="M62 58Q62 24 100 22Q138 24 138 58Q100 44 62 58Z" fill="#e8453c"/>
        <path d="M62 54Q44 50 34 60Q48 66 64 62Z" fill="#c2342b"/><circle cx="100" cy="23" r="4.5" fill="#c2342b"/>`,
    },
    eyes: { y: 78, lx: 84, rx: 116, w: 9, h: 10.5, pupil: 5.2 },
    brows: { y: 61, w: 18, h: 5.5, color: '#231a14' },
    nose: nose('#a5692f'),
    mouth: { x: 100, y: 101, w: 18 },
    cheeks: { y: 94, lx: 72, rx: 128, color: '#e0703a', opacity: 0.35 },
  },

  /* ── Bu Asih: ibu berhijab membawa rantang ── */
  asih: {
    back: `<path d="M48 86Q48 22 100 20Q152 22 152 86L158 146Q100 166 42 146Z" fill="#d4447a"/>`,
    legs: `<path d="M78 229Q78 216 90 216H99V229Z" fill="#5b3a29"/><path d="M122 229Q122 216 110 216H101V229Z" fill="#5b3a29"/>`,
    body: `<path d="M77 118H123Q140 118 141 136L150 212Q150 221 141 221H59Q50 221 50 212L59 136Q60 118 77 118Z" fill="#1f8f8a"/>
      <path d="M52 204H148L149 212Q149 221 141 221H59Q51 221 51 212Z" fill="#16706c"/>
      <g fill="#ffffff" opacity=".55"><circle cx="78" cy="160" r="3"/><circle cx="100" cy="176" r="3"/><circle cx="124" cy="160" r="3"/><circle cx="86" cy="194" r="3"/><circle cx="116" cy="194" r="3"/></g>`,
    armL: { html: arm(66, 128, 56, 172, '#1f8f8a', '#e0a679', true), px: 66, py: 128 },
    armR: {
      html: arm(134, 128, 144, 172, '#1f8f8a', '#e0a679', true),
      hold: `<path d="M136 182Q146 166 156 182" stroke="#8a949b" stroke-width="3" fill="none"/>
        <rect x="132" y="180" width="28" height="13" rx="4" fill="#d7dde2"/><rect x="132" y="194" width="28" height="13" rx="4" fill="#c4ccd2"/><rect x="132" y="208" width="28" height="13" rx="4" fill="#d7dde2"/>
        <rect x="132" y="190" width="28" height="3" fill="#ff7a1a"/><rect x="132" y="204" width="28" height="3" fill="#ff7a1a"/>`,
      px: 134,
      py: 128,
    },
    head: {
      px: 100,
      py: 116,
      base: `<ellipse cx="100" cy="80" rx="35" ry="39" fill="#e0a679"/>`,
      top: `<path d="M64 66Q100 30 136 66Q100 52 64 66Z" fill="#b8336a"/>
        <path d="M63 98Q100 146 137 98L146 140Q100 160 54 140Z" fill="#d4447a"/>
        <circle cx="127" cy="126" r="4.5" fill="#ffc23d"/>`,
    },
    eyes: { y: 82, lx: 86, rx: 114, w: 7.5, h: 8.5, pupil: 4.6 },
    glasses: `<g fill="none" stroke="#6b3b2a" stroke-width="3"><circle cx="86" cy="82" r="12"/><circle cx="114" cy="82" r="12"/><path d="M98 81Q100 78 102 81"/></g>`,
    brows: { y: 64, w: 14, h: 4, color: '#4a2c1d' },
    nose: nose('#c4875a', 90),
    mouth: { x: 100, y: 104, w: 16 },
    cheeks: { y: 98, lx: 74, rx: 126, color: '#ff7a8a', opacity: 0.45 },
  },

  /* ── Mbah Tunas: nenek bercaping dengan gembor ── */
  tunas: {
    legs: `<path d="M78 229Q78 216 90 216H99V229Z" fill="#4a3426"/><path d="M122 229Q122 216 110 216H101V229Z" fill="#4a3426"/>`,
    body: `<path d="M64 168H136L144 212Q144 221 135 221H65Q56 221 56 212Z" fill="#8a4b2a"/>
      <g stroke="#d9a066" stroke-width="2.5" fill="none" opacity=".9"><path d="M66 182Q80 176 94 182T122 182T150 182"/><path d="M62 198Q76 192 90 198T118 198T146 198"/><path d="M60 213Q74 207 88 213T116 213T144 213"/></g>
      <path d="M78 120H122Q138 120 139 136L138 170Q137 178 128 178H72Q63 178 62 170L61 136Q62 120 78 120Z" fill="#3f8f5a"/>
      <path d="M92 120L100 140L108 120Z" fill="#c4875a"/><circle cx="100" cy="146" r="4" fill="#ffc23d"/><circle cx="100" cy="160" r="3.5" fill="#ffc23d"/>`,
    neck: `<rect x="92" y="106" width="16" height="18" fill="#9a5f38"/>`,
    armL: { html: arm(67, 128, 58, 170, '#3f8f5a', '#b97a4f', true), px: 67, py: 128 },
    armR: {
      html: arm(133, 128, 142, 170, '#3f8f5a', '#b97a4f', true),
      hold: `<path d="M134 168Q144 158 154 170" stroke="#1f6e37" stroke-width="4" fill="none"/>
        <path d="M134 176H158L156 206Q156 210 152 210H140Q136 210 136 206Z" fill="#2c9a4c"/>
        <path d="M156 186L176 172L178 176L158 194Z" fill="#2c9a4c"/><ellipse cx="177" cy="173" rx="4" ry="6" fill="#1f6e37" transform="rotate(-35 177 173)"/>`,
      px: 133,
      py: 128,
    },
    head: {
      px: 100,
      py: 114,
      base: `${head('#b97a4f', '#9a5f38')}
        <path d="M60 70Q60 52 72 46L72 86Q62 84 60 70Z" fill="#d6d6d6"/><path d="M140 70Q140 52 128 46L128 86Q138 84 140 70Z" fill="#d6d6d6"/>`,
      top: `<path d="M32 56L100 10L168 56Q100 68 32 56Z" fill="#e2b866"/>
        <g stroke="#c99a45" stroke-width="2.5"><path d="M100 12L74 60"/><path d="M100 12L126 60"/><path d="M100 12L52 58"/><path d="M100 12L148 58"/><path d="M100 12V62"/></g>
        <path d="M32 56Q100 68 168 56Q100 74 32 56Z" fill="#c99a45"/>`,
    },
    eyes: { y: 82, lx: 85, rx: 115, w: 7, h: 7.5, pupil: 4.4 },
    glasses: `<g fill="none" stroke="#3a2a20" stroke-width="3"><circle cx="85" cy="82" r="11.5"/><circle cx="115" cy="82" r="11.5"/><path d="M96 81Q100 78 104 81"/></g>
      <g stroke="#9a5f38" stroke-width="2" fill="none" stroke-linecap="round"><path d="M66 90Q69 94 66 98"/><path d="M134 90Q131 94 134 98"/></g>`,
    brows: { y: 66, w: 13, h: 3.5, color: '#bdbdbd' },
    nose: nose('#9a5f38', 90),
    mouth: { x: 100, y: 104, w: 16 },
    cheeks: { y: 98, lx: 73, rx: 127, color: '#e0603a', opacity: 0.4 },
  },

  /* ── Mang Jaga: bapak ronda bersarung, berpeci, membawa senter ── */
  jaga: {
    legs: legs('#2a2a2e', '#6b4a33', '#3d2a1d', 176),
    neck: `<rect x="92" y="104" width="16" height="20" fill="#8a5636"/>`,
    body: `<path d="M77 118H123Q142 118 144 138L144 178Q142 190 128 190H72Q58 190 56 178L56 138Q58 118 77 118Z" fill="#2b3f6b"/>
      <path d="M60 126L82 116L146 172L140 192Z" fill="#2c7a4b"/>
      <g stroke="#e0b04a" stroke-width="3"><path d="M68 122L144 184"/></g><g stroke="#1d5235" stroke-width="4"><path d="M76 118L146 176"/><path d="M62 132L132 192"/></g>
      <g stroke="#e0b04a" stroke-width="2" opacity=".8"><path d="M86 120L74 142"/><path d="M104 136L92 158"/><path d="M122 152L110 174"/></g>`,
    armL: { html: arm(64, 128, 54, 172, '#2b3f6b', '#a86b43'), px: 64, py: 128 },
    armR: {
      html: arm(136, 128, 146, 172, '#2b3f6b', '#a86b43'),
      hold: `<path d="M152 172L196 150L200 196Z" fill="#ffe27a" opacity=".45"/>
        <rect x="136" y="166" width="22" height="11" rx="3" fill="#3a3a3a" transform="rotate(-24 147 171)"/><rect x="152" y="160" width="8" height="15" rx="2" fill="#ffd84d" transform="rotate(-24 156 167)"/>`,
      px: 136,
      py: 128,
    },
    head: {
      px: 100,
      py: 112,
      base: `${head('#a86b43', '#8a5636')}
        <rect x="60" y="56" width="9" height="26" rx="4.5" fill="#1b1b1b"/><rect x="131" y="56" width="9" height="26" rx="4.5" fill="#1b1b1b"/>`,
      top: `<path d="M64 52L68 22Q100 14 132 22L136 52Q100 44 64 52Z" fill="#1b1b1b"/><path d="M66 46Q100 38 134 46L135 52Q100 44 65 52Z" fill="#3a3a3a"/>
        <path d="M80 98Q90 88 100 94Q110 88 120 98Q112 104 100 99Q88 104 80 98Z" fill="#1b1b1b"/>`,
    },
    eyes: { y: 76, lx: 84, rx: 116, w: 8.5, h: 9.5, pupil: 5 },
    brows: { y: 60, w: 20, h: 6, color: '#1b1b1b' },
    nose: nose('#8a5636', 82),
    mouth: { x: 100, y: 106, w: 16 },
  },

  /* ── Pak RT: berbatik, berpeci, membawa papan catatan ── */
  rt: {
    legs: legs('#3b3b40', '#2a2a2a', '#111111'),
    neck: `<rect x="92" y="104" width="16" height="20" fill="#9a5f38"/>`,
    body: `${torso('#a5541c')}
      <g fill="none" stroke="#f0b75a" stroke-width="2.5"><circle cx="80" cy="140" r="7"/><circle cx="120" cy="140" r="7"/><circle cx="100" cy="158" r="7"/><circle cx="80" cy="176" r="7"/><circle cx="120" cy="176" r="7"/></g>
      <path d="M88 118L100 132L112 118Z" fill="#7a3a12"/><path d="M100 132V186" stroke="#7a3a12" stroke-width="2"/>`,
    armL: { html: arm(66, 126, 56, 172, '#a5541c', '#b97a4f'), px: 66, py: 126 },
    armR: {
      html: arm(134, 126, 144, 172, '#a5541c', '#b97a4f'),
      hold: `<rect x="138" y="150" width="30" height="40" rx="4" fill="#c99a6b" transform="rotate(10 153 170)"/><rect x="142" y="156" width="22" height="30" rx="2" fill="#ffffff" transform="rotate(10 153 170)"/>
        <g stroke="#a0a0a0" stroke-width="2" transform="rotate(10 153 170)"><path d="M146 164H160"/><path d="M146 170H160"/><path d="M146 176H156"/></g>`,
      px: 134,
      py: 126,
    },
    head: {
      px: 100,
      py: 112,
      base: head('#b97a4f', '#9a5f38'),
      top: `<path d="M64 52L68 22Q100 14 132 22L136 52Q100 44 64 52Z" fill="#1b1b1b"/><path d="M66 46Q100 38 134 46L135 52Q100 44 65 52Z" fill="#3a3a3a"/>
        <rect x="61" y="56" width="8" height="20" rx="4" fill="#3a3a3a"/><rect x="131" y="56" width="8" height="20" rx="4" fill="#3a3a3a"/>`,
    },
    eyes: { y: 78, lx: 84, rx: 116, w: 7.5, h: 8.5, pupil: 4.6 },
    glasses: `<g fill="none" stroke="#1b1b1b" stroke-width="3"><rect x="72" y="68" width="24" height="19" rx="6"/><rect x="104" y="68" width="24" height="19" rx="6"/><path d="M96 76H104"/></g>`,
    brows: { y: 61, w: 16, h: 4.5, color: '#2a2a2a' },
    nose: nose('#9a5f38', 88),
    mouth: { x: 100, y: 102, w: 18 },
  },
}

export { RIGS }

/* ── wajah: potongan yang dipakai juga oleh komponen beranimasi ── */
export const eyeWhite = (r: Rig) =>
  `<ellipse cx="${r.eyes.lx}" cy="${r.eyes.y}" rx="${r.eyes.w}" ry="${r.eyes.h}" fill="${WHITE}"/><ellipse cx="${r.eyes.rx}" cy="${r.eyes.y}" rx="${r.eyes.w}" ry="${r.eyes.h}" fill="${WHITE}"/>`
export const pupils = (r: Rig) => {
  const p = r.eyes.pupil
  const g = Math.max(1.4, p * 0.36)
  return [r.eyes.lx, r.eyes.rx]
    .map((x) => `<circle cx="${x}" cy="${r.eyes.y + 1}" r="${p}" fill="${INK}"/><circle cx="${x + p * 0.38}" cy="${r.eyes.y + 1 - p * 0.42}" r="${g}" fill="${WHITE}"/>`)
    .join('')
}
export const happyEyes = (r: Rig) =>
  [r.eyes.lx, r.eyes.rx]
    .map((x) => `<path d="M${x - r.eyes.w} ${r.eyes.y + 3}Q${x} ${r.eyes.y - r.eyes.h - 2} ${x + r.eyes.w} ${r.eyes.y + 3}" fill="none" stroke="${r.mouth.light ? WHITE : INK}" stroke-width="${Math.max(3.5, r.eyes.w * 0.4)}" stroke-linecap="round"/>`)
    .join('')
export const browsSvg = (r: Rig) =>
  r.brows
    ? [r.eyes.lx, r.eyes.rx].map((x) => `<rect x="${x - r.brows!.w / 2}" y="${r.brows!.y}" width="${r.brows!.w}" height="${r.brows!.h}" rx="${r.brows!.h / 2}" fill="${r.brows!.color}"/>`).join('')
    : ''
export const cheeksSvg = (r: Rig) =>
  r.cheeks
    ? `<g fill="${r.cheeks.color}" opacity="${r.cheeks.opacity}"><ellipse cx="${r.cheeks.lx}" cy="${r.cheeks.y}" rx="8" ry="5"/><ellipse cx="${r.cheeks.rx}" cy="${r.cheeks.y}" rx="8" ry="5"/></g>`
    : ''
export const smileSvg = (r: Rig) => {
  const { x, y, w, light } = r.mouth
  return `<path d="M${x - w / 2} ${y}Q${x} ${y + w * 0.5} ${x + w / 2} ${y}" fill="none" stroke="${light ? WHITE : INK}" stroke-width="4" stroke-linecap="round"/>`
}
export const openMouthSvg = (r: Rig, big = 1) => {
  const { x, y } = r.mouth
  const w = r.mouth.w * big
  const h = w * 0.78
  return `<path d="M${x - w / 2} ${y - 2}Q${x} ${y - 5} ${x + w / 2} ${y - 2}Q${x + w / 2} ${y + h} ${x} ${y + h}Q${x - w / 2} ${y + h} ${x - w / 2} ${y - 2}Z" fill="${MOUTH}"/>
    <ellipse cx="${x}" cy="${y + h * 0.66}" rx="${w * 0.27}" ry="${h * 0.2}" fill="${TONGUE}"/>
    <path d="M${x - w / 2 + 3} ${y - 1}Q${x} ${y - 3} ${x + w / 2 - 3} ${y - 1}V${y + 2.5}Q${x} ${y + 0.5} ${x - w / 2 + 3} ${y + 2.5}Z" fill="${WHITE}"/>`
}
export const shadowSvg = `<ellipse cx="100" cy="230" rx="48" ry="6" fill="${INK}" opacity=".12"/>`

/** SVG statis (ikon aplikasi, logo, render server) */
export function characterSvg(who: CharacterId = 'kompi', opts: { shadow?: boolean; viewBox?: string; happy?: boolean } = {}): string {
  const r = RIGS[who]
  const face = `${eyeWhite(r)}${pupils(r)}${browsSvg(r)}${r.nose ?? ''}${cheeksSvg(r)}${opts.happy ? openMouthSvg(r) : smileSvg(r)}${r.glasses ?? ''}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${opts.viewBox ?? '0 0 200 240'}">${opts.shadow === false ? '' : shadowSvg}${r.back ?? ''}${r.legs}${r.neck ?? ''}${r.body}${r.armL.html}${r.armR.hold ?? ''}${r.armR.html}${r.head.back ?? ''}${r.head.base}${face}${r.head.top ?? ''}${r.sway?.html ?? ''}</svg>`
}
