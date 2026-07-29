import { useCallback, useEffect, useRef, useState } from 'react'
import { getPublicClient } from '@wagmi/core'
import { config, pulseChain } from '@/config/wagmi'
import type { ActivityExecution } from '@/hooks/useDivineManagerActivity'

const VOLUME_SNAPSHOT_URL = `${import.meta.env.BASE_URL}divine-manager-volume.json`
const SWAP_TOPIC = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'

export type VolumeToken = {
  address: string
  symbol: string
  decimals: number
}

export type VolumePool = {
  pairAddress: string
  token0: VolumeToken
  token1: VolumeToken
  executionCount: number
}

export type VolumeSwap = {
  poolAddress: string
  tokenIn: string
  amountIn: string
  tokenOut: string
  amountOut: string
}

export type VolumeExecution = {
  transactionHash: string
  timestamp: number
  swaps: VolumeSwap[]
  route: string[]
}

export type VolumeSnapshot = {
  schemaVersion: number
  generatedAt: string
  sourceIndexedThroughBlock: string
  pools: VolumePool[]
  executions: VolumeExecution[]
}

const decodeSwapAmounts = (data: string) => {
  if (!/^0x[0-9a-fA-F]{256}$/.test(data)) return null
  try {
    const word = (index: number) => BigInt(`0x${data.slice(2 + index * 64, 2 + (index + 1) * 64)}`)
    return {
      amount0In: word(0),
      amount1In: word(1),
      amount0Out: word(2),
      amount1Out: word(3),
    }
  } catch {
    return null
  }
}

const mergeExecutions = (snapshot: VolumeSnapshot, additions: VolumeExecution[]): VolumeSnapshot => ({
  ...snapshot,
  executions: Array.from(
    new Map(
      [...snapshot.executions, ...additions].map((execution) => [execution.transactionHash.toLowerCase(), execution])
    ).values()
  ).sort((left, right) => right.timestamp - left.timestamp),
})

let cachedSnapshot: VolumeSnapshot | null = null

const isSnapshot = (value: unknown): value is VolumeSnapshot => {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as Partial<VolumeSnapshot>
  return Array.isArray(snapshot.pools) && Array.isArray(snapshot.executions)
}

const loadSnapshot = async (): Promise<VolumeSnapshot> => {
  const response = await fetch(VOLUME_SNAPSHOT_URL, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Volume snapshot returned ${response.status}`)
  const snapshot = (await response.json()) as unknown
  if (!isSnapshot(snapshot)) throw new Error('Volume snapshot is invalid')
  return snapshot
}

// Volume is intentionally opt-in: the page does not request this historical
// snapshot until the visitor selects the Volume tab.
export const useManagerVolume = (enabled: boolean, activityExecutions: ActivityExecution[]) => {
  const [snapshot, setSnapshot] = useState<VolumeSnapshot | null>(() => cachedSnapshot)
  const [isLoading, setIsLoading] = useState(false)
  const [isCatchingUp, setIsCatchingUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestInFlight = useRef(false)
  const catchUpInFlight = useRef(false)
  const checkedLiveHashes = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return
    requestInFlight.current = true
    checkedLiveHashes.current.clear()
    setIsLoading(true)
    setError(null)

    try {
      const nextSnapshot = await loadSnapshot()
      setSnapshot((currentSnapshot) => {
        const mergedSnapshot = currentSnapshot
          ? mergeExecutions(nextSnapshot, currentSnapshot.executions)
          : nextSnapshot
        cachedSnapshot = mergedSnapshot
        return mergedSnapshot
      })
    } catch (fetchError) {
      console.error('Unable to load Divine Manager volume snapshot', fetchError)
      setError('Volume data is temporarily unavailable.')
    } finally {
      requestInFlight.current = false
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled || snapshot || requestInFlight.current) return
    void refresh()
  }, [enabled, refresh, snapshot])

  useEffect(() => {
    if (!enabled || !snapshot || catchUpInFlight.current) return

    const knownHashes = new Set(snapshot.executions.map((execution) => execution.transactionHash.toLowerCase()))
    const candidates = activityExecutions
      .filter((execution) => {
        const hash = execution.transactionHash.toLowerCase()
        return execution.source === 'divine-manager' && !knownHashes.has(hash) && !checkedLiveHashes.current.has(hash)
      })
      .sort((left, right) => right.timestamp - left.timestamp)
      .slice(0, 40)
    if (candidates.length === 0) return

    const publicClient = getPublicClient(config, { chainId: pulseChain.id })
    if (!publicClient) return
    candidates.forEach((execution) => checkedLiveHashes.current.add(execution.transactionHash.toLowerCase()))

    catchUpInFlight.current = true
    setIsCatchingUp(true)

    const poolByAddress = new Map(snapshot.pools.map((pool) => [pool.pairAddress.toLowerCase(), pool]))
    void Promise.allSettled(
      candidates.map(async (execution): Promise<VolumeExecution | null> => {
        const receipt = await publicClient.getTransactionReceipt({ hash: execution.transactionHash })
        const swaps = receipt.logs
          .flatMap((log) => {
            const pool = poolByAddress.get(log.address.toLowerCase())
            if (!pool || String(log.topics[0] || '').toLowerCase() !== SWAP_TOPIC) return []
            const amounts = decodeSwapAmounts(log.data)
            if (!amounts) return []

            const tokenIn = amounts.amount0In > 0n ? pool.token0 : amounts.amount1In > 0n ? pool.token1 : null
            const amountIn = amounts.amount0In > 0n ? amounts.amount0In : amounts.amount1In
            const tokenOut = amounts.amount0Out > 0n ? pool.token0 : amounts.amount1Out > 0n ? pool.token1 : null
            const amountOut = amounts.amount0Out > 0n ? amounts.amount0Out : amounts.amount1Out
            if (!tokenIn || !tokenOut || amountIn === 0n || amountOut === 0n) return []

            return [{
              poolAddress: pool.pairAddress,
              tokenIn: tokenIn.address,
              amountIn: amountIn.toString(),
              tokenOut: tokenOut.address,
              amountOut: amountOut.toString(),
              logIndex: Number(log.logIndex ?? 0),
            }]
          })
          .sort((left, right) => left.logIndex - right.logIndex)

        if (swaps.length === 0) return null
        const route = swaps.reduce<string[]>((path, swap) => {
          if (path[path.length - 1] !== swap.poolAddress) path.push(swap.poolAddress)
          return path
        }, [])

        return {
          transactionHash: execution.transactionHash,
          timestamp: execution.timestamp,
          swaps: swaps.map((swap) => ({
            poolAddress: swap.poolAddress,
            tokenIn: swap.tokenIn,
            amountIn: swap.amountIn,
            tokenOut: swap.tokenOut,
            amountOut: swap.amountOut,
          })),
          route,
        }
      })
    ).then((results) => {
      const additions = results.flatMap((result) =>
        result.status === 'fulfilled' && result.value ? [result.value] : []
      )
      if (additions.length === 0) return
      setSnapshot((currentSnapshot) => {
        if (!currentSnapshot) return currentSnapshot
        const mergedSnapshot = mergeExecutions(currentSnapshot, additions)
        cachedSnapshot = mergedSnapshot
        return mergedSnapshot
      })
    }).finally(() => {
      catchUpInFlight.current = false
      setIsCatchingUp(false)
    })
  }, [activityExecutions, enabled, snapshot])

  return { snapshot, isLoading: isLoading || isCatchingUp, error, refresh }
}
