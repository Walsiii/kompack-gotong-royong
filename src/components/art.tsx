import type { CSSProperties } from 'react'
import { CATS } from '../lib/catalog'
import { kompiSvg } from './KampungBuddy'
import type { Category } from '../lib/types'

const INK = 'var(--color-ink)'

/* ───────────── Ikon kategori (viewBox 24) ───────────── */

const CAT_PATHS: Record<Category, string> = {
  // karung sampah terikat
  sampah: `<path d="M8.2 7.6c-2.6 2.2-3.8 5-3.8 8.1 0 3 2.8 4.8 7.6 4.8s7.6-1.8 7.6-4.8c0-3.1-1.2-5.9-3.8-8.1" fill="var(--color-inverse)"/><path d="M8.2 7.6h7.6M9 7.4 7.4 3.6M15 7.4l1.6-3.8M12 7.5V4.2"/><path d="M9.5 13.5l1.6 1.6 3.4-3.4"/>`,
  // tetes & gelombang air selokan
  got: `<path d="M12 2.8c2.3 2.9 3.4 4.7 3.4 6.3a3.4 3.4 0 0 1-6.8 0c0-1.6 1.1-3.4 3.4-6.3z" fill="var(--color-inverse)"/><path d="M2.8 16.4c1.5-1.6 3-1.6 4.6 0s3 1.6 4.6 0 3-1.6 4.6 0 3 1.6 4.6 0M2.8 20.4c1.5-1.6 3-1.6 4.6 0s3 1.6 4.6 0 3-1.6 4.6 0 3 1.6 4.6 0"/>`,
  // kunci pas
  rusak: `<path d="M14.6 3.4a5 5 0 0 0-5.3 6.7L3.7 15.7a2 2 0 0 0 2.8 2.8l5.6-5.6a5 5 0 0 0 6.7-5.3l-2.9 2.9-2.6-.4-.4-2.6z" fill="var(--color-inverse)"/>`,
  // tunas
  taman: `<path d="M12 21v-9"/><path d="M12 13.4C7.3 13.7 4.8 11 4.6 6.6c4.7-.3 7.2 2.4 7.4 6.8z" fill="var(--color-inverse)"/><path d="M12 11c.2-3.9 2.5-6.4 7.2-6.4-.2 4.1-2.6 6.4-7.2 6.4z" fill="var(--color-inverse)"/><path d="M7.5 21h9"/>`,
  // tangan menopang hati
  bantu: `<path d="M12 11.2c-2-2.4-5.6-1.2-4.4 1.6.6 1.4 2.4 2.7 4.4 4 2-1.3 3.8-2.6 4.4-4 1.2-2.8-2.4-4-4.4-1.6z" fill="var(--color-inverse)"/><path d="M2.8 15.6l3.4 3.8c.8.9 1.9 1.4 3.1 1.4h5.8c1.1 0 2.2-.4 3-1.2l3.1-3"/><path d="M12 6.2V3.4M8.6 7.2 7.4 5M15.4 7.2 16.6 5"/>`,
}

export function catIconSvg(cat: Category, size = 24, stroke = INK, fill = 'var(--color-inverse)'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="${stroke}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${CAT_PATHS[cat].replaceAll('var(--color-inverse)', fill)}</svg>`
}

export function CatIcon({ cat, size = 24, className, stroke, fill }: { cat: Category; size?: number; className?: string; stroke?: string; fill?: string }) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', width: size, height: size, flex: 'none' }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: catIconSvg(cat, size, stroke, fill) }}
    />
  )
}

