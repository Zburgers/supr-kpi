import { useEffect, useRef, useState } from 'react'

/**
 * Hook to detect when an element enters the viewport.
 * Returns [ref, isVisible] - attach ref to the element you want to observe.
 */
export function useIntersection(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(element) // Only trigger once
        }
      },
      { threshold: 0.15, ...options }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [options])

  return [ref, isVisible] as const
}
