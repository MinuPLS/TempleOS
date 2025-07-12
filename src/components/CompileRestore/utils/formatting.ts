/**
 * Format balance for display
 */
export function formatBalance(balance: string): string {
  const num = parseFloat(balance)
  if (num === 0) return '0'
  if (num < 0.000001) return '<0.000001'
  if (num < 1) return num.toFixed(6).replace(/\.?0+$/, '')
  if (num < 1000) return num.toFixed(4).replace(/\.?0+$/, '')
  if (num < 1000000) return Math.floor(num / 1000) + 'K'
  return Math.floor(num / 1000000) + 'M'
}

/**
 * Format display amount - removes unnecessary decimal places
 */
export function formatDisplayAmount(amount: string): string {
  if (!amount || amount === '0') return '0'
  
  const num = parseFloat(amount)
  if (num === 0) return '0'
  
  // For whole numbers, show without decimals
  if (num === Math.floor(num)) {
    return num.toString()
  }
  
  // For decimals, remove trailing zeros
  return num.toString().replace(/\.?0+$/, '')
}

/**
 * Format fee percentage without % symbol
 */
export function formatFeeAmount(feePercent: string): string {
  if (!feePercent || feePercent === '0') return '0'
  
  const num = parseFloat(feePercent)
  if (num === 0) return '0'
  
  // Return clean number without % symbol
  return num.toString().replace(/\.?0+$/, '')
}

/**
 * Handle number input validation and formatting
 */
export function handleNumberInput(value: string): string {
  // Remove any non-numeric characters except decimal point
  const cleaned = value.replace(/[^0-9.]/g, '')
  
  // Ensure only one decimal point
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    return parts[0] + '.' + parts.slice(1).join('')
  }
  
  // Limit decimal places to 18 (standard for ERC20)
  if (parts[1] && parts[1].length > 18) {
    return parts[0] + '.' + parts[1].slice(0, 18)
  }
  
  return cleaned
}

/**
 * Validate amount input
 */
export function isValidAmount(amount: string): boolean {
  if (!amount || amount === '') return false
  const num = parseFloat(amount)
  return !isNaN(num) && num > 0 && isFinite(num)
}

/**
 * Format full token amount with proper comma separation
 */
export function formatFullAmount(amount: string): string {
  if (!amount || amount === '0') return '0'
  
  const num = parseFloat(amount)
  if (num === 0) return '0'
  
  // Split into integer and decimal parts
  const parts = num.toString().split('.')
  
  // Add comma separators to integer part
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  
  // Join back with decimal part if exists
  return parts.join('.')
}

/**
 * Get raw amount in wei format as string
 */
export function getRawAmount(amount: string, decimals: number = 18): string {
  if (!amount || amount === '0') return '0'
  
  try {
    // Parse the amount and convert to wei
    const num = parseFloat(amount)
    if (num === 0) return '0'
    
    // Convert to wei by multiplying by 10^decimals
    const weiAmount = BigInt(Math.floor(num * Math.pow(10, decimals)))
    return weiAmount.toString()
  } catch {
    return '0'
  }
}