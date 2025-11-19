import { useEffect, useMemo, useState } from 'react'
import { formatUnits } from 'viem'
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, RotateCcw, Flame } from 'lucide-react'
import type {
  DivineManagerExecution,
  DivineManagerStep,
  StepToken,
  PoolKey,
} from '@/hooks/useDivineManagerActivity'
import { formatTokenAmount } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/time'
import HolyCLogo from '../../assets/TokenLogos/HolyC.png'
import JITLogo from '../../assets/TokenLogos/JIT.png'
import styles from './LandingPage.module.css'
import type { TokenPrices } from '../UniswapPools/hooks/usePoolData'
import { useProtocolFees } from '@/hooks/useProtocolFees'

const PAGE_SIZE = 5
const FEE_SCALE = 100000n

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

type DisplayStep = {
  id: string
  action: DivineManagerStep['type']
  fromSymbol: StepToken
  toSymbol: StepToken
  fromAmount: bigint
  toAmount: bigint
  pool?: PoolKey
  burnAmount?: bigint
  transferBurn?: bigint
  originalFromAmount?: bigint
}

const shortSymbol = (symbol: StepToken) => {
  if (symbol === 'HOLYC') return 'HC'
  if (symbol === 'UNKNOWN') return '?'
  return symbol
}

const formatAmount = (amount: bigint, digits = 2) => formatTokenAmount(formatUnits(amount, 18), digits)
const bnAbs = (value: bigint) => (value >= 0n ? value : value * -1n)

const formatSigned = (amount: bigint, symbol: string) => {
  if (amount === 0n) return `0 ${symbol}`
  const sign = amount > 0n ? '+' : '-'
  return `${sign}${formatAmount(bnAbs(amount))} ${symbol}`
}

const formatCompact = (amount: bigint) => {
  if (amount === 0n) return '0'
  const sign = amount > 0n ? '+' : '-'
  return `${sign}${formatAmount(bnAbs(amount))}`
}

const applyFee = (amount: bigint, fee: bigint) => {
  if (amount <= 0n || fee <= 0n) return amount
  return amount - (amount * fee) / FEE_SCALE
}

const feeSlice = (amount: bigint, fee: bigint) => {
  if (amount <= 0n || fee <= 0n) return 0n
  return (amount * fee) / FEE_SCALE
}

const buildDisplaySteps = (
  steps: DivineManagerStep[],
  compileFee: bigint,
  transferFee: bigint
): {
  displaySteps: DisplayStep[]
  compilerHolycBurn: bigint
  owedJitBurn: bigint
} => {
  let compilerHolycBurn = 0n
  let owedJitBurn = 0n

  const displaySteps: DisplayStep[] = steps.map((step) => {
    if (step.type === 'compile') {
      const minted = applyFee(step.tokenInAmount, compileFee)
      const burnAmount = feeSlice(step.tokenInAmount, compileFee)
      compilerHolycBurn += burnAmount
      return {
        id: step.id,
        action: step.type,
        fromSymbol: step.tokenInSymbol,
        toSymbol: step.tokenOutSymbol,
        fromAmount: step.tokenInAmount,
        toAmount: minted,
        burnAmount,
      }
    }

    if (step.type === 'restore') {
      const restored = applyFee(step.tokenInAmount, compileFee)
      const burnAmount = feeSlice(step.tokenInAmount, compileFee)
      compilerHolycBurn += burnAmount
      return {
        id: step.id,
        action: step.type,
        fromSymbol: step.tokenInSymbol,
        toSymbol: step.tokenOutSymbol,
        fromAmount: step.tokenInAmount,
        toAmount: restored,
        burnAmount,
      }
    }

    const isJitOut = step.tokenInSymbol === 'JIT'
    const taxedInput = isJitOut ? applyFee(step.tokenInAmount, transferFee) : step.tokenInAmount
    const transferBurn = isJitOut ? feeSlice(step.tokenInAmount, transferFee) : 0n
    owedJitBurn += transferBurn

    return {
      id: step.id,
      action: step.type,
      fromSymbol: step.tokenInSymbol,
      toSymbol: step.tokenOutSymbol,
      fromAmount: taxedInput,
      toAmount: step.tokenOutAmount,
      pool: step.pool,
      transferBurn,
      originalFromAmount: isJitOut ? step.tokenInAmount : undefined,
    }
  })

  return { displaySteps, compilerHolycBurn, owedJitBurn }
}

