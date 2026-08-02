import { useCallback, useEffect, useState } from 'react'
import type { V2ProfitSettlement } from '@/lib/divineManagerV2'
import { getSharedArchiveClient, mergeItemsByTransactionHash } from '@/lib/sharedArchive'

export type StepToken = 'HOLYC' | 'JIT' | 'WPLS' | 'UNKNOWN'
export type StepType = 'compile' | 'restore' | 'swap' | 'rebalance'
export type PoolKey = 'HOLYC_WPLS' | 'JIT_WPLS' | 'HOLYC_JIT'
export type ActivitySource = 'divine-manager' | 'feeder-bot'
export type FeederRoute = 'hc-start-jit-gain' | 'jit-start-hc-gain'
export type FeederSettlementStatus = 'none' | 'partial' | 'complete'
export type FeederSettlementTxKind = 'swap' | 'burn' | 'partner'

export interface FeederSettlementTransaction {
  hash: `0x${string}`
  nonce: number
  kind: FeederSettlementTxKind
  label: string
  tokenInSymbol: StepToken
  tokenOutSymbol: StepToken
  amountIn: bigint
  amountOut: bigint
}

export interface FeederSettlementSummary {
  status: FeederSettlementStatus
  burnedAmount: bigint
  burnInputAmount: bigint
  partnerAmount: bigint
  partnerTokenSymbol: 'HOLYC' | 'JIT'
  retainedAmount: bigint
  retainedTokenSymbol: 'HOLYC' | 'JIT'
  transactions: FeederSettlementTransaction[]
}

export interface DivineManagerStep {
  id: string
  type: StepType
  label: string
  tokenInSymbol: StepToken
  tokenOutSymbol: StepToken
  tokenInAmount: bigint
  tokenOutAmount: bigint
  pool?: PoolKey
  isSettlement?: boolean
  settlementAmount?: bigint
  burns: { holyc: bigint; jit: bigint }
}

interface BaseActivityExecution {
  source: ActivitySource
  transactionHash: `0x${string}`
  blockNumber: bigint
  timestamp: number
  steps: DivineManagerStep[]
}

export interface DivineManagerExecution extends BaseActivityExecution {
  source: 'divine-manager'
  managerAddress: `0x${string}`
  strategyId: string
  jobNonce: string
  holyBurned: bigint
  jitBurned: bigint
  holyIn: bigint
  holyOut: bigint
  jitIn: bigint
  jitOut: bigint
  wplsIn: bigint
  wplsOut: bigint
  v2Settlement: V2ProfitSettlement | null
}

export interface FeederArbExecution extends BaseActivityExecution {
  source: 'feeder-bot'
  route: FeederRoute
  loopTransactionHashes: `0x${string}`[]
  netTokenSymbol: 'HOLYC' | 'JIT'
  netTokenAmount: bigint
  effectiveHolyBurned: bigint
  directHolyBurned: bigint
  compilerFeeHolyc: bigint
  jitTransferTaxBurned: bigint
  jitRestorePrincipalBurned: bigint
  settlement: FeederSettlementSummary
}

export type ActivityExecution = DivineManagerExecution | FeederArbExecution

type CachedStep = {
  id?: string
  type?: StepType
  label?: string
  tokenInSymbol?: StepToken
  tokenOutSymbol?: StepToken
  tokenInAmount?: string
  tokenOutAmount?: string
  pool?: PoolKey
  isSettlement?: boolean
  settlementAmount?: string
  burns?: { holyc?: string; jit?: string }
}

type CachedV2Settlement = {
  status?: V2ProfitSettlement['status']
  jobNonce?: string | null
  asset?: number | null
  grossProfit?: string
  protectedProfit?: string
  shareableProfit?: string
  totalAllocated?: string
  retainedProfit?: string
  allocations?: Array<{
    recipient?: string
    recipientLabel?: string
    sourceAsset?: number
    paidAsset?: number
    sourceAmount?: string
    paidAmount?: string
    bps?: number
  }>
  warnings?: string[]
}

