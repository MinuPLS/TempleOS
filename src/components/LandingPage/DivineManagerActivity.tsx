import { useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { ChevronLeft, ChevronRight, ExternalLink, RotateCcw, Flame } from 'lucide-react'
import type { DivineManagerExecution } from '@/hooks/useDivineManagerActivity'
import { useBuyAndBurnActivity, useCoinMafiaBuyAndBurnActivity } from '@/hooks/useBuyAndBurnActivity'
import { formatRelativeTime } from '@/lib/time'
import HolyCLogo from '../../assets/TokenLogos/HolyC.png'
import JITLogo from '../../assets/TokenLogos/JIT.png'
import BriahLogo from '../../assets/TokenLogos/Briah.png'
import CoinMafiaLogo from '../../assets/TokenLogos/CoinMafiaLogo.png'
import styles from './LandingPage.module.css'
import type { TokenPrices } from '../UniswapPools/hooks/usePoolData'

const PAGE_SIZE = 5
const PAGE_BLOCK = 20

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
  const normalized = value < 0 ? 0 : value
  const formatted = usdFormatter.format(normalized)
  return normalized > 0 ? `+ ${formatted}` : formatted
}

interface DivineManagerActivityProps {
  executions: DivineManagerExecution[]
  isLoading: boolean
  isLoadingMore: boolean
  error: string | null
  lastUpdated: number | null
  onRefresh: () => void
  onLoadMore: () => void
  hasMore: boolean
  tokenPrices: TokenPrices
}

