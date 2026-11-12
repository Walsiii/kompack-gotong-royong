import { create } from 'zustand'

/** Tampilan layar penuh (mis. navigasi jalan kaki) menyembunyikan bilah tab bawah. */
export const useChrome = create<{ immersive: boolean; setImmersive: (v: boolean) => void }>()((set) => ({
  immersive: false,
  setImmersive: (immersive) => set({ immersive }),
}))
