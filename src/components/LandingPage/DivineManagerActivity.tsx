import { useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { ChevronLeft, ChevronRight, ExternalLink, RotateCcw, Flame } from 'lucide-react'
import type { ActivityExecution } from '@/hooks/useDivineManagerActivity'
import { useBuyAndBurnActivity, useCoinMafiaBuyAndBurnActivity, useDumbBuyAndBurnActivity } from '@/hooks/useBuyAndBurnActivity'
import { formatRelativeTime } from '@/lib/time'
import HolyCLogo from '../../assets/TokenLogos/HolyC.png'
import JITLogo from '../../assets/TokenLogos/JIT.png'
import BriahLogo from '../../assets/TokenLogos/Briah.png'
import CoinMafiaLogo from '../../assets/TokenLogos/CoinMafiaLogo.png'
import DumbLogo from '../../assets/TokenLogos/Dumb.png'
import styles from './LandingPage.module.css'
import type { TokenPrices } from '../UniswapPools/hooks/usePoolData'

const PAGE_SIZE = 5
const PAGE_BLOCK = 20
const FEEDER_BURST_GAP_MS = 3_600_000

type BurnActivityItem = {
  transactionHash: string
  timestamp: number
  tokenBurned: bigint
}

type FeederExecution = Extract<ActivityExecution, { source: 'feeder-bot' }>
type TokenSymbol = 'HOLYC' | 'JIT'

type DisplayGainRow = {
  symbol: TokenSymbol
  amount: bigint
}

type FeederBurstDisplayItem = {
  displayType: 'feeder-burst'
  id: string
  source: 'feeder-bot'
  newestTimestamp: number
  oldestTimestamp: number
  newestBlockNumber: bigint
  oldestBlockNumber: bigint
  loopCount: number
  transactionCount: number
  settlementBurned: bigint
  estimatedUsdGain: number
  netHolycGain: bigint
  netJitGain: bigint
  executions: FeederExecution[]
}

type DisplayFeedItem = ActivityExecution | FeederBurstDisplayItem

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

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000))
  if (totalSeconds < 60) {
    return `${Math.max(totalSeconds, 1)}s`
  }

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }

  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

const formatBlockWindow = (newestBlockNumber: bigint, oldestBlockNumber: bigint) => {
  const inclusiveBlocks = bnAbs(newestBlockNumber - oldestBlockNumber) + 1n
  return `${inclusiveBlocks.toString()} ${inclusiveBlocks === 1n ? 'block' : 'blocks'}`
}

const isFeederExecution = (execution: ActivityExecution): execution is FeederExecution => execution.source === 'feeder-bot'

const isFeederBurstDisplayItem = (item: DisplayFeedItem): item is FeederBurstDisplayItem => 'displayType' in item

const sortExecutionsByRecency = (left: ActivityExecution, right: ActivityExecution) => {
  const blockDiff = Number(right.blockNumber - left.blockNumber)
  if (blockDiff !== 0) return blockDiff
  return right.timestamp - left.timestamp
}

const sortByTimestamp = (left: { timestamp: number }, right: { timestamp: number }) => right.timestamp - left.timestamp

const getSourceBadgeLabel = (source: ActivityExecution['source']) =>
  source === 'feeder-bot' ? 'Feeder Bot' : 'Divine Manager'

const getTokenLogo = (symbol: 'HOLYC' | 'JIT') => (symbol === 'HOLYC' ? HolyCLogo : JITLogo)

const getExecutionGainRows = (execution: ActivityExecution): DisplayGainRow[] =>
  isFeederExecution(execution)
    ? [{ symbol: execution.netTokenSymbol, amount: execution.netTokenAmount }]
    : [
        { symbol: 'HOLYC', amount: execution.holyIn - execution.holyOut },
        { symbol: 'JIT', amount: execution.jitIn - execution.jitOut },
      ]

