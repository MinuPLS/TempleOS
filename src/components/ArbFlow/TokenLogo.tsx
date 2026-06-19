import { useEffect, useState, memo } from 'react'
import { resolveTokenLogo, fetchDexscreenerLogo } from '@/arb-flow/getTokenLogo'
import styles from './ArbFlow.module.css'

interface TokenLogoProps {
  address: string
  symbol: string
  size?: number
}

export const TokenLogo = memo<TokenLogoProps>(({ address, symbol, size = 26 }) => {
  const resolved = resolveTokenLogo({ address, symbol })
  const [src, setSrc] = useState(resolved.src)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    if (resolved.isInitials && !errored) {
      void fetchDexscreenerLogo(symbol).then((logo) => {
        if (logo) setSrc(logo)
      })
    }
  }, [symbol, resolved.isInitials, errored])

  useEffect(() => {
    setSrc(resolveTokenLogo({ address, symbol }).src)
    setErrored(false)
  }, [address, symbol])

  if (errored) {
    const initials = symbol.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2) || '?'
    return (
      <span
        className={styles.tokenLogoFallback}
        style={{ width: size, height: size, fontSize: size * 0.36, background: 'rgba(255,255,255,0.1)' }}
      >
        {initials}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={symbol}
      className={styles.tokenLogoImg}
      style={{ width: size, height: size }}
      onError={() => setErrored(true)}
      draggable={false}
    />
  )
})
