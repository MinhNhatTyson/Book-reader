export interface CleanupOptions {
  hideSeparators: boolean
  joinWrapped: boolean
  hideLines: string // one rule per line: plain text = "contains", "re:..." = regex
}

const SEPARATOR_RE = /^[\s\-_=*#~·•+<>|\\/]{3,}$/u
const TERMINAL_RE = /[.!?…。！？"”’»)\]:;]$/u
const LOWER_START_RE = /^\p{Ll}/u

function buildMatchers(src: string): ((line: string) => boolean)[] {
  const out: ((line: string) => boolean)[] = []
  for (const raw of src.split(/\r?\n/)) {
    const rule = raw.trim()
    if (!rule) continue
    if (rule.startsWith('re:')) {
      try {
        const re = new RegExp(rule.slice(3), 'iu')
        out.push((l) => re.test(l))
      } catch {
        /* ignore an invalid pattern while the user is still typing it */
      }
    } else if (rule.length >= 3) {
      const needle = rule.toLowerCase()
      out.push((l) => l.toLowerCase().includes(needle))
    }
  }
  return out
}

// Display-only: takes a chapter's trimmed, non-empty lines and returns the lines to show.
export function cleanParagraphs(lines: string[], o: CleanupOptions): string[] {
  const matchers = buildMatchers(o.hideLines)
  let out = lines
  if (o.hideSeparators || matchers.length) {
    out = out.filter((l) => !(o.hideSeparators && SEPARATOR_RE.test(l)) && !matchers.some((m) => m(l)))
  }
  if (o.joinWrapped) {
    const joined: string[] = []
    for (const l of out) {
      const prev = joined[joined.length - 1]
      if (prev !== undefined && !TERMINAL_RE.test(prev) && LOWER_START_RE.test(l)) {
        joined[joined.length - 1] = `${prev} ${l}`
      } else {
        joined.push(l)
      }
    }
    out = joined
  }
  return out
}