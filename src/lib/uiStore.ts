import { useSyncExternalStore } from 'react'

interface UI { chaptersOpen: boolean; settingsOpen: boolean; headerHidden: boolean }

let state: UI = { chaptersOpen: false, settingsOpen: false, headerHidden: false }
const listeners = new Set<() => void>()

export function setUI(patch: Partial<UI>) {
  // Skip no-op updates so scroll events don't re-render subscribers
  if ((Object.keys(patch) as (keyof UI)[]).every((k) => state[k] === patch[k])) return
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

export function toggleHeader() {
  setUI({ headerHidden: !state.headerHidden })
}

export function useUI() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => { listeners.delete(cb) }
    },
    () => state,
  )
}