import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Copy, Info, RotateCcw } from 'lucide-react'
import { formatUnits } from 'viem'
import { fetchDexscreenerLogo, resolveTokenLogo } from '@/arb-flow/getTokenLogo'
import type { TokenPrices } from '../UniswapPools/hooks/usePoolData'
import styles from './LandingPage.module.css'
import {
  useConnectedLiquidityPools,
  type ConnectedPoolToken,
} from './useConnectedLiquidityPools'
import { useManagerVolume } from './useManagerVolume'
import type { VolumeWindow } from './LiquidityVolumeNetwork'
import type { ActivityExecution } from '@/hooks/useDivineManagerActivity'

const LiquidityVolumeNetwork = lazy(() =>
  import('./LiquidityVolumeNetwork').then((module) => ({ default: module.LiquidityVolumeNetwork }))
)

const VOLUME_WINDOWS: Array<{ id: VolumeWindow; label: string; ms: number | null }> = [
  { id: '24h', label: '24H', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7D', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: '30D', ms: 30 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'ALL', ms: null },
]

type ConnectedLiquidityPoolsProps = {
  tokenPrices: TokenPrices
  managerExecutions: ActivityExecution[]
}

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

const formatPoolBalance = (token: ConnectedPoolToken) => {
  const value = Number(formatUnits(token.reserve, token.decimals))
  if (!Number.isFinite(value) || value === 0) return '0'
  if (value > 0 && value < 0.01) return '<0.01'
  return compactNumberFormatter.format(value)
}

const formatLiquidity = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value > 0 && value < 0.01) return '<$0.01'
  return usdFormatter.format(value)
}

const formatAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

const TokenLogo = ({ token, className }: { token: ConnectedPoolToken; className: string }) => {
  const initial = useMemo(() => resolveTokenLogo(token), [token])
  const [src, setSrc] = useState(initial.src)

  useEffect(() => {
    setSrc(initial.src)
    if (!initial.isInitials) return
    let active = true
    void fetchDexscreenerLogo(token).then((logo) => {
      if (active && logo) setSrc(logo)
    })
    return () => {
      active = false
    }
  }, [initial, token])

  return <img src={src} alt={`${token.symbol} logo`} className={className} />
}

const LiquidityViewsGuide = () => (
  <div className={`${styles.burnInfoBox} ${styles.liquidityViewsGuide}`}>
    <ul className={styles.burnInfoList}>
      <li>
        <strong>Two Views, One Network:</strong> This panel follows the liquidity pools used by the DivineManager.
        Pools shows what is available, while Volume shows how activity moved between those pools.
      </li>
      <li>
        <strong>Pools:</strong> Browse every pair the DivineManager has used and its current estimated liquidity.
        Open a pair to see its token balances or copy its addresses.
      </li>
      <li>
        <strong>Volume:</strong> Follow the paths taken between pools. Each bubble is a pair, and each line shows a
        connection seen in a DivineManager route.
      </li>
    </ul>
  </div>
)

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const input = document.createElement('textarea')
  input.value = value
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