const formatUsdSigned = (value: number) => {
  const formatted = usdFormatter.format(Math.abs(value))
  return `${value >= 0 ? '+' : '-'} ${formatted}`
}

const TxFlowTooltip = ({
  steps,
  feeBreakdown,
  compileFeeLabel,
  transferFeeLabel,
  summary,
  burnStats,
  inline = false,
}: {
  steps: DisplayStep[]
  feeBreakdown: {
    compilerHolyc: bigint
    jitBurnJit: bigint
    jitBurnHolyc: bigint
    totalHolyBurn: bigint
  }
  compileFeeLabel: string
  transferFeeLabel: string
  summary?: {
    netHoly: string
    netJit: string
    netBurnUsd: string
    netProfitUsd: string
  }
  burnStats: {
    holyc: string
    jit: string
  }
  inline?: boolean
}) => {
  const stepCountLabel = `${steps.length} ${steps.length === 1 ? 'step' : 'steps'}`

  return (
    <div className={`${styles.txTooltipContent} ${inline ? styles.inlineTooltipContent : ''}`}>
      <div className={styles.tooltipGrid}>
        <div className={`${styles.tooltipColumn} ${styles.tooltipCard}`}>
          <div className={styles.tooltipCardHeader}>
            <span>Route</span>
            <span className={styles.tooltipStepCount}>{stepCountLabel}</span>
          </div>
          <div className={styles.tooltipSteps}>
            {steps.map((step, index) => {
              const stepTitle =
                step.action === 'compile' ? 'Compiled' : step.action === 'restore' ? 'Restored' : 'Swapped'
              const amountLine = `${formatAmount(step.fromAmount)} ${shortSymbol(step.fromSymbol)} → ${
                step.toAmount > 0n ? `${formatAmount(step.toAmount)} ${shortSymbol(step.toSymbol)}` : 'pending'
              }`

              const detailParts: string[] = []
              if (step.action === 'compile' || step.action === 'restore') {
                const burnLabel = step.burnAmount ? `${formatAmount(step.burnAmount)} HC burn` : 'No burn'
                detailParts.push(`${burnLabel} (${compileFeeLabel})`)
              } else if (step.transferBurn && step.transferBurn > 0n) {
                detailParts.push(`${formatAmount(step.transferBurn)} JIT burn (${transferFeeLabel})`)
              }
              const detailText = detailParts.join(' • ')
              const stepIndexClass =
                step.action === 'compile'
                  ? styles.stepIndexCompile
                  : step.action === 'restore'
                  ? styles.stepIndexRestore
                  : styles.stepIndexSwap

              return (
                <div key={step.id} className={styles.tooltipStepRow}>
                  <div className={`${styles.stepIndex} ${stepIndexClass}`}>{index + 1}</div>
                  <div className={styles.stepCopy}>
                    <p className={styles.stepTitle}>{stepTitle}</p>
                    <span className={styles.stepAmounts}>{amountLine}</span>
                    {detailText && <span className={styles.stepDetails}>{detailText}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className={`${styles.tooltipColumn} ${styles.tooltipCard}`}>
          <div className={styles.tooltipCardHeader}>
            <span>Owed Fees</span>
          </div>
          <div className={styles.feeSummary}>
            <div className={styles.feeRow}>
              <span>Compiler burn</span>
              <strong className={styles.holyText}>{formatAmount(feeBreakdown.compilerHolyc)} HC</strong>
              <small>{compileFeeLabel} fee</small>
            </div>
            <div className={styles.feeRow}>
              <span>Fee on transfer</span>
              <strong className={styles.jitText}>{formatAmount(feeBreakdown.jitBurnJit)} JIT</strong>
              {feeBreakdown.jitBurnJit > 0n && (
                <small>restored as {formatAmount(feeBreakdown.jitBurnHolyc)} HC</small>
              )}
            </div>
            <div className={`${styles.feeRow} ${styles.feeTotal}`}>
              <span>Total burned</span>
              <strong className={styles.burnText}>{burnStats.holyc} HC</strong>
              <small className={styles.jitText}>{burnStats.jit} JIT</small>
            </div>
          </div>
        </div>
      </div>

      {summary && (
        <div className={`${styles.txTotalsBox} ${styles.tooltipCard} ${inline ? styles.inlineSummaryCard : ''}`}>
          <div className={styles.txFlowNet}>
            <div>
              <p>Net HolyC</p>
              <strong className={`${styles.holyText} ${styles.summaryValue}`}>{summary.netHoly}</strong>
            </div>
            <div>
              <p>Value Burned</p>
              <strong className={`${styles.burnText} ${styles.summaryValue}`}>{summary.netBurnUsd}</strong>
            </div>
            <div>
              <p>Net JIT</p>
              <strong className={`${styles.jitText} ${styles.summaryValue}`}>{summary.netJit}</strong>
            </div>
            <div>
              <p>Net profit</p>
              <strong className={`${styles.profitText} ${styles.summaryValue}`}>{summary.netProfitUsd}</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  )
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
  const [page, setPage] = useState(1)
  const [expandedTx, setExpandedTx] = useState<string | null>(null)
  const { compileRestoreFee, transferFee } = useProtocolFees()

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
  const compileFeePercent = `${(Number(compileRestoreFee) / 1000).toFixed(1)}%`
  const transferFeePercent = `${(Number(transferFee) / 1000).toFixed(1)}%`

  const handleRowToggle = (hash: string) => {
    setExpandedTx((prev) => (prev === hash ? null : hash))
  }

  return (
    <div className={styles.divineActivity}>
      <div className={styles.activityHeader}>
        <div>
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
            Number(formatUnits(netHoly, 18)) * tokenPrices.holycUSD +
            Number(formatUnits(netJit, 18)) * tokenPrices.jitUSD
          const usdValue = formatUsdSigned(usdNumber)
          const { displaySteps, compilerHolycBurn, owedJitBurn } = buildDisplaySteps(
            tx.steps,
            compileRestoreFee,
            transferFee
          )
          const feeBreakdown = {
            compilerHolyc: compilerHolycBurn,
            jitBurnJit: owedJitBurn,
            jitBurnHolyc: owedJitBurn,
            totalHolyBurn: tx.holyBurned,
          }
          const holyBurnValue = Number(formatUnits(tx.holyBurned, 18)) * tokenPrices.holycUSD
          const jitBurnValue = Number(formatUnits(tx.jitBurned, 18)) * tokenPrices.jitUSD
          const netBurnUsd = usdFormatter.format(Math.abs(holyBurnValue + jitBurnValue))

          const summary = {
            netHoly: formatSigned(netHoly, 'HOLYC'),
            netJit: formatSigned(netJit, 'JIT'),
            netBurnUsd,
            netProfitUsd: usdValue,
          }
          const expanded = expandedTx === tx.transactionHash
          const detailId = `tx-details-${tx.transactionHash}`

          return (
            <div
              key={tx.transactionHash}
              className={`${styles.txRow} ${styles.txRowInteractive} ${expanded ? styles.txRowExpanded : ''}`}
              onClick={() => handleRowToggle(tx.transactionHash)}
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              aria-controls={detailId}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  handleRowToggle(tx.transactionHash)
                }
              }}
            >
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
                      onClick={(e) => e.stopPropagation()}
                    >
                      Otterscan <ExternalLink size={13} />
                    </a>
                  </div>
                  <div className={styles.txRowToggle}>
                    <span>{expanded ? 'Hide route' : 'Show route'}</span>
                    <ChevronDown
                      size={16}
                      className={`${styles.txRowToggleIcon} ${expanded ? styles.txRowToggleIconOpen : ''}`}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
              <div
                id={detailId}
                className={`${styles.txDetailsPanel} ${expanded ? styles.txDetailsPanelExpanded : ''}`}
                aria-hidden={!expanded}
              >
                <TxFlowTooltip
                  steps={displaySteps}
                  feeBreakdown={feeBreakdown}
                  compileFeeLabel={compileFeePercent}
                  transferFeeLabel={transferFeePercent}
                  summary={summary}
                  burnStats={{
                    holyc: formatAmount(tx.holyBurned),
                    jit: formatAmount(tx.jitBurned),
                  }}
                  inline
                />
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
                        <span className={styles.burnText}>{formatAmount(tx.holyBurned)} HC</span>
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
