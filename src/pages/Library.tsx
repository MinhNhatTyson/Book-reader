import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db, deleteBook } from '../lib/db'
import { parseFile } from '../lib/parseFile'

export default function Library() {
  const books = useLiveQuery(() => db.books.orderBy('createdAt').reverse().toArray(), [])
  const [busy, setBusy] = useState(false)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target
    const file = input.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const { text, encoding, chapters } = await parseFile(file)
      await db.transaction('rw', db.books, db.texts, async () => {
        const id = await db.books.add({
          title: file.name.replace(/\.txt$/i, ''),
          size: file.size,
          createdAt: Date.now(),
          encoding,
          chapters,
        })
        await db.texts.add({ id, text })
      })
    } finally {
      setBusy(false)
      input.value = ''
    }
  }

  return (
    <main className="page">
      <h1>Library</h1>
      <input type="file" accept=".txt,text/plain" onChange={handleUpload} />
      {busy && <p>Analyzing file…</p>}
      <ul>
        {books?.map((b) => (
          <li key={b.id}>
            <Link to={`/read/${b.id}`}>{b.title}</Link>{' '}
            <small>
              {(b.size / 1024).toFixed(0)} KB · {b.chapters?.length ?? '?'} chapters · {b.encoding ?? 'unknown'}
            </small>{' '}
            <button onClick={() => deleteBook(b.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  )
}