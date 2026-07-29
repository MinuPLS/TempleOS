import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatUnits } from 'viem'
import { ChevronLeft, ChevronRight, ExternalLink, RotateCcw, Flame, Info, Workflow } from 'lucide-react'
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
import FupaLogo from '../../assets/TokenLogos/FUPA.jpg'
import styles from './LandingPage.module.css'
import type { TokenPrices } from '../UniswapPools/hooks/usePoolData'

const PAGE_SIZE = 5
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

const formatUsdValue = (value: number) => {
  const absoluteValue = Math.abs(value)
  return absoluteValue > 0 && absoluteValue < 0.01 ? smallUsdFormatter.format(absoluteValue) : usdFormatter.format(absoluteValue)
}

const formatUsdSigned = (value: number) => {
  const normalized = value < 0 ? 0 : value
  const formatted = formatUsdValue(normalized)
  return normalized > 0 ? `+ ${formatted}` : formatted
}

const formatActivityUpdatedAt = (timestamp: number) =>
  formatRelativeTime(timestamp).replace(/\b\w/g, (character) => character.toUpperCase())

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
  ...(execution.v2Settlement
    ? {
        HOLYC:
          execution.v2Settlement.status !== 'missing' && execution.v2Settlement.asset === 0
            ? execution.v2Settlement.retainedProfit
            : 0n,
        JIT:
          execution.v2Settlement.status !== 'missing' && execution.v2Settlement.asset === 1
            ? execution.v2Settlement.retainedProfit
            : 0n,
        WPLS:
          execution.v2Settlement.status !== 'missing' && execution.v2Settlement.asset === 2
            ? execution.v2Settlement.retainedProfit
            : 0n,
      }
    : {
        HOLYC: execution.holyIn - execution.holyOut,
        JIT: execution.jitIn - execution.jitOut,
        WPLS: (execution.wplsIn ?? 0n) - (execution.wplsOut ?? 0n),
      }),
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
  error: string | null
  lastUpdated: number | null
  onRefresh: () => Promise<void>
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
  const { holycUSD, jitUSD, wplsUSD } = tokenPrices
  const [pageByView, setPageByView] = useState<Record<ViewMode, number>>({
    arbs: 1,
    burns: 1,
    mafia: 1,
    dumb: 1,
    fupa: 1,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('arbs')
  const [expandedBurstIds, setExpandedBurstIds] = useState<Set<string>>(new Set())
  const [flowTxHash, setFlowTxHash] = useState<string | null>(null)
  const isViewingBurns = viewMode === 'burns'
  const isViewingMafia = viewMode === 'mafia'
  const isViewingDumb = viewMode === 'dumb'
  const isViewingFupa = viewMode === 'fupa'
  const isViewingArbs = viewMode === 'arbs'
  const isViewingPartnerBurn = !isViewingArbs
  const isShowingArbInfo = isInfoOpen && isViewingArbs

  const {
    executions: burnExecutions,
    isLoading: isBurnLoading,
    error: burnError,
    refresh: refreshBurns,
    lastUpdated: burnLastUpdated,
    tokenUsdPrice: briahUsdPrice,
  } = useBuyAndBurnActivity()

  const {
    executions: mafiaExecutions,
    isLoading: isMafiaLoading,
    error: mafiaError,
    refresh: refreshMafia,
    lastUpdated: mafiaLastUpdated,
    tokenUsdPrice: coinMafiaUsdPrice,
  } = useCoinMafiaBuyAndBurnActivity()

  const {
    executions: dumbExecutions,
    isLoading: isDumbLoading,
    error: dumbError,
    refresh: refreshDumb,
    lastUpdated: dumbLastUpdated,
    tokenUsdPrice: dumbUsdPrice,
  } = useDumbBuyAndBurnActivity()

  const {
    executions: fupaExecutions,
    isLoading: isFupaLoading,
    error: fupaError,
    refresh: refreshFupa,
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
  const activityTransactionCount = isViewingBurns
    ? burnExecutions.length
    : isViewingMafia
      ? mafiaExecutions.length
      : isViewingDumb
        ? dumbExecutions.length
        : isViewingFupa
          ? fupaExecutions.length
          : executions.length

  const handleRefresh = async () => {
    if (isRefreshing) return
    setIsRefreshing(true)

    try {
      await Promise.allSettled([
        onRefresh(),
        refreshBurns(),
        refreshMafia(),
        refreshDumb(),
        refreshFupa(),
      ])
    } finally {
      setIsRefreshing(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(currentData.length / PAGE_SIZE))
  const pageIndex = Math.min(page, totalPages)
  const start = (pageIndex - 1) * PAGE_SIZE
  const pageItems = useMemo(() => currentData.slice(start, start + PAGE_SIZE), [currentData, start])

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

  const showPartnerView = (nextView: Exclude<ViewMode, 'arbs'>) => {
    setIsInfoOpen(false)
    setViewMode(nextView)
  }
  const showBurns = () => showPartnerView('burns')
  const showMafia = () => showPartnerView('mafia')
  const showDumb = () => showPartnerView('dumb')
  const showFupa = () => showPartnerView('fupa')
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
    const burnUsdValue = formatUsdValue(Number(formatUnits(burnAmount, 18)) * holycUSD)

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
    const isV2Manager = execution.managerAddress?.toLowerCase() === DIVINE_MANAGER_ADDRESS.toLowerCase()
    const managerLabel = isV2Manager ? 'DivineManagerV2' : 'Divine Manager'
    const v2Settlement = execution.v2Settlement
    const toggleFlow = () =>
      setFlowTxHash((prev) => (prev === execution.transactionHash ? null : execution.transactionHash))

    return (
      <div key={execution.transactionHash} className={styles.txRow}>
        <div className={styles.txRowHeader}>
          <div className={styles.txRowMain}>
            <div className={styles.txRowTitleLine}>
              <span
                className={`${styles.sourceBadge} ${styles.sourceBadgeManager}${isV2Manager ? ` ${styles.sourceBadgeManagerV2}` : ''}`}
              >
                {managerLabel}
              </span>
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
                  <ArbFlowInline txHash={execution.transactionHash} tokenPrices={tokenPrices} />
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
                {v2Settlement?.status === 'missing' ? (
                  <div className={styles.v2SettlementWarning}>Settlement data unavailable — totals were not inferred from token outflows.</div>
                ) : (
                  renderValueContent(gainRows, execution.transactionHash, usdValue, burnAmount)
                )}
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
      {isShowingArbInfo ? (
          <div className={styles.activityInfoNav}>
            <p className={styles.activityInfoNavLabel}>About the Divine Manager</p>
            <button
              type="button"
              className={`${styles.viewToggleButton} ${styles.activityInfoBackButton}`}
              onClick={() => setIsInfoOpen(false)}
              aria-label="Back to automated arb feed"
            >
              <ChevronLeft size={15} /> Back
            </button>
          </div>
        ) : (
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
              ? <>
                  Updated {formatActivityUpdatedAt(currentLastUpdated)}
                  {activityTransactionCount > 0 && (
                    <span className={styles.activitySubtitleStat}>
                      {' '}· {activityTransactionCount}
                      <span className={styles.activityTransactionLabel}> Transactions</span>
                    </span>
                  )}
                </>
              : isViewingPartnerBurn
                ? 'Reading direct from vault'
                : 'Syncing live data'}
          </p>
        </div>
        <div className={styles.activityHeaderRight}>
          <div className={styles.activityControls}>
            <div className={styles.activityUtilityActions}>
              {isViewingArbs ? (
                <button
                  type="button"
                  className={`${styles.activityRefreshButton} ${isInfoOpen ? styles.infoButtonActive : ''}`}
                  onClick={() => setIsInfoOpen(true)}
                  aria-label="Show automated arb info"
                  title="About automated arbs"
                >
                  <Info size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className={`${styles.viewToggleButton} ${styles.activityInfoBackButton}`}
                  onClick={showArbs}
                  aria-label="Back to automated arb feed"
                >
                  <ChevronLeft size={14} /> Back
                </button>
              )}
              <button
                type="button"
                className={`${styles.activityRefreshButton}${isRefreshing || currentLoading ? ` ${styles.refreshSpinning}` : ''}`}
                onClick={() => void handleRefresh()}
                disabled={isRefreshing || currentLoading}
                aria-label="Refresh feed"
                title="Refresh feed"
              >
                <RotateCcw size={16} />
              </button>
            </div>
            {isViewingArbs ? (
              <div className={styles.activityToggleStack}>
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
              </div>
            ) : null}
          </div>
        </div>
          </div>
        )}

      {!isShowingArbInfo && currentError && (
        <div className={styles.activityError}>
          <p>{currentError}</p>
        </div>
      )}

      <div className={styles.activityPanelStack}>
        {isShowingArbInfo ? (
          <div className={styles.activityInfoPanel}>
            <div className={`${styles.burnInfoBox} ${styles.activityInfoBox}`}>
              <div className={styles.activityInfoIntro}>
                <p className={styles.activityInfoLead}>Every successful arb, live.</p>
                <p className={styles.activityInfoSummary}>
                  This is the live record of every successful arbitrage executed by <strong>DivineManagerV2</strong>,
                  the protocol&apos;s on-chain treasury and automated trade executor at the heart of TempleOS&apos;s
                  deflationary engine. Each entry shows how a market price gap became treasury growth, HolyC burns and,
                  when eligible, partner buy-and-burn payouts.
                </p>
              </div>

              <div className={styles.activityInfoSections}>
                <section className={styles.activityInfoSection}>
                  <h4>What this live feed shows</h4>
                  <p>
                    Every card is one completed on-chain arb. <strong>Tokens gained</strong> shows the net assets
                    added to the protocol treasury, while{' '}
                    <strong>Value gained</strong> estimates their USD value. The flame value records{' '}
                    HolyC burned during settlement.{' '}
                    <strong>View flow</strong> opens the route leg by leg, and <strong>Otterscan</strong> verifies the
                    transaction on-chain. The four token logos switch to the partner burn receipts funded by these arbs.
                  </p>
                </section>

                <section className={styles.activityInfoSection}>
                  <h4>Where the profit comes from</h4>
                  <p>
                    HolyC and JIT share the same underlying supply, but their prices move independently across different
                    markets. Normal trading lets those prices naturally drift apart, while JIT&apos;s burn-on-transfer
                    mechanics can amplify the difference. When the gap becomes large enough to remain profitable after
                    all costs, the Manager closes it and turns that temporary imbalance into protocol-owned value.
                  </p>
                </section>

                <section className={styles.activityInfoSection}>
                  <h4>How the value stays inside the ecosystem</h4>
                  <p>
                    Every successful trade builds the protocol treasury, burns HolyC and dedicates a portion of its
                    profit to Buy&amp;Burning partnered projects. this way, market gaps that outside arbitrageurs could
                    extract are recycled into treasury growth, supply reduction and continued positive price pressure.
                  </p>
                </section>

                <section className={styles.activityInfoSection}>
                  <h4>How it knows when to act</h4>
                  <p>
                    The off-chain <strong>Arb Guardian</strong> watches the markets and simulates possible routes using
                    live liquidity, slippage, token fees and gas. It only calls DivineManagerV2 when a route still
                    clears the required net profit. The caller can request an execution, but it cannot withdraw or take
                    custody of the treasury&apos;s assets.
                  </p>
                </section>

                <section className={styles.activityInfoSection}>
                  <h4>Built to protect its treasury</h4>
                  <p>
                    Every swap, conversion and settlement happens inside <strong>one atomic transaction</strong>:
                    either the complete route succeeds or nothing executes. Before accepting the result, the contract
                    rechecks prices, slippage, minimum profit and the total value of the treasury.
                  </p>
                </section>

                <section className={styles.activityInfoSection}>
                  <h4>An execution advantage others cannot copy</h4>
                  <p>
                    On approved JIT routes, the Divine Manager begins the loop fee-exempt. It still tracks the burns a
                    normal trader would owe, then settles that burn debt with a small protocol discount before the
                    transaction ends. Because a front-runner cannot reproduce these economics, the Manager does not need
                    to win every race to the pool.
                  </p>
                </section>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.activityFeedPanel}>
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
                    ? formatUsdValue(tokenPriceUsdValue)
                    : isUsableUsdValue(onChainUsdValue)
                      ? formatUsdValue(onChainUsdValue)
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
        )}
      </div>
    </div>
  )
}
