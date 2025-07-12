import React, { useRef, useEffect, useState } from 'react';
import { useDebouncedCallback } from '../../../hooks/useDebouncedCallback';

interface Coords {
  x: number;
  y: number;
}

interface ParticleFlowCanvasProps {
  isCompileMode: boolean;
  isActive: boolean;
  source: Coords;
  target: Coords;
}

export const ParticleFlowCanvas: React.FC<ParticleFlowCanvasProps> = React.memo(({
  isCompileMode,
  isActive,
  source,
  target,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Array<{
    id: number;
    startTime: number;
    size: number;
    speed: number;
    spawnOffset: { x: number; y: number };
    pathVariation: { x: number; y: number };
    transformOffset: number;
    ghost?: {
      x: number;
      y: number;
      radius: number;
      r: number;
      g: number;
      b: number;
      opacity: number;
      startTime: number;
    } | null;
  }>>([]);
  const prevCompileModeRef = useRef<boolean | null>(null);
  const animationFrameIdRef = useRef<number>(0);
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeEnd = useDebouncedCallback(() => {
    setIsResizing(false);
  }, 300);

  // Effect for initialization - RESTORE original canvas sizing logic
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      setIsResizing(true);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width * window.devicePixelRatio;
      canvas.height = height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      handleResizeEnd();
    };

    // Initial setup
    resizeCanvas();

    // RESTORE window resize listener for canvas internal sizing
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, [handleResizeEnd]);

  // Effect for animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isActive || isResizing) {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const PARTICLE_COUNT = 12; // Reduced from 20 for better performance
    const CYCLE_DURATION = 8;

    if (particlesRef.current.length === 0) {
      particlesRef.current = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
        const phase = i / PARTICLE_COUNT;
        const spawnAngle = Math.random() * Math.PI * 2;
        const spawnRadius = 25 + Math.random() * 20;
        return {
          id: i,
          startTime: performance.now() - phase * CYCLE_DURATION * 1000,
          size: 12 + Math.random() * 6, // Increased from 10 + Math.random() * 5
          speed: 1.0,
          spawnOffset: { x: Math.cos(spawnAngle) * spawnRadius, y: Math.sin(spawnAngle) * spawnRadius },
          pathVariation: { x: (Math.random() - 0.5) * 100, y: (Math.random() - 0.5) * 60 },
          transformOffset: (Math.random() - 0.4) * 0.2,
        };
      });
    }

    if (prevCompileModeRef.current !== null && isCompileMode !== prevCompileModeRef.current) {
      const now = performance.now();
      particlesRef.current.forEach(p => {
        const elapsedTime = (now - p.startTime) / 1000;
        const currentProgress = (elapsedTime / (CYCLE_DURATION * p.speed)) % 1;
        const reversedProgress = 1.0 - currentProgress;
        
        const oldSourceColor = !isCompileMode ? [0, 143, 255] : [255, 127, 0];
        const oldTargetColor = !isCompileMode ? [255, 127, 0] : [0, 143, 255];
        const oldTransformStart = 0.45 + p.transformOffset;
        const oldMix = Math.max(0, Math.min(1, (currentProgress - oldTransformStart) / 0.25));
        const r = (oldSourceColor[0] * (1 - oldMix) + oldTargetColor[0] * oldMix) | 0;
        const g = (oldSourceColor[1] * (1 - oldMix) + oldTargetColor[1] * oldMix) | 0;
        const b = (oldSourceColor[2] * (1 - oldMix) + oldTargetColor[2] * oldMix) | 0;

        const oldOpacity = Math.sin(currentProgress * Math.PI);
        const oldPulse = Math.sin((now / 400) + p.id) * 0.05;
        const oldScale = 0.8 + Math.sin(currentProgress * Math.PI) * 0.35 + oldPulse;
        
        const oldSourceX = !isCompileMode ? source.x : target.x;
        const oldSourceY = !isCompileMode ? source.y : target.y;
        const oldTargetX = !isCompileMode ? target.x : source.x;
        const oldTargetY = !isCompileMode ? target.y : source.y;

        const oldMidX = (oldSourceX + oldTargetX) / 2 + p.pathVariation.x;
        const oldMidY = (oldSourceY + oldTargetY) / 2 + p.pathVariation.y;

        p.ghost = {
          x: (1 - currentProgress) * (1 - currentProgress) * oldSourceX + 2 * (1 - currentProgress) * currentProgress * oldMidX + currentProgress * currentProgress * oldTargetX,
          y: (1 - currentProgress) * (1 - currentProgress) * oldSourceY + 2 * (1 - currentProgress) * currentProgress * oldMidY + currentProgress * currentProgress * oldTargetY,
          radius: (p.size * oldScale) / 2,
          r, g, b,
          opacity: oldOpacity,
          startTime: now,
        };

        p.startTime = now - (reversedProgress * CYCLE_DURATION * p.speed * 1000);
      });
    }
    prevCompileModeRef.current = isCompileMode;

    const draw = (time: number) => {
      if (!canvasRef.current) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach(p => {
        const elapsedTime = (time - p.startTime) / 1000;
        const progress = (elapsedTime / (CYCLE_DURATION * p.speed)) % 1;

        const sourceX = source.x + p.spawnOffset.x;
        const sourceY = source.y + p.spawnOffset.y;
        const targetX = target.x + p.spawnOffset.x;
        const targetY = target.y + p.spawnOffset.y;

        const midX = (sourceX + targetX) / 2 + p.pathVariation.x;
        const midY = (sourceY + targetY) / 2 + p.pathVariation.y;

        const x = (1 - progress) * (1 - progress) * sourceX + 2 * (1 - progress) * progress * midX + progress * progress * targetX;
        const y = (1 - progress) * (1 - progress) * sourceY + 2 * (1 - progress) * progress * midY + progress * progress * targetY;

        const opacity = Math.sin(progress * Math.PI);
        const pulse = Math.sin((time / 400) + p.id) * 0.05;
        const scale = 0.8 + Math.sin(progress * Math.PI) * 0.35 + pulse;

        const sourceColor = isCompileMode ? [0, 143, 255] : [255, 127, 0];
        const targetColor = isCompileMode ? [255, 127, 0] : [0, 143, 255];
        const transformStart = 0.45 + p.transformOffset;
        const mix = Math.max(0, Math.min(1, (progress - transformStart) / 0.25));
        const r = (sourceColor[0] * (1 - mix) + targetColor[0] * mix) | 0;
        const g = (sourceColor[1] * (1 - mix) + targetColor[1] * mix) | 0;
        const b = (sourceColor[2] * (1 - mix) + targetColor[2] * mix) | 0;

        let finalOpacity = opacity;
        const GHOST_DURATION = 300;

        if (p.ghost) {
          const timeSinceGhost = time - p.ghost.startTime;
          if (timeSinceGhost < GHOST_DURATION) {
            const ghostProgress = timeSinceGhost / GHOST_DURATION;
            const ghostOpacity = (1 - ghostProgress) * p.ghost.opacity;
            
            // Simplified ghost rendering
            ctx.fillStyle = `rgba(${p.ghost.r},${p.ghost.g},${p.ghost.b},${ghostOpacity})`;
            ctx.beginPath();
            ctx.arc(p.ghost.x | 0, p.ghost.y | 0, p.ghost.radius, 0, Math.PI * 2);
            ctx.fill();

            finalOpacity *= ghostProgress;
          } else {
            p.ghost = null;
          }
        }

        const particleX = x | 0;
        const particleY = y | 0;
        const particleRadius = (p.size * scale) / 2;

        // Simplified rendering for better performance
        ctx.fillStyle = `rgba(${r},${g},${b},${finalOpacity})`;
        ctx.shadowColor = `rgba(${r},${g},${b},${finalOpacity * 0.5})`;
        ctx.shadowBlur = 8; // Reduced shadow blur for performance

        ctx.beginPath();
        ctx.arc(particleX, particleY, particleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Simplified highlight - single circle instead of gradient
        if (finalOpacity > 0.3) { // Only render highlight for visible particles
          const highlightX = particleX + particleRadius * 0.2;
          const highlightY = particleY - particleRadius * 0.2;
          const highlightRadius = particleRadius * 0.15;
          
          ctx.fillStyle = `rgba(255, 255, 255, ${finalOpacity * 0.4})`;
          ctx.beginPath();
          ctx.arc(highlightX, highlightY, highlightRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      animationFrameIdRef.current = requestAnimationFrame(draw);
    };

    animationFrameIdRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameIdRef.current);
    };
  }, [isCompileMode, isActive, source, target, isResizing]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1, display: isActive ? 'block' : 'none' }} />;
});