import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { db, type Book } from '../lib/db'
import { THEMES, useSettings } from '../lib/settings'
import { setUI } from '../lib/uiStore'
import ChapterDrawer from '../components/ChapterDrawer'
import SettingsPanel from '../components/SettingsPanel'
import ScrollView from '../components/ScrollView'
import PagedView from '../components/PagedView'
import './Reader.css'
import ReaderDock from '../components/ReaderDock'
import { adoptRemoteProgress, downloadText, flushRemoteProgress, queueProgress } from '../lib/sync'

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
  const [leaving, setLeaving] = useState(false)
  const switchingRef = useRef(false)
  const switchTimer = useRef<number | undefined>(undefined)
  const [note, setNote] = useState('Loading…')
  const remoteIdRef = useRef<string | undefined>(undefined)

  // Load the book + its text once (not live, so progress saves don't reload 10 MB)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let b = await db.books.get(bookId)
      if (cancelled) return
      if (!b) { setBook(null); return }
      remoteIdRef.current = b.remoteId
      b = await adoptRemoteProgress(b) // newer position from another device

      let t = await db.texts.get(bookId)
      if (!t && b.remoteId) {
        setNote('Downloading from the cloud…')
        try {
          await downloadText(bookId)
          t = await db.texts.get(bookId)
        } catch {
          if (!cancelled) setNote('Could not download this book. Check your connection and reload.')
          return
        }
      }
      if (cancelled) return

      localStorage.setItem('last-read', String(b.id))
      db.books.update(b.id, { lastReadAt: Date.now() })
      ratioRef.current = b.progress?.ratio ?? 0
      setChapterIdx(b.progress?.chapter ?? 0)
      setText(t?.text ?? '')
      setBook(b)
    })()
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

  // Theme the whole page (not just .reader) so there is no flash or light overscroll
  useLayoutEffect(() => {
    const t = THEMES[s.theme]
    const root = document.documentElement
    root.style.background = t.bg
    document.body.style.background = t.bg
    document.body.style.color = t.fg
    return () => {
      root.style.background = ''
      root.style.removeProperty('--boot-bg')
      document.body.style.background = ''
      document.body.style.color = ''
    }
  }, [s.theme])

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
    const now = Date.now()
    db.books.update(bookId, { progress: p, lastReadAt: now, progressAt: now })
    queueProgress(remoteIdRef.current, p.chapter, p.ratio, now)
  }, [bookId])

  const saveProgress = useCallback(
    (ratio: number) => {
      if (switchingRef.current) return
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
      if (n < 0 || n >= total || switchingRef.current) return
      switchingRef.current = true
      window.clearTimeout(saveTimer.current)
      pendingRef.current = null
      ratioRef.current = ratio
      const now = Date.now()
      db.books.update(bookId, { progress: { chapter: n, ratio }, lastReadAt: now, progressAt: now })
      queueProgress(remoteIdRef.current, n, ratio, now)
      setUI({ chaptersOpen: false })

      setLeaving(true) // fade the old chapter out...
      switchTimer.current = window.setTimeout(() => {
        setChapterIdx(n) // ...then swap; the new view fades in on mount
        setLeaving(false)
        switchingRef.current = false
      }, 180)
    },
    [book, bookId],
  )

    // Save any pending progress when leaving the page or the reader
  useEffect(() => {
    const onLeave = () => { flushProgress(); flushRemoteProgress() }
    const onVisibility = () => { if (document.visibilityState === 'hidden') onLeave() }
    window.addEventListener('pagehide', onLeave)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onLeave)
      document.removeEventListener('visibilitychange', onVisibility)
      window.clearTimeout(switchTimer.current)
      onLeave()
    }
  }, [flushProgress])

  if (book === undefined) return <main className="page">{note}</main>
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

      <div className={`reader-view${leaving ? ' leaving' : ''}`}>
        {s.mode === 'scroll'
          ? <ScrollView key={`s-${chapterIdx}`} {...viewProps} />
          : <PagedView key={`p-${chapterIdx}`} {...viewProps} />}
      </div>

      <ChapterDrawer chapters={chapters} current={chapterIdx} onSelect={(i) => goChapter(i)} />
      <SettingsPanel />
      <ReaderDock />
    </div>
  )
}