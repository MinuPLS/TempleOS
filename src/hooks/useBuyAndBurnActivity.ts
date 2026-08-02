import { useCallback, useEffect, useState } from 'react'
import {
  BRIAH_TOKEN_ADDRESS,
  COINMAFIA_TOKEN_ADDRESS,
  DUMB_TOKEN_ADDRESS,
  FUPA_TOKEN_ADDRESS,
} from '@/config/contracts'
import { getSharedArchiveClient, type ArchiveChunkV2 } from '@/lib/sharedArchive'

export interface BuyAndBurnExecution {
  transactionHash: string
  tokenBurned: bigint
  jitSpent: bigint
  timestamp: number
  blockNumber: number
  caller: `0x${string}`
}

type BuyAndBurnConfig = {
  cacheKey: string
  snapshotKey: string
  tokenAddress: `0x${string}`
  logLabel: string
}

type CachedBuyAndBurnExecution = {
  transactionHash?: string
  tokenBurned?: string
  jitSpent?: string
  timestamp?: number
  blockNumber?: number | string
  caller?: string
}

type ChunkItem = CachedBuyAndBurnExecution & { feedKey?: string }
type StaticBuyAndBurnSnapshot = {
  indexedThroughBlock?: string
  feeds?: Record<string, { items?: CachedBuyAndBurnExecution[] }>
}

type BurnCache = {
  executions: BuyAndBurnExecution[]
  lastUpdated: number
  tokenUsdPrice: number | null
}

const HOUR_MS = 60 * 60 * 1000
const cacheByKey = new Map<string, BurnCache>()

const BRIAH_CONFIG: BuyAndBurnConfig = {
  cacheKey: 'briah-buy-and-burn',
  snapshotKey: 'briah',
  tokenAddress: BRIAH_TOKEN_ADDRESS,
  logLabel: 'Briah',
}

const COINMAFIA_CONFIG: BuyAndBurnConfig = {
  cacheKey: 'coinmafia-buy-and-burn',
  snapshotKey: 'coinmafia',
  tokenAddress: COINMAFIA_TOKEN_ADDRESS,
  logLabel: 'CoinMafia',
}

const DUMB_CONFIG: BuyAndBurnConfig = {
  cacheKey: 'dumb-buy-and-burn',
  snapshotKey: 'dumb',
  tokenAddress: DUMB_TOKEN_ADDRESS,
  logLabel: 'Dumb',
}

const FUPA_CONFIG: BuyAndBurnConfig = {
  cacheKey: 'fupa-buy-and-burn',
  snapshotKey: 'fupa',
  tokenAddress: FUPA_TOKEN_ADDRESS,
  logLabel: 'FUPA',
}

const hydrate = (value: CachedBuyAndBurnExecution): BuyAndBurnExecution | null => {
  const blockNumber = Number(value.blockNumber)
  if (!value.transactionHash || !value.caller || !Number.isFinite(value.timestamp) || !Number.isSafeInteger(blockNumber)) return null
  try {
    return {
      transactionHash: value.transactionHash,
      tokenBurned: BigInt(value.tokenBurned ?? '0'),
      jitSpent: BigInt(value.jitSpent ?? '0'),
      timestamp: value.timestamp!,
      blockNumber,
      caller: value.caller as `0x${string}`,
    }
  } catch {
    return null
  }
}

const mergeArchive = (
  snapshotKey: string,
  base: StaticBuyAndBurnSnapshot | null,
  chunks: ArchiveChunkV2<ChunkItem>[]
) => {
  const records = [
    ...(base?.feeds?.[snapshotKey]?.items ?? []),
    ...chunks.flatMap((chunk) => chunk.items.filter((item) => item.feedKey === snapshotKey)),
  ]
  const byHash = new Map<string, BuyAndBurnExecution>()
  for (const record of records) {
    const execution = hydrate(record)
    if (execution) byHash.set(execution.transactionHash.toLowerCase(), execution)
  }
  return [...byHash.values()].sort((left, right) => right.timestamp - left.timestamp)
}

const fetchDexscreenerTokenUsdPrice = async (tokenAddress: `0x${string}`) => {
  const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`)
  if (!response.ok) return null
  const body = await response.json() as { pairs?: Array<{ chainId?: string; priceUsd?: string; liquidity?: { usd?: number | string } }> }
  const pairs = (body.pairs ?? []).filter((pair) => pair.chainId === 'pulsechain')
  const best = pairs.reduce<typeof pairs[number] | null>((current, pair) => {
    const currentLiquidity = Number(current?.liquidity?.usd ?? 0)
    return Number(pair.liquidity?.usd ?? 0) > currentLiquidity ? pair : current
  }, null)
  const price = Number(best?.priceUsd)
  return Number.isFinite(price) && price > 0 ? price : null
}

const useBuyAndBurnActivityBase = (config: BuyAndBurnConfig) => {
  const cached = cacheByKey.get(config.cacheKey)
  const [executions, setExecutions] = useState<BuyAndBurnExecution[]>(cached?.executions ?? [])
  const [isLoading, setIsLoading] = useState(!cached)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(cached?.lastUpdated ?? null)
  const [tokenUsdPrice, setTokenUsdPrice] = useState<number | null>(cached?.tokenUsdPrice ?? null)

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    setError(null)
    try {
      const [{ base, chunks, manifest }, price] = await Promise.all([
        getSharedArchiveClient().loadArchive<StaticBuyAndBurnSnapshot>('buyAndBurn'),
        fetchDexscreenerTokenUsdPrice(config.tokenAddress).catch(() => null),
      ])
      const next = mergeArchive(config.snapshotKey, base, chunks)
      const updatedAt = Date.parse(manifest.generatedAt) || Date.now()
      const nextCache = { executions: next, lastUpdated: updatedAt, tokenUsdPrice: price }
      cacheByKey.set(config.cacheKey, nextCache)
      setExecutions(next)
      setLastUpdated(updatedAt)
      setTokenUsdPrice(price)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : `Failed to load ${config.logLabel} archive`)
    } finally {
      if (!silent) setIsLoading(false)
    }
  }, [config.cacheKey, config.logLabel, config.snapshotKey, config.tokenAddress])

  useEffect(() => {
    void refresh(Boolean(cached))
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh(true)
    }, HOUR_MS)
    return () => window.clearInterval(interval)
  }, [cached, refresh])

  return {
    executions,
    isLoading,
    isLoadingMore: false,
    hasMore: false,
    error,
    refresh: () => refresh(false),
    silentRefresh: () => refresh(true),
    loadMore: () => Promise.resolve(),
    lastUpdated,
    tokenUsdPrice,
  }
}

export const useBuyAndBurnActivity = () => useBuyAndBurnActivityBase(BRIAH_CONFIG)
export const useCoinMafiaBuyAndBurnActivity = () => useBuyAndBurnActivityBase(COINMAFIA_CONFIG)
export const useDumbBuyAndBurnActivity = () => useBuyAndBurnActivityBase(DUMB_CONFIG)
export const useFupaBuyAndBurnActivity = () => useBuyAndBurnActivityBase(FUPA_CONFIG)
