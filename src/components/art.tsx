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

/* ───────────── Avatar warga ───────────── */

interface AvatarDef {
  bg: string
  skin: string
  shirt: string
  hair: string
  style: 'pendek' | 'panjang' | 'hijab' | 'topi' | 'keriting' | 'kuncir' | 'jabrik'
}

const AVATARS: AvatarDef[] = [
  { bg: 'var(--color-avatar-light)', skin: 'var(--color-avatar-mid)', shirt: 'var(--color-ink-2)', hair: 'var(--color-ink)', style: 'pendek' },
  { bg: 'var(--color-avatar-light)', skin: 'var(--color-avatar-mid)', shirt: 'var(--color-ink-2)', hair: 'var(--color-ink)', style: 'panjang' },
  { bg: 'var(--color-avatar-light)', skin: 'var(--color-avatar-mid)', shirt: 'var(--color-ink-2)', hair: 'var(--color-ink)', style: 'hijab' },
  { bg: 'var(--color-avatar-light)', skin: 'var(--color-avatar-deep)', shirt: 'var(--color-ink-2)', hair: 'var(--color-ink)', style: 'topi' },
  { bg: 'var(--color-avatar-light)', skin: 'var(--color-avatar-deep)', shirt: 'var(--color-ink-2)', hair: 'var(--color-ink)', style: 'keriting' },
  { bg: 'var(--color-avatar-light)', skin: 'var(--color-avatar-mid)', shirt: 'var(--color-ink-2)', hair: 'var(--color-ink)', style: 'kuncir' },
  { bg: 'var(--color-avatar-light)', skin: 'var(--color-avatar-mid)', shirt: 'var(--color-ink-2)', hair: 'var(--color-ink)', style: 'jabrik' },
  { bg: 'var(--color-avatar-light)', skin: 'var(--color-avatar-deep)', shirt: 'var(--color-ink-2)', hair: 'var(--color-ink)', style: 'hijab' },
]

export const AVATAR_COUNT = AVATARS.length

function hairSvg(a: AvatarDef): { back: string; front: string } {
  const s = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"`
  switch (a.style) {
    case 'pendek':
      return { back: '', front: `<path d="M13.6 21c-.6-7.4 4.4-11.4 10.4-11.4S35 13.6 34.4 21c-2.2-3.4-5.4-5.6-10.4-5.6S15.8 17.6 13.6 21z" fill="${a.hair}" ${s}/>` }
    case 'panjang':
      return {
        back: `<path d="M12 37V21.5C12 13.8 17.4 9.4 24 9.4s12 4.4 12 12.1V37z" fill="${a.hair}" ${s}/>`,
        front: `<path d="M14 20.5c2.6-4.6 6-6.5 10-6.5s7.4 1.9 10 6.5c-.2-6.3-4.4-9.9-10-9.9s-9.8 3.6-10 9.9z" fill="${a.hair}" ${s}/>`,
      }
    case 'hijab':
      return {
        back: `<path d="M11.4 23c0-8.6 5.6-13.8 12.6-13.8S36.6 14.4 36.6 23c0 6.2-2 9.8-3.4 14H14.8c-1.4-4.2-3.4-7.8-3.4-14z" fill="${a.hair}" ${s}/>`,
        front: '',
      }
    case 'topi':
      return {
        back: '',
        front: `<path d="M13.4 19.6c.6-6.4 5-10.2 10.6-10.2s10 3.8 10.6 10.2z" fill="var(--color-rompi)" ${s}/><path d="M32.5 19.6h8.3" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
      }
    case 'keriting':
      return {
        back: '',
        front: `<g fill="${a.hair}" ${s}><circle cx="15" cy="18.5" r="4.2"/><circle cx="18.6" cy="13.4" r="4.4"/><circle cx="24" cy="11.4" r="4.6"/><circle cx="29.4" cy="13.4" r="4.4"/><circle cx="33" cy="18.5" r="4.2"/></g>`,
      }
    case 'kuncir':
      return {
        back: `<circle cx="36.5" cy="14.5" r="5" fill="${a.hair}" ${s}/>`,
        front: `<path d="M13.6 21c-.6-7.4 4.4-11.4 10.4-11.4S35 13.6 34.4 21c-2.8-4.4-6.2-6-10.4-6s-7.6 1.6-10.4 6z" fill="${a.hair}" ${s}/>`,
      }
    case 'jabrik':
      return {
        back: '',
        front: `<path d="M13.4 20.6 12.6 13l4.4 2.8L18.6 9l4 4.6L26 7.8l2.4 5.8 4.8-3-.6 6.4 3.4-.4-1.6 4.4c-2.6-3.4-5.8-5-10.4-5s-8 1.6-10.6 4.6z" fill="${a.hair}" ${s}/>`,
      }
  }
}

export function avatarSvg(index: number): string {
  const a = AVATARS[((index % AVATARS.length) + AVATARS.length) % AVATARS.length]
  const { back, front } = hairSvg(a)
  const hijab = a.style === 'hijab'
  const face = hijab
    ? `<ellipse cx="24" cy="23.5" rx="7.8" ry="8.6" fill="${a.skin}" stroke="${INK}" stroke-width="1.6"/>`
    : `<circle cx="24" cy="22.5" r="10.4" fill="${a.skin}" stroke="${INK}" stroke-width="1.6"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <rect width="48" height="48" fill="${a.bg}"/>
    ${hijab ? '' : back}
    <path d="M7 49c0-10.5 7.4-15.5 17-15.5S41 38.5 41 49z" fill="${a.shirt}" stroke="${INK}" stroke-width="1.6"/>
    ${hijab ? back : ''}
    ${face}
    ${front}
    <circle cx="20.4" cy="23.4" r="1.4" fill="${INK}"/><circle cx="27.6" cy="23.4" r="1.4" fill="${INK}"/>
    <path d="M20.8 27.2c1.9 1.8 4.5 1.8 6.4 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>
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
      dangerouslySetInnerHTML={{ __html: kompiSvg({ shadow: false, viewBox: '30 34 168 156' }).replace('<svg ', '<svg style="display:block;width:100%;height:100%" ') }}
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
