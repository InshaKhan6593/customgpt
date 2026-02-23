"use client"

import { useRef, useCallback, useEffect } from "react"

/**
 * A hook that debounces a callback and returns a function to trigger it.
 * When the returned function is called, it resets the timer and will
 * fire the callback after `delay` ms of inactivity.
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
) {
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        callback(...args)
      }, delay)
    },
    [callback, delay]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return debouncedFn
}
