import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Bookmark, Chapter } from '../lib/db'
import { chapterAt } from '../lib/bookmarks'
import { setUI, useUI } from '../lib/uiStore'

interface Props {
  bookmarks: Bookmark[]
  chapters: Chapter[]
  onAdd: (note: string) => Promise<void>
  onRemove: (id: string) => Promise<void>
  onJump: (pos: number) => void
}

export default function BookmarkPanel({ bookmarks, chapters, onAdd, onRemove, onJump }: Props) {
  const { bookmarksOpen } = useUI()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (!bookmarksOpen) return null

  const sorted = [...bookmarks].sort((a, b) => a.pos - b.pos)

  async function add() {
    setBusy(true)
    try {
      await onAdd(note)
      setNote('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="backdrop" onClick={() => setUI({ bookmarksOpen: false })} />
      <aside className="drawer right">
        <h3>Bookmarks ({bookmarks.length})</h3>
        <input
          type="text"
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !busy) add() }}
        />
        <button className="primary" disabled={busy} onClick={add}>Bookmark this spot</button>

        {sorted.length === 0 && <p className="hint">No bookmarks in this book yet.</p>}
        <div className="drawer-list">
          {sorted.map((m) => (
            <div className="bm-row" key={m.id}>
              <button onClick={() => onJump(m.pos)}>
                <span className="hit-chapter">{chapters[chapterAt(chapters, m.pos)]?.title}</span>
                <span className="hit-text">{m.snippet}…</span>
                {m.note && <span className="bm-note">{m.note}</span>}
              </button>
              <button className="bm-del" aria-label="Delete bookmark" onClick={() => onRemove(m.id)}>×</button>
            </div>
          ))}
        </div>

        <Link className="bm-all" to="/bookmarks">All bookmarks →</Link>
      </aside>
    </>
  )
}