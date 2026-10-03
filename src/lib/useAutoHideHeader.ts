import { useEffect } from 'react'
import { setUI } from './uiStore'

// Hide the header while scrolling down, show it while scrolling up or near the top.
export function useAutoHideHeader() {
  useEffect(() => {
    let lastY = window.scrollY
    const onScroll = () => {
      const y = window.scrollY
      const dy = y - lastY
      if (y < 80) setUI({ headerHidden: false })
      else if (dy > 12) setUI({ headerHidden: true })
      else if (dy < -12) setUI({ headerHidden: false })
      if (Math.abs(dy) > 12) lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      setUI({ headerHidden: false }) // leaving scroll mode or the reader
    }
  }, [])
}