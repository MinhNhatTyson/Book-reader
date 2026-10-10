import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, type Book, type Bookmark } from '../lib/db'
import { chapterAt } from '../lib/bookmarks'
import { syncLibrary } from '../lib/sync'
import './Bookmarks.css'

export default function Bookmarks() {
  const books = useLiveQuery(() => db.books.toArray(), [])
  const [q, setQ] = useState('')

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (books ?? [])
      .filter((b) => b.bookmarks?.length)
      .map((b) => ({
        book: b,
        items: (b.bookmarks ?? [])
          .filter((m) => !needle || `${b.title} ${m.note} ${m.snippet}`.toLowerCase().includes(needle))
          .sort((x, y) => y.createdAt - x.createdAt),
      }))
      .filter((g) => g.items.length)
      .sort((a, b) => b.items[0].createdAt - a.items[0].createdAt)
  }, [books, q])

  async function remove(book: Book, m: Bookmark) {
    if (!window.confirm('Delete this bookmark?')) return
    await db.books.update(book.id, {
      bookmarks: (book.bookmarks ?? []).filter((x) => x.id !== m.id),
      bookmarksAt: Date.now(),
    })
    syncLibrary().catch(() => {})
  }

  return (
    <main className="page bookmarks">
      <h1>Bookmarks</h1>
      <input
        className="bm-search"
        type="text"
        placeholder="Search notes, text or book titles…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {books && groups.length === 0 && (
        <p className="bm-empty">
          {q.trim() ? 'No bookmarks match.' : 'No bookmarks yet. Open a book and tap 🔖 to save a spot.'}
        </p>
      )}

      {groups.map(({ book, items }) => (
        <section className="bm-group" key={book.id}>
          <h2>{book.title}</h2>
          {items.map((m) => {
            const chTitle = book.chapters?.length ? book.chapters[chapterAt(book.chapters, m.pos)]?.title : ''
            return (
              <div className="bm-card" key={m.id}>
                <Link to={`/read/${book.id}?pos=${m.pos}`}>
                  <span className="bm-chapter">{chTitle} · {new Date(m.createdAt).toLocaleDateString()}</span>
                  <span className="bm-snippet">{m.snippet}…</span>
                  {m.note && <span className="bm-note">{m.note}</span>}
                </Link>
                <button aria-label="Delete bookmark" onClick={() => remove(book, m)}>×</button>
              </div>
            )
          })}
        </section>
      ))}
    </main>
  )
}