/**
 * Wallet configuration utilities to prevent conflicts between multiple wallet extensions
 */

// Type definitions for Ethereum provider
interface EthereumProvider {
  isMetaMask?: boolean
  isCoinbaseWallet?: boolean
  isRabby?: boolean
  isBraveWallet?: boolean
  isTrust?: boolean
  isOKExWallet?: boolean
  providers?: EthereumProvider[]
}

type WindowWithEthereum = Window & { ethereum?: EthereumProvider }

// Check if MetaMask is available and handle conflicts
export function configureMetaMask() {
  if (typeof window === 'undefined') return

  // Detect if multiple wallet extensions are present
  const hasMultipleWallets = () => {
    const ethereum = (window as WindowWithEthereum).ethereum
    if (!ethereum) return false
    
    // Check for common wallet extension properties
    const walletIdentifiers: (keyof EthereumProvider)[] = [
      'isMetaMask',
      'isCoinbaseWallet', 
      'isRabby',
      'isBraveWallet',
      'isTrust',
      'isOKExWallet'
    ]
    
    return walletIdentifiers.filter(id => ethereum[id]).length > 1
  }

  // Handle MetaMask conflicts gracefully
  if (hasMultipleWallets()) {
    console.warn('[TempleOS] Multiple wallet extensions detected. Using primary Ethereum provider.')
    
    // Try to select MetaMask specifically if available
    const ethereum = (window as WindowWithEthereum).ethereum
    if (ethereum?.providers?.length && ethereum.providers.length > 0) {
      const metamaskProvider = ethereum.providers.find((p: EthereumProvider) => Boolean(p.isMetaMask))
      if (metamaskProvider) {
        // Use MetaMask provider specifically
        ;(window as WindowWithEthereum).ethereum = metamaskProvider
      }
    }
  }
}

// Suppress MetaMask console warnings for cleaner development experience
export function suppressMetaMaskWarnings() {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return
  
  const originalConsoleWarn = console.warn
  console.warn = (...args) => {
    const message = args.join(' ')
    
    // Filter out specific MetaMask warnings that are not actionable
    if (
      message.includes('MetaMask encountered an error setting the global Ethereum provider') ||
      message.includes('which has only a getter') ||
      message.includes('another Ethereum wallet extension')
    ) {
      // Log a cleaner message for developers
      console.log('[TempleOS] MetaMask provider conflict detected (non-critical)')
      return
    }
    
    // Let other warnings through
    originalConsoleWarn.apply(console, args)
  }
}

// Initialize wallet configuration
export function initializeWalletConfig() {
  configureMetaMask()
  suppressMetaMaskWarnings()
}
