import { useMemo } from 'react'
import { TokenCalculations } from '../types'

interface UseDollarValueCalculationsProps {
  amount: string
  calculations: TokenCalculations
  isCompileMode: boolean
  tokenPrices: {
    holycUSD: number
    jitUSD: number
  }
  compileRestoreFee?: bigint
  isUserFeeExempt?: boolean
}

interface DollarValueResult {
  inputValue: number
  outputValue: number
  feeValue: number
  netGainLoss: number
  gainLossPercent: number
  isGain: boolean
  isLoss: boolean
  isNeutral: boolean
}

const ZERO_RESULT: DollarValueResult = {
  inputValue: 0,
  outputValue: 0,
  feeValue: 0,
  netGainLoss: 0,
  gainLossPercent: 0,
  isGain: false,
  isLoss: false,
  isNeutral: true
}

export function useDollarValueCalculations({
  amount,
  calculations,
  isCompileMode,
  tokenPrices,
  compileRestoreFee,
  isUserFeeExempt
}: UseDollarValueCalculationsProps): DollarValueResult {
  
  return useMemo(() => {
    // Early return for invalid inputs
    if (!amount || !calculations.received || !tokenPrices.holycUSD || !tokenPrices.jitUSD) {
      return ZERO_RESULT
    }

    try {
      const inputAmount = parseFloat(amount)
      const receivedAmount = parseFloat(calculations.received)
      
      if (inputAmount <= 0 || receivedAmount <= 0) {
        return ZERO_RESULT
      }

      // Calculate dollar values based on mode
      let inputValue: number
      let outputValue: number
      let feeValue: number = 0

      if (isCompileMode) {
        // Compile: HolyC → JIT
        inputValue = inputAmount * tokenPrices.holycUSD
        outputValue = receivedAmount * tokenPrices.jitUSD
        
        // Calculate fee value in USD (HolyC burned)
        if (!isUserFeeExempt && compileRestoreFee) {
          const burnAmount = parseFloat(calculations.burnAmount || '0')
          feeValue = burnAmount * tokenPrices.holycUSD
        }
      } else {
        // Restore: JIT → HolyC
        inputValue = inputAmount * tokenPrices.jitUSD
        outputValue = receivedAmount * tokenPrices.holycUSD
        
        // Calculate fee value in USD (HolyC fee)
        if (!isUserFeeExempt && compileRestoreFee) {
          const holycFeeAmount = parseFloat(calculations.holycBurnFee || '0')
          feeValue = holycFeeAmount * tokenPrices.holycUSD
        }
      }

      // Net change is the difference between what the user puts in and what they receive
      const netGainLoss = outputValue - inputValue
      const gainLossPercent = inputValue > 0 ? (netGainLoss / inputValue) * 100 : 0

      // Determine gain/loss/neutral status
      const threshold = 0.01 // $0.01 threshold for neutral
      const isGain = netGainLoss > threshold
      const isLoss = netGainLoss < -threshold
      const isNeutral = !isGain && !isLoss

      return {
        inputValue,
        outputValue,
        feeValue,
        netGainLoss,
        gainLossPercent,
        isGain,
        isLoss,
        isNeutral
      }
    } catch (error) {
      console.error('Dollar value calculation error:', error)
      return ZERO_RESULT
    }
  }, [amount, calculations, isCompileMode, tokenPrices, compileRestoreFee, isUserFeeExempt])
}
