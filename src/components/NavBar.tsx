
import { useAccount, useBalance } from 'wagmi'
import { formatEther } from 'viem'
import { useState, useEffect, useRef, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HOLY_C_ADDRESS, JIT_ADDRESS } from '../config/contracts'
import { WalletConnect } from './WalletConnect'
import { Tooltip } from './Tooltip'
import { GuideModal } from './GuideModal'
import { DivineManagerGuideModal } from './GuideModal/DivineManagerGuideModal'
import { throttle } from '../lib/performanceOptimizer'
import styles from './NavBar.module.css'
import { Link, useLocation } from 'react-router-dom'

export function NavBar() {
  const { address, isConnected } = useAccount()
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [isDivineGuideOpen, setIsDivineGuideOpen] = useState(false)
  const [isGuidesMenuOpen, setIsGuidesMenuOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const resizeTimeoutRef = useRef<number | null>(null)
  const guidesRef = useRef<HTMLDivElement | null>(null)
  const location = useLocation()
  
  const { data: holyCBalance, refetch: refetchHolyCBalance } = useBalance({
    address,
    token: HOLY_C_ADDRESS,
  })
  const { data: jitBalance, refetch: refetchJitBalance } = useBalance({
    address,
    token: JIT_ADDRESS,
  })

  useEffect(() => {
    const checkMobile = throttle(() => {
      setIsMobile(window.innerWidth <= 900) // Unified breakpoint
    }, 16) // ~1 frame for 60fps

    const handleResizeStart = () => {
      setIsResizing(true)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
        setIsResizing(false)
      }, 150) // Short delay after resize stops
    }

    const handleResize = () => {
      handleResizeStart()
      checkMobile()
    }

    // Initial check
    checkMobile()
    
    window.addEventListener('resize', handleResize, { passive: true })
    return () => {
      window.removeEventListener('resize', handleResize)
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handleBalancesUpdated = () => {
      refetchHolyCBalance()
      refetchJitBalance()
    }

    window.addEventListener('balances-updated', handleBalancesUpdated)

    return () => {
      window.removeEventListener('balances-updated', handleBalancesUpdated)
    }
  }, [refetchHolyCBalance, refetchJitBalance])

  useEffect(() => {
    const handleOpenDivineGuide = () => {
      setIsDivineGuideOpen(true)
    }

    window.addEventListener('open-divine-manager-guide', handleOpenDivineGuide)

    return () => {
      window.removeEventListener('open-divine-manager-guide', handleOpenDivineGuide)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!guidesRef.current) return
      if (!guidesRef.current.contains(event.target as Node)) {
        setIsGuidesMenuOpen(false)
      }
    }

    if (isGuidesMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      if (isGuidesMenuOpen) {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isGuidesMenuOpen, guidesRef])

  useEffect(() => {
    const handleOpenDivineGuide = () => {
      setIsDivineGuideOpen(true)
    }

    window.addEventListener('open-divine-manager-guide', handleOpenDivineGuide)

    return () => {
      window.removeEventListener('open-divine-manager-guide', handleOpenDivineGuide)
    }
  }, [])

  const formatBalance = (value: string | number) => {
    const num = Number(value)
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T'
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
    return num.toFixed(2)
  }

  const formatCompactAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`
  }

  const isOnLandingPage = location.pathname === '/' || location.pathname.startsWith('/dashboard')
  const navSubtitle = isOnLandingPage ? 'HolyC' : 'JustInTimeCompiler'
  const currentAddress = isOnLandingPage ? HOLY_C_ADDRESS : JIT_ADDRESS
  const compactAddress = formatCompactAddress(currentAddress);
  const tooltipContent = isOnLandingPage
    ? 'The HolyC contract address'
    : 'The JustInTime Compiler contract this dApp is interating with, verified and opensource'
  const navCta = isOnLandingPage
    ? { label: 'Launch dApp', to: '/compiler' }
    : { label: 'Overview', to: '/' }

  const handleCopyAddress = () => {
    const targetAddress = currentAddress
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(targetAddress)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = targetAddress
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    } catch (error) {
      console.error('Failed to copy contract address', error)
    }
  }


  return (
    <nav className={styles.navbar}>
      <motion.div 
        className={styles.navbarContent} 
        layout={!isResizing}
        transition={{ duration: isResizing ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.div
          className={styles.titleContainer}
          layout={!isResizing}
          transition={{ duration: isResizing ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <Tooltip 
            content="Open up the official telegram group in a new tab" 
            variant="info"
            position="bottom"
            disabled={isMobile}
          >
            <a href="https://t.me/HolyCPulse" target="_blank" rel="noopener noreferrer" className={styles.appTitleLink}>
              <h1 className={styles.appTitle}>
                <span className={styles.templeOs}>TempleOS</span>
                <motion.span
                  layout={!isResizing ? "position" : false}
                  initial="hidden"
                  animate={!isMobile ? "visible" : "hidden"}
                  variants={{
                    visible: { opacity: 1, scaleX: 1, width: 'auto' },
                    hidden: { opacity: 0, scaleX: 0, width: 0 }
                  }}
                  transition={{
                    type: 'tween',
                    ease: [0.4, 0, 0.2, 1],
                    duration: 0.4
                  }}
                  style={{ display: 'flex', alignItems: 'center', transformOrigin: 'left', overflow: 'hidden' }}
                >
                  <span className={styles.separator}>:</span>
                  <span className={styles.jitCompiler}>{navSubtitle}</span>
                </motion.span>
              </h1>
            </a>
          </Tooltip>
          <Tooltip 
            content={tooltipContent} 
            variant="info"
            position="bottom"
            disabled={isMobile}
          >
            <motion.div
              layout={!isResizing}
              transition={{ duration: isResizing ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] }}
              className={styles.contractAddress}
              onClick={handleCopyAddress}
            >
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={isMobile ? 'compact' : 'full'}
                  initial={{ opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  exit={{ opacity: 0, scaleX: 0 }}
                  transition={{
                    type: 'tween',
                    ease: [0.4, 0, 0.2, 1],
                    duration: 0.4
                  }}
                  style={{ display: 'inline-block', transformOrigin: 'left', willChange: 'transform, opacity' }}
                >
                  {isMobile ? compactAddress : currentAddress}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          </Tooltip>
          {!isMobile && copyFeedback && <div className={styles.copyFeedback}>Copied!</div>}
        </motion.div>

        <div className={styles.balanceSectionWrapper}>
          <motion.div
            className={styles.balanceSection}
            animate={{
              opacity: isConnected && !isMobile ? 1 : 0,
              scale: isConnected && !isMobile ? 1 : 0.95,
            }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className={styles.balanceItem}>
              <Tooltip content="Your balance of HolyC, the foundational, tax-free reserve asset" variant="info">
                <div className={styles.tokenInfo}>
                  <span className={styles.balanceLabel}>HolyC</span>
                  <span className={`${styles.balanceValue} ${styles.holycBalance}`}>
                    {holyCBalance ? formatBalance(formatEther(holyCBalance.value)) : '...'}
                  </span>
                </div>
              </Tooltip>
            </div>
            <div className={styles.balanceDivider} />
            <div className={styles.balanceItem}>
              <Tooltip content="Your balance of JIT, the deflationary utility token with a 2% transfer burn" variant="burn">
                <div className={styles.tokenInfo}>
                  <span className={styles.balanceLabel}>JIT</span>
                  <span className={`${styles.balanceValue} ${styles.jitBalance}`}>
                    {jitBalance ? formatBalance(formatEther(jitBalance.value)) : '...'}
                  </span>
                </div>
              </Tooltip>
            </div>
          </motion.div>
        </div>

        <motion.div 
          className={styles.navbarRight} 
          layout={!isResizing}
          transition={{ duration: isResizing ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <Link
            to={navCta.to}
            className={`${styles.navRouteButton} ${isOnLandingPage ? styles.navRouteButtonPrimary : ''}`}
          >
            {navCta.label}
          </Link>
          <div ref={guidesRef} className={styles.guidesWrapper}>
            <button
              type="button"
              className={`${styles.guideButton} ${styles.guidesToggle}`}
              onClick={() => setIsGuidesMenuOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={isGuidesMenuOpen}
            >
              <span className={styles.guideButtonText}>Guides</span>
            </button>
            <AnimatePresence>
              {isGuidesMenuOpen && (
                <motion.div
                  className={styles.guidesMenu}
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.16, ease: [0.2, 0, 0.2, 1] }}
                >
                  <button
                    type="button"
                    className={`${styles.guidesItem} ${styles.guidesItemPrimary}`}
                    onClick={() => {
                      setIsGuidesMenuOpen(false)
                      setIsGuideOpen(true)
                    }}
                  >
                    The Compiler
                  </button>
                  <button
                    type="button"
                    className={`${styles.guidesItem} ${styles.guidesItemSecondary}`}
                    onClick={() => {
                      setIsGuidesMenuOpen(false)
                      setIsDivineGuideOpen(true)
                    }}
                  >
                    Divine Manager
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <WalletConnect />
        </motion.div>
      </motion.div>

      <GuideModal 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
      />
      <DivineManagerGuideModal
        isOpen={isDivineGuideOpen}
        onClose={() => setIsDivineGuideOpen(false)}
      />

    </nav>
  )
}

export default memo(NavBar)
