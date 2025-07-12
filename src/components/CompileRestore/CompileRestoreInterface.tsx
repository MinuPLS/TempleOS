import { useState, useEffect, useMemo, useReducer, useCallback, memo, useRef } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { formatEther, parseEther } from 'viem'
import { JIT_ADDRESS, HOLY_C_ADDRESS, JIT_ABI, HOLYC_ABI } from '../../config/contracts'

// Hooks
import { useTokenBalances } from './hooks/useTokenBalances'
import { useOptimizedContracts } from './hooks/useOptimizedContracts'
import { useCalculations } from './hooks/useCalculations'
import { useDebounce } from './hooks/useDebounce'
import { usePoolData } from '../UniswapPools/hooks/usePoolData'
// import { useOptimizedInput } from './hooks/useOptimizedInput' // Removed - using inline optimization

// Components
import { ModeToggle } from './components/ModeToggle'
import { TokenFlowFinal } from './components/TokenFlowFinal'
import Tooltip from '../Tooltip/Tooltip'

// Utils
import { formatBalance, formatDisplayAmount, formatFeeAmount, handleNumberInput, isValidAmount, formatFullAmount } from './utils/formatting'
import { formatCurrency } from '../../lib/utils'
import { ANIMATION_DURATION } from './utils/constants'

// Types
import { CompilerState } from './types'


// Styles
import styles from './styles/interface.module.css'
import inputStyles from './styles/integratedInput.module.css'

const initialState: CompilerState = {
  isCompileMode: true,
  amount: '',
  needsApproval: false,
  showBurnAnimation: false,
  showModeTransition: false,
}

function compilerReducer(state: CompilerState, action: Partial<CompilerState>): CompilerState {
  return { ...state, ...action }
}

