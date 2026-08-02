import { useCallback, useEffect, useState } from 'react'
import type { ActivityExecution } from '@/hooks/useDivineManagerActivity'
import { getSharedArchiveClient, type ArchiveChunkV2 } from '@/lib/sharedArchive'

export type VolumeToken = { address: string; symbol: string; decimals: number }
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

const HOUR_MS = 60 * 60 * 1000
let cachedSnapshot: VolumeSnapshot | null = null

const mergeVolume = (base: VolumeSnapshot | null, chunks: ArchiveChunkV2<VolumeExecution>[], generatedAt: string): VolumeSnapshot => {
  if (!base) throw new Error('Shared manager-volume archive is missing its base snapshot')
  const executions = new Map<string, VolumeExecution>()
  for (const execution of [...base.executions, ...chunks.flatMap((chunk) => chunk.items)]) {
    if (execution?.transactionHash) executions.set(execution.transactionHash.toLowerCase(), execution)
  }
  return {
    ...base,
    generatedAt,
    executions: [...executions.values()].sort((left, right) => right.timestamp - left.timestamp),
  }
}

// The second argument remains part of the public hook contract. Archive data is
// now complete at publish time, so it intentionally performs no receipt catch-up.
export const useManagerVolume = (enabled: boolean, activityExecutions: ActivityExecution[]) => {
  void activityExecutions
  const [snapshot, setSnapshot] = useState<VolumeSnapshot | null>(() => cachedSnapshot)
  const [isLoading, setIsLoading] = useState(false)
  const [isCatchingUp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const { base, chunks, manifest } = await getSharedArchiveClient().loadArchive<VolumeSnapshot>('managerVolume')
      const next = mergeVolume(base, chunks, manifest.generatedAt)
      cachedSnapshot = next
      setSnapshot(next)
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Volume data is temporarily unavailable.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, HOUR_MS)
    return () => window.clearInterval(interval)
  }, [enabled, refresh])

  return { snapshot, isLoading, isCatchingUp, error, refresh }
}