export const DivineManagerActivity = ({
  executions,
  isLoading,
  isLoadingMore,
  error,
  lastUpdated,
  onRefresh,
  onLoadMore,
  hasMore,
  tokenPrices,
}: DivineManagerActivityProps) => {
  const { holycUSD, jitUSD } = tokenPrices
  const [pageByView, setPageByView] = useState<{ arbs: number; burns: number; mafia: number }>({
    arbs: 1,
    burns: 1,
    mafia: 1,
  })
  const [viewMode, setViewMode] = useState<'arbs' | 'burns' | 'mafia'>('arbs')
  const isViewingBurns = viewMode === 'burns'
  const isViewingMafia = viewMode === 'mafia'
  const isViewingArbs = viewMode === 'arbs'

  const {
    executions: burnExecutions,
    isLoading: isBurnLoading,
    isLoadingMore: isBurnLoadingMore,
    hasMore: hasMoreBurns,
    error: burnError,
    refresh: refreshBurns,
    loadMore: loadMoreBurns,
    lastUpdated: burnLastUpdated,
    tokenUsdPrice: briahUsdPrice,
  } = useBuyAndBurnActivity()

  const {
    executions: mafiaExecutions,
    isLoading: isMafiaLoading,
    isLoadingMore: isMafiaLoadingMore,
    hasMore: hasMoreMafia,
    error: mafiaError,
    refresh: refreshMafia,
    loadMore: loadMoreMafia,
    lastUpdated: mafiaLastUpdated,
    tokenUsdPrice: coinMafiaUsdPrice,
  } = useCoinMafiaBuyAndBurnActivity()

  const page = pageByView[viewMode]

  const [hasLoadedBurns, setHasLoadedBurns] = useState(false)
  const [hasLoadedMafia, setHasLoadedMafia] = useState(false)

  useEffect(() => {
    if (isViewingBurns && !hasLoadedBurns) {
      setHasLoadedBurns(true)
      void refreshBurns()
    }
  }, [isViewingBurns, hasLoadedBurns, refreshBurns])

  useEffect(() => {
    if (isViewingMafia && !hasLoadedMafia) {
      setHasLoadedMafia(true)
      void refreshMafia()
    }
  }, [isViewingMafia, hasLoadedMafia, refreshMafia])

  const currentData = useMemo(() => {
    const data = isViewingBurns ? burnExecutions : isViewingMafia ? mafiaExecutions : executions
    // Ensure descending sort (newest first)
    return [...data].sort((a, b) => b.timestamp - a.timestamp)
  }, [isViewingBurns, isViewingMafia, burnExecutions, mafiaExecutions, executions])

  const currentLoading = isViewingBurns ? isBurnLoading : isViewingMafia ? isMafiaLoading : isLoading
  const currentLoadingMore = isViewingBurns
    ? isBurnLoadingMore
    : isViewingMafia
      ? isMafiaLoadingMore
      : isLoadingMore
  const currentError = isViewingBurns ? burnError : isViewingMafia ? mafiaError : error
  const currentLastUpdated = isViewingBurns
    ? burnLastUpdated
    : isViewingMafia
      ? mafiaLastUpdated
      : lastUpdated
  const handleRefresh = isViewingBurns
    ? () => void refreshBurns()
    : isViewingMafia
      ? () => void refreshMafia()
      : onRefresh
  const currentHasMore = isViewingBurns ? hasMoreBurns : isViewingMafia ? hasMoreMafia : hasMore
  const handleLoadMore = isViewingBurns
    ? () => void loadMoreBurns()
    : isViewingMafia
      ? () => void loadMoreMafia()
      : onLoadMore

  const totalPages = Math.max(1, Math.ceil(currentData.length / PAGE_SIZE))
  const pageIndex = Math.min(page, totalPages)
  const start = (pageIndex - 1) * PAGE_SIZE
  const pageItems = useMemo(() => currentData.slice(start, start + PAGE_SIZE), [currentData, start])
  const totalPageDisplay =
    totalPages > PAGE_BLOCK && currentHasMore
      ? `${Math.floor(totalPages / PAGE_BLOCK) * PAGE_BLOCK}+`
      : totalPages
  const shouldShowLoadMore = currentHasMore && pageIndex === totalPages

  const handlePrev = () =>
    setPageByView((prev) => {
      const current = prev[viewMode]
      return { ...prev, [viewMode]: Math.max(1, current - 1) }
    })
  const handleNext = () =>
    setPageByView((prev) => {
      const current = prev[viewMode]
      return { ...prev, [viewMode]: Math.min(totalPages, current + 1) }
    })
  const showBurns = () => setViewMode('burns')
  const showMafia = () => setViewMode('mafia')
  const showArbs = () => setViewMode('arbs')

  const explorerBase = 'https://otter.pulsechain.com'

  return (
    <div className={styles.divineActivity}>
      <div className={styles.activityHeader}>
        <div className={styles.activityHeading}>
          <p className={styles.sectionEyebrow}>
            {isViewingArbs ? 'Live Divine Manager executes' : 'Buy & burn'}
          </p>
          <h3 className={styles.sectionTitle}>
            {isViewingBurns
              ? 'Briah Burn Tracker'
              : isViewingMafia
                ? 'CoinMafia Burn Tracker'
                : 'Automated Arbs'}
          </h3>
          <p className={styles.sectionSubtitle}>
            {currentLastUpdated
              ? `Updated ${formatRelativeTime(currentLastUpdated)}`
              : isViewingBurns || isViewingMafia
                ? 'Reading direct from vault'
                : 'Syncing live data'}
          </p>
        </div>
        <div className={styles.activityHeaderRight}>
          <div className={styles.activityControls}>
            <div className={styles.activityToggleStack}>
              {isViewingArbs ? (
                <>
                  <button type="button" className={styles.viewToggleButton} onClick={showBurns}>
                    View Briah Burns <Flame size={14} className={styles.buttonIconFlame} />
                  </button>
                  <button type="button" className={styles.viewToggleButton} onClick={showMafia}>
                    VIEW MAFIA BURNS <Flame size={14} className={styles.buttonIconFlame} />
                  </button>
                </>
              ) : (
                <button type="button" className={styles.viewToggleButton} onClick={showArbs}>
                  <ChevronLeft size={16} /> Back to Arbs
                </button>
              )}
            </div>
            <button
              className={styles.activityRefreshButton}
              onClick={() => {
                if (currentLoadingMore) return
                handleRefresh()
              }}
              disabled={currentLoadingMore}
              aria-label="Refresh feed"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {currentError && (
        <div className={styles.activityError}>
          <p>{currentError}</p>
        </div>
      )}

      <div className={styles.txList}>
        {currentLoading && pageItems.length === 0 && (
          <p className={styles.activityHint}>
            {isViewingBurns
              ? 'Summoning buy-and-burn logs…'
              : isViewingMafia
                ? 'Summoning CoinMafia burns…'
                : 'Loading Divine Manager executions…'}
          </p>
        )}
        {!currentLoading && pageItems.length === 0 && !currentError && (
          <p className={styles.activityHint}>
            {isViewingBurns
              ? 'No burn executions yet.'
              : isViewingMafia
                ? 'No CoinMafia burn executions yet.'
                : 'No Execute transactions yet. Arb Guardian will post here once the next spread clears.'}
          </p>
        )}

        {pageItems.map((item) => {
          if (isViewingBurns || isViewingMafia) {
            const burn = item as (typeof burnExecutions)[0]
            const tokenAmount = Number(formatUnits(burn.tokenBurned, 18))
            const usdPrice = isViewingBurns ? briahUsdPrice : coinMafiaUsdPrice
            const usdValue = usdPrice ? usdFormatter.format(tokenAmount * usdPrice) : '—'
            const tokenLabel = isViewingBurns ? 'Briah burned' : 'CoinMafia burned'
            const tokenSymbol = isViewingBurns ? 'BRIAH' : 'COINMAFIA'
            const tokenLogo = isViewingBurns ? BriahLogo : CoinMafiaLogo
            const tokenAlt = isViewingBurns ? 'Briah logo' : 'CoinMafia logo'

            return (
              <div key={burn.transactionHash} className={`${styles.txRow} ${styles.burnRow}`}>
                <div className={styles.txRowHeader}>
                  <div className={styles.txRowMain}>
                    <p>Burn</p>
                    <span>{shortenHex(burn.transactionHash, 6)}</span>
                  </div>
                  <div className={styles.txRowHeaderMeta}>
                    <div className={styles.txRowMetaGroup}>
                      <span className={styles.txRowTime}>{formatRelativeTime(burn.timestamp)}</span>
                      <a
                        href={`${explorerBase}/tx/${burn.transactionHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.txRowLink}
                      >
                        Otterscan <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>
                </div>
                <div className={styles.burnValueRow}>
                  <div className={styles.burnTokenSummary}>
                    <img src={tokenLogo} alt={tokenAlt} />
                    <div className={styles.burnTokenCopy}>
                      <span className={styles.valueLabel}>{tokenLabel}</span>
                      <strong className={styles.burnAmount}>
                        {formatAmount(burn.tokenBurned, 4)} {tokenSymbol}
                      </strong>
                    </div>
                  </div>
                  <div className={styles.burnUsdBlock}>
                    <span className={styles.valueLabel}>Est. USD value</span>
                    <strong className={styles.burnUsdValue}>{usdValue}</strong>
                  </div>
                </div>
              </div>
            )
          }

          // Arb Row
          const tx = item as DivineManagerExecution
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
                    <span className={`${styles.valueLabel} ${styles.valueLabelRight}`}>
                      Value gained
                    </span>
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
      {shouldShowLoadMore && (
        <div className={styles.activityLoadMoreRow}>
          <button
            type="button"
            className={styles.activityLoadMoreButton}
            onClick={handleLoadMore}
            disabled={currentLoadingMore || currentLoading}
          >
            {currentLoadingMore ? 'Loading more…' : 'Load older activity'}
          </button>
        </div>
      )}
      <div className={styles.activityFooter}>
        <button onClick={handlePrev} disabled={pageIndex === 1} aria-label="Previous page">
          <ChevronLeft size={16} />
        </button>
        <span className={styles.pageIndicator}>
          {pageIndex}/{totalPageDisplay}
        </span>
        <button onClick={handleNext} disabled={pageIndex === totalPages} aria-label="Next page">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
