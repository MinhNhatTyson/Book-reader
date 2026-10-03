import { useSyncExternalStore } from 'react'

interface UI { chaptersOpen: boolean; settingsOpen: boolean }

let state: UI = { chaptersOpen: false, settingsOpen: false }
const listeners = new Set<() => void>()

export function setUI(patch: Partial<UI>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
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