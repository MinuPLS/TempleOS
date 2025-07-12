import { useCallback, useRef } from 'react'

export function useOptimizedInput(onInputChange: (value: string) => void) {
  const rafId = useRef<number>()

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    
    // Cancel previous RAF if it exists
    if (rafId.current) {
      cancelAnimationFrame(rafId.current)
    }
    
    // Schedule the update for the next frame
    rafId.current = requestAnimationFrame(() => {
      onInputChange(value)
    })
  }, [onInputChange])

  return { handleInputChange }
}