export const ConnectedLiquidityPools = ({ tokenPrices, managerExecutions }: ConnectedLiquidityPoolsProps) => {
  const { pools, isLoading, error, refresh } = useConnectedLiquidityPools(tokenPrices)
  const [copiedTarget, setCopiedTarget] = useState<{ value: string; label: string } | null>(null)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [expandedPoolAddress, setExpandedPoolAddress] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'pools' | 'volume'>('pools')
  const [volumeWindow, setVolumeWindow] = useState<VolumeWindow>('all')
  const {
    snapshot: volumeSnapshot,
    isLoading: isVolumeLoading,
    error: volumeError,
    refresh: refreshVolume,
  } = useManagerVolume(activeTab === 'volume', managerExecutions)

  const volumeSummary = useMemo(() => {
    if (!volumeSnapshot) return null
    const windowMs = VOLUME_WINDOWS.find((item) => item.id === volumeWindow)?.ms ?? null
    const cutoff = windowMs === null ? null : Date.now() - windowMs
    const executions = volumeSnapshot.executions.filter((execution) => cutoff === null || execution.timestamp >= cutoff)
    return {
      executions: executions.length,
      swaps: executions.reduce((total, execution) => total + execution.swaps.length, 0),
    }
  }, [volumeSnapshot, volumeWindow])

  useEffect(() => {
    if (!copiedTarget) return
    const timeoutId = window.setTimeout(() => setCopiedTarget(null), 1600)
    return () => window.clearTimeout(timeoutId)
  }, [copiedTarget])

  const handleCopy = async (value: string, label: string) => {
    try {
      await copyText(value)
      setCopiedTarget({ value, label })
    } catch (copyError) {
      console.error(`Unable to copy ${label.toLowerCase()}`, copyError)
    }
  }

  return (
    <div className={`${styles.sideCard} ${styles.liquidityPoolsCard}`}>
      <div className={styles.liquidityPoolsHeader}>
        <div className={styles.liquidityPoolsHeading}>
          <h3 className={styles.liquidityPoolsTitle}>Liquidity Pools</h3>
          <p className={styles.liquidityPoolsSubtitle}>
            {activeTab === 'volume'
              ? isVolumeLoading
                ? 'Updating recent routes…'
                : volumeSummary
                ? `${volumeSummary.swaps} manager swaps · ${volumeSummary.executions} runs`
                : 'Route activity unavailable'
              : pools.length > 0 ? `${pools.length} manager-routed pairs` : 'Manager-routed pairs'}
          </p>
        </div>
        <div className={styles.liquidityPoolsActions}>
          <div className={styles.liquidityPoolsViewTabs} role="tablist" aria-label="Liquidity pools views">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'pools'}
              className={`${styles.liquidityPoolsTab}${activeTab === 'pools' ? ` ${styles.liquidityPoolsTabActive}` : ''}`}
              onClick={() => {
                setActiveTab('pools')
                setIsInfoOpen(false)
              }}
            >
              Pools
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'volume'}
              className={`${styles.liquidityPoolsTab}${activeTab === 'volume' ? ` ${styles.liquidityPoolsTabActive}` : ''}`}
              onClick={() => {
                setActiveTab('volume')
                setIsInfoOpen(false)
              }}
            >
              Volume
            </button>
          </div>
          <button
            type="button"
            className={`${styles.activityRefreshButton} ${isInfoOpen ? styles.infoButtonActive : ''}`}
            onClick={() => setIsInfoOpen((isOpen) => !isOpen)}
            aria-label={isInfoOpen ? 'Hide Pools and Volume guide' : 'Show Pools and Volume guide'}
            aria-pressed={isInfoOpen}
            title="About Pools and Volume"
          >
            <Info size={16} />
          </button>
          <button
            type="button"
            className={`${styles.activityRefreshButton}${(activeTab === 'pools' ? isLoading : isVolumeLoading) ? ` ${styles.refreshSpinning}` : ''}`}
            onClick={() => void (activeTab === 'pools' ? refresh() : refreshVolume())}
            disabled={activeTab === 'pools' ? isLoading : isVolumeLoading}
            aria-label={activeTab === 'pools' ? 'Refresh pool balances' : 'Reload indexed route volume'}
            title={activeTab === 'pools' ? 'Refresh pool balances' : 'Reload indexed route volume'}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {activeTab === 'pools' ? (
        <>
          {error ? <p className={styles.liquidityPoolsError}>{error}</p> : null}

          <div className={styles.liquidityPoolsPanels}>
            <div
              className={`${styles.liquidityPoolsPanel} ${isInfoOpen ? styles.liquidityPoolsPanelHidden : styles.liquidityPoolsPanelVisible}`}
              aria-hidden={isInfoOpen}
            >
              <div className={styles.liquidityPoolsViewport}>
                {isLoading && pools.length === 0 ? (
                  <div className={styles.liquidityPoolsGrid} aria-label="Loading liquidity pools">
                    {Array.from({ length: 6 }, (_, index) => (
                      <div key={index} className={`${styles.liquidityPoolCard} ${styles.liquidityPoolSkeleton}`} />
                    ))}
                  </div>
                ) : (
                  <div className={styles.liquidityPoolsGrid}>
                    {pools.map((pool) => {
                      const isExpanded = expandedPoolAddress === pool.pairAddress
                      return (
                        <article
                          key={pool.pairAddress}
                          className={`${styles.liquidityPoolCard}${isExpanded ? ` ${styles.liquidityPoolCardExpanded}` : ''}`}
                        >
                          <button
                            type="button"
                            className={styles.liquidityPoolToggle}
                            onClick={() => setExpandedPoolAddress(isExpanded ? null : pool.pairAddress)}
                            aria-expanded={isExpanded}
                            aria-controls={`pool-details-${pool.pairAddress}`}
                            title={isExpanded ? 'Hide pool details' : 'Show pool details'}
                          >
                            <div className={styles.liquidityPoolLogos}>
                              <TokenLogo token={pool.token0} className={styles.liquidityPoolLogo} />
                              <TokenLogo token={pool.token1} className={styles.liquidityPoolLogo} />
                            </div>

                            <strong className={styles.liquidityPoolName}>
                              {pool.token0.symbol}/{pool.token1.symbol}
                            </strong>

                            <div className={styles.liquidityPoolSummary}>
                              <strong className={styles.liquidityPoolValue}>{formatLiquidity(pool.liquidityUSD)}</strong>
                              <ChevronDown
                                size={14}
                                className={`${styles.liquidityPoolChevron}${isExpanded ? ` ${styles.liquidityPoolChevronOpen}` : ''}`}
                                aria-hidden="true"
                              />
                            </div>
                          </button>

                          <div
                            id={`pool-details-${pool.pairAddress}`}
                            className={`${styles.liquidityPoolExpandedDetails}${isExpanded ? ` ${styles.liquidityPoolExpandedDetailsOpen}` : ''}`}
                            aria-hidden={!isExpanded}
                          >
                            <div className={styles.liquidityPoolExpandedInner}>
                              {[pool.token0, pool.token1].map((token) => (
                                <div key={token.address} className={styles.liquidityPoolDetailRow}>
                                  <span className={styles.liquidityPoolDetailLabel}>{token.symbol}</span>
                                  <code title={token.address}>{formatAddress(token.address)}</code>
                                  <strong className={styles.liquidityPoolDetailBalance}>{formatPoolBalance(token)}</strong>
                                  <button
                                    type="button"
                                    onClick={() => void handleCopy(token.address, `${token.symbol} address`)}
                                    className={`${styles.liquidityPoolCopyButton}${copiedTarget?.value === token.address ? ` ${styles.liquidityPoolCopyButtonActive}` : ''}`}
                                    aria-label={`Copy ${token.symbol} token address`}
                                    title={`Copy ${token.symbol} address`}
                                  >
                                    {copiedTarget?.value === token.address ? <Check size={11} /> : <Copy size={11} />}
                                  </button>
                                </div>
                              ))}

                              <div className={`${styles.liquidityPoolDetailRow} ${styles.liquidityPoolDetailRowPair}`}>
                                <span className={styles.liquidityPoolDetailLabel}>PAIR</span>
                                <code title={pool.pairAddress}>{formatAddress(pool.pairAddress)}</code>
                                <button
                                  type="button"
                                  onClick={() => void handleCopy(pool.pairAddress, 'Pair address')}
                                  className={`${styles.liquidityPoolCopyButton}${copiedTarget?.value === pool.pairAddress ? ` ${styles.liquidityPoolCopyButtonActive}` : ''}`}
                                  aria-label={`Copy ${pool.token0.symbol}/${pool.token1.symbol} pair address`}
                                  title="Copy pair address"
                                >
                                  {copiedTarget?.value === pool.pairAddress ? <Check size={11} /> : <Copy size={11} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div
              className={`${styles.liquidityPoolsPanel} ${isInfoOpen ? styles.liquidityPoolsPanelVisible : styles.liquidityPoolsPanelHidden}`}
              aria-hidden={!isInfoOpen}
            >
              <LiquidityViewsGuide />
            </div>
          </div>
        </>
      ) : (
        <div className={styles.liquidityPoolsPanels}>
          <div
            className={`${styles.liquidityPoolsPanel} ${styles.volumePanelHost} ${isInfoOpen ? styles.liquidityPoolsPanelHidden : styles.liquidityPoolsPanelVisible}`}
            aria-hidden={isInfoOpen}
          >
            <Suspense fallback={<div className={styles.volumeLoading}>Preparing route volume…</div>}>
              <LiquidityVolumeNetwork
                snapshot={volumeSnapshot}
                isLoading={isVolumeLoading}
                error={volumeError}
                window={volumeWindow}
                onWindowChange={setVolumeWindow}
              />
            </Suspense>
          </div>

          <div
            className={`${styles.liquidityPoolsPanel} ${isInfoOpen ? styles.liquidityPoolsPanelVisible : styles.liquidityPoolsPanelHidden}`}
            aria-hidden={!isInfoOpen}
          >
            <LiquidityViewsGuide />
          </div>
        </div>
      )}

      {copiedTarget ? (
        <div className={styles.pairAddressToast} role="status" aria-live="polite">
          <Check size={15} />
          <span>{copiedTarget.label} copied</span>
        </div>
      ) : null}
    </div>
  )
}

export default ConnectedLiquidityPools
