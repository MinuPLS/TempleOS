import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import Tooltip from '../../Tooltip/Tooltip'
import { formatCurrency } from '../../../lib/utils'
import styles from '../styles/dollarValueTooltip.module.css'

interface DollarValueTooltipProps {
  inputValue: number
  outputValue: number
  feeValue: number
  netGainLoss: number
  gainLossPercent: number
  isGain: boolean
  isLoss: boolean
  isNeutral: boolean
  isCompileMode: boolean
  className?: string
}

export const DollarValueTooltip: React.FC<DollarValueTooltipProps> = ({
  inputValue,
  outputValue,
  feeValue,
  netGainLoss,
  gainLossPercent,
  isGain,
  isLoss,
  _isNeutral,
  isCompileMode,
  className = ''
}) => {
  const { icon, colorClass, sign, tooltipContent } = useMemo(() => {
    let icon: React.ReactNode
    let colorClass: string
    let sign: string

    if (isGain) {
      icon = <TrendingUp size={14} />
      colorClass = styles.gain
      sign = '+'
    } else if (isLoss) {
      icon = <TrendingDown size={14} />
      colorClass = styles.loss
      sign = '-'
    } else {
      icon = <Minus size={14} />
      colorClass = styles.neutral
      sign = ''
    }

    const sourceToken = isCompileMode ? 'HolyC' : 'JIT'
    const targetToken = isCompileMode ? 'JIT' : 'HolyC'

    const tooltipContent = (
      <div className={styles.tooltipContent}>
        <div className={styles.tooltipHeader}>
          <span className={styles.tooltipTitle}>Value Change</span>
        </div>
        
        <div className={styles.breakdown}>
          <div className={styles.breakdownRow}>
            <span className={styles.label}>Input ({sourceToken}):</span>
            <span className={styles.value}>{formatCurrency(inputValue)}</span>
          </div>
          <div className={styles.breakdownRow}>
            <span className={styles.label}>Output ({targetToken}):</span>
            <span className={styles.value}>{formatCurrency(outputValue)}</span>
          </div>
          {feeValue > 0 && (
            <div className={styles.breakdownRow}>
              <span className={styles.label}>Fee Cost:</span>
              <span className={`${styles.value} ${styles.feeValue}`}>-{formatCurrency(feeValue)}</span>
            </div>
          )}
          <div className={`${styles.breakdownRow} ${styles.total}`}>
            <span className={styles.label}>Net Change:</span>
            <span className={`${styles.value} ${colorClass}`}>
              {sign}{formatCurrency(Math.abs(netGainLoss))} ({sign}{Math.abs(gainLossPercent).toFixed(2)}%)
            </span>
          </div>
        </div>

        <div className={styles.disclaimer}>
          <span className={styles.disclaimerText}>
            Output already includes the 4% compile/restore fee. Additional AMM slippage, JIT transfer taxes, or swap fees are not included.
          </span>
        </div>
      </div>
    )

    return { icon, colorClass, sign, tooltipContent }
  }, [isGain, isLoss, isCompileMode, inputValue, outputValue, feeValue, netGainLoss, gainLossPercent])

  // Don't render if values are zero or invalid
  if (inputValue <= 0 || outputValue <= 0) {
    return null
  }

  return (
    <Tooltip
      content={tooltipContent}
      variant="info"
      position="top"
      delay={200}
      className={styles.tooltipContainer}
    >
      <div className={`${styles.valueIndicator} ${colorClass} ${className}`}>
        {icon}
        <span className={styles.valueText}>
          {sign}{formatCurrency(Math.abs(netGainLoss))}
        </span>
      </div>
    </Tooltip>
  )
}
