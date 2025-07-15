import { memo } from 'react'
import styles from './styles/interface.module.css'

interface InfoModalProps {
  isOpen: boolean
  onClose: () => void
}

export default memo(function InfoModal({ isOpen, onClose }: InfoModalProps) {
  if (!isOpen) return null

  return (
    <div className={styles.infoModalOverlay} onClick={onClose}>
      <div className={styles.infoModalContent} onClick={(e) => e.stopPropagation()}>
        <button className={styles.infoModalClose} onClick={onClose}>
          &times;
        </button>
        <div className={styles.explanationText}>
          <h4 className={styles.explanationTitle}>Direct Token Conversion</h4>
          <p>
            The <span className={styles.tooltipIndigo}>JustInTime Compiler</span> enables direct conversion between <span className={styles.tooltipBlue}>HolyC</span> and <span className={styles.tooltipAmber}>JIT</span> tokens at a <span className={styles.tooltipGreen}>fixed 1:1 rate</span> minus the <span className={styles.tooltipRed}>4% fee</span>, bypassing market prices.<br/><br/>
            <strong>How it works:</strong><br/>
            • <span className={styles.tooltipBlue}>Compile</span>: Lock HolyC → Mint new JIT<br/>
            • <span className={styles.tooltipAmber}>Restore</span>: Burn JIT → Unlock HolyC<br/><br/>
            <strong>Fee Mechanism:</strong><br/>
            The <span className={styles.tooltipRed}>4% fee</span> is permanently sent to the <span className={styles.tooltipRed}>burn contract</span>, reducing total supply. This incentivizes trading through <span className={styles.tooltipPurple}>liquidity pools</span> first, allowing <span className={styles.tooltipAmber}>JIT</span> price to increase as supply decreases.<br/><br/>
            <strong>Arbitrage Strategy:</strong><br/>
            When profitable, traders can <span className={styles.tooltipGreen}>"rebalance"</span> the supply shock by compiling more <span className={styles.tooltipAmber}>JIT</span>, capturing the price difference between pools and the fixed compiler rate.
          </p>
        </div>
      </div>
    </div>
  )
})