const getFeederExecutionUsdGain = (execution: FeederExecution, holycUSD: number, jitUSD: number) =>
  Number(formatUnits(execution.netTokenAmount, 18)) * (execution.netTokenSymbol === 'HOLYC' ? holycUSD : jitUSD)

const getExecutionUsdGain = (execution: ActivityExecution, holycUSD: number, jitUSD: number) =>
  isFeederExecution(execution)
    ? getFeederExecutionUsdGain(execution, holycUSD, jitUSD)
    : Number(formatUnits(execution.holyIn - execution.holyOut, 18)) * holycUSD +
      Number(formatUnits(execution.jitIn - execution.jitOut, 18)) * jitUSD

const getFeederRouteLabel = (route: FeederExecution['route']) =>
  route === 'hc-start-jit-gain' ? 'HC -> JIT loop' : 'JIT -> HC loop'

const getFeederExecutionTransactionCount = (execution: FeederExecution) =>
  execution.loopTransactionHashes.length + execution.settlement.transactions.length

const getFeederLatestVisibleTransaction = (execution: FeederExecution) => {
  const latestSettlementTx = execution.settlement.transactions[execution.settlement.transactions.length - 1]

  if (latestSettlementTx) {
    return {
      hash: latestSettlementTx.hash,
      label: latestSettlementTx.label,
      isSettlement: true,
    }
  }

  return {
    hash: execution.transactionHash,
    label: 'Arb swap',
    isSettlement: false,
  }
}

const buildFeederBurstDisplayItem = (
  executions: FeederExecution[],
  holycUSD: number,
  jitUSD: number
): FeederBurstDisplayItem => {
  const newestExecution = executions[0]
  const oldestExecution = executions[executions.length - 1]

  return {
    displayType: 'feeder-burst',
    id: `feeder-burst-${newestExecution.transactionHash}-${oldestExecution.transactionHash}-${executions.length}`,
    source: 'feeder-bot',
    newestTimestamp: newestExecution.timestamp,
    oldestTimestamp: oldestExecution.timestamp,
    newestBlockNumber: newestExecution.blockNumber,
    oldestBlockNumber: oldestExecution.blockNumber,
    loopCount: executions.length,
    transactionCount: executions.reduce((total, execution) => total + getFeederExecutionTransactionCount(execution), 0),
    settlementBurned: executions.reduce((total, execution) => total + execution.settlement.burnedAmount, 0n),
    estimatedUsdGain: executions.reduce(
      (total, execution) => total + getFeederExecutionUsdGain(execution, holycUSD, jitUSD),
      0
    ),
    netHolycGain: executions.reduce(
      (total, execution) => total + (execution.netTokenSymbol === 'HOLYC' ? execution.netTokenAmount : 0n),
      0n
    ),
    netJitGain: executions.reduce(
      (total, execution) => total + (execution.netTokenSymbol === 'JIT' ? execution.netTokenAmount : 0n),
      0n
    ),
    executions,
  }
}

const buildDisplayFeedItems = (
  executions: ActivityExecution[],
  holycUSD: number,
  jitUSD: number
): DisplayFeedItem[] => {
  const displayItems: DisplayFeedItem[] = []
  let feederBurst: FeederExecution[] = []

  const flushFeederBurst = () => {
    if (feederBurst.length === 0) return
    if (feederBurst.length === 1) {
      displayItems.push(feederBurst[0])
    } else {
      displayItems.push(buildFeederBurstDisplayItem(feederBurst, holycUSD, jitUSD))
    }
    feederBurst = []
  }

  executions.forEach((execution) => {
    if (!isFeederExecution(execution)) {
      flushFeederBurst()
      displayItems.push(execution)
      return
    }

    const previousFeederExecution = feederBurst[feederBurst.length - 1]
    const isBurstGap =
      previousFeederExecution !== undefined &&
      previousFeederExecution.timestamp - execution.timestamp > FEEDER_BURST_GAP_MS

    if (isBurstGap) {
      flushFeederBurst()
    }

    feederBurst.push(execution)
  })

  flushFeederBurst()
  return displayItems
}

