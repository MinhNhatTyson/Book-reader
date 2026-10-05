import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import ChapterText from './ChapterText'
import { useSettings } from '../lib/settings'
import type { ViewProps } from './ScrollView'

const GAP = 64

export default function PagedView({ title, paragraphs, initialRatio, onRatio, onPrev, onNext }: ViewProps) {
  const s = useSettings()
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const ratioRef = useRef(initialRatio)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [page, setPage] = useState(0)
  const [pages, setPages] = useState(1)

  // Measure the viewport (and re-measure when web fonts finish loading)
  useEffect(() => {
    const el = viewportRef.current!
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    document.fonts.ready.then(measure)
    return () => ro.disconnect()
  }, [])

  // Count pages whenever the layout could have changed
  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el || size.w === 0) return
    const n = Math.max(1, Math.round((el.scrollWidth + GAP) / (size.w + GAP)))
    setPages(n)
    setPage(Math.round(ratioRef.current * (n - 1)))
  }, [size, paragraphs, s.fontSize, s.fontFamily, s.lineHeight, s.paraSpacing, s.indent, s.justify, s.width])

  const go = useCallback(
    (p: number) => {
      if (p < 0) return onPrev?.(1) // previous chapter, last page
      if (p >= pages) return onNext?.(0)
      setPage(p)
      ratioRef.current = pages > 1 ? p / (pages - 1) : 0
      onRatio(ratioRef.current)
    },
    [pages, onPrev, onNext, onRatio],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1)
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, page])

  const touchX = useRef<number | null>(null)

  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) > 50) go(dx < 0 ? page + 1 : page - 1)
  }
  // Tap zones: left 30% = previous, right 30% = next (touch devices only)
  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!window.matchMedia('(pointer: coarse)').matches) return
    if (window.getSelection()?.toString()) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    if (x < 0.3) go(page - 1)
    else if (x > 0.7) go(page + 1)
  }

  return (
    <div className="paged">
      <button className="edge left" onClick={() => go(page - 1)} aria-label="Previous page">‹</button>
      <div className="paged-viewport" ref={viewportRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onClick={onTap}>
        <div
          ref={contentRef}
          className="paged-content text-flow"
          style={{
            height: size.h,
            columnWidth: size.w,
            columnGap: GAP,
            transform: `translateX(-${page * (size.w + GAP)}px)`,
          }}
        >
          <ChapterText title={title} paragraphs={paragraphs} />
        </div>
      </div>
      <button className="edge right" onClick={() => go(page + 1)} aria-label="Next page">›</button>
      <div className="paged-footer">Page {page + 1} / {pages}</div>
    </div>
  )
}