import { useEffect, useMemo, useRef, useState } from 'react'
import type { Chapter } from '../lib/db'
import { setUI, useUI } from '../lib/uiStore'

interface Props {
  chapters: Chapter[]
  current: number
  onSelect: (i: number) => void
}

export default function ChapterDrawer({ chapters, current, onSelect }: Props) {
  const { chaptersOpen } = useUI()
  const [q, setQ] = useState('')
  const activeRef = useRef<HTMLButtonElement>(null)

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return chapters
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => !needle || c.title.toLowerCase().includes(needle))
  }, [chapters, q])

  useEffect(() => {
    if (chaptersOpen) activeRef.current?.scrollIntoView({ block: 'center' })
  }, [chaptersOpen])

  if (!chaptersOpen) return null
  return (
    <>
      <div className="backdrop" onClick={() => setUI({ chaptersOpen: false })} />
      <aside className="drawer left">
        <h3>Chapters ({chapters.length.toLocaleString()})</h3>
        <input type="text" placeholder="Search, e.g. 120" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="drawer-list">
          {items.map(({ c, i }) => (
            <button
              key={i}
              ref={i === current ? activeRef : undefined}
              className={i === current ? 'active' : ''}
              onClick={() => onSelect(i)}
            >
              {c.title}
            </button>
          ))}
        </div>
        <button className="reset" onClick={() => setUI({ chaptersOpen: false, resplitOpen: true })}>
          Re-split chapters…
        </button>
      </aside>
    </>
  )
}