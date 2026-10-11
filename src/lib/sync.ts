import { db, deleteBook, type Book, type Bookmark, type Chapter } from './db'

const TOKEN_KEY = 'sync-token'
const SYNC_KEY = 'last-sync'
const JSON_HEADERS = { 'Content-Type': 'application/json' }

interface RemoteBook {
  id: string
  title: string
  size: number
  createdAt: number
  encoding: string | null
  chapterCount: number
  chaptersAt: number
  bookmarksAt: number
  progress: { chapter: number; ratio: number } | null
  progressAt: number | null
}

export const getToken = () => localStorage.getItem(TOKEN_KEY) ?? ''
export const hasToken = () => !!getToken()
export const getLastSync = () => Number(localStorage.getItem(SYNC_KEY)) || 0
export function setToken(t: string) {
  if (t.trim()) localStorage.setItem(TOKEN_KEY, t.trim())
  else localStorage.removeItem(TOKEN_KEY)
}

function newId() {
  // randomUUID only exists on https/localhost; fall back for http://192.168.x.x testing
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${getToken()}`)
  const res = await fetch(`/api${path}`, { ...init, headers })
  if (!res.ok) throw new Error(`${res.status} ${init.method ?? 'GET'} ${path}`)
  return res
}

async function gzip(text: string): Promise<Blob> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Response(stream).blob()
}

// One sync operation at a time, so uploads and syncs never race each other
let chain: Promise<unknown> = Promise.resolve()
function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn)
  chain = run.catch(() => {})
  return run
}

function putProgress(remoteId: string, chapter: number, ratio: number, progressAt: number) {
  return api(`/books/${remoteId}/progress`, {
    method: 'PUT',
    keepalive: true, // lets the request finish even while the page is closing
    headers: JSON_HEADERS,
    body: JSON.stringify({ chapter, ratio, progressAt }),
  })
}

async function doUpload(localId: number) {
  if (!hasToken()) return
  const b = await db.books.get(localId)
  const t = await db.texts.get(localId)
  if (!b || !t || b.uploaded) return

  const remoteId = b.remoteId ?? newId()
  await db.books.update(localId, { remoteId })
  await api('/books', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      id: remoteId, title: b.title, size: b.size, createdAt: b.createdAt,
      encoding: b.encoding ?? null, chapterCount: b.chapters?.length ?? 0,
    }),
  })
  await api(`/books/${remoteId}/chapters?at=${b.chaptersAt ?? 0}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(b.chapters ?? []) })
  if (b.bookmarksAt) {
    await api(`/books/${remoteId}/bookmarks?at=${b.bookmarksAt}`, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(b.bookmarks ?? []) })
  }
  await api(`/books/${remoteId}/text`, { method: 'PUT', body: await gzip(t.text) }) // last: makes the book visible
  if (b.progress) {
    await putProgress(remoteId, b.progress.chapter, b.progress.ratio, b.progressAt ?? b.lastReadAt ?? b.createdAt)
  }
  await db.books.update(localId, { uploaded: true })
}

