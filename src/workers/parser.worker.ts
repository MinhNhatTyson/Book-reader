interface Chapter { title: string; start: number; end: number }

const NUM_WORDS = 'một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười|nhất'
const CHAPTER_RE = new RegExp(
  `^\\s*(?:chương|chuong|chapter|hồi|quyển|tập|phần|volume|vol\\.?)\\s+(?:\\d+|[ivxlc]+|${NUM_WORDS})(?![\\p{L}\\p{N}])`,
  'iu',
)

function decode(buf: ArrayBuffer): { text: string; encoding: string } {
  const b = new Uint8Array(buf)
  if (b[0] === 0xff && b[1] === 0xfe) return { text: new TextDecoder('utf-16le').decode(buf), encoding: 'UTF-16 LE' }
  if (b[0] === 0xfe && b[1] === 0xff) return { text: new TextDecoder('utf-16be').decode(buf), encoding: 'UTF-16 BE' }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), encoding: 'UTF-8' }
  } catch {
    return { text: new TextDecoder('windows-1258').decode(buf), encoding: 'Windows-1258' }
  }
}

function splitBySize(text: string, target = 15000): Chapter[] {
  const out: Chapter[] = []
  let start = 0
  let n = 1
  while (start < text.length) {
    let end = Math.min(start + target, text.length)
    if (end < text.length) {
      const nl = text.indexOf('\n', end)
      end = nl === -1 ? text.length : nl + 1
    }
    out.push({ title: `Part ${n++}`, start, end })
    start = end
  }
  return out
}

type Mark = { title: string; start: number }

function lineMarks(text: string, test: (line: string) => boolean): Mark[] {
  const found: Mark[] = []
  let pos = 0
  while (pos < text.length) {
    let nl = text.indexOf('\n', pos)
    if (nl === -1) nl = text.length
    if (nl - pos < 150) {
      const line = text.slice(pos, nl)
      if (test(line)) found.push({ title: line.trim(), start: pos })
    }
    pos = nl + 1
  }
  return found
}

function buildChapters(text: string, marks: Mark[]): Chapter[] {
  const chapters: Chapter[] = []
  if (text.slice(0, marks[0].start).trim()) chapters.push({ title: 'Intro', start: 0, end: marks[0].start })
  marks.forEach((m, i) => {
    chapters.push({ title: m.title, start: m.start, end: marks[i + 1]?.start ?? text.length })
  })
  return chapters
}

function detectChapters(text: string): Chapter[] {
  const found = lineMarks(text, (l) => CHAPTER_RE.test(l))
  // Drop "chapters" shorter than 200 chars (usually a table of contents)
  const marks = found.filter((m, i) => i === found.length - 1 || found[i + 1].start - m.start >= 200)
  if (marks.length < 2) return splitBySize(text)
  return buildChapters(text, marks)
}

// Custom heading pattern: no 200-char filter, so the result is exactly what the pattern matches
function splitByPattern(text: string, pattern: string): Chapter[] {
  const re = new RegExp(pattern, 'iu') // throws on an invalid pattern
  const marks = lineMarks(text, (l) => re.test(l.trim()))
  return marks.length ? buildChapters(text, marks) : []
}

type Req =
  | Blob
  | { mode: 'auto' | 'pattern' | 'size'; text: string; pattern?: string; size?: number }

self.onmessage = async (e: MessageEvent<Req>) => {
  const d = e.data
  if (d instanceof Blob) {
    // First upload: decode the file, then detect chapters
    const { text, encoding } = decode(await d.arrayBuffer())
    self.postMessage({ text, encoding, chapters: detectChapters(text) })
    return
  }
  // Re-split an already stored text
  try {
    const chapters =
      d.mode === 'pattern' ? splitByPattern(d.text, d.pattern ?? '')
      : d.mode === 'size' ? splitBySize(d.text, d.size ?? 15000)
      : detectChapters(d.text)
    self.postMessage({ chapters })
  } catch {
    self.postMessage({ error: 'Invalid pattern' })
  }
}