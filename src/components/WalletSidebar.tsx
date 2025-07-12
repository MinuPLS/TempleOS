import { useAccount } from 'wagmi'
import { useBalance } from 'wagmi'
import { formatEther } from 'viem'
import { HOLY_C_ADDRESS, JIT_ADDRESS } from '../config/contracts'
import HolyCLogo from '../assets/TokenLogos/HolyC.png'
import JITLogo from '../assets/TokenLogos/JIT.png'
import { Tooltip } from './Tooltip'

export function WalletSidebar() {
  const { address } = useAccount()
  const { data: holyCBalance } = useBalance({
    address,
    token: HOLY_C_ADDRESS,
  })
  const { data: jitBalance } = useBalance({
    address,
    token: JIT_ADDRESS,
  })

  const formatBalance = (value: string | number) => {
    const num = Number(value)
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T'
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
    return num.toFixed(2)
  }

  return (
    <div className="wallet-sidebar">
      <div className="sidebar-header">
        <Tooltip 
          content="A detailed view of your connected wallet's token balances"
          variant="info"
        >
          <h3>💼 Wallet</h3>
        </Tooltip>
      </div>
      
      <div className="balance-items">
        <div className="balance-item holyc-item">
          <div className="token-info">
            <img src={HolyCLogo} alt="HolyC" className="token-icon" />
            <div className="token-details">
              <Tooltip 
                content="HolyC is the system's foundational, tax-free reserve asset"
                variant="info"
              >
                <span className="token-name">HolyC</span>
              </Tooltip>
              <span className="token-balance">
                {holyCBalance ? formatBalance(formatEther(holyCBalance.value)) : '0'}
              </span>
            </div>
          </div>
        </div>

        <div className="balance-item jit-item">
          <div className="token-info">
            <img src={JITLogo} alt="JIT" className="token-icon" />
            <div className="token-details">
              <Tooltip 
                content="JIT is the 'compiled' utility token with a 2% burn on transfers"
                variant="burn"
              >
                <span className="token-name">JIT</span>
              </Tooltip>
              <span className="token-balance">
                {jitBalance ? formatBalance(formatEther(jitBalance.value)) : '0'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .wallet-sidebar {
          width: 280px;
          height: 100vh;
          background: linear-gradient(180deg, 
            rgba(26, 26, 36, 0.95) 0%, 
            rgba(20, 20, 30, 0.95) 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: fixed;
          left: 0;
          top: 0;
          z-index: 50;
          overflow-y: auto;
        }

        .sidebar-header {
          padding-top: 80px; /* Account for main header height */
        }

        .sidebar-header h3 {
          font-size: 18px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.9);
          margin: 0;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .balance-items {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .balance-item {
          background: rgba(30, 30, 46, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 16px;
          transition: all 0.3s ease;
          cursor: pointer;
        }

        .balance-item:hover {
          background: rgba(37, 37, 56, 0.7);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .holyc-item:hover {
          box-shadow: 0 4px 20px rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.3);
        }

        .jit-item:hover {
          box-shadow: 0 4px 20px rgba(220, 38, 38, 0.2);
          border-color: rgba(220, 38, 38, 0.3);
        }

        .token-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .token-icon {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .token-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }

        .token-name {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.9);
        }

        .holyc-item .token-name {
          color: #60a5fa;
        }

        .jit-item .token-name {
          color: #f87171;
        }

        .token-balance {
          font-size: 16px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.8);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .wallet-sidebar {
            width: 100%;
            height: auto;
            position: relative;
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            flex-direction: row;
            align-items: center;
            padding: 16px 24px;
          }

          .sidebar-header {
            padding-top: 0;
            flex-shrink: 0;
          }

          .sidebar-header h3 {
            font-size: 16px;
            padding-bottom: 0;
            border-bottom: none;
          }

          .balance-items {
            flex-direction: row;
            gap: 12px;
            flex: 1;
          }

          .balance-item {
            flex: 1;
            padding: 12px;
          }

          .token-icon {
            width: 24px;
            height: 24px;
          }

          .token-name {
            font-size: 12px;
          }

          .token-balance {
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  )
}