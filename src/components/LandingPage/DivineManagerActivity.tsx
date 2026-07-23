import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatUnits } from 'viem'
import { ChevronLeft, ChevronRight, ExternalLink, RotateCcw, Flame, Workflow } from 'lucide-react'
import type { ActivityExecution } from '@/hooks/useDivineManagerActivity'
import {
  useBuyAndBurnActivity,
  useCoinMafiaBuyAndBurnActivity,
  useDumbBuyAndBurnActivity,
  useFupaBuyAndBurnActivity,
} from '@/hooks/useBuyAndBurnActivity'
import { DIVINE_MANAGER_ADDRESS } from '@/config/contracts'
import { formatRelativeTime } from '@/lib/time'
import { ArbFlowInline } from '../ArbFlow/ArbFlowInline'
import HolyCLogo from '../../assets/TokenLogos/HolyC.png'
import JITLogo from '../../assets/TokenLogos/JIT.png'
import WplsLogo from '../../assets/TokenLogos/wpls.png'
import BriahLogo from '../../assets/TokenLogos/Briah.png'
import CoinMafiaLogo from '../../assets/TokenLogos/CoinMafiaLogo.png'
import DumbLogo from '../../assets/TokenLogos/Dumb.png'
import FupaLogo from '../../assets/TokenLogos/FUPA.png'
import styles from './LandingPage.module.css'
import type { TokenPrices } from '../UniswapPools/hooks/usePoolData'

const PAGE_SIZE = 5
const PAGE_BLOCK = 20
const FEEDER_BURST_GAP_MS = 3_600_000

type BurnActivityItem = {
  transactionHash: string
  timestamp: number
  tokenBurned: bigint
  jitSpent: bigint
}

type FeederExecution = Extract<ActivityExecution, { source: 'feeder-bot' }>
type TokenSymbol = 'HOLYC' | 'JIT' | 'WPLS'
type ViewMode = 'arbs' | 'burns' | 'mafia' | 'dumb' | 'fupa'

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

const smallUsdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
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
  const formatted = normalized > 0 && normalized < 0.01 ? smallUsdFormatter.format(normalized) : usdFormatter.format(normalized)
  return normalized > 0 ? `+ ${formatted}` : formatted
}

const isUsableUsdValue = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

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

const getTokenLogo = (symbol: TokenSymbol) =>
  symbol === 'HOLYC' ? HolyCLogo : symbol === 'JIT' ? JITLogo : WplsLogo

const TOKEN_DUST_THRESHOLD = 1_000_000_000_000n
const isMeaningfulTokenDelta = (amount: bigint) => bnAbs(amount) > TOKEN_DUST_THRESHOLD

const getDivineManagerTokenDeltas = (execution: Extract<ActivityExecution, { source: 'divine-manager' }>) => ({
  HOLYC: execution.holyIn - execution.holyOut,
  JIT: execution.jitIn - execution.jitOut,
  WPLS: (execution.wplsIn ?? 0n) - (execution.wplsOut ?? 0n),
})

const getExecutionGainRows = (execution: ActivityExecution): DisplayGainRow[] => {
  if (isFeederExecution(execution)) {
    return [{ symbol: execution.netTokenSymbol, amount: execution.netTokenAmount }]
  }

  const deltas = getDivineManagerTokenDeltas(execution)
  const gainRows: DisplayGainRow[] = [
    { symbol: 'HOLYC', amount: deltas.HOLYC },
    { symbol: 'JIT', amount: deltas.JIT },
    { symbol: 'WPLS', amount: deltas.WPLS },
  ]
  const meaningfulGainRows = gainRows.filter((row) => isMeaningfulTokenDelta(row.amount))

  return meaningfulGainRows.length > 0 ? meaningfulGainRows : [{ symbol: 'HOLYC', amount: 0n }]
}

const getFeederExecutionUsdGain = (execution: FeederExecution, holycUSD: number, jitUSD: number) =>
  Number(formatUnits(execution.netTokenAmount, 18)) * (execution.netTokenSymbol === 'HOLYC' ? holycUSD : jitUSD)