type CachedActivity = {
  source?: ActivitySource
  transactionHash?: string
  blockNumber?: string | number
  timestamp?: number
  steps?: CachedStep[]
  managerAddress?: string
  strategyId?: string
  jobNonce?: string
  holyBurned?: string
  jitBurned?: string
  holyIn?: string
  holyOut?: string
  jitIn?: string
  jitOut?: string
  wplsIn?: string
  wplsOut?: string
  v2Settlement?: CachedV2Settlement | null
  route?: FeederRoute
  loopTransactionHashes?: string[]
  netTokenSymbol?: 'HOLYC' | 'JIT'
  netTokenAmount?: string
  effectiveHolyBurned?: string
  directHolyBurned?: string
  compilerFeeHolyc?: string
  jitTransferTaxBurned?: string
  jitRestorePrincipalBurned?: string
  settlement?: {
    status?: FeederSettlementStatus
    burnedAmount?: string
    burnInputAmount?: string
    partnerAmount?: string
    partnerTokenSymbol?: 'HOLYC' | 'JIT'
    retainedAmount?: string
    retainedTokenSymbol?: 'HOLYC' | 'JIT'
    transactions?: Array<{
      hash?: string
      nonce?: number
      kind?: FeederSettlementTxKind
      label?: string
      tokenInSymbol?: StepToken
      tokenOutSymbol?: StepToken
      amountIn?: string
      amountOut?: string
    }>
  }
}

type StaticActivitySnapshot = { indexedThroughBlock?: string; items?: CachedActivity[] }
type ActivityCache = { executions: ActivityExecution[]; lastUpdated: number }

let cachedActivity: ActivityCache | null = null
const HOUR_MS = 60 * 60 * 1000
const asBigInt = (value: string | number | undefined) => BigInt(value ?? 0)

const hydrateSteps = (steps: CachedStep[] | undefined): DivineManagerStep[] =>
  (steps ?? []).flatMap((step) => {
    if (!step.id || !step.type || !step.label || !step.tokenInSymbol || !step.tokenOutSymbol) return []
    try {
      return [{
        id: step.id,
        type: step.type,
        label: step.label,
        tokenInSymbol: step.tokenInSymbol,
        tokenOutSymbol: step.tokenOutSymbol,
        tokenInAmount: asBigInt(step.tokenInAmount),
        tokenOutAmount: asBigInt(step.tokenOutAmount),
        ...(step.pool ? { pool: step.pool } : {}),
        ...(step.isSettlement ? { isSettlement: true } : {}),
        ...(step.settlementAmount ? { settlementAmount: asBigInt(step.settlementAmount) } : {}),
        burns: { holyc: asBigInt(step.burns?.holyc), jit: asBigInt(step.burns?.jit) },
      }]
    } catch {
      return []
    }
  })

const hydrateSettlement = (value: CachedV2Settlement | null | undefined): V2ProfitSettlement | null => {
  if (!value) return null
  try {
    return {
      status: value.status ?? 'missing',
      jobNonce: (value.jobNonce ?? null) as `0x${string}` | null,
      asset: value.asset === 0 || value.asset === 1 || value.asset === 2 ? value.asset : null,
      grossProfit: asBigInt(value.grossProfit),
      protectedProfit: asBigInt(value.protectedProfit),
      shareableProfit: asBigInt(value.shareableProfit),
      totalAllocated: asBigInt(value.totalAllocated),
      retainedProfit: asBigInt(value.retainedProfit),
      allocations: (value.allocations ?? []).flatMap((allocation) => {
        if (!allocation.recipient || allocation.sourceAsset === undefined || allocation.paidAsset === undefined) return []
        if (![0, 1, 2].includes(allocation.sourceAsset) || ![0, 1, 2].includes(allocation.paidAsset)) return []
        return [{
          recipient: allocation.recipient as `0x${string}`,
          recipientLabel: allocation.recipientLabel ?? allocation.recipient,
          sourceAsset: allocation.sourceAsset as 0 | 1 | 2,
          paidAsset: allocation.paidAsset as 0 | 1 | 2,
          sourceAmount: asBigInt(allocation.sourceAmount),
          paidAmount: asBigInt(allocation.paidAmount),
          bps: allocation.bps ?? 0,
        }]
      }),
      warnings: value.warnings ?? [],
    }
  } catch {
    return null
  }
}

