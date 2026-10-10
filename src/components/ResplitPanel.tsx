import { useEffect, useState } from 'react'
import type { Chapter } from '../lib/db'
import { resplit } from '../lib/parseFile'
import { setUI, useUI } from '../lib/uiStore'

interface Props {
  text: string
  chapterCount: number
  onApply: (chapters: Chapter[]) => Promise<void>
}

type Mode = 'auto' | 'pattern' | 'size'

export default function ResplitPanel({ text, chapterCount, onApply }: Props) {
  const { resplitOpen } = useUI()
  const [mode, setMode] = useState<Mode>('auto')
  const [pattern, setPattern] = useState('^Chương\\s+\\d+')
  const [size, setSize] = useState(15000)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<{ key: string; chapters: Chapter[]; error: string }>({
    key: '', chapters: [], error: '',
  })

  const pat = pattern.trim()
  const effSize = Math.max(2000, size || 0)
  const key = `${mode}\u0000${pat}\u0000${effSize}`
  const skip = mode === 'pattern' && !pat

  // Re-run the split 300 ms after any option changes, in the background worker
  useEffect(() => {
    if (!resplitOpen || skip) return
    let stale = false
    const t = window.setTimeout(() => {
      resplit(text, { mode, pattern: pat, size: effSize })
        .then((chapters) => { if (!stale) setPreview({ key, chapters, error: '' }) })
        .catch((e: unknown) => {
          if (!stale) setPreview({ key, chapters: [], error: e instanceof Error ? e.message : 'Failed' })
        })
    }, 300)
    return () => { stale = true; window.clearTimeout(t) }
  }, [resplitOpen, skip, key, mode, pat, effSize, text])

  if (!resplitOpen) return null

  const ready = !skip && preview.key === key
  const chapters = ready ? preview.chapters : []
  const canApply = ready && !preview.error && chapters.length > 0 && !busy

  async function apply() {
    setBusy(true)
    try {
      await onApply(chapters)
      setUI({ resplitOpen: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="backdrop" onClick={() => setUI({ resplitOpen: false })} />
      <aside className="drawer left">
        <h3>Re-split chapters</h3>
        <p className="hint">Currently {chapterCount.toLocaleString()} chapters. Your reading position is kept.</p>

        <div className="seg">
          <button className={mode === 'auto' ? 'active' : ''} onClick={() => setMode('auto')}>Auto</button>
          <button className={mode === 'pattern' ? 'active' : ''} onClick={() => setMode('pattern')}>Pattern</button>
          <button className={mode === 'size' ? 'active' : ''} onClick={() => setMode('size')}>Size</button>
        </div>

        {mode === 'pattern' && (
          <>
            <input type="text" value={pattern} onChange={(e) => setPattern(e.target.value)} spellCheck={false} />
            <p className="hint">
              A regex tested against each short line (case-insensitive). Examples:{' '}
              <code>^Chương\s+\d+</code> · <code>^Chapter \d+</code> · <code>^第.+章</code>
            </p>
          </>
        )}
        {mode === 'size' && (
          <label className="row">
            <span>Characters per part (min 2000)</span>
            <input type="number" min={2000} step={1000} value={size} onChange={(e) => setSize(Number(e.target.value))} />
          </label>
        )}

        {skip && <p className="hint">Enter a pattern.</p>}
        {!skip && !ready && <p className="hint">Analyzing…</p>}
        {ready && preview.error && <p className="hint">{preview.error}</p>}
        {ready && !preview.error && chapters.length === 0 && <p className="hint">No line matches this pattern.</p>}
        {ready && chapters.length > 0 && (
          <>
            <p><strong>{chapters.length.toLocaleString()}</strong> chapters</p>
            <ul className="preview-list">
              {chapters.slice(0, 6).map((c, i) => <li key={i}>{c.title}</li>)}
              {chapters.length > 6 && <li>…</li>}
            </ul>
          </>
        )}

        <button className="primary" disabled={!canApply} onClick={apply}>
          {busy ? 'Applying…' : 'Apply'}
        </button>
      </aside>
    </>
  )
}