const getExecutionUsdGain = (execution: ActivityExecution, holycUSD: number, jitUSD: number, wplsUSD: number) => {
  if (isFeederExecution(execution)) {
    return getFeederExecutionUsdGain(execution, holycUSD, jitUSD)
  }

  const deltas = getDivineManagerTokenDeltas(execution)
  return (
    Number(formatUnits(deltas.HOLYC, 18)) * holycUSD +
    Number(formatUnits(deltas.JIT, 18)) * jitUSD +
    Number(formatUnits(deltas.WPLS, 18)) * wplsUSD
  )
}

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
  const { holycUSD, jitUSD, wplsUSD } = tokenPrices
  const [pageByView, setPageByView] = useState<Record<ViewMode, number>>({
    arbs: 1,
    burns: 1,
    mafia: 1,
    dumb: 1,
    fupa: 1,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('arbs')
  const [expandedBurstIds, setExpandedBurstIds] = useState<Set<string>>(new Set())
  const [flowTxHash, setFlowTxHash] = useState<string | null>(null)
  const isViewingBurns = viewMode === 'burns'
  const isViewingMafia = viewMode === 'mafia'
  const isViewingDumb = viewMode === 'dumb'
  const isViewingFupa = viewMode === 'fupa'
  const isViewingArbs = viewMode === 'arbs'
  const isViewingPartnerBurn = !isViewingArbs

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

  const {
    executions: fupaExecutions,
    isLoading: isFupaLoading,
    isLoadingMore: isFupaLoadingMore,
    hasMore: hasMoreFupa,
    error: fupaError,
    refresh: refreshFupa,
    silentRefresh: silentRefreshFupa,
    loadMore: loadMoreFupa,
    lastUpdated: fupaLastUpdated,
    tokenUsdPrice: fupaUsdPrice,
  } = useFupaBuyAndBurnActivity()

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
    if (isViewingFupa) return [...fupaExecutions].sort(sortByTimestamp)
    return arbDisplayItems
  }, [
    isViewingBurns,
    isViewingMafia,
    isViewingDumb,
    isViewingFupa,
    burnExecutions,
    mafiaExecutions,
    dumbExecutions,
    fupaExecutions,
    arbDisplayItems,
  ])

  const currentLoading = isViewingBurns
    ? isBurnLoading
    : isViewingMafia
      ? isMafiaLoading
      : isViewingDumb
        ? isDumbLoading
        : isViewingFupa
          ? isFupaLoading
          : isLoading
  const currentLoadingMore = isViewingBurns
    ? isBurnLoadingMore
    : isViewingMafia
      ? isMafiaLoadingMore
      : isViewingDumb
        ? isDumbLoadingMore
        : isViewingFupa
          ? isFupaLoadingMore
          : isLoadingMore
  const currentError = isViewingBurns
    ? burnError
    : isViewingMafia
      ? mafiaError
      : isViewingDumb
        ? dumbError
        : isViewingFupa
          ? fupaError
          : error
  const currentLastUpdated = isViewingBurns
    ? burnLastUpdated
    : isViewingMafia
      ? mafiaLastUpdated
      : isViewingDumb
        ? dumbLastUpdated
        : isViewingFupa
          ? fupaLastUpdated
          : lastUpdated

  const handleRefresh = () => {
    if (isRefreshing) return
    setIsRefreshing(true)

    const promises: Promise<void>[] = [
      silentRefreshBurns(),
      silentRefreshMafia(),
      silentRefreshDumb(),
      silentRefreshFupa(),
    ]
    if (isViewingBurns) {
      void refreshBurns()
    } else if (isViewingMafia) {
      void refreshMafia()
    } else if (isViewingDumb) {
      void refreshDumb()
    } else if (isViewingFupa) {
      void refreshFupa()
    }
    onRefresh()

    void Promise.allSettled(promises).then(() => setIsRefreshing(false))
  }

  const currentHasMore = isViewingBurns
    ? hasMoreBurns
    : isViewingMafia
      ? hasMoreMafia
      : isViewingDumb
        ? hasMoreDumb
        : isViewingFupa
          ? hasMoreFupa
          : hasMore
  const handleLoadMore = isViewingBurns
    ? () => void loadMoreBurns()
    : isViewingMafia
      ? () => void loadMoreMafia()
      : isViewingDumb
        ? () => void loadMoreDumb()
        : isViewingFupa
          ? () => void loadMoreFupa()
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
  const showFupa = () => setViewMode('fupa')
  const showArbs = () => setViewMode('arbs')

  const explorerBase = 'https://otter.pulsechain.com'

  const getGainClassName = (symbol: DisplayGainRow['symbol']) =>
    symbol === 'HOLYC' ? styles.holyText : symbol === 'JIT' ? styles.jitText : styles.wplsText
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

  const renderValueContent = (gainRows: DisplayGainRow[], itemKey: string, usdValue: string, burnAmount: bigint) => {
    const burnUsdValue = usdFormatter.format(Math.abs(Number(formatUnits(burnAmount, 18)) * holycUSD))

    return (
      <div className={styles.valueContent}>
        {renderTokenRows(gainRows, itemKey, { signed: true })}
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
    )
  }

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
            {renderValueContent(gainRows, burst.id, usdValue, burst.settlementBurned)}
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
    const gainRows = getExecutionGainRows(execution)
    const usdValue = formatUsdSigned(getExecutionUsdGain(execution, holycUSD, jitUSD, wplsUSD))
    const isFlowOpen = flowTxHash === execution.transactionHash
    const managerLabel =
      execution.managerAddress?.toLowerCase() === DIVINE_MANAGER_ADDRESS.toLowerCase()
        ? 'DivineManagerV2'
        : 'Divine Manager'
    const toggleFlow = () =>
      setFlowTxHash((prev) => (prev === execution.transactionHash ? null : execution.transactionHash))

    return (
      <div key={execution.transactionHash} className={styles.txRow}>
        <div className={styles.txRowHeader}>
          <div className={styles.txRowMain}>
            <div className={styles.txRowTitleLine}>
              <span className={`${styles.sourceBadge} ${styles.sourceBadgeManager}`}>{managerLabel}</span>
              <button
                type="button"
                className={`${styles.viewFlowButton}${isFlowOpen ? ` ${styles.viewFlowButtonActive}` : ''}`}
                onClick={toggleFlow}
                aria-expanded={isFlowOpen}
                aria-label={isFlowOpen ? 'Hide arb flow' : 'View arb flow'}
              >
                <Workflow size={12} /> {isFlowOpen ? 'Hide flow' : 'View flow'}
              </button>
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

        <motion.div layout className={styles.valueRow} style={{ overflow: 'hidden' }}>
          <AnimatePresence mode="wait" initial={false}>
            {isFlowOpen ? (
              <motion.div
                key="flow"
                style={{ width: '100%' }}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <div className={styles.valueCard}>
                  <ArbFlowInline txHash={execution.transactionHash} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="summary"
                className={styles.valueCard}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
              >
                <div className={styles.valueHeader}>
                  <span className={styles.valueLabel}>Tokens gained</span>
                  <span className={`${styles.valueLabel} ${styles.valueLabelRight}`}>Value gained</span>
                </div>
                {renderValueContent(gainRows, execution.transactionHash, usdValue, burnAmount)}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    )
  }

  const renderFeederExecutionCard = (execution: FeederExecution) => {
    const burnAmount = execution.settlement.burnedAmount
    const gainRows = getExecutionGainRows(execution)
    const usdValue = formatUsdSigned(getExecutionUsdGain(execution, holycUSD, jitUSD, wplsUSD))
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
            {renderValueContent(gainRows, execution.transactionHash, usdValue, burnAmount)}
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
                  : isViewingFupa
                    ? 'FUPA Burn Tracker'
                    : 'Automated Arbs'}
          </h3>
          <p className={styles.sectionSubtitle}>
            {currentLastUpdated
              ? `Updated ${formatRelativeTime(currentLastUpdated)}`
              : isViewingPartnerBurn
                ? 'Reading direct from vault'
                : 'Syncing live data'}
          </p>
        </div>
        <div className={styles.activityHeaderRight}>
          <div className={styles.activityControls}>
            <div className={styles.activityToggleStack}>
              {isViewingArbs ? (
                <div className={styles.partnerLogosRow}>
                  <button
                    type="button"
                    className={`${styles.partnerLogoBtn} ${styles.partnerLogoBriah}`}
                    onClick={showBurns}
                    title="Briah Burns"
                    aria-label="View Briah burns"
                  >
                    <img src={BriahLogo} alt="Briah" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.partnerLogoBtn} ${styles.partnerLogoMafia}`}
                    onClick={showMafia}
                    title="CoinMafia Burns"
                    aria-label="View CoinMafia burns"
                  >
                    <img src={CoinMafiaLogo} alt="CoinMafia" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.partnerLogoBtn} ${styles.partnerLogoDumb}`}
                    onClick={showDumb}
                    title="Dumb Burns"
                    aria-label="View Dumb burns"
                  >
                    <img src={DumbLogo} alt="Dumb" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.partnerLogoBtn} ${styles.partnerLogoFupa}`}
                    onClick={showFupa}
                    title="FUPA Burns"
                    aria-label="View FUPA burns"
                  >
                    <img src={FupaLogo} alt="FUPA" />
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
                  : isViewingFupa
                    ? 'Summoning FUPA burns…'
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
                  : isViewingFupa
                    ? 'No FUPA burn executions yet.'
                    : 'No Execute transactions yet. Arb Guardian will post here once the next spread clears.'}
          </p>
        )}

        {pageItems.map((item) => {
          if (isViewingPartnerBurn) {
            const burn = item as BurnActivityItem
            const tokenAmount = Number(formatUnits(burn.tokenBurned, 18))
            const usdPrice = isViewingBurns
              ? briahUsdPrice
              : isViewingMafia
                ? coinMafiaUsdPrice
                : isViewingDumb
                  ? dumbUsdPrice
                  : fupaUsdPrice
            const tokenPriceUsdValue = isUsableUsdValue(usdPrice) ? tokenAmount * usdPrice : null
            const onChainUsdValue = Number(formatUnits(burn.jitSpent, 18)) * jitUSD
            const usdValue = isUsableUsdValue(tokenPriceUsdValue)
              ? usdFormatter.format(tokenPriceUsdValue)
              : isUsableUsdValue(onChainUsdValue)
                ? usdFormatter.format(onChainUsdValue)
                : '—'
            const tokenLabel = isViewingBurns
              ? 'Briah burned'
              : isViewingMafia
                ? 'CoinMafia burned'
                : isViewingDumb
                  ? 'Dumb burned'
                  : 'FUPA burned'
            const tokenSymbol = isViewingBurns
              ? 'BRIAH'
              : isViewingMafia
                ? 'COINMAFIA'
                : isViewingDumb
                  ? 'DUMB'
                  : 'FUPA'
            const tokenLogo = isViewingBurns
              ? BriahLogo
              : isViewingMafia
                ? CoinMafiaLogo
                : isViewingDumb
                  ? DumbLogo
                  : FupaLogo
            const tokenAlt = `${tokenSymbol} logo`

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
