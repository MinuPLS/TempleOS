
import { useAccount, useBalance } from 'wagmi'
import { formatEther } from 'viem'
import { useState, useEffect } from 'react'
import { HelpCircle } from 'lucide-react'
import { HOLY_C_ADDRESS, JIT_ADDRESS } from '../config/contracts'
import { WalletConnect } from './WalletConnect'
import { Tooltip } from './Tooltip'
import { GuideModal } from './GuideModal'

export function NavBar() {
  const { address, isConnected } = useAccount()
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState(false)
  const { data: holyCBalance, refetch: refetchHolyCBalance } = useBalance({
    address,
    token: HOLY_C_ADDRESS,
  })
  const { data: jitBalance, refetch: refetchJitBalance } = useBalance({
    address,
    token: JIT_ADDRESS,
  })

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

  return (
    <nav className="navbar">
      <div className="navbar-content">
        <div className="title-container">
          <a href="https://t.me/HolyCPulse" target="_blank" rel="noopener noreferrer" className="app-title-link">
            <h1 className="app-title">
              <span className="temple-os">TempleOS</span>
              <span className="separator">:</span>
              <span className="jit-compiler">JustInTimeCompiler</span>
            </h1>
          </a>
          <div className="contract-address" onClick={handleCopyAddress}>
            0x57909025ACE10D5dE114d96E3EC84F282895870c
          </div>
          {copyFeedback && <div className="copy-feedback">Copied!</div>}
        </div>
        
        <div className="navbar-right">
          <Tooltip
            content="Open the complete guide to understand the TempleOS ecosystem, tokenomics, and arbitrage strategies"
            variant="info"
          >
            <button
              className="guide-button"
              onClick={() => setIsGuideOpen(true)}
              aria-label="Open ecosystem guide"
            >
              Introduction
              <HelpCircle size={22} />
            </button>
          </Tooltip>
          <div className="balance-section">
            {isConnected ? (
              <>
                <div className="balance-item-vertical">
                  <Tooltip
                    content="Your balance of HolyC, the foundational, tax-free reserve asset"
                    variant="info"
                  >
                    <span className="balance-label">HolyC</span>
                  </Tooltip>
                  <span className="balance-value holyc-balance">
                    {holyCBalance ? formatBalance(formatEther(holyCBalance.value)) : '...'}
                  </span>
                </div>
                <div className="balance-item-vertical">
                  <Tooltip
                    content="Your balance of JIT, the deflationary utility token with a 2% transfer burn"
                    variant="burn"
                  >
                    <span className="balance-label">JIT</span>
                  </Tooltip>
                  <span className="balance-value jit-balance">
                    {jitBalance ? formatBalance(formatEther(jitBalance.value)) : '...'}
                  </span>
                </div>
              </>
            ) : (
              <div className="balance-item-vertical">
                <span className="balance-label">Connect Wallet</span>
              </div>
            )}
          </div>
          <WalletConnect />
        </div>
      </div>

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
          padding: 16px 24px;
          position: sticky;
          top: 0;
          z-index: 100;
          animation: headerSlideIn 0.6s ease-out;
        }

        .navbar-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1400px;
          margin: 0 auto;
        }

        .title-container {
          position: relative;
        }

        .contract-address {
          font-family: 'SF Pro Rounded', 'Helvetica Neue', sans-serif;
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          background: rgba(0, 0, 0, 0.2);
          padding: 8px 12px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-top: 8px;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          text-shadow: 0 0 15px rgba(255, 255, 255, 0.6);
        }

        .contract-address:hover {
          background: rgba(139, 92, 246, 0.2);
          color: #c4b5fd;
        }

        .copy-feedback {
          position: absolute;
          bottom: -28px;
          left: 50%;
          transform: translateX(-50%);
          background: #4caf50;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
        }

        .app-title-link {
          text-decoration: none;
        }

        .app-title {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 24px;
          font-weight: 800;
          margin: 0;
          letter-spacing: -0.5px;
          padding: 0 10px;
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
          font-size: 26px;
          margin: 0 1px;
        }

        .jit-compiler {
          background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%);
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 20px rgba(96, 165, 250, 0.3);
          font-weight: 700;
        }


        .navbar-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .balance-section {
          display: flex;
          align-items: center;
          gap: 20px;
          padding: 6px 16px;
          background: rgba(30, 30, 46, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          backdrop-filter: blur(10px);
          min-height: 52px;
          min-width: 200px;
        }

        .balance-item-vertical {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          min-width: 70px;
        }

        .balance-label {
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.8;
        }

        .balance-value {
          font-size: 13px;
          font-weight: 700;
          text-align: center;
          line-height: 1;
        }

        .holyc-balance {
          color: #60a5fa;
          text-shadow: 0 0 10px rgba(96, 165, 250, 0.4);
        }

        .balance-label:has(+ .holyc-balance) {
          color: #60a5fa;
          text-shadow: 0 0 6px rgba(96, 165, 250, 0.3);
        }

        .jit-balance {
          color: #f87171;
          text-shadow: 0 0 10px rgba(248, 113, 113, 0.4);
        }

        .balance-label:has(+ .jit-balance) {
          color: #f87171;
          text-shadow: 0 0 6px rgba(248, 113, 113, 0.3);
        }

        .guide-button {
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 12px;
          padding: 8px 16px;
          color: #a78bfa;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
          gap: 8px;
          font-weight: 600;
          height: 52px;
        }

        .guide-button:hover {
          background: rgba(139, 92, 246, 0.2);
          border-color: rgba(139, 92, 246, 0.5);
          color: #c4b5fd;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2);
        }

        .guide-button:active {
          transform: translateY(0);
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

        /* Mobile responsive */
        @media (max-width: 768px) {
          .navbar {
            padding: 12px 16px;
          }

          .app-title {
            font-size: 18px;
            gap: 2px;
          }

          .separator {
            font-size: 20px;
          }

          .temple-os, .jit-compiler {
            text-shadow: 0 0 15px rgba(244, 114, 182, 0.2);
          }

          .navbar-right {
            gap: 12px;
          }

          .balance-section {
            padding: 4px 12px;
            gap: 16px;
            height: 48px;
          }

          .balance-item-vertical {
            min-width: 60px;
          }

          .balance-label {
            font-size: 9px;
          }

          .balance-value {
            font-size: 12px;
          }
        }

        @media (max-width: 480px) {
          .navbar-content {
            flex-wrap: wrap;
            gap: 12px;
          }

          .app-title {
            font-size: 16px;
            flex: 1;
            gap: 2px;
            flex-wrap: wrap;
          }

          .separator {
            font-size: 18px;
            margin: 0 1px;
          }

          .navbar-right {
            flex: 1;
            justify-content: flex-end;
          }
        }
      `}</style>
    </nav>
  )
}