import { memo, useMemo } from 'react'
import { ArrowRightCircle } from 'lucide-react'
import type { PoolData, TokenPrices } from '../UniswapPools/hooks/usePoolData'
import type { TokenStats } from '../StatsDashboard/hooks/useTokenStats'
import { formatCurrency, formatBigIntTokenAmount, formatTokenAmount } from '@/lib/utils'
import HolyCLogo from '../../assets/TokenLogos/HolyC.png'
import JITLogo from '../../assets/TokenLogos/JIT.png'
import WPLSLogo from '../../assets/TokenLogos/wpls.png'
import PulseXLogo from '../../assets/TokenLogos/PulseX.png'
import RefreshIcon from '../../assets/refresh-icon.svg'
import styles from './LandingAnalytics.module.css'

const getTokenLogo = (symbol: string) => {
  if (symbol === 'HolyC') return HolyCLogo
  if (symbol === 'JIT') return JITLogo
  if (symbol === 'WPLS') return WPLSLogo
  return PulseXLogo
}

const poolNarrative = (token0: string, token1: string) => {
  if (token0 === 'HolyC' && token1 === 'WPLS') {
    return 'Primary HolyC price. Most volume goes here.'
  }
  if (token0 === 'JIT' && token1 === 'WPLS') {
    return 'JIT trades separately; 2% burn on every move.'
  }
  return 'Connects both pools. Divine Manager and bots close gaps.'
}

type PoolTokenMeta = {
  symbol: string
  amount: string
}

type PoolRow = {
  pairAddress: string
  liquidityUSD: string
  token0: PoolTokenMeta
  token1: PoolTokenMeta
}

interface LandingAnalyticsProps {
  poolData: PoolData[]
  tokenPrices: TokenPrices
  tokenStats: TokenStats
  isPoolsLoading: boolean
  isStatsLoading: boolean
  onRefresh: () => void
}

