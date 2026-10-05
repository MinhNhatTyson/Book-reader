interface Env {
  DB: D1Database
  BOOKS: KVNamespace
  ASSETS: Fetcher
  API_TOKEN: string
}

interface BookRow {
  id: string
  title: string
  size: number
  created_at: number
  encoding: string | null
  chapter_count: number
  progress_chapter: number | null
  progress_ratio: number | null
  progress_at: number | null
}

const MAX_TEXT = 24 * 1024 * 1024 // KV value limit is 25 MiB
const MAX_CHAPTERS_JSON = 1_800_000 // D1 row limit is 2 MB
const ID_RE = /^[A-Za-z0-9_-]{8,64}$/
const COLS = 'id, title, size, created_at, encoding, chapter_count, progress_chapter, progress_ratio, progress_at'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

const toBook = (r: BookRow) => ({
  id: r.id,
  title: r.title,
  size: r.size,
  createdAt: r.created_at,
  encoding: r.encoding,
  chapterCount: r.chapter_count,
  progress: r.progress_chapter === null ? null : { chapter: r.progress_chapter, ratio: r.progress_ratio ?? 0 },
  progressAt: r.progress_at,
})

function authorized(req: Request, env: Env) {
  if (!env.API_TOKEN) return false
  const enc = new TextEncoder()
  const a = enc.encode(req.headers.get('Authorization') ?? '')
  const b = enc.encode(`Bearer ${env.API_TOKEN}`)
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b)
}

async function list(env: Env) {
  const { results } = await env.DB.prepare(`SELECT ${COLS} FROM books WHERE ready = 1`).all<BookRow>()
  return json(results.map(toBook))
}

async function getOne(env: Env, id: string) {
  const row = await env.DB.prepare(`SELECT ${COLS} FROM books WHERE id = ?1 AND ready = 1`).bind(id).first<BookRow>()
  return row ? json(toBook(row)) : json({ error: 'not found' }, 404)
}

async function upsert(req: Request, env: Env) {
  const b = await req.json<{
    id: string; title: string; size: number; createdAt: number; encoding: string | null; chapterCount: number
  }>()
  if (!ID_RE.test(b.id)) return json({ error: 'bad id' }, 400)
  await env.DB.prepare(
    `INSERT INTO books (id, title, size, created_at, encoding, chapter_count, ready)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)
     ON CONFLICT(id) DO UPDATE SET title = ?2, size = ?3, encoding = ?5, chapter_count = ?6, ready = 0`,
  ).bind(b.id, b.title, b.size, b.createdAt, b.encoding, b.chapterCount).run()
  return json({ ok: true })
}

async function getChapters(env: Env, id: string) {
  const row = await env.DB.prepare('SELECT chapters FROM books WHERE id = ?1').bind(id).first<{ chapters: string }>()
  return row
    ? new Response(row.chapters, { headers: { 'Content-Type': 'application/json' } })
    : json({ error: 'not found' }, 404)
}

async function putChapters(req: Request, env: Env, id: string) {
  const body = await req.text()
  if (body.length > MAX_CHAPTERS_JSON) return json({ error: 'too many chapters' }, 413)
  const r = await env.DB.prepare('UPDATE books SET chapters = ?1 WHERE id = ?2').bind(body, id).run()
  return r.meta.changes ? json({ ok: true }) : json({ error: 'not found' }, 404)
}

async function getText(env: Env, id: string) {
  const body = await env.BOOKS.get(`text:${id}`, 'stream')
  if (!body) return json({ error: 'not found' }, 404)
  // Stored gzipped; the browser decompresses transparently because of Content-Encoding.
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Encoding': 'gzip',
      'Cache-Control': 'private, no-store',
    },
  })
}

async function putText(req: Request, env: Env, id: string) {
  const exists = await env.DB.prepare('SELECT 1 AS x FROM books WHERE id = ?1').bind(id).first()
  if (!exists) return json({ error: 'not found' }, 404)
  const buf = await req.arrayBuffer()
  if (buf.byteLength > MAX_TEXT) return json({ error: 'too large' }, 413)
  await env.BOOKS.put(`text:${id}`, buf)
  await env.DB.prepare('UPDATE books SET ready = 1 WHERE id = ?1').bind(id).run() // visible to other devices only now
  return json({ ok: true })
}

async function putProgress(req: Request, env: Env, id: string) {
  const p = await req.json<{ chapter: number; ratio: number; progressAt: number }>()
  await env.DB.prepare(
    `UPDATE books SET progress_chapter = ?1, progress_ratio = ?2, progress_at = ?3
     WHERE id = ?4 AND (progress_at IS NULL OR progress_at <= ?3)`,
  ).bind(p.chapter, p.ratio, p.progressAt, id).run()
  return json({ ok: true })
}

async function remove(env: Env, id: string) {
  await env.BOOKS.delete(`text:${id}`)
  await env.DB.prepare('DELETE FROM books WHERE id = ?1').bind(id).run()
  return json({ ok: true })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    if (!authorized(req, env)) return json({ error: 'unauthorized' }, 401)

    const [, resource, id, sub] = url.pathname.split('/').filter(Boolean)
    if (resource !== 'books') return json({ error: 'not found' }, 404)
    if (id && !ID_RE.test(id)) return json({ error: 'bad id' }, 400)
    const m = req.method

    try {
      if (!id) {
        if (m === 'GET') return await list(env)
        if (m === 'POST') return await upsert(req, env)
      } else if (!sub) {
        if (m === 'GET') return await getOne(env, id)
        if (m === 'DELETE') return await remove(env, id)
      } else if (sub === 'chapters') {
        if (m === 'GET') return await getChapters(env, id)
        if (m === 'PUT') return await putChapters(req, env, id)
      } else if (sub === 'text') {
        if (m === 'GET') return await getText(env, id)
        if (m === 'PUT') return await putText(req, env, id)
      } else if (sub === 'progress' && m === 'PUT') {
        return await putProgress(req, env, id)
      }
      return json({ error: 'not found' }, 404)
    } catch (e) {
      console.error(e)
      return json({ error: 'server error' }, 500)
    }
  },
}