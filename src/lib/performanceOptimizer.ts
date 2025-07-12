/**
 * Performance optimization utilities for better Interaction to Next Paint (INP)
 */

// Debounce function with immediate execution option for better UX
export function debounceWithImmediate<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  let hasBeenCalled = false

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      if (!immediate || hasBeenCalled) {
        func(...args)
      }
      hasBeenCalled = false
    }

    const callNow = immediate && !timeout

    if (timeout) {
      clearTimeout(timeout)
    }

    timeout = setTimeout(later, wait)

    if (callNow) {
      func(...args)
      hasBeenCalled = true
    }
  }
}

// Throttle function that ensures execution at regular intervals
export function throttle<T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

// Schedule work to avoid blocking main thread during interactions
export function scheduleWork<T>(
  task: () => T,
  priority: 'immediate' | 'normal' | 'low' = 'normal'
): Promise<T> {
  return new Promise((resolve) => {
    const execute = () => {
      try {
        const result = task()
        resolve(result)
      } catch (_error) {
        console.error('Scheduled work error:', _error)
        resolve(task()) // Fallback
      }
    }

    switch (priority) {
      case 'immediate':
        execute()
        break
      case 'normal':
        // Use setTimeout to yield to browser
        setTimeout(execute, 0)
        break
      case 'low':
        // Use requestIdleCallback if available, otherwise setTimeout
        if ('requestIdleCallback' in window) {
          requestIdleCallback(execute, { timeout: 1000 })
        } else {
          setTimeout(execute, 16) // ~1 frame
        }
        break
    }
  })
}

// Optimize event handlers to reduce blocking time
export function optimizeEventHandler<T extends Event>(
  handler: (event: T) => void,
  options: {
    debounce?: number
    throttle?: number
    immediate?: boolean
    priority?: 'immediate' | 'normal' | 'low'
  } = {}
) {
  const { debounce: debounceMs, throttle: throttleMs, immediate = false, priority = 'normal' } = options

  let optimizedHandler = handler

  // Apply debouncing if specified
  if (debounceMs) {
    optimizedHandler = debounceWithImmediate(optimizedHandler, debounceMs, immediate)
  }

  // Apply throttling if specified (takes precedence over debouncing)
  if (throttleMs) {
    optimizedHandler = throttle(optimizedHandler, throttleMs)
  }

  // Wrap with work scheduling for non-immediate priorities
  if (priority !== 'immediate') {
    const originalHandler = optimizedHandler
    optimizedHandler = (event: T) => {
      // Prevent default immediately to ensure responsiveness
      if (event.cancelable && (event.type === 'click' || event.type === 'keydown')) {
        event.preventDefault()
      }
      
      scheduleWork(() => originalHandler(event), priority)
    }
  }

  return optimizedHandler
}

// Measure and log interaction performance
export function measureInteraction(name: string, fn: () => void) {
  if (process.env.NODE_ENV !== 'development') {
    fn()
    return
  }

  const startTime = performance.now()
  fn()
  const endTime = performance.now()
  const duration = endTime - startTime

  if (duration > 16) { // More than 1 frame
    console.warn(`Slow interaction "${name}": ${duration.toFixed(2)}ms`)
  }

  // Report to performance observer if available
  if ('PerformanceObserver' in window) {
    try {
      performance.mark(`interaction-${name}-start`)
      performance.mark(`interaction-${name}-end`)
      performance.measure(`interaction-${name}`, `interaction-${name}-start`, `interaction-${name}-end`)
    } catch {
      // Ignore performance API errors
    }
  }
}