import { useSyncExternalStore } from 'react'

export type ThemeName = 'light' | 'sepia' | 'dark'

export interface ReaderSettings {
  theme: ThemeName
  fontFamily: string
  fontSize: number
  lineHeight: number
  width: number
  paraSpacing: number
  justify: boolean
  indent: boolean
  mode: 'scroll' | 'paged'
}

export const DEFAULTS: ReaderSettings = {
  theme: 'sepia',
  fontFamily: '"Literata", Georgia, serif',
  fontSize: 20,
  lineHeight: 1.8,
  width: 720,
  paraSpacing: 1,
  justify: false,
  indent: false,
  mode: 'scroll',
}

export const THEMES: Record<ThemeName, { bg: string; fg: string; panel: string; muted: string; border: string }> = {
  light: { bg: '#fafafa', fg: '#222222', panel: '#ffffff', muted: '#888888', border: '#dddddd' },
  sepia: { bg: '#f4ecd8', fg: '#5b4636', panel: '#efe4cb', muted: '#a08a70', border: '#d9c9a7' },
  dark:  { bg: '#121212', fg: '#cfcfcf', panel: '#1e1e1e', muted: '#777777', border: '#333333' },
}

export const FONTS = [
  { label: 'Literata (book)', value: '"Literata", Georgia, serif' },
  { label: 'Merriweather', value: '"Merriweather", Georgia, serif' },
  { label: 'Be Vietnam Pro', value: '"Be Vietnam Pro", "Segoe UI", sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Arial, sans-serif' },
  { label: 'Consolas (Notepad)', value: 'Consolas, "Courier New", monospace' },
]

const KEY = 'reader-settings'

function load(): ReaderSettings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
}

let current = load()
const listeners = new Set<() => void>()

export function updateSettings(patch: Partial<ReaderSettings>) {
  current = { ...current, ...patch }
  localStorage.setItem(KEY, JSON.stringify(current))
  listeners.forEach((l) => l())
}

export function useSettings() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    () => current,
  )
}