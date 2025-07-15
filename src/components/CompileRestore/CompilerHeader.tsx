import { memo } from 'react'
import { ModeToggle } from './components/ModeToggle'
import { TokenFlowFinal } from './components/TokenFlowFinal'
import { CompilerState } from './types'
import styles from './styles/interface.module.css'

interface CompilerHeaderProps {
  state: CompilerState
  onModeChange: (isCompileMode: boolean) => void
  onTransitionStart: () => void
  uiState: { isInfoExpanded: boolean }
  setUiState: (update: { isInfoExpanded: boolean }) => void
  isMobile: boolean
}

export default memo(function CompilerHeader({
  state,
  onModeChange,
  onTransitionStart,
  uiState,
  setUiState,
  isMobile
}: CompilerHeaderProps) {
  const headerClass = `${styles.interfaceHeader} ${state.isCompileMode ? styles.compileMode : styles.restoreMode}`

  return (
    <div className={headerClass}>
      <div className={styles.headerContent}>
        <div className={styles.headerSection}>
          <ModeToggle
            isCompileMode={state.isCompileMode}
            onModeChange={onModeChange}
            onTransitionStart={onTransitionStart}
          />
        </div>

        <TokenFlowFinal isCompileMode={state.isCompileMode} onModeChange={onModeChange} />

        {/* Process Explanation - moved after TokenFlow */}
        <div className={styles.processExplanation}>
          <div className={`${styles.explanationText} ${state.isCompileMode ? styles.compileText : styles.restoreText}`}>
            {state.isCompileMode ? (
              <span>
                <strong>Compile</strong> your HolyC into JIT tokens
              </span>
            ) : (
              <span>
                <strong>Restore</strong> your JIT back into HolyC
              </span>
            )}
          </div>
          <div className={styles.explanationSubText}>
            {state.isCompileMode ? (
              <span>Locks your HolyC into the compiler and Mints you JIT</span>
            ) : (
              <span>Burns your JIT and unlocks your HolyC from the compiler</span>
            )}
          </div>
        </div>
      </div>
      
      {/* Info Dropdown in bottom right of header */}
      <div className={styles.headerInfoSection}>
        <div 
          className={`${styles.expandIcon} ${uiState.isInfoExpanded ? styles.expanded : ''}`}
          onClick={() => setUiState({ isInfoExpanded: !uiState.isInfoExpanded })}
          data-info-preload
        >
          ▼
        </div>
        {!isMobile && (
          <div className={`${styles.expandableContent} ${uiState.isInfoExpanded ? styles.expanded : ''}`}>
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
        )}
      </div>
    </div>
  )
})