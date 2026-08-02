import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatUnits, getAddress, type Address } from 'viem'
import { getSharedArchiveClient } from '@/lib/sharedArchive'
import type { TokenPrices } from '../UniswapPools/hooks/usePoolData'

const HOLYC_LOWER = '0x6c8fdfd2cec0b83d69045074d57a87fa1525225a'
const JIT_LOWER = '0x57909025ace10d5de114d96e3ec84f282895870c'
const HOUR_MS = 60 * 60 * 1000

type ArchivedPoolToken = { address: string; symbol: string; decimals: number }
type ArchivedPool = {
  pairAddress: string
  token0: ArchivedPoolToken
  token1: ArchivedPoolToken
  executionCount?: number
  reserve0?: string
  reserve1?: string
  reserveTimestamp?: number
}
type ArchivedPoolSnapshot = { items?: ArchivedPool[] }

export type ConnectedPoolToken = {
  address: Address
  symbol: string
  decimals: number
  reserve: bigint
}

export type ConnectedLiquidityPool = {
  pairAddress: Address
  token0: ConnectedPoolToken
  token1: ConnectedPoolToken
  liquidityUSD: number | null
  executionCount: number
}

const isArchivedToken = (value: ArchivedPoolToken | undefined): value is ArchivedPoolToken =>
  Boolean(
    value &&
      /^0x[a-fA-F0-9]{40}$/.test(value.address) &&
      typeof value.symbol === 'string' &&
      value.symbol.trim() &&
      Number.isInteger(value.decimals) &&
      value.decimals >= 0
  )

const hydratePools = (snapshot: ArchivedPoolSnapshot): ConnectedLiquidityPool[] =>
  (snapshot.items ?? []).flatMap((pool) => {
    if (
      !/^0x[a-fA-F0-9]{40}$/.test(pool.pairAddress) ||
      !isArchivedToken(pool.token0) ||
      !isArchivedToken(pool.token1) ||
      typeof pool.reserve0 !== 'string' ||
      typeof pool.reserve1 !== 'string'
    ) {
      return []
    }
    try {
      return [{
        pairAddress: getAddress(pool.pairAddress),
        token0: {
          address: getAddress(pool.token0.address),
          symbol: pool.token0.symbol.trim(),
          decimals: pool.token0.decimals,
          reserve: BigInt(pool.reserve0),
        },
        token1: {
          address: getAddress(pool.token1.address),
          symbol: pool.token1.symbol.trim(),
          decimals: pool.token1.decimals,
          reserve: BigInt(pool.reserve1),
        },
        liquidityUSD: null,
        executionCount: Math.max(0, Math.floor(pool.executionCount ?? 0)),
      }]
    } catch {
      return []
    }
  })

const reserveValue = (reserve: bigint, decimals: number) => Number(formatUnits(reserve, decimals))

const getAnchorUsdPrice = (address: string, tokenPrices: TokenPrices) => {
  const lowerAddress = address.toLowerCase()
  if (lowerAddress === HOLYC_LOWER) return tokenPrices.holycUSD
  if (lowerAddress === JIT_LOWER) return tokenPrices.jitUSD
  return 0
}

const calculateLiquidityUSD = (
  token0: ConnectedPoolToken,
  token1: ConnectedPoolToken,
  tokenPrices: TokenPrices
) => {
  const token0Price = getAnchorUsdPrice(token0.address, tokenPrices)
  const token1Price = getAnchorUsdPrice(token1.address, tokenPrices)
  const token0Value = token0Price > 0 ? reserveValue(token0.reserve, token0.decimals) * token0Price : 0
  const token1Value = token1Price > 0 ? reserveValue(token1.reserve, token1.decimals) * token1Price : 0
  if (token0Price > 0 && token1Price > 0) return token0Value + token1Value
  if (token0Price > 0) return token0Value * 2
  if (token1Price > 0) return token1Value * 2
  return null
}

export const useConnectedLiquidityPools = (tokenPrices: TokenPrices) => {
  const [snapshot, setSnapshot] = useState<ConnectedLiquidityPool[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { value } = await getSharedArchiveClient().loadCurrent<ArchivedPoolSnapshot>('managerPools')
      setSnapshot(hydratePools(value))
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to load shared pool balances right now.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, HOUR_MS)
    return () => window.clearInterval(interval)
  }, [refresh])

  const pools = useMemo(
    () => snapshot
      .map((pool) => ({
        ...pool,
        liquidityUSD: calculateLiquidityUSD(pool.token0, pool.token1, tokenPrices),
      }))
      .sort((poolA, poolB) => (poolB.liquidityUSD ?? -1) - (poolA.liquidityUSD ?? -1)),
    [snapshot, tokenPrices]
  )

  return { pools, isLoading, error, refresh }
}
