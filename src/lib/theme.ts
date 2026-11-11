import { create } from 'zustand'

export type Theme = 'ink' | 'forest' | 'sunset'
const KEY = 'kompack-appearance'
export const THEMES: { id: Theme; label: string; description: string }[] = [
  { id: 'ink', label: 'Tinta', description: 'Hitam & putih' },
  { id: 'forest', label: 'Hutan', description: 'Aksen hijau' },
  { id: 'sunset', label: 'Senja', description: 'Aksen terakota' },
]

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (THEMES.some((theme) => theme.id === saved)) return saved as Theme
  } catch { /* Appearance remains usable when storage is unavailable. */ }
  return 'ink'
}

const initial = initialTheme()
document.documentElement.dataset.theme = initial

export const useTheme = create<{ theme: Theme; setTheme: (theme: Theme) => void }>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem(KEY, theme) } catch { /* In-memory preference still applies. */ }
    set({ theme })
    window.dispatchEvent(new Event('kompack:theme'))
  },
}))
