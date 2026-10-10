import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { db, type Book, type Bookmark, type Chapter } from '../lib/db'
import { THEMES, useSettings } from '../lib/settings'
import { setUI } from '../lib/uiStore'
import ChapterDrawer from '../components/ChapterDrawer'
import SettingsPanel from '../components/SettingsPanel'
import ScrollView from '../components/ScrollView'
import PagedView from '../components/PagedView'
import './Reader.css'
import ReaderDock from '../components/ReaderDock'
import { adoptRemoteProgress, downloadText, flushRemoteProgress, queueProgress, syncLibrary } from '../lib/sync'
import SearchPanel from '../components/SearchPanel'
import ResplitPanel from '../components/ResplitPanel'
import { cleanParagraphs } from '../lib/cleanup'
import { locate, makeSnippet, newBookmarkId } from '../lib/bookmarks'
import BookmarkPanel from '../components/BookmarkPanel'

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
  const [viewNonce, setViewNonce] = useState(0) 
  const switchingRef = useRef(false)
  const switchTimer = useRef<number | undefined>(undefined)
  const [note, setNote] = useState('Loading…')
  const remoteIdRef = useRef<string | undefined>(undefined)
  const barRef = useRef<HTMLDivElement>(null)

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
      let startChapter = Math.min(b.progress?.chapter ?? 0, Math.max(0, (b.chapters?.length ?? 1) - 1))
      let startRatio = b.progress?.ratio ?? 0
      const jumpPos = Number(new URLSearchParams(location.search).get('pos') ?? NaN) // from /bookmarks
      if (Number.isFinite(jumpPos) && b.chapters?.length) {
        const at = locate(b.chapters, jumpPos)
        startChapter = at.chapter
        startRatio = at.ratio
        history.replaceState(null, '', location.pathname) // so a refresh doesn't jump again
      }
      ratioRef.current = startRatio
      setChapterIdx(startChapter)
      setText(t?.text ?? '')
      setBook(b)
    })()
    return () => { cancelled = true }
  }, [bookId])

  // Esc closes panels; panels also close when leaving the reader
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setUI({ chaptersOpen: false, settingsOpen: false, searchOpen: false, resplitOpen: false, bookmarksOpen: false })
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      setUI({ chaptersOpen: false, settingsOpen: false, searchOpen: false, resplitOpen: false, bookmarksOpen: false })
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

  const totalChapters = book?.chapters?.length ?? 0

  // Whole-book progress: finished chapters + how far into the current one
  const paintBar = useCallback(
    (ratio: number) => {
      if (!barRef.current || !totalChapters) return
      const pct = Math.min(100, ((chapterIdx + ratio) / totalChapters) * 100)
      barRef.current.style.width = `${pct}%`
    },
    [chapterIdx, totalChapters],
  )

  // Initial paint after the book loads or the chapter changes
  useEffect(() => {
    paintBar(ratioRef.current)
  }, [paintBar, book])

  // Raw chapter text -> paragraphs (one per non-empty line; stored text is never modified)
  const paragraphs = useMemo(() => {
    if (!chapter) return []
    const lines = text
      .slice(chapter.start, chapter.end)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    const body = lines[0] === chapter.title ? lines.slice(1) : lines
    return cleanParagraphs(body, {
      hideSeparators: s.hideSeparators,
      joinWrapped: s.joinWrapped,
      hideLines: s.hideLines,
    })
  }, [text, chapter, s.hideSeparators, s.joinWrapped, s.hideLines])

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
      paintBar(ratio)      
      pendingRef.current = { chapter: chapterIdx, ratio }
      window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(flushProgress, 400)
    },
    [chapterIdx, flushProgress, paintBar],
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
        setViewNonce((v) => v + 1)
        setLeaving(false)
        switchingRef.current = false
      }, 180)
    },
    [book, bookId],
  )

  // Replace this book's chapters, keeping the exact spot you are reading
  async function applyChapters(next: Chapter[]) {
    const cur = book?.chapters?.[chapterIdx]
    if (!book || !cur || !next.length) return
    window.clearTimeout(saveTimer.current)
    pendingRef.current = null
    const abs = cur.start + ratioRef.current * (cur.end - cur.start) // absolute character offset
    let ci = next.findIndex((c) => abs < c.end)
    if (ci === -1) ci = next.length - 1
    const c = next[ci]
    const ratio = Math.min(1, Math.max(0, (abs - c.start) / Math.max(1, c.end - c.start)))
    const now = Date.now()
    const patch = { chapters: next, chaptersAt: now, progress: { chapter: ci, ratio }, progressAt: now, lastReadAt: now }
    await db.books.update(bookId, patch)
    ratioRef.current = ratio
    setChapterIdx(ci)
    setBook({ ...book, ...patch })
    setViewNonce((v) => v + 1)
    syncLibrary().catch(() => {}) // pushes the new chapters and position; the next sync retries on failure
  }

  async function saveBookmarks(next: Bookmark[]) {
    const patch = { bookmarks: next, bookmarksAt: Date.now() }
    await db.books.update(bookId, patch)
    setBook((b) => (b ? { ...b, ...patch } : b))
    syncLibrary().catch(() => {}) // the next sync retries on failure
  }

  async function addBookmark(note: string) {
    const cur = book?.chapters?.[chapterIdx]
    if (!book || !cur) return
    const raw = Math.floor(cur.start + ratioRef.current * (cur.end - cur.start))
    const pos = Math.max(cur.start, text.lastIndexOf('\n', raw) + 1) // snap to the start of the paragraph
    const bm: Bookmark = { id: newBookmarkId(), pos, snippet: makeSnippet(text, pos), note: note.trim(), createdAt: Date.now() }
    await saveBookmarks([...(book.bookmarks ?? []), bm])
  }

  async function removeBookmark(id: string) {
    if (!book) return
    await saveBookmarks((book.bookmarks ?? []).filter((m) => m.id !== id))
  }

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
        <div ref={barRef} />
      </div>

      <div className={`reader-view${leaving ? ' leaving' : ''}`}>
        {s.mode === 'scroll'
          ? <ScrollView key={`s-${chapterIdx}-${viewNonce}`} {...viewProps} />
          : <PagedView key={`p-${chapterIdx}-${viewNonce}`} {...viewProps} />}
      </div>

      <ChapterDrawer chapters={chapters} current={chapterIdx} onSelect={(i) => goChapter(i)} />
      <SettingsPanel />
      <SearchPanel
        text={text}
        chapters={chapters}
        onJump={(i, r) => { setUI({ searchOpen: false }); goChapter(i, r) }}
      />
      <ResplitPanel text={text} chapterCount={chapters.length} onApply={applyChapters} />
      <BookmarkPanel
        bookmarks={book.bookmarks ?? []}
        chapters={chapters}
        onAdd={addBookmark}
        onRemove={removeBookmark}
        onJump={(pos) => {
          setUI({ bookmarksOpen: false })
          const at = locate(chapters, pos)
          goChapter(at.chapter, at.ratio)
        }}
      />
      <ReaderDock />
    </div>
  )
}