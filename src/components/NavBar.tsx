
import { useAccount, useBalance } from 'wagmi'
import { formatEther } from 'viem'
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HOLY_C_ADDRESS, JIT_ADDRESS } from '../config/contracts'
import { WalletConnect } from './WalletConnect'
import { Tooltip } from './Tooltip'
import { GuideModal } from './GuideModal'
import { throttle } from '../lib/performanceOptimizer'

export function NavBar() {
  const { address, isConnected } = useAccount()
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const resizeTimeoutRef = useRef<number | null>(null)
  
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

  const handleCopyAddress = () => {
    navigator.clipboard.writeText("0x57909025ACE10D5dE114d96E3EC84F282895870c")
    setCopyFeedback(true)
    setTimeout(() => setCopyFeedback(false), 2000)
  }

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

  const fullAddress = "0x57909025ACE10D5dE114d96E3EC84F282895870c";
  const compactAddress = formatCompactAddress(fullAddress);


  return (
    <nav className="navbar">
      <motion.div 
        className="navbar-content" 
        layout={!isResizing}
        transition={{ duration: isResizing ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <motion.div
          className="title-container"
          layout={!isResizing}
          transition={{ duration: isResizing ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <Tooltip 
            content="Open up the official telegram group in a new tab" 
            variant="info"
            position="bottom"
            disabled={isMobile}
          >
            <a href="https://t.me/HolyCPulse" target="_blank" rel="noopener noreferrer" className="app-title-link">
              <h1 className="app-title">
                <span className="temple-os">TempleOS</span>
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
                  <span className="separator">:</span>
                  <span className="jit-compiler">JustInTimeCompiler</span>
                </motion.span>
              </h1>
            </a>
          </Tooltip>
          <Tooltip 
            content="The JustInTime Compiler contract this dApp is interating with, verified and opensource" 
            variant="info"
            position="bottom"
            disabled={isMobile}
          >
            <motion.div
              layout={!isResizing}
              transition={{ duration: isResizing ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="contract-address"
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
                  {isMobile ? compactAddress : fullAddress}
                </motion.span>
              </AnimatePresence>
            </motion.div>
          </Tooltip>
          {!isMobile && copyFeedback && <div className="copy-feedback">Copied!</div>}
        </motion.div>

        <div className="balance-section-wrapper">
          <motion.div
            className="balance-section"
            animate={{
              opacity: isConnected && !isMobile ? 1 : 0,
              scale: isConnected && !isMobile ? 1 : 0.95,
            }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className="balance-item">
              <Tooltip content="Your balance of HolyC, the foundational, tax-free reserve asset" variant="info">
                <div className="token-info">
                  <span className="balance-label">HolyC</span>
                  <span className="balance-value holyc-balance">
                    {holyCBalance ? formatBalance(formatEther(holyCBalance.value)) : '...'}
                  </span>
                </div>
              </Tooltip>
            </div>
            <div className="balance-divider" />
            <div className="balance-item">
              <Tooltip content="Your balance of JIT, the deflationary utility token with a 2% transfer burn" variant="burn">
                <div className="token-info">
                  <span className="balance-label">JIT</span>
                  <span className="balance-value jit-balance">
                    {jitBalance ? formatBalance(formatEther(jitBalance.value)) : '...'}
                  </span>
                </div>
              </Tooltip>
            </div>
          </motion.div>
        </div>

        <motion.div 
          className="navbar-right" 
          layout={!isResizing}
          transition={{ duration: isResizing ? 0 : 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          <Tooltip
            content="Open the complete guide to understand the TempleOS ecosystem, tokenomics, and arbitrage strategies"
            variant="info"
            disabled={isMobile}
          >
            <button
              className="guide-button"
              onClick={() => setIsGuideOpen(true)}
              aria-label="Open ecosystem guide"
            >
              <span className="guide-button-text">Guide</span>
            </button>
          </Tooltip>
          <WalletConnect />
        </motion.div>
      </motion.div>

      <GuideModal 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
      />

      <style>{`
        .navbar {
          background: linear-gradient(135deg,
            rgba(26, 26, 36, 0.98) 0%,
            rgba(20, 20, 30, 0.98) 100%);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 0 24px;
          position: sticky;
          top: 0;
          z-index: 100;
          animation: headerSlideIn 0.6s ease-out;
          height: 72px;
          display: flex;
          align-items: center;
        }

        .navbar-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1400px;
          margin: 0 auto;
          gap: 24px;
          position: relative;
          width: 100%;
        }
        

        .title-container {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 2px;
          align-items: flex-start; /* Default alignment */
        }
        
        


        .contract-address {
          font-family: 'SF Pro Rounded', 'Helvetica Neue', sans-serif;
          font-size: 12px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          padding-left: 10px;
          letter-spacing: 0.3px;
          white-space: nowrap;
          position: relative; /* For AnimatePresence positioning */
        }

        .contract-address:hover {
          color: rgba(255, 255, 255, 0.9);
          text-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
        }




        .copy-feedback {
          position: absolute;
          top: 100%;
          left: 10px;
          margin-top: 4px;
          background: #4caf50;
          color: white;
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
        }

        .app-title-link {
          text-decoration: none;
        }

        .app-title {
          display: flex;
          align-items: center;
          gap: 1px;
          font-size: 22px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.5px;
          padding: 0 10px;
          line-height: 1.2;
          white-space: nowrap;
        }



        .temple-os {
          background: linear-gradient(135deg, #f472b6 0%, #a855f7 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 20px rgba(244, 114, 182, 0.3);
          font-weight: 900;
        }

        .separator {
          background: linear-gradient(135deg, #60a5fa 0%, #f472b6 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 600;
          font-size: 22px;
          margin: 0;
        }

        .jit-compiler {
          background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 700;
        }


        .navbar-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .balance-section-wrapper {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .balance-section {
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 14px 24px;
          background: rgba(30, 30, 46, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          backdrop-filter: blur(10px);
          height: 48px;
          pointer-events: auto;
        }

        .balance-item {
          display: flex;
          align-items: center;
        }

        .token-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .balance-divider {
          width: 1px;
          height: 28px;
          background: rgba(255, 255, 255, 0.1);
        }

        .balance-label {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          opacity: 0.85;
        }

        .balance-value {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.1;
        }

        .holyc-balance {
          color: #60a5fa;
          text-shadow: 0 0 12px rgba(96, 165, 250, 0.5);
        }

        .balance-item:has(.holyc-balance) .balance-label {
          color: #60a5fa;
          opacity: 0.8;
        }

        .jit-balance {
          color: #f87171;
          text-shadow: 0 0 12px rgba(248, 113, 113, 0.5);
        }

        .balance-item:has(.jit-balance) .balance-label {
          color: #f87171;
          opacity: 0.8;
        }

        .guide-button {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 10px 28px;
          color: rgba(255, 255, 255, 0.9);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 16px;
          height: 44px;
          letter-spacing: 0.3px;
          backdrop-filter: blur(10px);
          min-width: 100px;
        }

        .guide-button:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: #ffffff;
          transform: translateY(-1px);
        }

        .guide-button:active {
          transform: translateY(0);
        }

        .guide-button-text {
          position: relative;
          z-index: 1;
        }

        .wallet-connect-wrapper button {
          white-space: nowrap;
        }

        @keyframes headerSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0px);
          }
        }

        /* Mobile layout switch - unified breakpoint */
        @media (max-width: 900px) {
          .navbar {
            padding: 0 12px;
            height: 64px;
          }
          .navbar-content {
            justify-content: space-between;
            position: relative;
            max-width: 100%;
            gap: 8px;
          }

          .title-container {
            flex-shrink: 1;
            min-width: 0;
          }

          .app-title {
            font-size: 18px;
          }

          .separator, .jit-compiler {
            display: none;
          }
          
          .contract-address {
            display: none; /* Hide contract address on mobile */
          }

          .balance-section-wrapper {
            display: none;
          }

          .navbar-right {
            gap: 8px;
          }

          .guide-button {
            padding: 8px 16px;
            font-size: 14px;
            height: 38px;
            min-width: auto;
          }
        }

        @media (max-width: 400px) {
          .guide-button-text {
            display: none;
          }
          .guide-button::before {
            content: '📖'; /* Use an emoji or icon font */
            font-size: 18px;
          }
          .guide-button {
            padding: 8px 12px;
          }
        }
        
      `}</style>
    </nav>
  )
}