const hydrateActivity = (value: CachedActivity): ActivityExecution | null => {
  if (!value.source || !value.transactionHash || value.blockNumber === undefined || !Number.isFinite(value.timestamp)) return null
  try {
    const base = {
      transactionHash: value.transactionHash as `0x${string}`,
      blockNumber: asBigInt(value.blockNumber),
      timestamp: value.timestamp!,
      steps: hydrateSteps(value.steps),
    }
    if (value.source === 'divine-manager' && value.managerAddress) {
      return {
        ...base,
        source: 'divine-manager',
        managerAddress: value.managerAddress as `0x${string}`,
        strategyId: value.strategyId ?? '0x',
        jobNonce: value.jobNonce ?? '0x',
        holyBurned: asBigInt(value.holyBurned),
        jitBurned: asBigInt(value.jitBurned),
        holyIn: asBigInt(value.holyIn),
        holyOut: asBigInt(value.holyOut),
        jitIn: asBigInt(value.jitIn),
        jitOut: asBigInt(value.jitOut),
        wplsIn: asBigInt(value.wplsIn),
        wplsOut: asBigInt(value.wplsOut),
        v2Settlement: hydrateSettlement(value.v2Settlement),
      }
    }
    if (value.source === 'feeder-bot' && value.route && value.netTokenSymbol && value.settlement) {
      return {
        ...base,
        source: 'feeder-bot',
        route: value.route,
        loopTransactionHashes: (value.loopTransactionHashes ?? []) as `0x${string}`[],
        netTokenSymbol: value.netTokenSymbol,
        netTokenAmount: asBigInt(value.netTokenAmount),
        effectiveHolyBurned: asBigInt(value.effectiveHolyBurned),
        directHolyBurned: asBigInt(value.directHolyBurned),
        compilerFeeHolyc: asBigInt(value.compilerFeeHolyc),
        jitTransferTaxBurned: asBigInt(value.jitTransferTaxBurned),
        jitRestorePrincipalBurned: asBigInt(value.jitRestorePrincipalBurned),
        settlement: {
          status: value.settlement.status ?? 'none',
          burnedAmount: asBigInt(value.settlement.burnedAmount),
          burnInputAmount: asBigInt(value.settlement.burnInputAmount),
          partnerAmount: asBigInt(value.settlement.partnerAmount),
          partnerTokenSymbol: value.settlement.partnerTokenSymbol ?? 'HOLYC',
          retainedAmount: asBigInt(value.settlement.retainedAmount),
          retainedTokenSymbol: value.settlement.retainedTokenSymbol ?? 'HOLYC',
          transactions: (value.settlement.transactions ?? []).flatMap((transaction) => {
            if (!transaction.hash || transaction.nonce === undefined || !transaction.kind || !transaction.label || !transaction.tokenInSymbol || !transaction.tokenOutSymbol) return []
            return [{
              hash: transaction.hash as `0x${string}`,
              nonce: transaction.nonce,
              kind: transaction.kind,
              label: transaction.label,
              tokenInSymbol: transaction.tokenInSymbol,
              tokenOutSymbol: transaction.tokenOutSymbol,
              amountIn: asBigInt(transaction.amountIn),
              amountOut: asBigInt(transaction.amountOut),
            }]
          }),
        },
      }
    }
  } catch {
    return null
  }
  return null
}

export const useDivineManagerActivity = () => {
  const [executions, setExecutions] = useState<ActivityExecution[]>(cachedActivity?.executions ?? [])
  const [isLoading, setIsLoading] = useState(!cachedActivity)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(cachedActivity?.lastUpdated ?? null)

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    setError(null)
    try {
      const [divineArchive, feederArchive] = await Promise.all([
        getSharedArchiveClient().loadArchive<StaticActivitySnapshot>('divineManager'),
        getSharedArchiveClient().loadArchive<StaticActivitySnapshot>('feeder'),
      ])
      const next = [
        ...mergeItemsByTransactionHash(divineArchive.base?.items ?? [], divineArchive.chunks),
        ...mergeItemsByTransactionHash(feederArchive.base?.items ?? [], feederArchive.chunks),
      ]
        .flatMap(hydrateActivity)
        .sort((left, right) => Number(right.blockNumber - left.blockNumber) || right.timestamp - left.timestamp)
      const updatedAt = Date.now()
      cachedActivity = { executions: next, lastUpdated: updatedAt }
      setExecutions(next)
      setLastUpdated(updatedAt)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load shared Divine Manager archive')
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh(Boolean(cachedActivity))
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh(true)
    }, HOUR_MS)
    return () => window.clearInterval(interval)
  }, [refresh])

  return {
    executions,
    isLoading,
    isLoadingMore: false,
    hasMore: false,
    error,
    lastUpdated,
    refresh: () => refresh(false),
    loadMore: () => Promise.resolve(),
  }
}
