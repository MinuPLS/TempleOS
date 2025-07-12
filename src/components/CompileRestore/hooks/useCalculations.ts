import { useMemo, useRef, useCallback } from 'react'
import { TokenCalculations } from '../types'
import { parseUnits, formatUnits } from 'viem'

interface UseCalculationsProps {
  amount: string
  compileRestoreFee?: bigint
  isUserFeeExempt?: boolean
  isCompileMode: boolean
}

// Pre-computed constants to avoid repeated calculations
const ZERO_RESULT: TokenCalculations = {
  burnAmount: '0',
  holycBurnFee: '0',
  lockedAmount: '0',
  received: '0',
  feePercent: '0',
}

// BigInt constants for precise calculations
const DECIMALS = 18
const FEE_DENOMINATOR = 100000n // Fee is expressed in parts per 100000
const PERCENT_DENOMINATOR = 1000n // Percent display is expressed in parts per 1000

export function useCalculations({
  amount,
  compileRestoreFee,
  isUserFeeExempt,
  isCompileMode,
}: UseCalculationsProps): TokenCalculations {
  const cacheRef = useRef<Map<string, TokenCalculations>>(new Map())
  
  // Precise calculation function using BigInt arithmetic
  const calculateValues = useCallback((inputAmount: string, fee: bigint, exempt: boolean, compile: boolean): TokenCalculations => {
    // Use Map for O(1) cache lookup
    const cacheKey = `${inputAmount}-${fee.toString()}-${exempt}-${compile}`
    const cached = cacheRef.current.get(cacheKey)
    if (cached) return cached
    
    // Early return for invalid inputs
    if (!inputAmount || !fee || isNaN(Number(inputAmount)) || Number(inputAmount) <= 0) {
      cacheRef.current.set(cacheKey, ZERO_RESULT)
      return ZERO_RESULT
    }

    try {
      // Parse input amount to BigInt with 18 decimals precision
      const amountBigInt = parseUnits(inputAmount, DECIMALS)
      const isExempt = exempt || false
      
      // Calculate fee percent for display (parts per 1000)
      const feePercent = isExempt ? '0' : formatUnits(fee / PERCENT_DENOMINATOR * 10n, 1)
      
      let result: TokenCalculations
      
      if (compile) {
        // COMPILE: HolyC → JIT - precise BigInt calculations
        const burnAmountBigInt = isExempt ? 0n : (amountBigInt * fee) / FEE_DENOMINATOR
        const lockedAmountBigInt = amountBigInt - burnAmountBigInt
        
        result = {
          burnAmount: burnAmountBigInt === 0n ? '0' : formatUnits(burnAmountBigInt, DECIMALS),
          holycBurnFee: '0',
          lockedAmount: lockedAmountBigInt === 0n ? '0' : formatUnits(lockedAmountBigInt, DECIMALS),
          received: lockedAmountBigInt === 0n ? '0' : formatUnits(lockedAmountBigInt, DECIMALS),
          feePercent,
        }
      } else {
        // RESTORE: JIT → HolyC - precise BigInt calculations
        const holycFeeAmountBigInt = isExempt ? 0n : (amountBigInt * fee) / FEE_DENOMINATOR
        const receivedAmountBigInt = amountBigInt - holycFeeAmountBigInt
        
        result = {
          burnAmount: inputAmount,
          holycBurnFee: holycFeeAmountBigInt === 0n ? '0' : formatUnits(holycFeeAmountBigInt, DECIMALS),
          lockedAmount: '0',
          received: receivedAmountBigInt === 0n ? '0' : formatUnits(receivedAmountBigInt, DECIMALS),
          feePercent,
        }
      }
      
      // Limit cache size to prevent memory leaks
      if (cacheRef.current.size > 100) {
        const firstKey = cacheRef.current.keys().next().value
        cacheRef.current.delete(firstKey)
      }
      
      cacheRef.current.set(cacheKey, result)
      return result
    } catch (error) {
      console.error('Calculation error:', error)
      cacheRef.current.set(cacheKey, ZERO_RESULT)
      return ZERO_RESULT
    }
  }, [])
  
  const calculations = useMemo(() => {
    return calculateValues(amount, compileRestoreFee || BigInt(0), isUserFeeExempt || false, isCompileMode)
  }, [amount, compileRestoreFee, isUserFeeExempt, isCompileMode, calculateValues])

  return calculations
}