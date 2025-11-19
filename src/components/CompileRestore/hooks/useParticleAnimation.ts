import { useCallback, useEffect, useRef } from 'react';

interface UseParticleAnimationOptions {
  isActive: boolean;
  onFrame: (deltaTime: number, currentTime: number) => void;
}

export const useParticleAnimation = ({ isActive, onFrame }: UseParticleAnimationOptions) => {
  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  const animate = useCallback((currentTime: number) => {
    const deltaTime = lastTimeRef.current ? (currentTime - lastTimeRef.current) / 1000 : 0;
    lastTimeRef.current = currentTime;

    // Call the frame update callback
    onFrame(deltaTime, currentTime)

    // Continue animation loop
    animationFrameRef.current = requestAnimationFrame(animate)
  }, [onFrame])

  useEffect(() => {
    if (isActive) {
      lastTimeRef.current = 0 // Reset time on activation
      animationFrameRef.current = requestAnimationFrame(animate)
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [isActive, animate])

  return {
    isAnimating: isActive && animationFrameRef.current !== null,
  }
}
