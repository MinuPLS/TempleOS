import { useRef, useState, useEffect, memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ParticleFlowCanvas } from './ParticleFlowCanvas';
import HolyCLogo from '../../../assets/TokenLogos/HolyC.png';
import JITLogo from '../../../assets/TokenLogos/JIT.png';
import styles from '../styles/tokenFlow.module.css';

interface TokenFlowFinalProps {
  isCompileMode: boolean;
  onModeChange: (isCompile: boolean) => void;
}

interface Coords {
  x: number;
  y: number;
}

export const TokenFlowFinal = memo<TokenFlowFinalProps>(({
  isCompileMode,
  onModeChange,
}) => {
  const particleColor = isCompileMode ? '#3b82f6' : '#f59e0b';

  const holyCRef = useRef<HTMLDivElement>(null);
  const jitRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{ source: Coords | null, target: Coords | null }>({ source: null, target: null });

  // Optimized coordinate measurement with debouncing and ResizeObserver
  useEffect(() => {
    const measureElements = () => {
      if (holyCRef.current && jitRef.current && containerRef.current) {
        // Use getBoundingClientRect more efficiently
        const containerRect = containerRef.current.getBoundingClientRect();
        const holyCRect = holyCRef.current.getBoundingClientRect();
        const jitRect = jitRef.current.getBoundingClientRect();

        const holyCCenter = {
          x: holyCRect.left - containerRect.left + holyCRect.width * 0.5,
          y: holyCRect.top - containerRect.top + holyCRect.height * 0.5,
        };
        const jitCenter = {
          x: jitRect.left - containerRect.left + jitRect.width * 0.5,
          y: jitRect.top - containerRect.top + jitRect.height * 0.5,
        };
        
        setCoords({
          source: isCompileMode ? holyCCenter : jitCenter,
          target: isCompileMode ? jitCenter : holyCCenter,
        });
      }
    };

    // Use ResizeObserver for better performance than window resize
    let resizeObserver: ResizeObserver | null = null;
    
    const initMeasurement = () => {
      // Initial measurement with RAF for smooth rendering
      requestAnimationFrame(measureElements);
      
      // Set up ResizeObserver for container changes
      if (containerRef.current && 'ResizeObserver' in window) {
        resizeObserver = new ResizeObserver((_entries) => {
          // Debounce resize measurements
          requestAnimationFrame(measureElements);
        });
        resizeObserver.observe(containerRef.current);
      } else {
        // Fallback for browsers without ResizeObserver
        let resizeTimer: NodeJS.Timeout;
        const throttledResize = () => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(measureElements, 150); // Increased debounce time
        };
        window.addEventListener('resize', throttledResize);
        
        return () => {
          clearTimeout(resizeTimer);
          window.removeEventListener('resize', throttledResize);
        };
      }
    };

    const timer = setTimeout(initMeasurement, 16);
    
    return () => {
      clearTimeout(timer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isCompileMode]);

  // Memoize coordinates more efficiently
  const { sourceCoords, targetCoords } = useMemo(() => {
    return {
      sourceCoords: coords.source,
      targetCoords: coords.target,
    };
  }, [coords.source, coords.target]);


  return (
    <motion.div
      className={styles.tokenFlow}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 15, stiffness: 200 }}
      ref={containerRef}
      style={{ position: 'relative' }}
    >
      {/* Particle container rendered first (behind) */}
      {sourceCoords && targetCoords && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <ParticleFlowCanvas
            isCompileMode={isCompileMode}
            isActive={true}
            source={sourceCoords}
            target={targetCoords}
          />
        </div>
      )}
      
      <div className={styles.tokenRow}>
        {/* HolyC Token */}
        <motion.div
          ref={holyCRef}
          className={`${styles.tokenItem} ${styles.holyCToken} ${
            isCompileMode ? styles.sourceActive : styles.targetActive
          }`}
          onClick={() => onModeChange(true)}
          animate={{
            filter: isCompileMode
              ? 'brightness(1.3) saturate(1.2)'
              : 'brightness(0.8) saturate(0.8)',
          }}
          transition={{ type: 'spring', damping: 10, stiffness: 150 }}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.tokenContainer}>
            <img
              src={HolyCLogo}
              alt="HolyC"
              className={styles.tokenLogo}
              draggable={false}
            />
            <div
              className={styles.tokenGlow}
              style={{ opacity: isCompileMode ? 1 : 0 }}
            />
            {/* Target preview effect - shows on HolyC when restoring (removed) */}
          </div>
          <span className={styles.tokenName}>HolyC</span>
        </motion.div>

        {/* Central Transformation Area */}
        <div className={styles.centralArea}>
          <motion.div
            className={styles.vortex}
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
            style={{ background: `conic-gradient(from 0deg, transparent, ${particleColor}22, transparent)` }}
          />
          
          <motion.button
            className={styles.arrowButton}
            onClick={() => onModeChange(!isCompileMode)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            style={{ border: `2px solid ${particleColor}` }}
          >
            <motion.svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={styles.arrowSvg}
              animate={{ rotate: isCompileMode ? 0 : 180 }}
              transition={{ type: 'tween', duration: 0.4, ease: 'circOut' }}
            >
              <defs>
                <linearGradient
                  id={`arrowGradient-${isCompileMode}`}
                  x1="0%"
                  y1="50%"
                  x2="100%"
                  y2="50%"
                >
                  <stop offset="0%" stopColor={particleColor} stopOpacity="0.7" />
                  <stop offset="100%" stopColor={particleColor} stopOpacity="1" />
                </linearGradient>
              </defs>
              <motion.path
                d="M6 16H26M26 16L18 8M26 16L18 24"
                stroke={`url(#arrowGradient-${isCompileMode})`}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />
            </motion.svg>
          </motion.button>
        </div>

        {/* JIT Token */}
        <motion.div
          ref={jitRef}
          className={`${styles.tokenItem} ${styles.jitToken} ${
            isCompileMode ? styles.targetActive : styles.sourceActive
          }`}
          onClick={() => onModeChange(false)}
          animate={{
            filter: !isCompileMode
              ? 'brightness(1.3) saturate(1.2)'
              : 'brightness(0.8) saturate(0.8)',
          }}
          transition={{ type: 'spring', damping: 10, stiffness: 150 }}
          style={{ cursor: 'pointer' }}
        >
          <div className={styles.tokenContainer}>
            <img
              src={JITLogo}
              alt="JIT"
              className={styles.tokenLogo}
              draggable={false}
            />
            <div
              className={styles.tokenGlow}
              style={{ opacity: !isCompileMode ? 1 : 0 }}
            />
            {/* Target preview effect - shows on JIT when compiling (removed) */}
          </div>
          <span className={styles.tokenName}>JIT</span>
        </motion.div>
      </div>
    </motion.div>
  );
});