/** Ubin ikon kategori berwarna */
export function CatTile({ cat, size = 44, muted, className = '' }: { cat: Category; size?: number; muted?: boolean; className?: string }) {
  return (
    <span
      className={`category-symbol grid flex-none place-items-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: muted ? 'var(--color-surface)' : CATS[cat].soft,
        color: muted ? 'var(--color-ink-3)' : CATS[cat].color,
      }}
    >
      <CatIcon cat={cat} size={size * 0.56} stroke="currentColor" fill={muted ? 'var(--color-surface)' : CATS[cat].soft} />
    </span>
  )
}

/* ───────────── Avatar warga (gaya datar, sama dengan keluarga karakter) ───────────── */

interface AvatarDef {
  bg: string
  skin: string
  shade: string
  shirt: string
  hair: string
  style: 'pendek' | 'panjang' | 'hijab' | 'topi' | 'keriting' | 'kuncir' | 'jabrik'
}

const AVATARS: AvatarDef[] = [
  { bg: '#e0f0fa', skin: '#c68642', shade: '#a5692f', shirt: '#1c82c4', hair: '#231a14', style: 'pendek' },
  { bg: '#fce5ee', skin: '#e0a679', shade: '#c4875a', shirt: '#d4447a', hair: '#3a2418', style: 'panjang' },
  { bg: '#e1f4e6', skin: '#e0a679', shade: '#c4875a', shirt: '#2c9a4c', hair: '#2c9a4c', style: 'hijab' },
  { bg: '#fff0d9', skin: '#a86b43', shade: '#8a5636', shirt: '#ffc23d', hair: '#e8453c', style: 'topi' },
  { bg: '#e1f4e6', skin: '#8a5636', shade: '#6e4128', shirt: '#2c9a4c', hair: '#1b1b1b', style: 'keriting' },
  { bg: '#fff0d9', skin: '#c68642', shade: '#a5692f', shirt: '#ff7a1a', hair: '#3a2418', style: 'kuncir' },
  { bg: '#e0f0fa', skin: '#b97a4f', shade: '#9a5f38', shirt: '#2b3f6b', hair: '#1b1b1b', style: 'jabrik' },
  { bg: '#dff2f1', skin: '#a86b43', shade: '#8a5636', shirt: '#1f8f8a', hair: '#1f8f8a', style: 'hijab' },
]

export const AVATAR_COUNT = AVATARS.length

function hairSvg(a: AvatarDef): { back: string; front: string } {
  switch (a.style) {
    case 'pendek':
      return { back: '', front: `<path d="M12.5 17Q12 7 24 7Q36 7 35.5 17Q32 12 24 12.5Q16 12 12.5 17Z" fill="${a.hair}"/>` }
    case 'panjang':
      return {
        back: `<path d="M11 36V18Q11 6.5 24 6.5Q37 6.5 37 18V36Q33.5 33 30.5 33V18H17.5V33Q14.5 33 11 36Z" fill="${a.hair}"/>`,
        front: `<path d="M12.5 17Q13 8 24 8Q35 8 35.5 17Q30 11 22 13Q16 14 12.5 17Z" fill="${a.hair}"/>`,
      }
    case 'hijab':
      return {
        back: `<path d="M9.5 30Q9.5 6 24 6Q38.5 6 38.5 30L40 43Q24 47 8 43Z" fill="${a.hair}"/>`,
        front: `<path d="M15 15Q24 8.5 33 15Q24 12 15 15Z" fill="#000" opacity=".18"/><path d="M14.5 25Q24 37 33.5 25L36.5 38Q24 42 11.5 38Z" fill="${a.hair}"/>`,
      }
    case 'topi':
      return {
        back: '',
        front: `<path d="M12.5 16.5Q12.5 5.5 24 5.5Q35.5 5.5 35.5 16.5Q24 12.5 12.5 16.5Z" fill="${a.hair}"/><path d="M30 14Q38.5 12.5 42 15.5Q36.5 17.6 31 17Z" fill="${a.hair}"/><path d="M30 14Q38.5 12.5 42 15.5Q36.5 17.6 31 17Z" fill="#000" opacity=".2"/>`,
      }
    case 'keriting':
      return {
        back: '',
        front: `<g fill="${a.hair}"><circle cx="14" cy="16" r="4.4"/><circle cx="17.4" cy="10.6" r="4.6"/><circle cx="23.4" cy="8.4" r="4.8"/><circle cx="29.6" cy="9.8" r="4.6"/><circle cx="34" cy="14.6" r="4.4"/></g>`,
      }
    case 'kuncir':
      return {
        back: `<circle cx="37" cy="12" r="4.6" fill="${a.hair}"/><rect x="33" y="10.5" width="4" height="3.4" rx="1.2" fill="#ffc23d"/>`,
        front: `<path d="M12.5 17Q12 7 24 7Q36 7 35.5 17Q31 11.5 23 13Q16.5 13.5 12.5 17Z" fill="${a.hair}"/>`,
      }
    case 'jabrik':
      return {
        back: '',
        front: `<path d="M12.5 17L11.5 9L16 11L17.5 5L22 9.5L25 4L28 9.5L32.5 6L32.5 11L36.5 10.5L35.5 17Q31 12 24 12.5Q17 12 12.5 17Z" fill="${a.hair}"/>`,
      }
  }
}

export function avatarSvg(index: number): string {
  const a = AVATARS[((index % AVATARS.length) + AVATARS.length) % AVATARS.length]
  const { back, front } = hairSvg(a)
  const hijab = a.style === 'hijab'
  const face = hijab
    ? `<ellipse cx="24" cy="21" rx="9" ry="10" fill="${a.skin}"/>`
    : `<ellipse cx="13" cy="21" rx="2.2" ry="3" fill="${a.shade}"/><ellipse cx="35" cy="21" rx="2.2" ry="3" fill="${a.shade}"/><rect x="13" y="8.5" width="22" height="23" rx="9.5" fill="${a.skin}"/>`
  const eye = (x: number) => `<ellipse cx="${x}" cy="20.4" rx="2.6" ry="3" fill="#fff"/><circle cx="${x + 0.3}" cy="20.9" r="1.6" fill="${INK}"/><circle cx="${x + 0.9}" cy="20.2" r=".55" fill="#fff"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="${a.bg}"/>
    ${hijab ? '' : back}
    ${hijab ? '' : `<rect x="21" y="28" width="6" height="7" fill="${a.shade}"/>`}
    <path d="M6 49Q6 34.5 24 33.5Q42 34.5 42 49Z" fill="${a.shirt}"/>
    ${hijab ? back : ''}
    ${face}
    ${front}
    ${eye(20)}${eye(28)}
    <path d="M23 24.2Q24 25.8 25 24.2Z" fill="${a.shade}"/>
    <path d="M21.4 27Q24 29.4 26.6 27" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`
}

export function Avatar({ index, size = 40, className = '', style }: { index: number; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={`inline-block flex-none overflow-hidden rounded-full ${className}`}
      style={{ width: size, height: size, ...style }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: avatarSvg(index).replace('<svg ', '<svg style="display:block;width:100%;height:100%" ') }}
    />
  )
}

/* ───────────── Logo ───────────── */

/** Wajah Kompi (statis) untuk logo */
export function KompiMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`inline-block flex-none ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: kompiSvg({ shadow: false, viewBox: '34 0 166 166' }).replace('<svg ', '<svg style="display:block;width:100%;height:100%" ') }}
    />
  )
}

export function Logo({ size = 28, light, className = '', mark = true }: { size?: number; light?: boolean; className?: string; mark?: boolean }) {
  return (
    <span className={`inline-flex select-none items-center whitespace-nowrap ${className}`} style={{ gap: size * 0.22 }}>
      {mark && <KompiMark size={size * 1.25} />}
      <span
        className="font-display"
        style={{
          fontSize: size,
          lineHeight: 1,
          fontWeight: 800,
          letterSpacing: '-0.045em',
          color: light ? 'var(--color-inverse)' : INK,
        }}
      >
        kompack
        <span style={{ color: light ? 'var(--color-sun)' : 'var(--color-rompi)' }}>!</span>
      </span>
    </span>
  )
}

/* ───────────── Koin poin ───────────── */

export function Coin({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={`flex-none ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="var(--color-rompi)" />
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="var(--color-inverse)" strokeWidth="1.4" />
      <path d="M9.4 7.6v8.8M9.6 12.2l4.6-4.6M11.4 10.6l3.2 5.8" stroke="var(--color-inverse)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