async function doSync() {
  if (!hasToken()) return
  const remote: RemoteBook[] = await (await api('/books')).json()
  const local = await db.books.toArray()
  const byRemote = new Map(local.filter((b) => b.remoteId).map((b) => [b.remoteId!, b]))
  const remoteIds = new Set(remote.map((r) => r.id))

  // 1. Books that exist in the cloud: add the new ones, reconcile chapters, then reading position
  for (const r of remote) {
    const l = byRemote.get(r.id)
    if (!l) {
      const chapters: Chapter[] = await (await api(`/books/${r.id}/chapters`)).json()
      const bookmarks: Bookmark[] = r.bookmarksAt ? await (await api(`/books/${r.id}/bookmarks`)).json() : []
      await db.books.add({
        title: r.title, size: r.size, createdAt: r.createdAt, encoding: r.encoding ?? undefined,
        chapters, chaptersAt: r.chaptersAt ?? 0, bookmarks, bookmarksAt: r.bookmarksAt ?? 0,
        progress: r.progress ?? undefined, progressAt: r.progressAt ?? undefined,
        lastReadAt: r.progressAt ?? undefined, remoteId: r.id, uploaded: true,
      })
      continue
    }

    const remoteAt = r.chaptersAt ?? 0
    const localAt = l.chaptersAt ?? 0
    if (remoteAt > localAt) {
      const chapters: Chapter[] = await (await api(`/books/${r.id}/chapters`)).json()
      await db.books.update(l.id, { chapters, chaptersAt: remoteAt })
    } else if (localAt > remoteAt && l.uploaded) {
      await api(`/books/${r.id}/chapters?at=${localAt}`, {
        method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(l.chapters ?? []),
      })
    }

    const remoteBmAt = r.bookmarksAt ?? 0
    const localBmAt = l.bookmarksAt ?? 0
    if (remoteBmAt > localBmAt) {
      const bookmarks: Bookmark[] = await (await api(`/books/${r.id}/bookmarks`)).json()
      await db.books.update(l.id, { bookmarks, bookmarksAt: remoteBmAt })
    } else if (localBmAt > remoteBmAt && l.uploaded) {
      await api(`/books/${r.id}/bookmarks?at=${localBmAt}`, {
        method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(l.bookmarks ?? []),
      })
    }

    if ((r.progressAt ?? 0) > (l.progressAt ?? 0)) {
      await db.books.update(l.id, {
        progress: r.progress ?? undefined,
        progressAt: r.progressAt ?? undefined,
        lastReadAt: Math.max(l.lastReadAt ?? 0, r.progressAt ?? 0),
      })
    } else if (l.progress && (l.progressAt ?? 0) > (r.progressAt ?? 0)) {
      await putProgress(r.id, l.progress.chapter, l.progress.ratio, l.progressAt ?? 0)
    }
  }

  // 2. Books deleted on another device
  for (const l of local) {
    if (l.remoteId && l.uploaded && !remoteIds.has(l.remoteId)) await deleteBook(l.id)
  }

  // 3. Books that only exist on this device yet
  for (const l of local) {
    if (!l.uploaded) await doUpload(l.id)
  }

  localStorage.setItem(SYNC_KEY, String(Date.now()))
}

export const syncLibrary = () => enqueue(doSync)
export const uploadBook = (localId: number) => enqueue(() => doUpload(localId))

export async function deleteEverywhere(b: Book) {
  if (b.remoteId && hasToken()) await api(`/books/${b.remoteId}`, { method: 'DELETE' })
  await deleteBook(b.id)
}

// Download a book's text into this device (used when opening a cloud-only book)
export async function downloadText(localId: number) {
  const b = await db.books.get(localId)
  if (!b?.remoteId) throw new Error('not synced')
  const res = await api(`/books/${b.remoteId}/text`)
  const buf = new Uint8Array(await res.arrayBuffer())
  let text: string
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    // Still gzipped (the browser did not decompress it): decompress manually
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    text = await new Response(stream).text()
  } else {
    text = new TextDecoder('utf-8').decode(buf)
  }
  await db.texts.put({ id: localId, text })
}

// If another device has a newer reading position, adopt it (waits at most 2 s)
export async function adoptRemoteProgress(b: Book): Promise<Book> {
  if (!b.remoteId || !hasToken()) return b
  try {
    const res = await api(`/books/${b.remoteId}`, { signal: AbortSignal.timeout(2000) })
    const r: RemoteBook = await res.json()
    if (r.progress && (r.progressAt ?? 0) > (b.progressAt ?? 0)) {
      const patch = { progress: r.progress, progressAt: r.progressAt ?? undefined }
      await db.books.update(b.id, patch)
      return { ...b, ...patch }
    }
  } catch {
    /* offline or slow: keep the local position */
  }
  return b
}

// Reading position -> cloud, at most once every 5 s, plus an immediate flush when leaving
let pending: { remoteId: string; chapter: number; ratio: number; at: number } | null = null
let timer: number | undefined

export function queueProgress(remoteId: string | undefined, chapter: number, ratio: number, at: number) {
  if (!remoteId || !hasToken()) return
  pending = { remoteId, chapter, ratio, at }
  window.clearTimeout(timer)
  timer = window.setTimeout(flushRemoteProgress, 5000)
}

export function flushRemoteProgress() {
  window.clearTimeout(timer)
  const p = pending
  if (!p) return
  pending = null
  putProgress(p.remoteId, p.chapter, p.ratio, p.at).catch(() => {})
}