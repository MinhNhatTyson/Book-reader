import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { db, type Book } from '../lib/db'
import { THEMES, useSettings } from '../lib/settings'
import { setUI } from '../lib/uiStore'
import ChapterDrawer from '../components/ChapterDrawer'
import SettingsPanel from '../components/SettingsPanel'
import ScrollView from '../components/ScrollView'
import PagedView from '../components/PagedView'
import './Reader.css'

export default function Reader() {
  const { id } = useParams()
  const bookId = Number(id)
  const s = useSettings()

  const [book, setBook] = useState<Book | null | undefined>(undefined)
  const [text, setText] = useState('')
  const [chapterIdx, setChapterIdx] = useState(0)
  const ratioRef = useRef(0)
  const saveTimer = useRef<number | undefined>(undefined)
  const pendingRef = useRef<{ chapter: number; ratio: number } | null>(null)

  // Load the book + its text once (not live, so progress saves don't reload 10 MB)
  useEffect(() => {
    let cancelled = false
    Promise.all([db.books.get(bookId), db.texts.get(bookId)]).then(([b, t]) => {
      if (cancelled) return
      if (b) {
        localStorage.setItem('last-read', String(b.id))
        db.books.update(b.id, { lastReadAt: Date.now() })
        ratioRef.current = b.progress?.ratio ?? 0
        setChapterIdx(b.progress?.chapter ?? 0)
      }
      setText(t?.text ?? '')
      setBook(b ?? null)
    })
    return () => { cancelled = true }
  }, [bookId])

  // Esc closes panels; panels also close when leaving the reader
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUI({ chaptersOpen: false, settingsOpen: false })
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      setUI({ chaptersOpen: false, settingsOpen: false })
    }
  }, [])

  const chapter = book?.chapters?.[chapterIdx]

  // Raw chapter text -> paragraphs (one per non-empty line; content untouched)
  const paragraphs = useMemo(() => {
    if (!chapter) return []
    const lines = text
      .slice(chapter.start, chapter.end)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    return lines[0] === chapter.title ? lines.slice(1) : lines
  }, [text, chapter])

    const flushProgress = useCallback(() => {
    window.clearTimeout(saveTimer.current)
    const p = pendingRef.current
    if (!p) return
    pendingRef.current = null
    db.books.update(bookId, { progress: p, lastReadAt: Date.now() })
  }, [bookId])

  const saveProgress = useCallback(
    (ratio: number) => {
      ratioRef.current = ratio
      pendingRef.current = { chapter: chapterIdx, ratio }
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(flushProgress, 400)
    },
    [chapterIdx, flushProgress],
  )

  const goChapter = useCallback(
    (n: number, ratio = 0) => {
      const total = book?.chapters?.length ?? 0
      if (n < 0 || n >= total) return
      window.clearTimeout(saveTimer.current)
      pendingRef.current = null
      ratioRef.current = ratio
      setChapterIdx(n)
      db.books.update(bookId, { progress: { chapter: n, ratio }, lastReadAt: Date.now() })
      setUI({ chaptersOpen: false })
    },
    [book, bookId],
  )

    // Save any pending progress when leaving the page or the reader
  useEffect(() => {
    window.addEventListener('pagehide', flushProgress)
    return () => {
      window.removeEventListener('pagehide', flushProgress)
      flushProgress()
    }
  }, [flushProgress])

  if (book === undefined) return <main className="page">Loading…</main>
  if (book === null) return <main className="page">Book not found.</main>
  if (!book.chapters?.length || !text) {
    return (
      <main className="page">
        This book was uploaded before chapter analysis existed. Delete it in the Library and upload it again.
      </main>
    )
  }

  const chapters = book.chapters
  const t = THEMES[s.theme]
  const style = {
    '--bg': t.bg, '--fg': t.fg, '--panel': t.panel, '--muted': t.muted, '--border': t.border,
    '--font': s.fontFamily, '--size': `${s.fontSize}px`, '--lh': s.lineHeight,
    '--width': `${s.width}px`, '--gap': `${s.paraSpacing}em`,
    '--align': s.justify ? 'justify' : 'left', '--indent': s.indent ? '1.5em' : '0',
  } as CSSProperties

  const viewProps = {
    title: chapter?.title ?? '',
    paragraphs,
    initialRatio: ratioRef.current,
    onRatio: saveProgress,
    onPrev: chapterIdx > 0 ? (r: number) => goChapter(chapterIdx - 1, r) : null,
    onNext: chapterIdx < chapters.length - 1 ? (r: number) => goChapter(chapterIdx + 1, r) : null,
  }

  return (
    <div className="reader" style={style}>
      <div className="reader-progress">
        <div style={{ width: `${((chapterIdx + 1) / chapters.length) * 100}%` }} />
      </div>

      {s.mode === 'scroll'
        ? <ScrollView key={`s-${chapterIdx}`} {...viewProps} />
        : <PagedView key={`p-${chapterIdx}`} {...viewProps} />}

      <ChapterDrawer chapters={chapters} current={chapterIdx} onSelect={(i) => goChapter(i)} />
      <SettingsPanel />
    </div>
  )
}