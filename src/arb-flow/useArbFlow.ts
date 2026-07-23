import { useCallback, useEffect, useRef, useState } from 'react'
import { getPublicClient } from '@wagmi/core'
import { config, pulseChain } from '@/config/wagmi'
import {
  DIVINE_MANAGER_ADDRESS,
  DIVINE_MANAGER_ADDRESSES,
  DIVINE_MANAGER_ABI,
  JIT_ADDRESS,
} from '@/config/contracts'
import { buildArbFlow, BuildContext } from '@/arb-flow/buildArbFlow'
import { PoolResolver, ResolveClient } from '@/arb-flow/resolvePool'
import { TokenResolver } from '@/arb-flow/resolveToken'
import type { ArbFlow } from '@/arb-flow/types'

interface UseArbFlowState {
  flow: ArbFlow | null
  isLoading: boolean
  error: string | null
}

// A confirmed tx's arb flow is immutable, so cache built flows per tx hash for
// the page session. Reopening a "View flow" panel (or revisiting one) then shows
// instantly instead of re-running all the RPC fetches + pool/token resolution.
const flowCache = new Map<string, ArbFlow>()
const FLOW_CACHE_MAX = 50

export const useArbFlow = (txHash: string | null) => {
  const [state, setState] = useState<UseArbFlowState>(() => {
    const cached = txHash ? flowCache.get(txHash.toLowerCase()) : null
    return { flow: cached ?? null, isLoading: false, error: null }
  })
  const currentHashRef = useRef<string | null>(null)

  const fetchFlow = useCallback(async (hash: string) => {
    const cacheKey = hash.toLowerCase()
    const cached = flowCache.get(cacheKey)
    if (cached) {
      setState({ flow: cached, isLoading: false, error: null })
      return
    }
    setState({ flow: null, isLoading: true, error: null })

    try {
      const publicClient = getPublicClient(config, { chainId: pulseChain.id })
      if (!publicClient) {
        throw new Error('Public client not available')
      }

      const [tx, receipt] = await Promise.all([
        publicClient.getTransaction({ hash: hash as `0x${string}` }),
        publicClient.getTransactionReceipt({ hash: hash as `0x${string}` }),
      ])
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber })
      const managerAddress =
        DIVINE_MANAGER_ADDRESSES.find((address) =>
          receipt.logs.some((log) => log.address.toLowerCase() === address.toLowerCase())
        ) ?? DIVINE_MANAGER_ADDRESS

      let splitDestination: string | null = null
      try {
        splitDestination = (await publicClient.readContract({
          address: managerAddress,
          abi: DIVINE_MANAGER_ABI,
          functionName: 'splitDestination',
        })) as string
      } catch {
        splitDestination = null
      }

      const clientAdapter: ResolveClient = {
        readContract: (args) =>
          publicClient.readContract(args as Parameters<typeof publicClient.readContract>[0]) as Promise<unknown>,
      }

      const ctx: BuildContext = {
        managerAddress,
        jitCompilerAddress: JIT_ADDRESS,
        splitDestination,
        poolResolver: new PoolResolver(clientAdapter),
        tokenResolver: new TokenResolver(clientAdapter),
      }

      const { flow } = await buildArbFlow(
        {
          txHash: hash,
          blockNumber: receipt.blockNumber,
          timestamp: Number(block.timestamp) * 1000,
          input: tx.input,
          logs: receipt.logs.map((log) => ({
            address: log.address,
            topics: log.topics as readonly string[],
            data: log.data,
            logIndex: log.logIndex,
          })),
          from: tx.from,
        },
        ctx
      )

      flowCache.set(cacheKey, flow)
      if (flowCache.size > FLOW_CACHE_MAX) {
        const oldestKey = flowCache.keys().next().value
        if (oldestKey !== undefined) flowCache.delete(oldestKey)
      }
      setState({ flow, isLoading: false, error: null })
    } catch (err) {
      setState({
        flow: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load arb flow',
      })
    }
  }, [])

  useEffect(() => {
    if (!txHash) {
      setState({ flow: null, isLoading: false, error: null })
      return
    }
    if (currentHashRef.current === txHash) return
    currentHashRef.current = txHash
    void fetchFlow(txHash)
  }, [txHash, fetchFlow])

  return state
}
