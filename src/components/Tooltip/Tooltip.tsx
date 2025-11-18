import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import styles from './Tooltip.module.css';
import { throttle } from '../../lib/performanceOptimizer';

export interface TooltipProps {
  content: string | React.ReactNode;
  children: React.ReactNode;
  variant?: 'info' | 'warning' | 'success' | 'burn';
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  disabled?: boolean;
  trigger?: 'hover' | 'click' | 'both';
  delay?: number;
  className?: string;
  showIcon?: boolean;
  iconSize?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  variant = 'info',
  position = 'auto',
  disabled = false,
  trigger = 'both',
  delay = 50,
  className = '',
  showIcon = false,
  iconSize = 16
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isPreloaded, setIsPreloaded] = useState(false); // Track if tooltip is mounted and positioned
  const [calculatedPosition, setCalculatedPosition] = useState(position);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hideDelayRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const tooltipHoverRef = useRef(false);
  const triggerFocusedRef = useRef(false);

  useEffect(() => {
    // Detect mobile device with throttling
    const checkMobile = throttle(() => {
      setIsMobile(window.innerWidth <= 900 || 'ontouchstart' in window); // Unified breakpoint
    }, 16); // ~1 frame for 60fps
    
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const calculateAndSetPosition = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let finalPosition = position;
    let top = 0;
    let left = 0;

    // Auto-calculate position if needed
    if (position === 'auto') {
      const spaceTop = triggerRect.top;
      const spaceBottom = viewport.height - triggerRect.bottom;
      const spaceLeft = triggerRect.left;

      if (spaceTop >= tooltipRect.height + 10) {
        finalPosition = 'top';
      } else if (spaceBottom >= tooltipRect.height + 10) {
        finalPosition = 'bottom';
      } else if (spaceLeft >= tooltipRect.width + 10) {
        finalPosition = 'left';
      } else {
        finalPosition = 'right';
      }
    }

    // Calculate position based on final position
    switch (finalPosition) {
      case 'top':
        top = triggerRect.top - tooltipRect.height - 10;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + 10;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - 10;
        break;
      case 'right':
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + 10;
        break;
    }

    // Ensure tooltip stays within viewport
    left = Math.max(10, Math.min(left, viewport.width - tooltipRect.width - 10));
    top = Math.max(10, Math.min(top, viewport.height - tooltipRect.height - 10));

    setCalculatedPosition(finalPosition);
    setTooltipStyle({
      top: `${top}px`,
      left: `${left}px`,
      position: 'fixed'
    });
  }, [position]);

  // Preload tooltip - mount it without positioning (positioning happens on show)
  const preloadTooltip = useCallback(() => {
    if (disabled || !content || isPreloaded) return;
    
    setIsPreloaded(true);
    // Don't calculate position on preload - do it when actually showing
    // This prevents stale positioning after window resizes
  }, [disabled, content, isPreloaded]);

  // Listen for external preload events
  useEffect(() => {
    const handlePreloadEvent = () => {
      preloadTooltip();
    };

    const triggerElement = triggerRef.current;
    if (triggerElement) {
      triggerElement.addEventListener('preload-tooltip', handlePreloadEvent);
      return () => {
        triggerElement.removeEventListener('preload-tooltip', handlePreloadEvent);
      };
    }
  }, [preloadTooltip]);

  const showTooltip = useCallback((instant = false) => {
    if (disabled || !content) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const show = () => {
      if (!isPreloaded) {
        // If not preloaded, mount first
        setIsPreloaded(true);
        setTimeout(() => {
          calculateAndSetPosition();
          setIsVisible(true);
        }, 0);
      } else {
        // Already preloaded (mounted), calculate fresh position and show
        setTimeout(() => {
          calculateAndSetPosition();
          setIsVisible(true);
        }, 0);
      }
    };

    if (isMobile || instant) {
      show();
    } else {
      timeoutRef.current = setTimeout(show, delay);
    }
  }, [disabled, content, isMobile, delay, isPreloaded, calculateAndSetPosition]);

  const hideTooltip = useCallback(
    (force = false) => {
      if (force) {
        triggerFocusedRef.current = false;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (hideDelayRef.current) {
        clearTimeout(hideDelayRef.current);
        hideDelayRef.current = null;
      }

      if (!force && triggerFocusedRef.current) {
        return;
      }

      if (force || isMobile || trigger === 'click') {
        tooltipHoverRef.current = false;
        setIsVisible(false);
        return;
      }

      hideDelayRef.current = setTimeout(() => {
        if (!tooltipHoverRef.current && !triggerFocusedRef.current) {
          setIsVisible(false);
        }
      }, 120);
    },
    [isMobile, trigger]
  );

  const forceHideTooltip = useCallback(() => hideTooltip(true), [hideTooltip]);

  const handleClick = (e: React.MouseEvent) => {
    if (disabled || !content) return;
    
    e.preventDefault();
    e.stopPropagation();
    if (!isMobile) {
      triggerRef.current?.focus();
      triggerFocusedRef.current = true;
    }
    
    if (isMobile || trigger === 'click' || trigger === 'both') {
      if (isVisible) {
        setIsVisible(false);
      } else {
        if (isPreloaded) {
          // Already preloaded (mounted) - calculate fresh position and show
          setTimeout(() => {
            calculateAndSetPosition();
            setIsVisible(true);
          }, 0);
        } else {
          // Not preloaded, need to mount and position first
          showTooltip(true);
        }
      }
    }
  };


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isVisible &&
        tooltipRef.current &&
        triggerRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('scroll', forceHideTooltip);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', forceHideTooltip);
    };
  }, [isVisible, hideTooltip, forceHideTooltip]);

  useEffect(() => {
    return () => {
      if (hideDelayRef.current) {
        clearTimeout(hideDelayRef.current);
      }
    };
  }, []);

  const tooltipElement = (
    <div
      ref={tooltipRef}
      className={`${styles.tooltip} ${isVisible ? styles.visible : ''} ${styles[variant]} ${styles[calculatedPosition]} ${className}`}
      style={tooltipStyle}
      role="tooltip"
      aria-live="polite"
      onMouseEnter={() => {
        tooltipHoverRef.current = true;
        if (hideDelayRef.current) {
          clearTimeout(hideDelayRef.current);
          hideDelayRef.current = null;
        }
      }}
      onMouseLeave={(event) => {
        const related = event.relatedTarget as Node | null;
        const leavingToTrigger = related ? triggerRef.current?.contains(related) : false;
        tooltipHoverRef.current = Boolean(leavingToTrigger);
        if (!leavingToTrigger) {
          hideTooltip();
        }
      }}
    >
      <div className={styles.tooltipContent}>
        {typeof content === 'string' ? (
          <span dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          content
        )}
      </div>
      <div className={styles.tooltipArrow} />
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className={`${styles.tooltipTrigger} ${showIcon ? styles.withIcon : ''}`}
        onMouseEnter={
          !isMobile && (trigger === 'hover' || trigger === 'both')
            ? () => {
                preloadTooltip();
                showTooltip();
              }
            : undefined
        }
        onMouseLeave={
          !isMobile && (trigger === 'hover' || trigger === 'both')
            ? (event) => {
                const related = event.relatedTarget as Node | null;
                const enteringTooltip = related ? tooltipRef.current?.contains(related) : false;
                if (!enteringTooltip) {
                  hideTooltip();
                }
              }
            : undefined
        }
        onFocus={
          !isMobile && (trigger === 'hover' || trigger === 'both')
            ? () => {
                triggerFocusedRef.current = true;
                preloadTooltip();
                showTooltip();
              }
            : undefined
        }
        onBlur={
          !isMobile && (trigger === 'hover' || trigger === 'both')
            ? () => {
                triggerFocusedRef.current = false;
                hideTooltip(true);
              }
            : undefined
        }
        onClick={handleClick}
        aria-describedby={isVisible ? 'tooltip' : undefined}
        tabIndex={0}
      >
        {showIcon ? (
          <div className={styles.tooltipWithIcon}>
            {children}
            <HelpCircle
              size={iconSize}
              className={`${styles.tooltipIcon} ${styles[variant]}`}
            />
          </div>
        ) : (
          children
        )}
      </div>
      {content && (isPreloaded || isVisible) && createPortal(tooltipElement, document.body)}
    </>
  );
};

export default Tooltip;
