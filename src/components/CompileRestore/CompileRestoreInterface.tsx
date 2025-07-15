import { useState, useEffect, useMemo, useReducer, useCallback, memo, useRef } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'
import { JIT_ADDRESS, HOLY_C_ADDRESS, JIT_ABI, HOLYC_ABI } from '../../config/contracts'

// Hooks
import { useTokenBalances } from './hooks/useTokenBalances'
import { useOptimizedContracts } from './hooks/useOptimizedContracts'
import { useCalculations } from './hooks/useCalculations'
import { useDebounce } from './hooks/useDebounce'
import { usePoolData } from '../UniswapPools/hooks/usePoolData'

// Components
import { TokenInputForm } from './components/TokenInputForm'
import { ActionButtons } from './components/ActionButtons'
import CompilerHeader from './CompilerHeader'
import InfoModal from './InfoModal'
import Tooltip from '../Tooltip/Tooltip'

// Utils
import { formatDisplayAmount, formatFeeAmount, isValidAmount } from './utils/formatting'
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
  showBurnAnimation: false,
  showModeTransition: false,
}

interface UiState {
  inputFocused: boolean;
  expandedTransactionRow: number | null;
  userInteracted: boolean;
  selectedPercentage: number | null;
  percentageDropdownOpen: boolean;
  isInfoExpanded: boolean;
  exceedsBalance: boolean;
}

function compilerReducer(state: CompilerState, action: Partial<CompilerState>): CompilerState {
  return { ...state, ...action }
}

export const CompileRestoreInterface = memo(function CompileRestoreInterface() {
  const { address, isConnected } = useAccount()
  const { writeContractAsync } = useWriteContract()
  
  // Consolidated UI State
  const [uiState, setUiState] = useReducer((state: UiState, updates: Partial<UiState>) => ({ ...state, ...updates }), {
    inputFocused: false,
    expandedTransactionRow: null,
    userInteracted: false,
    selectedPercentage: null,
    percentageDropdownOpen: false,
    isInfoExpanded: false,
    exceedsBalance: false
  })

  // Main compiler state (existing)
  const [state, dispatch] = useReducer(compilerReducer, initialState)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 600)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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
  const shouldShowDetails = useMemo(() => hasAmount || uiState.inputFocused || uiState.expandedTransactionRow || uiState.userInteracted, [hasAmount, uiState.inputFocused, uiState.expandedTransactionRow, uiState.userInteracted])
  
  // Check approval needs - derived value
  const needsApproval = useMemo(() => {
    return (
      state.isCompileMode &&
      !!state.amount &&
      allowance !== undefined &&
      allowance < parseEther(state.amount)
    );
  }, [state.amount, allowance, state.isCompileMode]);

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
    setUiState({ exceedsBalance: balanceExceeded })
  }, [balanceExceeded])

  // Pre-computed transaction breakdown to avoid repeated useMemo calls in render

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

  // Amount change handler for TokenInputForm
  const handleAmountChange = useCallback((newAmount: string) => {
    dispatch({ amount: newAmount })
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





  // Handle outside clicks to close the UI
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Use setTimeout to prevent interference with click events
        setTimeout(() => {
          setUiState({
            inputFocused: false,
            expandedTransactionRow: null,
            userInteracted: false,
            percentageDropdownOpen: false
          })
        }, 100)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])


  const contractFeeTooltipContent = useMemo(() => (
    <>
      This is the fee for <span className={styles.tooltipBlue}>Compile</span> or <span className={styles.tooltipAmber}>Restore</span>. It gives you less <span className={styles.tooltipBlue}>HolyC</span> upon Restoring, or less <span className={styles.tooltipAmber}>JIT</span> for Compiling. The fee is taxed by sending <span className={styles.tooltipBlue}>HolyC</span> to the <span className={styles.tooltipRed}>burn address</span>.
    </>
  ), []);

  const transferFeeTooltipContent = useMemo(() => (
    <>
      This is the transfer fee for <span className={styles.tooltipAmber}>JIT</span>, taxed when sending it across wallets. This naturally decreases <span className={styles.tooltipAmber}>JIT</span> supply & therefore naturally increases <span className={styles.tooltipGreen}>positive price pressure</span>.
    </>
  ), []);

  return (
    <div 
      className={styles.compilerInterface} 
      ref={containerRef}
      onMouseEnter={() => {
        // Preload all tooltips when entering the interface area
        const tooltipTriggers = containerRef.current?.querySelectorAll('[data-tooltip-preload]');
        tooltipTriggers?.forEach(trigger => {
          const event = new CustomEvent('preload-tooltip');
          trigger.dispatchEvent(event);
        });
        
        // Preload info dropdown content
        const infoTrigger = containerRef.current?.querySelector('[data-info-preload]');
        if (infoTrigger) {
          // Pre-calculate any positioning or prepare content
          // The CSS is already optimized for smooth transitions
        }
      }}
    >
      <CompilerHeader
        state={state}
        onModeChange={handleModeChange}
        onTransitionStart={handleTransitionStart}
        uiState={uiState}
        setUiState={setUiState}
        isMobile={isMobile}
      />

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
                delay={100}
              >
                <div className={inputStyles.feeIndicator} data-fee-type="contract" data-tooltip-preload>
                  Contract <span className={inputStyles.feeValue}>
                    {compileRestoreFee ? (Number(compileRestoreFee) / 1000).toFixed(1) : '0'}%
                  </span>
                </div>
              </Tooltip>
              <Tooltip
                content={transferFeeTooltipContent}
                variant="info"
                position="top"
                delay={100}
              >
                <div className={inputStyles.feeIndicator} data-fee-type="transfer" data-tooltip-preload>
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
          
          <TokenInputForm
            amount={state.amount}
            onAmountChange={handleAmountChange}
            sourceToken={sourceToken}
            targetToken={targetToken}
            currentBalance={currentBalance}
            calculations={calculations}
            displayValues={displayValues}
            uiState={uiState}
            onUiStateChange={setUiState}
            shouldShowDetails={shouldShowDetails}
            isConnected={isConnected}
            isCompileMode={state.isCompileMode}
          />
        </div>
      </div>

      <ActionButtons
        isConnected={isConnected}
        isCompileMode={state.isCompileMode}
        needsApproval={needsApproval}
        hasAmount={hasAmount}
        exceedsBalance={uiState.exceedsBalance}
        isTxPending={isTxPending}
        isApprovalTxPending={isApprovalTxPending}
        onApprove={handleApprove}
        onConvert={handleConvert}
      />

      {isMobile && (
        <InfoModal
          isOpen={uiState.isInfoExpanded}
          onClose={() => setUiState({ isInfoExpanded: false })}
        />
      )}
    </div>
  )
})