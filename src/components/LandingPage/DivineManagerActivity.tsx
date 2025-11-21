import { useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { ChevronLeft, ChevronRight, ExternalLink, RotateCcw, Flame } from 'lucide-react'
import type { DivineManagerExecution } from '@/hooks/useDivineManagerActivity'
import { formatRelativeTime } from '@/lib/time'
import HolyCLogo from '../../assets/TokenLogos/HolyC.png'
import JITLogo from '../../assets/TokenLogos/JIT.png'
import styles from './LandingPage.module.css'
import type { TokenPrices } from '../UniswapPools/hooks/usePoolData'

const PAGE_SIZE = 5

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const shortenHex = (value: string, size = 4) => {
  if (!value) return ''
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`
}

const formatAmount = (amount: bigint, digits = 2) => {
  const value = Number(formatUnits(amount, 18))
  if (!Number.isFinite(value)) return '0'
  const absValue = Math.abs(value)

  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  }

  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }

  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
const bnAbs = (value: bigint) => (value >= 0n ? value : value * -1n)

const formatCompact = (amount: bigint) => {
  if (amount === 0n) return '0'
  const sign = amount > 0n ? '+' : '-'
  return `${sign}${formatAmount(bnAbs(amount))}`
}

const formatUsdSigned = (value: number) => {
  const formatted = usdFormatter.format(Math.abs(value))
  return `${value >= 0 ? '+' : '-'} ${formatted}`
}

interface DivineManagerActivityProps {
  executions: DivineManagerExecution[]
  isLoading: boolean
  error: string | null
  lastUpdated: number | null
  onRefresh: () => void
  tokenPrices: TokenPrices
}

export const DivineManagerActivity = ({
  executions,
  isLoading,
  error,
  lastUpdated,
  onRefresh,
  tokenPrices,
}: DivineManagerActivityProps) => {
  const { holycUSD, jitUSD } = tokenPrices
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [executions])

  const totalPages = Math.max(1, Math.ceil(executions.length / PAGE_SIZE))
  const pageIndex = Math.min(page, totalPages)
  const start = (pageIndex - 1) * PAGE_SIZE
  const pageItems = useMemo(
    () => executions.slice(start, start + PAGE_SIZE),
    [executions, start]
  )

  const handlePrev = () => setPage((prev) => Math.max(1, prev - 1))
  const handleNext = () => setPage((prev) => Math.min(totalPages, prev + 1))

  const explorerBase = 'https://otter.pulsechain.com'

  return (
    <div className={styles.divineActivity}>
      <div className={styles.activityHeader}>
        <div className={styles.activityHeading}>
          <p className={styles.sectionEyebrow}>Live Divine Manager executes</p>
          <h3 className={styles.sectionTitle}>Automated arbs</h3>
          <p className={styles.sectionSubtitle}>
            {lastUpdated ? `Updated ${formatRelativeTime(lastUpdated)}` : 'Syncing live data'}
          </p>
        </div>
        <button
          className={styles.activityRefreshButton}
          onClick={onRefresh}
          disabled={isLoading}
          aria-label="Refresh Divine Manager feed"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {error && (
        <div className={styles.activityError}>
          <p>{error}</p>
        </div>
      )}

      <div className={styles.txList}>
        {isLoading && executions.length === 0 && <p className={styles.activityHint}>Loading Divine Manager executions…</p>}
        {!isLoading && executions.length === 0 && (
          <p className={styles.activityHint}>No Execute transactions yet. Arb Guardian will post here once the next spread clears.</p>
        )}

        {pageItems.map((tx) => {
          const netHoly = tx.holyIn - tx.holyOut
          const netJit = tx.jitIn - tx.jitOut
          const usdNumber =
            Number(formatUnits(netHoly, 18)) * holycUSD + Number(formatUnits(netJit, 18)) * jitUSD
          const usdValue = formatUsdSigned(usdNumber)
          const holyBurnValue = Number(formatUnits(tx.holyBurned, 18)) * holycUSD
          const burnUsdValue = usdFormatter.format(Math.abs(holyBurnValue))

          return (
            <div key={tx.transactionHash} className={styles.txRow}>
              <div className={styles.txRowHeader}>
                <div className={styles.txRowMain}>
                  <p>Execute</p>
                  <span>{shortenHex(tx.transactionHash, 6)}</span>
                </div>
                <div className={styles.txRowHeaderMeta}>
                  <div className={styles.txRowMetaGroup}>
                    <span className={styles.txRowTime}>{formatRelativeTime(tx.timestamp)}</span>
                    <a
                      href={`${explorerBase}/tx/${tx.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.txRowLink}
                    >
                      Otterscan <ExternalLink size={13} />
                    </a>
                  </div>
                </div>
              </div>

              <div className={styles.valueRow}>
                <div className={styles.valueCard}>
                  <div className={styles.valueHeader}>
                    <span className={styles.valueLabel}>Tokens gained</span>
                    <span className={`${styles.valueLabel} ${styles.valueLabelRight}`}>Value gained</span>
                  </div>
                  <div className={styles.valueContent}>
                    <div className={styles.tokenStack}>
                      <div className={styles.tokenLine}>
                        <img src={HolyCLogo} alt="HolyC gained" />
                        <span className={styles.holyText}>{formatCompact(netHoly)}</span>
                      </div>
                      <div className={styles.tokenLine}>
                        <img src={JITLogo} alt="JIT gained" />
                        <span className={styles.jitText}>{formatCompact(netJit)}</span>
                      </div>
                    </div>
                    <div className={styles.valueStack}>
                      <strong className={`${styles.profitText} ${styles.valueUsd}`}>{usdValue}</strong>
                      <div className={styles.valueBurn}>
                        <Flame size={14} />
                        <div className={styles.valueBurnCopy}>
                          <span className={styles.burnText}>{formatAmount(tx.holyBurned)} HC</span>
                          <span className={styles.burnUsd}>{burnUsdValue}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className={styles.activityFooter}>
        <button onClick={handlePrev} disabled={pageIndex === 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span className={styles.pageIndicator}>
          {pageIndex}/{totalPages}
        </span>
        <button onClick={handleNext} disabled={pageIndex === totalPages} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
