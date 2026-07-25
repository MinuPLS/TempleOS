import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPublicClient } from '@wagmi/core'
import { formatUnits, getAddress, type Address } from 'viem'
import { UNISWAP_V2_PAIR_ABI } from '@/config/contracts'
import { config, pulseChain } from '@/config/wagmi'
import type { TokenPrices } from '../UniswapPools/hooks/usePoolData'

const POOL_ARCHIVE_URL = `${import.meta.env.BASE_URL}divine-manager-pools.json`
const HOLYC_LOWER = '0x6c8fdfd2cec0b83d69045074d57a87fa1525225a'
const JIT_LOWER = '0x57909025ace10d5de114d96e3ec84f282895870c'

type ArchivedPoolToken = {
  address: string
  symbol: string
  decimals: number
}

type ArchivedPool = {
  pairAddress: string
  token0: ArchivedPoolToken
  token1: ArchivedPoolToken
  executionCount?: number
}

type ArchivedPoolSnapshot = {
  schemaVersion?: number
  sourceIndexedThroughBlock?: string
  items?: ArchivedPool[]
}

type PairIdentity = {
  pairAddress: Address
  token0: Omit<ConnectedPoolToken, 'reserve'>
  token1: Omit<ConnectedPoolToken, 'reserve'>
  executionCount: number
}

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

type PoolSnapshot = {
  pairs: PairIdentity[]
  reserves: Map<string, readonly [bigint, bigint, number]>
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

const fetchArchivedPairs = async (): Promise<PairIdentity[]> => {
  const response = await fetch(POOL_ARCHIVE_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Pool archive returned ${response.status}`)
  const snapshot = (await response.json()) as ArchivedPoolSnapshot
  if (!Array.isArray(snapshot.items)) throw new Error('Pool archive payload is invalid')

  return snapshot.items.flatMap((pool) => {
    if (
      !/^0x[a-fA-F0-9]{40}$/.test(pool.pairAddress) ||
      !isArchivedToken(pool.token0) ||
      !isArchivedToken(pool.token1)
    ) {
      return []
    }

    return [
      {
        pairAddress: getAddress(pool.pairAddress),
        token0: {
          address: getAddress(pool.token0.address),
          symbol: pool.token0.symbol.trim(),
          decimals: pool.token0.decimals,
        },
        token1: {
          address: getAddress(pool.token1.address),
          symbol: pool.token1.symbol.trim(),
          decimals: pool.token1.decimals,
        },
        executionCount: Math.max(0, Math.floor(pool.executionCount ?? 0)),
      },
    ]
  })
}

const fetchPoolSnapshot = async (
  publicClient: NonNullable<ReturnType<typeof getPublicClient>>
): Promise<PoolSnapshot> => {
  const pairs = await fetchArchivedPairs()
  const reserveResults = await publicClient.multicall({
    allowFailure: true,
    contracts: pairs.map((pair) => ({
      address: pair.pairAddress,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'getReserves',
    })),
  })

  const reserves = new Map<string, readonly [bigint, bigint, number]>()
  reserveResults.forEach((result, index) => {
    if (result.status !== 'success' || !Array.isArray(result.result)) return
    const [reserve0, reserve1, timestamp] = result.result
    if (typeof reserve0 !== 'bigint' || typeof reserve1 !== 'bigint') return
    reserves.set(pairs[index].pairAddress.toLowerCase(), [
      reserve0,
      reserve1,
      typeof timestamp === 'number' ? timestamp : Number(timestamp),
    ])
  })

  return { pairs, reserves }
}

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
  const [snapshot, setSnapshot] = useState<PoolSnapshot | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isMountedRef = useRef(true)
  const isFetchingRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      const publicClient = getPublicClient(config, { chainId: pulseChain.id })
      if (!publicClient) throw new Error('PulseChain public client is unavailable')
      const nextSnapshot = await fetchPoolSnapshot(publicClient)
      if (isMountedRef.current) setSnapshot(nextSnapshot)
    } catch (fetchError) {
      console.error('Unable to refresh archived Divine Manager pools', fetchError)
      if (isMountedRef.current) setError('Unable to refresh pool balances right now.')
    } finally {
      isFetchingRef.current = false
      if (isMountedRef.current) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const pools = useMemo<ConnectedLiquidityPool[]>(() => {
    if (!snapshot) return []

    return snapshot.pairs
      .flatMap((pair) => {
        const pairReserves = snapshot.reserves.get(pair.pairAddress.toLowerCase())
        if (!pairReserves) return []
        const token0: ConnectedPoolToken = { ...pair.token0, reserve: pairReserves[0] }
        const token1: ConnectedPoolToken = { ...pair.token1, reserve: pairReserves[1] }
        return [
          {
            pairAddress: pair.pairAddress,
            token0,
            token1,
            liquidityUSD: calculateLiquidityUSD(token0, token1, tokenPrices),
            executionCount: pair.executionCount,
          },
        ]
      })
      .sort((poolA, poolB) => (poolB.liquidityUSD ?? -1) - (poolA.liquidityUSD ?? -1))
  }, [snapshot, tokenPrices])

  return { pools, isLoading, error, refresh }
}
