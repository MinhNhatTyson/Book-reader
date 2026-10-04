import { updateSettings, useSettings, type ThemeName } from '../lib/settings'
import { setUI, useUI } from '../lib/uiStore'

const ORDER: ThemeName[] = ['light', 'sepia', 'dark']

export default function ReaderDock() {
  const s = useSettings()
  const { headerHidden } = useUI()
  const nextTheme = ORDER[(ORDER.indexOf(s.theme) + 1) % ORDER.length]

  return (
    <div className={`reader-dock${headerHidden ? ' show' : ''}`}>
      <button onClick={() => setUI({ chaptersOpen: true })} aria-label="Chapters">☰</button>
      <button onClick={() => updateSettings({ theme: nextTheme })} aria-label="Switch theme">◐</button>
      <button onClick={() => setUI({ settingsOpen: true })} aria-label="Settings">Aa</button>
    </div>
  )
}