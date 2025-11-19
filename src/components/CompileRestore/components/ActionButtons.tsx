import { memo } from 'react'
import inputStyles from '../styles/integratedInput.module.css'

interface ActionButtonsProps {
  isConnected: boolean;
  isCompileMode: boolean;
  needsApproval: boolean;
  hasAmount: boolean;
  exceedsBalance: boolean;
  isTxPending: boolean;
  isApprovalTxPending: boolean;
  onApprove: () => void;
  onConvert: () => void;
}

export const ActionButtons = memo<ActionButtonsProps>(({
  isConnected,
  isCompileMode,
  needsApproval,
  hasAmount,
  exceedsBalance,
  isTxPending,
  isApprovalTxPending,
  onApprove,
  onConvert
}) => {
  return (
    <div className={inputStyles.actionButtons}>
      {!isConnected ? (
        <button className={`${inputStyles.actionButton}`} disabled>
          Connect Wallet
        </button>
      ) : exceedsBalance ? (
        <button className={`${inputStyles.actionButton}`} disabled>
          Insufficient Balance
        </button>
      ) : needsApproval ? (
        <button
          className={`${inputStyles.actionButton} ${inputStyles.approveButton}`}
          onClick={onApprove}
          disabled={isTxPending || isApprovalTxPending || !hasAmount || exceedsBalance}
        >
          {isApprovalTxPending ? '⟳ Approving...' : 'Approve HolyC'}
        </button>
      ) : (
        <button
          className={`${inputStyles.actionButton} ${
            isCompileMode ? inputStyles.compileButton : inputStyles.restoreButton
          }`}
          onClick={onConvert}
          disabled={isTxPending || isApprovalTxPending || !hasAmount || exceedsBalance}
        >
          {isTxPending
            ? `⟳ ${isCompileMode ? 'Compiling' : 'Restoring'}...`
            : `${isCompileMode ? 'Compile' : 'Restore'}`}
        </button>
      )}
    </div>
  )
})

ActionButtons.displayName = 'ActionButtons'