export const CompileRestoreInterface = memo(function CompileRestoreInterface() {
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  
  // State
  const [state, dispatch] = useReducer(compilerReducer, initialState)
  const [exceedsBalance, setExceedsBalance] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [expandedTransactionRow, setExpandedTransactionRow] = useState<string | null>(null)
  const [copyFeedback] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null)
  const [percentageDropdownOpen, setPercentageDropdownOpen] = useState(false)
  const [isInfoExpanded, setIsInfoExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Custom hooks with optimized contract fetching
  const { holyCBalance, jitBalance, refetchBalances } = useTokenBalances(address)
  const { allowance, compileRestoreFee, transferFee, isUserFeeExempt, refetchAllowance } = useOptimizedContracts(address)
  const { tokenPrices } = usePoolData()
  const debouncedAmount = useDebounce(state.amount, 500) // Increased debounce for better performance

  const calculations = useCalculations({
    amount: debouncedAmount,
    compileRestoreFee,
    isUserFeeExempt,
    isCompileMode: state.isCompileMode,
  })

  // Transaction tracking
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | undefined>()
  const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })
  const { isLoading: isApprovalTxPending, isSuccess: isApprovalTxSuccess } = useWaitForTransactionReceipt({ hash: approvalTxHash })

  // Check approval needs
  useEffect(() => {
    const needsApproval =
      state.isCompileMode &&
      !!state.amount &&
      allowance !== undefined &&
      allowance < parseEther(state.amount)
    dispatch({ needsApproval })
  }, [state.amount, allowance, state.isCompileMode])

  // Refetch allowance after approval
  useEffect(() => {
    if (isApprovalTxSuccess) {
      refetchAllowance()
      setApprovalTxHash(undefined)
    }
  }, [isApprovalTxSuccess, refetchAllowance])

  // Clear form on success
  useEffect(() => {
    if (isTxSuccess) {
      dispatch({ amount: '' })
      setTxHash(undefined)
      refetchBalances()
      window.dispatchEvent(new Event('balances-updated'))
    }
  }, [isTxSuccess, refetchBalances])

  // Derived values - memoized for performance
  const sourceToken = useMemo(() => state.isCompileMode ? 'HolyC' : 'JIT', [state.isCompileMode])
  const targetToken = useMemo(() => state.isCompileMode ? 'JIT' : 'HolyC', [state.isCompileMode])
  const currentBalance = useMemo(() => state.isCompileMode ? holyCBalance : jitBalance, [state.isCompileMode, holyCBalance, jitBalance])
  const hasAmount = useMemo(() => isValidAmount(debouncedAmount), [debouncedAmount])
  const shouldShowDetails = useMemo(() => hasAmount || inputFocused || expandedTransactionRow || userInteracted, [hasAmount, inputFocused, expandedTransactionRow, userInteracted])
  
  // Optimized display values with better formatting
  const displayValues = useMemo(() => {
    if (!debouncedAmount || !isValidAmount(debouncedAmount)) {
      return {
        sendingAmount: '0',
        receivingAmount: '0',
        feePercent: '0',
        dollarValue: '$0.00'
      }
    }
    
    const receivedAmount = calculations.received || '0'
    const targetPrice = state.isCompileMode ? tokenPrices.jitUSD : tokenPrices.holycUSD
    const dollarValue = targetPrice && parseFloat(receivedAmount) ? parseFloat(receivedAmount) * targetPrice : 0
    
    return {
      sendingAmount: formatDisplayAmount(debouncedAmount),
      receivingAmount: formatDisplayAmount(receivedAmount),
      feePercent: formatFeeAmount(calculations.feePercent || '0'),
      dollarValue: dollarValue > 0 ? formatCurrency(dollarValue) : '$0.00'
    }
  }, [debouncedAmount, calculations.received, calculations.feePercent, tokenPrices.jitUSD, tokenPrices.holycUSD, state.isCompileMode])

  // Optimized balance checking with memoization
  const balanceExceeded = useMemo(() => {
    if (!currentBalance || !isValidAmount(debouncedAmount)) {
      return false
    }
    try {
      const amountWei = parseEther(debouncedAmount)
      return amountWei > currentBalance.value
    } catch {
      return false
    }
  }, [debouncedAmount, currentBalance])
  
  useEffect(() => {
    setExceedsBalance(balanceExceeded)
  }, [balanceExceeded])

  // Pre-computed transaction breakdown to avoid repeated useMemo calls in render
  const transactionBreakdown = useMemo(() => {
    if (!state.isCompileMode) {
      return {
        amount: `${formatBalance(calculations.burnAmount || '0')} + ${formatBalance(calculations.holycBurnFee || '0')} fee`,
        explanation: (
          <>
            <span className={inputStyles.tooltipRed}>Burned JIT</span>: {formatBalance(calculations.burnAmount || '0')} <span className={inputStyles.tooltipAmber}>JIT</span> tokens permanently destroyed. <br/>
            <span className={inputStyles.tooltipRed}>Burn Fee</span>: {formatBalance(calculations.holycBurnFee || '0')} <span className={inputStyles.tooltipBlue}>HolyC</span> sent to burn address as restoration fee. <br/>
          </>
        )
      }
    }
    return {
      amount: `${formatBalance(calculations.burnAmount || '0')} + ${formatBalance(calculations.lockedAmount || '0')}`,
      explanation: (
        <>
          <span className={inputStyles.tooltipRed}>Burn Fee</span>: {formatBalance(calculations.burnAmount || '0')} <span className={inputStyles.tooltipBlue}>HolyC</span> sent to burn address as fee. <br/>
          <span className={inputStyles.tooltipAmber}>Lock in Contract</span>: {formatBalance(calculations.lockedAmount || '0')} <span className={inputStyles.tooltipBlue}>HolyC</span> locked in compiler to back your <span className={inputStyles.tooltipAmber}>JIT</span> tokens. <br/>
        </>
      )
    }
  }, [state.isCompileMode, calculations.burnAmount, calculations.lockedAmount, calculations.holycBurnFee])

  // Handlers
  const handleModeChange = useCallback((isCompile: boolean) => {
    dispatch({ isCompileMode: isCompile })
  }, [])

  const handleTransitionStart = useCallback(() => {
    dispatch({ showModeTransition: true })
    setTimeout(() => {
      dispatch({ showModeTransition: false })
    }, ANIMATION_DURATION.MODE_TRANSITION)
  }, [])

  // Input handler for amount. The resulting calculations are debounced.
  const optimizedInputHandler = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanValue = handleNumberInput(e.target.value)
    dispatch({ amount: cleanValue })
    setSelectedPercentage(null) // Clear percentage selection when typing manually
    setPercentageDropdownOpen(false) // Close dropdown when typing
  }, [])

  const handlePercentageSelect = useCallback((percentage: number) => {
    if (!currentBalance) return
    
    const balanceInEther = formatEther(currentBalance.value)
    const percentageAmount = (parseFloat(balanceInEther) * percentage / 100).toString()
    
    dispatch({ amount: percentageAmount })
    setSelectedPercentage(percentage)
    setPercentageDropdownOpen(false)
  }, [currentBalance])

  const togglePercentageDropdown = useCallback(() => {
    setPercentageDropdownOpen(prev => !prev)
  }, [])

  const handleInputFocus = useCallback(() => {
    setInputFocused(true)
    setUserInteracted(true)
  }, [])

  const handleInputBlur = useCallback(() => {
    // Don't blur automatically - let outside click handle it
    // setInputFocused(false)
  }, [])

  const handleApprove = useCallback(async () => {
    if (!state.amount) return
    try {
      const hash = await writeContractAsync({
        abi: HOLYC_ABI,
        address: HOLY_C_ADDRESS,
        functionName: 'approve',
        args: [JIT_ADDRESS, parseEther(state.amount)],
      })
      setApprovalTxHash(hash)
    } catch {
      // Handle approval error silently
    }
  }, [state.amount, writeContractAsync])

  const handleConvert = useCallback(async () => {
    if (!state.amount) return

    dispatch({ showBurnAnimation: true })
    setTimeout(() => dispatch({ showBurnAnimation: false }), 3000)

    try {
      const hash = await writeContractAsync({
        abi: JIT_ABI,
        address: JIT_ADDRESS,
        functionName: state.isCompileMode ? 'compile' : 'restore',
        args: [parseEther(state.amount)],
      })
      setTxHash(hash)
    } catch {
      // Handle conversion error silently
      dispatch({ showBurnAnimation: false })
    }
  }, [state.amount, state.isCompileMode, writeContractAsync])

  const toggleTransactionRow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Mark as user interaction to keep UI open
    setUserInteracted(true)
    
    setExpandedTransactionRow(prev => prev === 'transaction-breakdown' ? null : 'transaction-breakdown')
  }, [])




  // Handle outside clicks to close the UI
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Use setTimeout to prevent interference with click events
        setTimeout(() => {
          setInputFocused(false)
          setExpandedTransactionRow(null)
          setUserInteracted(false)
          setPercentageDropdownOpen(false)
        }, 100)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const headerClass = `${styles.interfaceHeader} ${state.isCompileMode ? styles.compileMode : styles.restoreMode}`

  const contractFeeTooltipContent = (
    <>
      This is the fee for <span className={styles.tooltipBlue}>Compile</span> or <span className={styles.tooltipAmber}>Restore</span>. It gives you less <span className={styles.tooltipBlue}>HolyC</span> upon Restoring, or less <span className={styles.tooltipAmber}>JIT</span> for Compiling. The fee is taxed by sending <span className={styles.tooltipBlue}>HolyC</span> to the <span className={styles.tooltipRed}>burn address</span>.
    </>
  );

  const transferFeeTooltipContent = (
    <>
      This is the transfer fee for <span className={styles.tooltipAmber}>JIT</span>, taxed when sending it across wallets. This naturally decreases <span className={styles.tooltipAmber}>JIT</span> supply & therefore naturally increases <span className={styles.tooltipGreen}>positive price pressure</span>.
    </>
  );

  return (
    <div className={styles.compilerInterface} ref={containerRef}>
      {/* Compact Header with Mode Toggle and Token Flow */}
      <div className={headerClass}>
        <div className={styles.headerContent}>
          <div className={styles.headerSection}>
            <ModeToggle
              isCompileMode={state.isCompileMode}
              onModeChange={handleModeChange}
              onTransitionStart={handleTransitionStart}
            />
          </div>

          <TokenFlowFinal isCompileMode={state.isCompileMode} onModeChange={handleModeChange} />

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
            className={`${styles.expandIcon} ${isInfoExpanded ? styles.expanded : ''}`}
            onClick={() => setIsInfoExpanded(!isInfoExpanded)}
          >
            ▼
          </div>
          <div className={`${styles.expandableContent} ${isInfoExpanded ? styles.expanded : ''}`}>
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
      </div>

      {/* Integrated Input and Details Section */}
      <div className={inputStyles.integratedInputContainer}>
        <div className={`${inputStyles.inputWrapper} ${!state.amount ? inputStyles.empty : ''}`}>
          {/* Fee Controls - positioned in corners */}
          <div className={inputStyles.feeControls}>
            <div className={inputStyles.feeControlsLeft}>
              <Tooltip
                content={contractFeeTooltipContent}
                variant="info"
                position="top"
              >
                <div className={inputStyles.feeIndicator} data-fee-type="contract">
                  Contract <span className={inputStyles.feeValue}>
                    {compileRestoreFee ? (Number(compileRestoreFee) / 1000).toFixed(1) : '0'}%
                  </span>
                </div>
              </Tooltip>
              <Tooltip
                content={transferFeeTooltipContent}
                variant="info"
                position="top"
              >
                <div className={inputStyles.feeIndicator} data-fee-type="transfer">
                  Transfer <span className={inputStyles.feeValue}>
                    {transferFee ? (Number(transferFee) / 1000).toFixed(1) : '0'}%
                  </span>
                </div>
              </Tooltip>
            </div>
            <div className={inputStyles.feeControlsRight}>
              {isUserFeeExempt && (
                <div className={inputStyles.feeExemptBadge}>
                  <div className={inputStyles.feeExemptIcon}>✓</div>
                  <span className={inputStyles.feeExemptText}>Fee Exempt</span>
                </div>
              )}
            </div>
          </div>
          
          <div className={inputStyles.inputContainer}>
            <div className={inputStyles.inputAndPresets}>
              <input
                className={inputStyles.amountInput}
                type="text"
                inputMode="decimal"
                placeholder={`Enter ${sourceToken} amount`}
                value={state.amount}
                onChange={optimizedInputHandler}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
              />
              {currentBalance && (
                <div className={inputStyles.percentageDropdownContainer}>
                  <button
                    className={`${inputStyles.percentageTrigger} ${percentageDropdownOpen ? inputStyles.active : ''}`}
                    onClick={togglePercentageDropdown}
                    type="button"
                  >
                    ▼
                  </button>
                  <div className={`${inputStyles.percentageDropdown} ${percentageDropdownOpen ? inputStyles.open : ''}`}>
                    {[25, 50, 75, 100].map((percentage) => (
                      <button
                        key={percentage}
                        className={`${inputStyles.percentageButton} ${selectedPercentage === percentage ? inputStyles.selected : ''}`}
                        onClick={() => handlePercentageSelect(percentage)}
                        type="button"
                      >
                        {percentage}%
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className={inputStyles.balanceContainer}>
            <div className={inputStyles.balanceDisplay}>
              Balance: {currentBalance ? formatBalance(formatEther(currentBalance.value)) : '0'} {sourceToken}
            </div>
          </div>
          {shouldShowDetails && (
            <div className={inputStyles.inputSummary}>
              <div className={inputStyles.summaryFlow}>
                <span className={inputStyles.summaryText}>
                  Sending <span className={inputStyles.summaryAmount}>{formatBalance(displayValues.sendingAmount)}</span> {sourceToken}
                </span>
                <span className={inputStyles.summaryArrow}>→</span>
                <span className={inputStyles.summaryReceive}>
                  Receive <span className={inputStyles.summaryAmount}>{formatBalance(displayValues.receivingAmount)}</span> {targetToken}
                </span>
              </div>
              {/* Dropdown button integrated into the purple line */}
              <div className={inputStyles.dropdownTrigger} onClick={toggleTransactionRow}>
                <div className={inputStyles.purpleLine}></div>
                <div className={`${inputStyles.dropdownIcon} ${expandedTransactionRow === 'transaction-breakdown' ? inputStyles.expanded : ''}`}>
                  ▼
                </div>
                <div className={inputStyles.purpleLine}></div>
              </div>
            </div>
          )}

          {/* Transaction Details - Simplified dropdown content */}
          <div className={`${inputStyles.transactionDetails} ${shouldShowDetails ? inputStyles.show : inputStyles.hide}`}>
            <div className={inputStyles.detailsContent}>
              {/* Expandable Transaction Details */}
              <div className={`${inputStyles.expandableContent} ${expandedTransactionRow === 'transaction-breakdown' ? inputStyles.expanded : ''}`}>
                <div className={inputStyles.explanationText}>
                  {transactionBreakdown.explanation}
                </div>
              </div>

              {/* You Will Receive Section - Compact Redesign */}
              <div className={inputStyles.receiveSection}>
                <h3 className={inputStyles.receiveTitle}>You Will Receive</h3>
                
                <div className={inputStyles.centeredContent}>
                  {/* Amount and Dollar Value */}
                  <div className={inputStyles.amountDisplay}>
                    <div className={inputStyles.amountCenter}>
                      {formatFullAmount(calculations.received || '0')}
                    </div>
                    <div className={inputStyles.dollarCenter}>
                      {displayValues.dollarValue}
                    </div>
                  </div>
                  
                  {/* Token Name */}
                  <div className={inputStyles.tokenNameCenter}>
                    <span className={inputStyles.tokenName} data-token={targetToken}>
                      {targetToken}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className={inputStyles.actionButtons}>
        {exceedsBalance ? (
          <button className={`${inputStyles.actionButton}`} disabled>
            Insufficient Balance
          </button>
        ) : state.isCompileMode && state.needsApproval ? (
          <button
            className={`${inputStyles.actionButton} ${inputStyles.approveButton}`}
            onClick={handleApprove}
            disabled={isTxPending || isApprovalTxPending || !hasAmount || exceedsBalance}
          >
            {isApprovalTxPending ? '⟳ Approving...' : 'Approve HolyC'}
          </button>
        ) : (
          <button
            className={`${inputStyles.actionButton} ${
              state.isCompileMode ? inputStyles.compileButton : inputStyles.restoreButton
            }`}
            onClick={handleConvert}
            disabled={isTxPending || isApprovalTxPending || !hasAmount || exceedsBalance}
          >
            {isTxPending
              ? `⟳ ${state.isCompileMode ? 'Compiling' : 'Restoring'}...`
              : `${state.isCompileMode ? 'Compile' : 'Restore'}`}
          </button>
        )}
      </div>
      
      {copyFeedback && (
        <div className={inputStyles.copyNotification}>
          ✓ Contract Copied!
        </div>
      )}
    </div>
  )
})