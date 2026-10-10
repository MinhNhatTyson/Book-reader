import type { Chapter } from './db'

export function newBookmarkId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

// Binary search: which chapter contains this character offset?
export function chapterAt(chapters: Chapter[], pos: number) {
  let lo = 0
  let hi = chapters.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (chapters[mid].start <= pos) lo = mid
    else hi = mid - 1
  }
  return lo
}

export function locate(chapters: Chapter[], pos: number) {
  const chapter = chapterAt(chapters, pos)
  const c = chapters[chapter]
  return { chapter, ratio: Math.min(1, Math.max(0, (pos - c.start) / Math.max(1, c.end - c.start))) }
}

export function makeSnippet(text: string, pos: number) {
  return text.slice(pos, pos + 160).replace(/\s+/g, ' ').trim().slice(0, 90)
}