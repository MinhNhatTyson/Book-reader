import { useEffect, useState } from 'react'
import type { Chapter } from '../lib/db'
import { setUI, useUI } from '../lib/uiStore'

interface Props {
  text: string
  chapters: Chapter[]
  onJump: (chapter: number, ratio: number) => void
}

interface Hit { chapter: number; ratio: number; before: string; match: string; after: string }

const MAX_HITS = 200
const CONTEXT = 40

// Binary search: which chapter contains this character offset?
function chapterAt(chapters: Chapter[], pos: number) {
  let lo = 0
  let hi = chapters.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (chapters[mid].start <= pos) lo = mid
    else hi = mid - 1
  }
  return lo
}

function search(text: string, chapters: Chapter[], needle: string): Hit[] {
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  const hits: Hit[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) && hits.length < MAX_HITS) {
    const ci = chapterAt(chapters, m.index)
    const c = chapters[ci]
    const from = Math.max(0, m.index - CONTEXT)
    const to = Math.min(text.length, m.index + m[0].length + CONTEXT)
    hits.push({
      chapter: ci,
      ratio: Math.min(1, (m.index - c.start) / Math.max(1, c.end - c.start)),
      before: text.slice(from, m.index).replace(/\s+/g, ' '),
      match: m[0],
      after: text.slice(m.index + m[0].length, to).replace(/\s+/g, ' '),
    })
  }
  return hits
}

export default function SearchPanel({ text, chapters, onJump }: Props) {
  const { searchOpen } = useUI()
  const [q, setQ] = useState('')
  const [result, setResult] = useState<{ q: string; hits: Hit[] }>({ q: '', hits: [] })
  const needle = q.trim()
  const valid = needle.length >= 2

  // Wait 250 ms after typing stops, then scan the whole book once
  useEffect(() => {
    if (!valid) return
    const t = window.setTimeout(() => setResult({ q: needle, hits: search(text, chapters, needle) }), 250)
    return () => window.clearTimeout(t)
  }, [needle, valid, text, chapters])

  if (!searchOpen) return null

  const ready = valid && result.q === needle
  const hits = ready ? result.hits : []

  return (
    <>
      <div className="backdrop" onClick={() => setUI({ searchOpen: false })} />
      <aside className="drawer right">
        <h3>Search in book</h3>
        <input
          type="text"
          placeholder="Type at least 2 letters…"
          value={q}
          autoFocus
          onChange={(e) => setQ(e.target.value)}
        />
        {valid && !ready && <p className="hint">Searching…</p>}
        {ready && hits.length === 0 && <p className="hint">No matches.</p>}
        {ready && hits.length >= MAX_HITS && <p className="hint">Showing the first {MAX_HITS} matches. Try a longer phrase.</p>}
        <div className="drawer-list">
          {hits.map((h, i) => (
            <button key={i} onClick={() => onJump(h.chapter, h.ratio)}>
              <span className="hit-chapter">{chapters[h.chapter].title}</span>
              <span className="hit-text">
                …{h.before}<mark>{h.match}</mark>{h.after}…
              </span>
            </button>
          ))}
        </div>
      </aside>
    </>
  )
}