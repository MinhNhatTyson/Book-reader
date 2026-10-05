import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, type Book } from '../lib/db'
import { deleteEverywhere, syncLibrary, uploadBook } from '../lib/sync'
import { parseFile } from '../lib/parseFile'

type Sort = 'recent' | 'title' | 'added'

function hue(s: string) {
  let h = 0
  for (const ch of s) h = (h * 31 + (ch.codePointAt(0) ?? 0)) % 360
  return h
}

function fraction(b: Book) {
  const n = b.chapters?.length ?? 0
  if (!n || !b.progress) return 0
  return Math.min(1, (b.progress.chapter + b.progress.ratio) / n)
}

function timeAgo(ts: number) {
  const s = Math.round((ts - Date.now()) / 1000)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [['day', 86400], ['hour', 3600], ['minute', 60]]
  for (const [u, sec] of units) if (Math.abs(s) >= sec) return rtf.format(Math.round(s / sec), u)
  return 'just now'
}

export default function Library() {
  const books = useLiveQuery(() => db.books.toArray(), [])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const localTexts = useLiveQuery(() => db.texts.toCollection().primaryKeys(), [])

  // Sync when the Library opens and whenever the tab/app comes back to the foreground
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') syncLibrary().catch(() => {})
    }
    run()
    document.addEventListener('visibilitychange', run)
    return () => document.removeEventListener('visibilitychange', run)
  }, [])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = (books ?? []).filter((b) => !needle || b.title.toLowerCase().includes(needle))
    list.sort((a, b) =>
      sort === 'title' ? a.title.localeCompare(b.title)
      : sort === 'added' ? b.createdAt - a.createdAt
      : (b.lastReadAt ?? b.createdAt) - (a.lastReadAt ?? a.createdAt),
    )
    return list
  }, [books, q, sort])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const files = Array.from(input.files ?? [])
    if (!files.length) return
    setError('')
    try {
      for (const file of files) {
        setBusy(file.name)
        const { text, encoding, chapters } = await parseFile(file)
        let localId = 0
        await db.transaction('rw', db.books, db.texts, async () => {
          localId = await db.books.add({
            title: file.name.replace(/\.txt$/i, ''),
            size: file.size,
            createdAt: Date.now(),
            encoding,
            chapters,
          })
          await db.texts.add({ id: localId, text })
        })
        uploadBook(localId).catch(() => {}) // background; the next sync retries if it fails
      }
    } catch {
      setError('Could not read that file.')
    } finally {
      setBusy('')
      input.value = ''
    }
  }

  async function confirmDelete(b: Book) {
    const where = b.remoteId ? ' on all your devices' : ''
    if (!window.confirm(`Delete "${b.title}"${where}? Its reading progress will be lost.`)) return
    try {
      await deleteEverywhere(b)
    } catch {
      setError('Could not delete from the cloud. Check your connection and try again.')
    }
  }

  return (
    <main className="page library">
      <h1>Library</h1>

      <div className="lib-toolbar">
        <input type="text" placeholder="Search your books…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recent">Recently read</option>
          <option value="added">Recently added</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>

      {error && <p className="lib-error">{error}</p>}

      <div className="shelf">
        <label className="card-add">
          <input type="file" accept=".txt,text/plain" multiple hidden disabled={!!busy} onChange={handleUpload} />
          <span className="plus">+</span>
          <span>{busy ? `Analyzing ${busy}…` : 'Add .txt book'}</span>
        </label>

        {shown.map((b) => {
          const f = fraction(b)
          const total = b.chapters?.length ?? 0
          const h = hue(b.title)
          const cloudOnly = !!b.remoteId && !!localTexts && !localTexts.includes(b.id)
          return (
            <div className="card-wrap" key={b.id}>
              <Link to={`/read/${b.id}`} className="card" title={b.title}>
                <div
                  className="cover"
                  style={{ background: `linear-gradient(135deg, hsl(${h} 45% 40%), hsl(${(h + 35) % 360} 50% 22%))` }}
                >
                  <span className="initial">{Array.from(b.title)[0]?.toUpperCase()}</span>
                  <span className="cover-title">{b.title}</span>
                </div>
                <div className="meta">
                  <div className="bar"><div style={{ width: `${f * 100}%` }} /></div>
                  <div className="meta-line">
                    <span>{Math.floor(f * 100)}%</span>
                    <span>{b.progress ? `Ch. ${b.progress.chapter + 1} / ${total}` : `${total} chapters`}</span>
                  </div>
                                    <div className="meta-sub">{cloudOnly ? '☁ In cloud · ' : ''}{b.lastReadAt ? `Read ${timeAgo(b.lastReadAt)}` : 'Not started'}</div>
                </div>
              </Link>
              <button className="card-delete" aria-label={`Delete ${b.title}`} onClick={() => confirmDelete(b)}>×</button>
            </div>
          )
        })}
      </div>
    </main>
  )
}