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

function detectChapters(text: string): Chapter[] {
  const found: { title: string; start: number }[] = []
  let pos = 0
  while (pos < text.length) {
    let nl = text.indexOf('\n', pos)
    if (nl === -1) nl = text.length
    if (nl - pos < 150) {
      const line = text.slice(pos, nl)
      if (CHAPTER_RE.test(line)) found.push({ title: line.trim(), start: pos })
    }
    pos = nl + 1
  }

  // Drop "chapters" shorter than 200 chars (usually a table of contents)
  const marks = found.filter((m, i) => i === found.length - 1 || found[i + 1].start - m.start >= 200)
  if (marks.length < 2) return splitBySize(text)

  const chapters: Chapter[] = []
  if (text.slice(0, marks[0].start).trim()) chapters.push({ title: 'Intro', start: 0, end: marks[0].start })
  marks.forEach((m, i) => {
    chapters.push({ title: m.title, start: m.start, end: marks[i + 1]?.start ?? text.length })
  })
  return chapters
}

self.onmessage = async (e: MessageEvent<File>) => {
  const buf = await e.data.arrayBuffer()
  const { text, encoding } = decode(buf)
  self.postMessage({ text, encoding, chapters: detectChapters(text) })
}