const buildBurstGainRows = (burst: FeederBurstDisplayItem): DisplayGainRow[] => {
  const gainRows: DisplayGainRow[] = []

  if (burst.netHolycGain !== 0n) {
    gainRows.push({ symbol: 'HOLYC', amount: burst.netHolycGain })
  }

  if (burst.netJitGain !== 0n) {
    gainRows.push({ symbol: 'JIT', amount: burst.netJitGain })
  }

  return gainRows.length > 0 ? gainRows : [{ symbol: 'HOLYC', amount: 0n }]
}

interface DivineManagerActivityProps {
  executions: ActivityExecution[]
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
  const [pageByView, setPageByView] = useState<{ arbs: number; burns: number; mafia: number; dumb: number }>({
    arbs: 1,
    burns: 1,
    mafia: 1,
    dumb: 1,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<'arbs' | 'burns' | 'mafia' | 'dumb'>('arbs')
  const [expandedBurstIds, setExpandedBurstIds] = useState<Set<string>>(new Set())
  const isViewingBurns = viewMode === 'burns'
  const isViewingMafia = viewMode === 'mafia'
  const isViewingDumb = viewMode === 'dumb'
  const isViewingArbs = viewMode === 'arbs'

  const {
    executions: burnExecutions,
    isLoading: isBurnLoading,
    isLoadingMore: isBurnLoadingMore,
    hasMore: hasMoreBurns,
    error: burnError,
    refresh: refreshBurns,
    silentRefresh: silentRefreshBurns,
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
    silentRefresh: silentRefreshMafia,
    loadMore: loadMoreMafia,
    lastUpdated: mafiaLastUpdated,
    tokenUsdPrice: coinMafiaUsdPrice,
  } = useCoinMafiaBuyAndBurnActivity()

  const {
    executions: dumbExecutions,
    isLoading: isDumbLoading,
    isLoadingMore: isDumbLoadingMore,
    hasMore: hasMoreDumb,
    error: dumbError,
    refresh: refreshDumb,
    silentRefresh: silentRefreshDumb,
    loadMore: loadMoreDumb,
    lastUpdated: dumbLastUpdated,
    tokenUsdPrice: dumbUsdPrice,
  } = useDumbBuyAndBurnActivity()

  const page = pageByView[viewMode]

  const sortedArbExecutions = useMemo(
    () => [...executions].sort(sortExecutionsByRecency),
    [executions]
  )

  const arbDisplayItems = useMemo(
    () => buildDisplayFeedItems(sortedArbExecutions, holycUSD, jitUSD),
    [sortedArbExecutions, holycUSD, jitUSD]
  )

  const currentData = useMemo<Array<BurnActivityItem | DisplayFeedItem>>(() => {
    if (isViewingBurns) return [...burnExecutions].sort(sortByTimestamp)
    if (isViewingMafia) return [...mafiaExecutions].sort(sortByTimestamp)
    if (isViewingDumb) return [...dumbExecutions].sort(sortByTimestamp)
    return arbDisplayItems
  }, [isViewingBurns, isViewingMafia, isViewingDumb, burnExecutions, mafiaExecutions, dumbExecutions, arbDisplayItems])

  const currentLoading = isViewingBurns ? isBurnLoading : isViewingMafia ? isMafiaLoading : isViewingDumb ? isDumbLoading : isLoading
  const currentLoadingMore = isViewingBurns
    ? isBurnLoadingMore
    : isViewingMafia
      ? isMafiaLoadingMore
      : isViewingDumb
        ? isDumbLoadingMore
        : isLoadingMore
  const currentError = isViewingBurns ? burnError : isViewingMafia ? mafiaError : isViewingDumb ? dumbError : error
  const currentLastUpdated = isViewingBurns
    ? burnLastUpdated
    : isViewingMafia
      ? mafiaLastUpdated
      : isViewingDumb
        ? dumbLastUpdated
        : lastUpdated

  const handleRefresh = () => {
    if (isRefreshing) return
    setIsRefreshing(true)

    const promises: Promise<void>[] = [silentRefreshBurns(), silentRefreshMafia(), silentRefreshDumb()]
    if (isViewingBurns) {
      void refreshBurns()
    } else if (isViewingMafia) {
      void refreshMafia()
    } else if (isViewingDumb) {
      void refreshDumb()
    }
    onRefresh()

    void Promise.allSettled(promises).then(() => setIsRefreshing(false))
  }

  const currentHasMore = isViewingBurns ? hasMoreBurns : isViewingMafia ? hasMoreMafia : isViewingDumb ? hasMoreDumb : hasMore
  const handleLoadMore = isViewingBurns
    ? () => void loadMoreBurns()
    : isViewingMafia
      ? () => void loadMoreMafia()
      : isViewingDumb
        ? () => void loadMoreDumb()
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

  const toggleBurstExpansion = (burstId: string) =>
    setExpandedBurstIds((prev) => {
      const next = new Set(prev)
      if (next.has(burstId)) {
        next.delete(burstId)
      } else {
        next.add(burstId)
      }
      return next
    })

  const showBurns = () => setViewMode('burns')
  const showMafia = () => setViewMode('mafia')
  const showDumb = () => setViewMode('dumb')
  const showArbs = () => setViewMode('arbs')

  const explorerBase = 'https://otter.pulsechain.com'

  const getGainClassName = (symbol: DisplayGainRow['symbol']) => (symbol === 'HOLYC' ? styles.holyText : styles.jitText)
  const renderTokenRows = (gainRows: DisplayGainRow[], itemKey: string, options?: { signed?: boolean }) => (
    <div className={styles.tokenStack}>
      {gainRows.map((gain) => (
        <div key={`${itemKey}-${gain.symbol}`} className={styles.tokenLine}>
          <img src={getTokenLogo(gain.symbol)} alt={`${gain.symbol} gained`} />
          <span className={getGainClassName(gain.symbol)}>{options?.signed ? formatCompact(gain.amount) : formatAmount(gain.amount)}</span>
        </div>
      ))}
    </div>
  )

  const getFeederTransactionLinks = (execution: FeederExecution) => {
    const coreKindLabel = execution.route === 'hc-start-jit-gain' ? 'compile' : 'restore'
    const rebalanceKindLabel = execution.route === 'hc-start-jit-gain' ? 'restore' : 'compile'
    const coreLabels =
      execution.loopTransactionHashes.length > 3
        ? [`Rebalance ${rebalanceKindLabel}`, `Open ${coreKindLabel}`, 'Arb swap', `Close ${coreKindLabel}`]
        : [`Open ${coreKindLabel}`, 'Arb swap', `Close ${coreKindLabel}`]

    return [
      ...execution.loopTransactionHashes.map((hash, index) => ({
        hash,
        label: coreLabels[index] ?? `Loop tx ${index + 1}`,
      })),
      ...execution.settlement.transactions.map((transaction) => ({
        hash: transaction.hash,
        label: transaction.label,
      })),
    ]
  }

  const renderBurstCard = (burst: FeederBurstDisplayItem) => {
    const isExpanded = expandedBurstIds.has(burst.id)
    const gainRows = buildBurstGainRows(burst)
    const burstWindowLabel = formatDuration(burst.newestTimestamp - burst.oldestTimestamp)
    const blockWindowLabel = formatBlockWindow(burst.newestBlockNumber, burst.oldestBlockNumber)
    const burnUsdValue = usdFormatter.format(
      Math.abs(Number(formatUnits(burst.settlementBurned, 18)) * holycUSD)
    )
    const usdValue = formatUsdSigned(burst.estimatedUsdGain)

    return (
      <div key={burst.id} className={styles.txRow}>
        <div className={styles.txRowHeader}>
          <div className={styles.txRowMain}>
            <div className={styles.txRowTitleLine}>
              <span className={`${styles.sourceBadge} ${styles.sourceBadgeFeeder}`}>{getSourceBadgeLabel(burst.source)}</span>
              <strong className={styles.burstHeadline}>{burst.loopCount} loops</strong>
            </div>
            <span className={styles.txRowSubtext}>
              {burst.transactionCount} txs · {blockWindowLabel} · {burstWindowLabel}
            </span>
          </div>
          <div className={styles.txRowHeaderMeta}>
            <div className={styles.txRowMetaGroup}>
              <span className={styles.txRowTime}>{formatRelativeTime(burst.newestTimestamp)}</span>
              <button
                type="button"
                className={`${styles.burstToggle}${isExpanded ? ` ${styles.burstToggleExpanded}` : ''}`}
                onClick={() => toggleBurstExpansion(burst.id)}
                aria-expanded={isExpanded}
              >
                {isExpanded ? 'Hide loops' : `View ${burst.loopCount} loops`}
                <ChevronRight size={14} className={styles.burstToggleIcon} />
              </button>
            </div>
          </div>
        </div>

        <div className={styles.valueRow}>
          <div className={styles.valueCard}>
            <div className={styles.valueHeader}>
              <span className={styles.valueLabel}>Burst totals</span>
              <span className={`${styles.valueLabel} ${styles.valueLabelRight}`}>
                {burst.loopCount} loops · {burst.transactionCount} txs
              </span>
            </div>
            <div className={styles.valueContent}>
              {renderTokenRows(gainRows, burst.id, { signed: true })}
              <div className={styles.valueStack}>
                <strong className={`${styles.profitText} ${styles.valueUsd}`}>{usdValue}</strong>
                <div className={styles.valueBurn}>
                  <Flame size={14} />
                  <div className={styles.valueBurnCopy}>
                    <span className={styles.burnText}>{formatAmount(burst.settlementBurned)} HC</span>
                    <span className={styles.burnUsd}>{burnUsdValue}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className={styles.burstDetails}>
            <div className={styles.burstDetailsHeader}>
              <span className={styles.valueLabel}>Underlying loops</span>
              <span className={styles.burstDetailsMeta}>
                {blockWindowLabel} · {burstWindowLabel}
              </span>
            </div>
            {burst.executions.map((execution) => (
              <div key={execution.transactionHash} className={styles.burstLoopRow}>
                <div className={styles.burstLoopHeader}>
                  <div className={styles.burstLoopInfo}>
                    <strong className={styles.burstLoopTitle}>{getFeederRouteLabel(execution.route)}</strong>
                    <span className={styles.burstLoopMeta}>
                      {formatRelativeTime(execution.timestamp)} · {getFeederExecutionTransactionCount(execution)} txs
                    </span>
                  </div>
                  <div className={styles.burstLoopStats}>
                    <span className={getGainClassName(execution.netTokenSymbol)}>
                      {formatCompact(execution.netTokenAmount)} {execution.netTokenSymbol}
                    </span>
                    <span className={styles.burstLoopBurn}>{formatAmount(execution.settlement.burnedAmount)} HC</span>
                  </div>
                </div>
                <div className={styles.burstHashList}>
                  {getFeederTransactionLinks(execution).map((transaction) => (
                    <a
                      key={`${execution.transactionHash}-${transaction.hash}-${transaction.label}`}
                      href={`${explorerBase}/tx/${transaction.hash}`}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.burstHashLink}
                    >
                      <span className={styles.burstHashLabel}>{transaction.label}</span>
                      <span>{shortenHex(transaction.hash)}</span>
                      <ExternalLink size={12} />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const renderDivineManagerExecutionCard = (execution: Extract<ActivityExecution, { source: 'divine-manager' }>) => {
    const burnAmount = execution.holyBurned
    const burnUsdValue = usdFormatter.format(
      Math.abs(Number(formatUnits(burnAmount, 18)) * holycUSD)
    )
    const gainRows = getExecutionGainRows(execution)
    const usdValue = formatUsdSigned(getExecutionUsdGain(execution, holycUSD, jitUSD))

    return (
      <div key={execution.transactionHash} className={styles.txRow}>
        <div className={styles.txRowHeader}>
          <div className={styles.txRowMain}>
            <div className={styles.txRowTitleLine}>
              <span className={`${styles.sourceBadge} ${styles.sourceBadgeManager}`}>{getSourceBadgeLabel(execution.source)}</span>
            </div>
            <span className={styles.txRowSubtext}>{shortenHex(execution.transactionHash, 6)}</span>
          </div>
          <div className={styles.txRowHeaderMeta}>
            <div className={styles.txRowMetaGroup}>
              <span className={styles.txRowTime}>{formatRelativeTime(execution.timestamp)}</span>
              <a
                href={`${explorerBase}/tx/${execution.transactionHash}`}
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
              {renderTokenRows(gainRows, execution.transactionHash, { signed: true })}
              <div className={styles.valueStack}>
                <strong className={`${styles.profitText} ${styles.valueUsd}`}>{usdValue}</strong>
                <div className={styles.valueBurn}>
                  <Flame size={14} />
                  <div className={styles.valueBurnCopy}>
                    <span className={styles.burnText}>{formatAmount(burnAmount)} HC</span>
                    <span className={styles.burnUsd}>{burnUsdValue}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderFeederExecutionCard = (execution: FeederExecution) => {
    const burnAmount = execution.settlement.burnedAmount
    const burnUsdValue = usdFormatter.format(
      Math.abs(Number(formatUnits(burnAmount, 18)) * holycUSD)
    )
    const gainRows = getExecutionGainRows(execution)
    const usdValue = formatUsdSigned(getExecutionUsdGain(execution, holycUSD, jitUSD))
    const latestVisibleTransaction = getFeederLatestVisibleTransaction(execution)

    return (
      <div key={execution.transactionHash} className={styles.txRow}>
        <div className={styles.txRowHeader}>
          <div className={styles.txRowMain}>
            <div className={styles.txRowTitleLine}>
              <span className={`${styles.sourceBadge} ${styles.sourceBadgeFeeder}`}>{getSourceBadgeLabel(execution.source)}</span>
            </div>
            <span className={styles.txRowSubtext}>
              {getFeederRouteLabel(execution.route)} · {getFeederExecutionTransactionCount(execution)} txs ·{' '}
              {latestVisibleTransaction.isSettlement ? `${latestVisibleTransaction.label} · ` : ''}
              {shortenHex(latestVisibleTransaction.hash, 6)}
            </span>
          </div>
          <div className={styles.txRowHeaderMeta}>
            <div className={styles.txRowMetaGroup}>
              <span className={styles.txRowTime}>{formatRelativeTime(execution.timestamp)}</span>
              <a
                href={`${explorerBase}/tx/${latestVisibleTransaction.hash}`}
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
              <span className={styles.valueLabel}>Net token gained</span>
              <span className={`${styles.valueLabel} ${styles.valueLabelRight}`}>Value gained</span>
            </div>
            <div className={styles.valueContent}>
              {renderTokenRows(gainRows, execution.transactionHash, { signed: true })}
              <div className={styles.valueStack}>
                <strong className={`${styles.profitText} ${styles.valueUsd}`}>{usdValue}</strong>
                <div className={styles.valueBurn}>
                  <Flame size={14} />
                  <div className={styles.valueBurnCopy}>
                    <span className={styles.burnText}>{formatAmount(burnAmount)} HC</span>
                    <span className={styles.burnUsd}>{burnUsdValue}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
                : isViewingDumb
                  ? 'Dumb Burn Tracker'
                  : 'Automated Arbs'}
          </h3>
          <p className={styles.sectionSubtitle}>
            {currentLastUpdated
              ? `Updated ${formatRelativeTime(currentLastUpdated)}`
              : isViewingBurns || isViewingMafia || isViewingDumb
                ? 'Reading direct from vault'
                : 'Syncing live data'}
          </p>
        </div>
        <div className={styles.activityHeaderRight}>
          <div className={styles.activityControls}>
            <div className={styles.activityToggleStack}>
              {isViewingArbs ? (
                <div className={styles.partnerLogosRow}>
                  <button type="button" className={`${styles.partnerLogoBtn} ${styles.partnerLogoBriah}`} onClick={showBurns} title="Briah Burns">
                    <img src={BriahLogo} alt="Briah" />
                  </button>
                  <button type="button" className={`${styles.partnerLogoBtn} ${styles.partnerLogoMafia}`} onClick={showMafia} title="CoinMafia Burns">
                    <img src={CoinMafiaLogo} alt="CoinMafia" />
                  </button>
                  <button type="button" className={`${styles.partnerLogoBtn} ${styles.partnerLogoDumb}`} onClick={showDumb} title="Dumb Burns">
                    <img src={DumbLogo} alt="Dumb" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={`${styles.viewToggleButton} ${styles.partnerBurnTrigger}`}
                  onClick={showArbs}
                >
                  <ChevronLeft size={14} /> Back
                </button>
              )}
            </div>
            <button
              className={`${styles.activityRefreshButton}${isRefreshing || currentLoading ? ` ${styles.refreshSpinning}` : ''}`}
              onClick={() => {
                if (currentLoadingMore) return
                handleRefresh()
              }}
              disabled={currentLoadingMore || isRefreshing}
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
                : isViewingDumb
                  ? 'Summoning Dumb burns…'
                  : 'Loading Divine Manager executions…'}
          </p>
        )}
        {!currentLoading && pageItems.length === 0 && !currentError && (
          <p className={styles.activityHint}>
            {isViewingBurns
              ? 'No burn executions yet.'
              : isViewingMafia
                ? 'No CoinMafia burn executions yet.'
                : isViewingDumb
                  ? 'No Dumb burn executions yet.'
                  : 'No Execute transactions yet. Arb Guardian will post here once the next spread clears.'}
          </p>
        )}

        {pageItems.map((item) => {
          if (isViewingBurns || isViewingMafia || isViewingDumb) {
            const burn = item as BurnActivityItem
            const tokenAmount = Number(formatUnits(burn.tokenBurned, 18))
            const usdPrice = isViewingBurns ? briahUsdPrice : isViewingMafia ? coinMafiaUsdPrice : dumbUsdPrice
            const usdValue = usdPrice ? usdFormatter.format(tokenAmount * usdPrice) : '—'
            const tokenLabel = isViewingBurns ? 'Briah burned' : isViewingMafia ? 'CoinMafia burned' : 'Dumb burned'
            const tokenSymbol = isViewingBurns ? 'BRIAH' : isViewingMafia ? 'COINMAFIA' : 'DUMB'
            const tokenLogo = isViewingBurns ? BriahLogo : isViewingMafia ? CoinMafiaLogo : DumbLogo
            const tokenAlt = isViewingBurns ? 'Briah logo' : isViewingMafia ? 'CoinMafia logo' : 'Dumb logo'

            return (
              <div key={burn.transactionHash} className={`${styles.txRow} ${styles.burnRow}`}>
                <div className={styles.txRowHeader}>
                  <div className={styles.txRowMain}>
                    <p>Burn</p>
                    <span className={styles.txRowSubtext}>{shortenHex(burn.transactionHash, 6)}</span>
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

          const arbItem = item as DisplayFeedItem
          return isFeederBurstDisplayItem(arbItem)
            ? renderBurstCard(arbItem)
            : isFeederExecution(arbItem)
              ? renderFeederExecutionCard(arbItem)
              : renderDivineManagerExecutionCard(arbItem)
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
