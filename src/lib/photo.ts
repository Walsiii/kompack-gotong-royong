import type { Category } from './types'

const WALL: Record<Category, string> = {
  sampah: '#E9C9A3',
  got: '#C9DDE3',
  rusak: '#E4CFC5',
  taman: '#CFE2C9',
  bantu: '#E8D2DA',
}

/**
 * Foto contoh (ilustrasi gang) untuk MODE UJI saja — supaya alur bisa dicoba di PC
 * tanpa kamera. Setiap foto contoh ditandai `sample` dan terlihat oleh Ketua RT.
 * `v` memberi variasi kecil supaya tiap contoh tidak identik.
 */
export function demoPhoto(kind: 'before' | 'after', cat: Category, v = 0): string {
  const dirty = kind === 'before'
  const sh = (v % 7) * 6 - 18
  const wall = dirty ? '#B9B4A8' : WALL[cat]
  const road = dirty ? '#8E897D' : '#A7A397'
  const sky = dirty ? '#C7CFD0' : '#A9D7EC'
  const trash = dirty
    ? `<g stroke="#2B2A26" stroke-width="2" stroke-linejoin="round">
        <path d="M${70 + sh} 250l26-8 10 20-30 10z" fill="#F4F4F0"/>
        <path d="M${168 + sh} 268l22-14 16 16-20 14z" fill="#E08A3C"/>
        <rect x="${246 + sh}" y="244" width="16" height="30" rx="5" fill="#6CB7D6" transform="rotate(64 ${254 + sh} 259)"/>
        <path d="M${300 + sh} 262l30-6 4 18-28 8z" fill="#E7C24A"/>
        <ellipse cx="${128 + sh}" cy="282" rx="34" ry="8" fill="#5E574B" stroke="none" opacity=".55"/>
        <path d="M${214 + sh} 238c6-10 16-10 20 0s-4 16-12 14-12-6-8-14z" fill="#7A9B57"/>
        <path d="M${352 + sh} 244l18 10-8 18-20-8z" fill="#F4F4F0"/>
      </g>`
    : `<g stroke="#2B2A26" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">
        <path d="M${70 + sh} 236h36l-5 32H${75 + sh}z" fill="#C8653F"/>
        <path d="M${88 + sh} 236c-10-22-22-24-26-14 10 0 18 6 26 14zm0 0c6-26 20-30 26-20-12 2-20 10-26 20z" fill="#4E9A55"/>
        <path d="M312 236h36l-5 32h-26z" fill="#C8653F"/>
        <path d="M330 236c-10-22-22-24-26-14 10 0 18 6 26 14zm0 0c6-26 20-30 26-20-12 2-20 10-26 20z" fill="#4E9A55"/>
      </g>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="${sky}"/>
    <circle cx="${336 - sh}" cy="52" r="24" fill="${dirty ? '#E4E4DA' : '#F6D365'}"/>
    <g stroke="#2B2A26" stroke-width="2" stroke-linejoin="round">
      <path d="M0 96l70-46 70 46v130H0z" fill="${wall}"/>
      <path d="M-6 100l76-52 76 52" fill="none" stroke-width="7" stroke="#B9533A"/>
      <rect x="44" y="140" width="40" height="86" fill="#7A5A3C"/>
      <rect x="150" y="110" width="110" height="116" fill="${dirty ? '#A8A195' : '#F7F7F2'}"/>
      <rect x="170" y="134" width="30" height="30" fill="#8DC3D9"/>
      <rect x="214" y="134" width="30" height="30" fill="#8DC3D9"/>
      <path d="M270 90l66-40 70 40v136H270z" fill="${wall}"/>
      <path d="M264 94l72-48 76 48" fill="none" stroke-width="7" stroke="#B9533A"/>
      <rect x="300" y="126" width="36" height="34" fill="#8DC3D9"/>
    </g>
    <rect y="224" width="400" height="76" fill="${road}"/>
    <path d="M0 226h400" stroke="#2B2A26" stroke-width="2"/>
    ${trash}
    <g font-family="monospace" font-weight="700" font-size="12">
      <rect x="136" y="12" width="128" height="22" rx="4" fill="#0F1F19"/>
      <text x="200" y="27" fill="#fff" text-anchor="middle">FOTO CONTOH</text>
    </g>
  </svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