export const LandingAnalytics = memo(function LandingAnalytics({
  poolData,
  tokenPrices,
  tokenStats,
  isPoolsLoading,
  isStatsLoading,
  onRefresh,
}: LandingAnalyticsProps) {
  const isRefreshing = isPoolsLoading || isStatsLoading

  const parityLabel = useMemo(() => {
    if (!tokenPrices.holycUSD || !tokenPrices.jitUSD) return 'Awaiting live parity'
    const delta = tokenPrices.jitUSD - tokenPrices.holycUSD
    if (Math.abs(delta) < 0.0000001) return 'HolyC ↔ JIT perfectly aligned'
    const percentDelta = (delta / tokenPrices.holycUSD) * 100
    const direction = percentDelta > 0 ? 'above' : 'below'
    return `JIT is ${Math.abs(percentDelta).toFixed(2)}% ${direction} HolyC`
  }, [tokenPrices.holycUSD, tokenPrices.jitUSD])

  const statLines = [
    {
      label: 'HolyC circulating',
      value: `${formatBigIntTokenAmount(tokenStats.circulatingHolyC)} HOLYC`,
    },
    {
      label: 'JIT supply',
      value: `${formatBigIntTokenAmount(tokenStats.jitCirculating)} JIT`,
    },
    {
      label: 'HolyC permanently locked in Compiler',
      value: `${formatBigIntTokenAmount(tokenStats.permanentlyLockedHolyC)} HOLYC`,
    },
    {
      label: 'HolyC burned from fees',
      value: `${formatBigIntTokenAmount(tokenStats.holycFeesBurned)} HOLYC`,
    },
    {
      label: 'HolyC in burned LP',
      value: `${formatBigIntTokenAmount(tokenStats.holycLockedAsLP)} HOLYC`,
    },
  ]

  const pools: PoolRow[] = poolData.length
    ? poolData
    : [
        {
          pairAddress: 'placeholder-holyc-wpls',
          liquidityUSD: '0',
          token0: { symbol: 'HolyC', amount: '0' },
          token1: { symbol: 'WPLS', amount: '0' },
        },
        {
          pairAddress: 'placeholder-jit-wpls',
          liquidityUSD: '0',
          token0: { symbol: 'JIT', amount: '0' },
          token1: { symbol: 'WPLS', amount: '0' },
        },
        {
          pairAddress: 'placeholder-holyc-jit',
          liquidityUSD: '0',
          token0: { symbol: 'HolyC', amount: '0' },
          token1: { symbol: 'JIT', amount: '0' },
        },
      ]

  return (
    <div className={styles.analyticsShell}>
      <div className={styles.summaryColumn}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Token intelligence</p>
            <h3 className={styles.sectionTitle}>Live parity snapshot</h3>
            <p className={styles.sectionSubtitle}>{parityLabel}</p>
          </div>
          <button
            className={styles.refreshButton}
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh landing analytics"
          >
            <img
              src={RefreshIcon}
              alt="Refresh"
              className={`${styles.refreshIcon} ${isRefreshing ? styles.loadingIcon : ''}`}
            />
          </button>
        </div>

        <div className={styles.priceGrid}>
          <div className={styles.priceCard}>
            <div className={styles.priceHeading}>
              <img src={HolyCLogo} alt="HolyC logo" />
              <span>HolyC price</span>
            </div>
            <strong>{formatCurrency(tokenPrices.holycUSD)}</strong>
            <p>Main token, tax-free, trades in HolyC/WPLS.</p>
          </div>
          <div className={styles.priceCard}>
            <div className={styles.priceHeading}>
              <img src={JITLogo} alt="JIT logo" />
              <span>JIT price</span>
            </div>
            <strong>{formatCurrency(tokenPrices.jitUSD)}</strong>
            <p>Twin token with 2% burn, trades in JIT/WPLS.</p>
          </div>
        </div>

        <div className={styles.supplyCard}>
          <div className={styles.supplyHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Supply & removal</p>
              <h3 className={styles.sectionTitle}>Locked, burned, deleted</h3>
            </div>
            <ArrowRightCircle className={styles.inlineIcon} size={18} />
          </div>
          <ul className={styles.statList}>
            {statLines.map(({ label, value }) => (
              <li key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </li>
            ))}
          </ul>
          <p className={styles.supplyFootnote}>
            HolyC removed = locked in Compiler + burned from fees + burned LP.
          </p>
        </div>
      </div>

      <div className={styles.poolColumn}>
        <div className={styles.poolHeader}>
          <div>
            <p className={styles.sectionEyebrow}>PulseX pools</p>
            <h3 className={styles.sectionTitle}>Three pools that feed the engine</h3>
            <p className={styles.sectionSubtitle}>HolyC, JIT, and Compiler routing create loopable volume.</p>
          </div>
          <img src={PulseXLogo} alt="PulseX logo" className={styles.pulsexLogo} />
        </div>

        <div className={styles.poolList}>
          {pools.map((pool) => (
            <article key={pool.pairAddress} className={styles.poolRow}>
              <div className={styles.poolHeaderRow}>
                <div className={styles.poolLogos}>
                  <img src={getTokenLogo(pool.token0.symbol)} alt={`${pool.token0.symbol} logo`} />
                  <img src={getTokenLogo(pool.token1.symbol)} alt={`${pool.token1.symbol} logo`} />
                </div>
                <div className={styles.poolTitle}>
                  <h4>
                    {pool.token0.symbol}/{pool.token1.symbol}
                  </h4>
                  <span>{poolNarrative(pool.token0.symbol, pool.token1.symbol)}</span>
                </div>
                <div className={styles.poolLiquidity}>
                  <p>Liquidity</p>
                  <strong>{formatCurrency(pool.liquidityUSD)}</strong>
                </div>
              </div>
              <div className={styles.poolBreakdown}>
                <div>
                  <span>{pool.token0.symbol}</span>
                  <strong>{formatTokenAmount(pool.token0.amount)}</strong>
                </div>
                <div>
                  <span>{pool.token1.symbol}</span>
                  <strong>{formatTokenAmount(pool.token1.amount)}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
})

export default LandingAnalytics
