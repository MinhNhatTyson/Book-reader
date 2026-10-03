import { DEFAULTS, FONTS, THEMES, updateSettings, useSettings, type ThemeName } from '../lib/settings'
import { setUI, useUI } from '../lib/uiStore'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
}

function Slider({ label, value, min, max, step, unit = '', onChange }: SliderProps) {
  return (
    <label className="row">
      <span>{label}: {value}{unit}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

export default function SettingsPanel() {
  const s = useSettings()
  const { settingsOpen } = useUI()
  if (!settingsOpen) return null

  return (
    <>
      <div className="backdrop" onClick={() => setUI({ settingsOpen: false })} />
      <aside className="drawer right">
        <h3>Reading settings</h3>

        <div className="row"><span>Theme</span></div>
        <div className="theme-row">
          {(Object.keys(THEMES) as ThemeName[]).map((name) => (
            <button
              key={name}
              className={`swatch ${s.theme === name ? 'active' : ''}`}
              style={{ background: THEMES[name].bg, color: THEMES[name].fg }}
              onClick={() => updateSettings({ theme: name })}
            >
              Aa
            </button>
          ))}
        </div>

        <label className="row">
          <span>Font</span>
          <select value={s.fontFamily} onChange={(e) => updateSettings({ fontFamily: e.target.value })}>
            {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
          </select>
        </label>

        <Slider label="Font size" value={s.fontSize} min={14} max={32} step={1} unit="px" onChange={(v) => updateSettings({ fontSize: v })} />
        <Slider label="Line height" value={s.lineHeight} min={1.4} max={2.4} step={0.1} onChange={(v) => updateSettings({ lineHeight: v })} />
        <Slider label="Text width" value={s.width} min={480} max={1000} step={20} unit="px" onChange={(v) => updateSettings({ width: v })} />
        <Slider label="Paragraph spacing" value={s.paraSpacing} min={0} max={2} step={0.25} unit="em" onChange={(v) => updateSettings({ paraSpacing: v })} />

        <label className="row"><span><input type="checkbox" checked={s.justify} onChange={(e) => updateSettings({ justify: e.target.checked })} /> Justify text</span></label>
        <label className="row"><span><input type="checkbox" checked={s.indent} onChange={(e) => updateSettings({ indent: e.target.checked })} /> Indent first line</span></label>

        <div className="row"><span>Reading mode</span></div>
        <div className="seg">
          <button className={s.mode === 'scroll' ? 'active' : ''} onClick={() => updateSettings({ mode: 'scroll' })}>Scroll</button>
          <button className={s.mode === 'paged' ? 'active' : ''} onClick={() => updateSettings({ mode: 'paged' })}>Pages</button>
        </div>

        <button className="reset" onClick={() => updateSettings(DEFAULTS)}>Reset to defaults</button>
      </aside>
    </>
  )
}