import React, { memo, useCallback, useMemo } from 'react'
import { formatEther } from 'viem'
import { formatBalance, formatFullAmount, handleNumberInput } from '../utils/formatting'
import inputStyles from '../styles/integratedInput.module.css'

interface UiState {
  inputFocused: boolean;
  expandedTransactionRow: number | null;
  userInteracted: boolean;
  selectedPercentage: number | null;
  percentageDropdownOpen: boolean;
  isInfoExpanded: boolean;
  exceedsBalance: boolean;
}

interface DisplayValues {
  sendingAmount: string;
  receivingAmount: string;
  feePercent: string;
  dollarValue: string;
}

interface Calculations {
  received?: string;
  burnAmount?: string;
  lockedAmount?: string;
  holycBurnFee?: string;
}

interface TokenInputFormProps {
  amount: string;
  onAmountChange: (amount: string) => void;
  sourceToken: string;
  targetToken: string;
  currentBalance: { value: bigint } | undefined;
  calculations: Calculations;
  displayValues: DisplayValues;
  uiState: UiState;
  onUiStateChange: (updates: Partial<UiState>) => void;
  shouldShowDetails: boolean;
  isConnected: boolean;
  isCompileMode: boolean;
  dollarValueTooltip?: React.ReactNode;
}

export const TokenInputForm = memo<TokenInputFormProps>(({
  amount,
  onAmountChange,
  sourceToken,
  targetToken,
  currentBalance,
  calculations,
  displayValues,
  uiState,
  onUiStateChange,
  shouldShowDetails,
  isConnected,
  isCompileMode,
  dollarValueTooltip
}) => {
  // Input handler for amount. The resulting calculations are debounced.
  const optimizedInputHandler = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanValue = handleNumberInput(e.target.value)
    onAmountChange(cleanValue)
    onUiStateChange({ 
      selectedPercentage: null, // Clear percentage selection when typing manually
      percentageDropdownOpen: false // Close dropdown when typing
    })
  }, [onAmountChange, onUiStateChange])

  const handlePercentageSelect = useCallback((percentage: number) => {
    if (!currentBalance) return
    
    const balanceInEther = formatEther(currentBalance.value)
    const percentageAmount = (parseFloat(balanceInEther) * percentage / 100).toString()
    
    onAmountChange(percentageAmount)
    onUiStateChange({ 
      selectedPercentage: percentage,
      percentageDropdownOpen: false
    })
  }, [currentBalance, onAmountChange, onUiStateChange])

  const togglePercentageDropdown = useCallback(() => {
    onUiStateChange({ percentageDropdownOpen: !uiState.percentageDropdownOpen })
  }, [uiState.percentageDropdownOpen, onUiStateChange])

  const handleInputFocus = useCallback(() => {
    onUiStateChange({
      inputFocused: true,
      userInteracted: true
    })
  }, [onUiStateChange])

  const toggleTransactionRow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Mark as user interaction to keep UI open
    onUiStateChange({
      userInteracted: true,
      expandedTransactionRow: uiState.expandedTransactionRow === 'transaction-breakdown' ? null : 'transaction-breakdown'
    })
  }, [uiState.expandedTransactionRow, onUiStateChange])

  const transactionBreakdown = useMemo(() => {
    if (!isCompileMode) {
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
  }, [isCompileMode, calculations.burnAmount, calculations.lockedAmount, calculations.holycBurnFee])

  return (
    <>
      <div className={inputStyles.inputContainer}>
        <div className={inputStyles.inputAndPresets}>
          <input
            className={inputStyles.amountInput}
            type="text"
            inputMode="decimal"
            placeholder={`Enter ${sourceToken} amount`}
            value={amount}
            onChange={optimizedInputHandler}
            onFocus={handleInputFocus}
          />
          {currentBalance && (
            <div className={inputStyles.percentageDropdownContainer}>
              <button
                className={`${inputStyles.percentageTrigger} ${uiState.percentageDropdownOpen ? inputStyles.active : ''}`}
                onClick={togglePercentageDropdown}
                type="button"
              >
                ▼
              </button>
              <div className={`${inputStyles.percentageDropdown} ${uiState.percentageDropdownOpen ? inputStyles.open : ''}`}>
                {[25, 50, 75, 100].map((percentage) => (
                  <button
                    key={percentage}
                    className={`${inputStyles.percentageButton} ${uiState.selectedPercentage === percentage ? inputStyles.selected : ''}`}
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
          {isConnected
            ? `Balance: ${currentBalance ? formatBalance(formatEther(currentBalance.value)) : '0'} ${sourceToken}`
            : 'Connect Wallet to see Balance'}
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
            <div className={`${inputStyles.dropdownIcon} ${uiState.expandedTransactionRow === 'transaction-breakdown' ? inputStyles.expanded : ''}`}>
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
          <div className={`${inputStyles.expandableContent} ${uiState.expandedTransactionRow === 'transaction-breakdown' ? inputStyles.expanded : ''}`}>
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
            
            {/* Dollar Value Tooltip positioned in bottom right of receive section */}
            {dollarValueTooltip && (
              <div className={inputStyles.dollarValueTooltipPosition}>
                {dollarValueTooltip}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
})

TokenInputForm.displayName = 'TokenInputForm'