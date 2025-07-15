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

      // Calculate symmetric gain/loss based on pure token price difference
      // This ensures both directions show the same dollar amount and percentage magnitude
      let netGainLoss = 0
      let gainLossPercent = 0
      
      if (tokenPrices.jitUSD > 0 && tokenPrices.holycUSD > 0 && receivedAmount > 0) {
        // Calculate the price difference percentage between HolyC and JIT
        const priceDiffPercent = ((tokenPrices.holycUSD - tokenPrices.jitUSD) / tokenPrices.jitUSD) * 100
        
        if (isCompileMode) {
          // Compile: HolyC → JIT (selling expensive for cheap)
          gainLossPercent = -Math.abs(priceDiffPercent) // Always negative
          // Calculate dollar loss based on pure price difference
          netGainLoss = -(inputAmount * Math.abs(tokenPrices.holycUSD - tokenPrices.jitUSD))
        } else {
          // Restore: JIT → HolyC (buying expensive with cheap)  
          gainLossPercent = Math.abs(priceDiffPercent) // Always positive
          // Calculate dollar gain based on pure price difference
          netGainLoss = inputAmount * Math.abs(tokenPrices.holycUSD - tokenPrices.jitUSD)
        }
      }

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