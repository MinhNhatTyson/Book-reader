import { useEffect, useLayoutEffect } from 'react'
import ChapterText from './ChapterText'

export interface ViewProps {
  title: string
  paragraphs: string[]
  initialRatio: number
  onRatio: (r: number) => void
  onPrev: ((ratio: number) => void) | null
  onNext: ((ratio: number) => void) | null
}

export default function ScrollView({ title, paragraphs, initialRatio, onRatio, onPrev, onNext }: ViewProps) {
  // Restore position once when this chapter is shown
  useLayoutEffect(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo(0, Math.max(0, max * initialRatio))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      onRatio(max > 0 ? Math.min(1, window.scrollY / max) : 0)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [onRatio])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return
      if (e.key === 'ArrowRight') onNext?.(0)
      if (e.key === 'ArrowLeft') onPrev?.(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPrev, onNext])

  return (
    <article className="text-flow scroll-view">
      <ChapterText title={title} paragraphs={paragraphs} />
      <div className="chapter-nav">
        <button disabled={!onPrev} onClick={() => onPrev?.(0)}>← Previous</button>
        <button disabled={!onNext} onClick={() => onNext?.(0)}>Next →</button>
      </div>
    </article>
  )
}