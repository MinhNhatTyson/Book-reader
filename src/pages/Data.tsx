import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Book } from '../lib/db'
import { downloadText } from '../lib/sync'
import './Data.css'

function fmt(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${Math.round(n / 1024)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

export default function Data() {
  const books = useLiveQuery(() => db.books.toArray(), [])
  const localIds = useLiveQuery(() => db.texts.toCollection().primaryKeys(), [])
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [tick, setTick] = useState(0) // bump to re-read the storage numbers
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    navigator.storage?.estimate?.().then((e) => { if (alive) setEst({ usage: e.usage ?? 0, quota: e.quota ?? 0 }) })
    navigator.storage?.persisted?.().then((p) => { if (alive) setPersisted(p) })
    return () => { alive = false }
  }, [tick])

  const local = new Set(localIds ?? [])
  const list = [...(books ?? [])].sort((a, b) => b.size - a.size)
  const localBytes = list.filter((b) => local.has(b.id)).reduce((n, b) => n + b.size, 0)
  const pct = est && est.quota ? Math.min(100, (est.usage / est.quota) * 100) : 0

  async function removeLocal(b: Book) {
    if (!window.confirm(`Remove "${b.title}" from this device? It stays in the cloud and downloads again when you open it.`)) return
    await db.texts.delete(b.id)
    setTick((t) => t + 1)
  }

  async function download(b: Book) {
    setBusy(b.id)
    setError('')
    try {
      await downloadText(b.id)
      setTick((t) => t + 1)
    } catch {
      setError('Could not download. Check your connection and sync token.')
    } finally {
      setBusy(null)
    }
  }

  async function askPersist() {
    setPersisted(await navigator.storage.persist())
  }

  function status(b: Book) {
    const has = local.has(b.id)
    if (has && b.remoteId && b.uploaded) return 'On this device · in cloud'
    if (has) return 'Device only (not uploaded yet)'
    if (b.remoteId) return '☁ Cloud only'
    return 'Text missing'
  }

  return (
    <main className="page data">
      <h1>Data</h1>

      <section className="data-card">
        <strong>Storage on this device</strong>
        {est ? (
          <>
            <div className="data-bar"><div style={{ width: `${pct}%` }} /></div>
            <div className="data-muted">
              {fmt(est.usage)} used of about {fmt(est.quota)} allowed by this browser
            </div>
          </>
        ) : (
          <div className="data-muted">Your browser does not report storage usage.</div>
        )}
        <div className="data-muted">
          Books stored here: {fmt(localBytes)}
          {persisted !== null && (
            <>
              {' · '}Persistent storage: {persisted ? 'granted' : 'not granted (the browser may clear data when space is low)'}
              {!persisted && <> <button className="data-link" onClick={askPersist}>Ask again</button></>}
            </>
          )}
        </div>
      </section>

      {error && <p className="data-error">{error}</p>}
      {books && list.length === 0 && <p className="data-muted">No books yet.</p>}

      <section>
        {list.map((b) => {
          const has = local.has(b.id)
          return (
            <div className="data-row" key={b.id}>
              <div className="data-info">
                <div className="data-title">{b.title}</div>
                <div className="data-muted">{fmt(b.size)} · {status(b)}</div>
              </div>
              {has && b.remoteId && b.uploaded && (
                <button className="data-btn secondary" onClick={() => removeLocal(b)}>Remove local copy</button>
              )}
              {!has && b.remoteId && (
                <button className="data-btn" disabled={busy === b.id} onClick={() => download(b)}>
                  {busy === b.id ? 'Downloading…' : 'Download'}
                </button>
              )}
            </div>
          )
        })}
      </section>
    </main>
  )
}