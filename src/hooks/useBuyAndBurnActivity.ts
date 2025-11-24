import { useCallback, useEffect, useRef, useState } from 'react'
import { getPublicClient } from '@wagmi/core'
import { config, pulseChain } from '@/config/wagmi'

export interface BuyAndBurnExecution {
  transactionHash: string
  briahBurned: bigint
  jitSpent: bigint
  timestamp: number
  blockNumber: number
  caller: `0x${string}`
}

const BUY_AND_BURN_CONTRACT = '0x7DA770d10B6a62Fc9DC5A9682bDF2849d2b617d4' as const
const BRIAH_TOKEN = '0xA80736067abDc215a3b6B66a57c6e608654d0C9a' as const
const DEXSCREENER_ENDPOINT = `https://api.dexscreener.com/latest/dex/tokens/${BRIAH_TOKEN}`
const BUY_AND_BURN_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'caller', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'jitSpent', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'briahBurned', type: 'uint256' },
    ],
    name: 'BuyAndBurn',
    type: 'event',
  },
] as const

const BLOCK_CHUNK = 2_500n
const MIN_BLOCK_CHUNK = 250n
const TARGET_EXECUTION_COUNT = 100 // 20 pages * 5 items per page
const MAX_BATCHES_PER_FETCH = 40 // Increased to cover same range with smaller chunks
const EMPTY_BATCH_MULTIPLIER = 4
const RETRY_DELAY_MS = 300
const MAX_RETRIES = 3
const REFRESH_INTERVAL = 300_000

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const withRetry = async <T>(fn: () => Promise<T>, retries = MAX_RETRIES, delayMs = RETRY_DELAY_MS): Promise<T> => {
  let attempt = 0
  for (;;) {
    try {
      return await fn()
    } catch (error) {
      attempt += 1
      if (attempt > retries) {
        throw error
      }
      await sleep(delayMs * attempt)
    }
  }
}

export const useBuyAndBurnActivity = () => {
  const [executions, setExecutions] = useState<BuyAndBurnExecution[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [briahUsdPrice, setBriahUsdPrice] = useState<number | null>(null)
  const [nextFromBlock, setNextFromBlock] = useState<bigint | null>(null)
  const executionsRef = useRef<BuyAndBurnExecution[]>([])
  const nextFromBlockRef = useRef<bigint | null>(null)
  const isFetchingRef = useRef(false)

  useEffect(() => {
    executionsRef.current = executions
  }, [executions])

  useEffect(() => {
    nextFromBlockRef.current = nextFromBlock
  }, [nextFromBlock])

  const fetchPrice = useCallback(async () => {
    try {
      const priceResponse = await fetch(DEXSCREENER_ENDPOINT)
      if (priceResponse.ok) {
        const priceJson = await priceResponse.json()
        const price = priceJson?.pairs?.find((pair: { priceUsd?: string }) => pair?.priceUsd)?.priceUsd
        const parsedPrice = price ? Number(price) : null
        if (parsedPrice && Number.isFinite(parsedPrice)) {
          setBriahUsdPrice(parsedPrice)
        }
      }
    } catch (priceError) {
      console.error('Error fetching BRIAH price:', priceError)
    }
  }, [])

  const fetchData = useCallback(
    async ({
      reset = false,
      loadMore = false,
      silent = false,
      targetCount = TARGET_EXECUTION_COUNT,
    }: { reset?: boolean; loadMore?: boolean; silent?: boolean; targetCount?: number } = {}) => {
      console.log('fetchData (BuyAndBurn) called', { reset, loadMore, silent, isFetching: isFetchingRef.current })
      if (isFetchingRef.current) {
        console.log('fetchData blocked by lock')
        return
      }

      isFetchingRef.current = true
      if (loadMore) {
        setIsLoadingMore(true)
      } else if (!silent) {
        setIsLoading(true)
      }
      setError(null)

      try {
        const publicClient = getPublicClient(config, { chainId: pulseChain.id })
        if (!publicClient) throw new Error('Public client not available')

        const latestBlock = await withRetry(() => publicClient.getBlockNumber())
        const cursor = nextFromBlockRef.current
        if (loadMore && cursor === null) {
          setHasMore(false)
          return
        }
        let toBlock = loadMore && cursor !== null ? cursor : latestBlock
        if (toBlock < 0n) {
          setHasMore(false)
          return
        }

        const executionMap = reset
          ? new Map<string, BuyAndBurnExecution>()
          : new Map(executionsRef.current.map((burn) => [burn.transactionHash, burn]))
        const desiredCount = Math.max(targetCount, executionMap.size + 5)
        const isPrimingFetch = !loadMore && executionMap.size === 0
        const batchLimit = isPrimingFetch ? MAX_BATCHES_PER_FETCH * EMPTY_BATCH_MULTIPLIER : MAX_BATCHES_PER_FETCH

        let localNextFrom: bigint | null = null
        let batches = 0
        let currentChunk = BLOCK_CHUNK

        while (toBlock >= 0n && batches < batchLimit && executionMap.size < desiredCount) {
          const fromBlock = toBlock >= currentChunk ? toBlock - currentChunk + 1n : 0n
          let logs
          try {
            logs = await withRetry(
              () =>
                publicClient.getContractEvents({
                  address: BUY_AND_BURN_CONTRACT,
                  abi: BUY_AND_BURN_ABI,
                  eventName: 'BuyAndBurn',
                  fromBlock,
                  toBlock,
                }),
              MAX_RETRIES
            )
            if (currentChunk < BLOCK_CHUNK) {
              const grown = currentChunk * 2n
              currentChunk = grown > BLOCK_CHUNK ? BLOCK_CHUNK : grown
            }
          } catch (logError) {
            console.warn(`Failed to fetch Buy & Burn logs for range ${fromBlock} - ${toBlock}`, logError)
            if (currentChunk > MIN_BLOCK_CHUNK) {
              let nextChunk = currentChunk / 2n
              if (nextChunk < MIN_BLOCK_CHUNK) {
                nextChunk = MIN_BLOCK_CHUNK
              }
              currentChunk = nextChunk
              continue
            }
            throw logError
          }

          if (logs.length === 0) {
            localNextFrom = fromBlock > 0n ? fromBlock - 1n : null
            toBlock = localNextFrom ?? -1n
            batches += 1
            continue
          }

          const uniqueBlockNumbers = Array.from(new Set(logs.map((log) => log.blockNumber ?? toBlock)))
          // Chunk block fetching to avoid RPC limits
          const chunks = []
          const CHUNK_SIZE = 3
          for (let i = 0; i < uniqueBlockNumbers.length; i += CHUNK_SIZE) {
            chunks.push(uniqueBlockNumbers.slice(i, i + CHUNK_SIZE))
          }

          const blockTimestamps = new Map<bigint, number>()

          for (const chunk of chunks) {
            const blockResults = await Promise.allSettled(
              chunk.map((blockNumber) => withRetry(() => publicClient.getBlock({ blockNumber }), MAX_RETRIES))
            )
            
            blockResults.forEach((result) => {
              if (result.status === 'fulfilled') {
                const blockNumber = result.value.number ?? 0n
                blockTimestamps.set(blockNumber, Number(result.value.timestamp) * 1000)
              }
            })
          }

          logs.forEach((log) => {
            const blockNumber = log.blockNumber ?? toBlock
            const timestamp = blockTimestamps.get(blockNumber) ?? Date.now()
            const briahBurned = log.args?.briahBurned ? BigInt(log.args.briahBurned) : 0n
            const jitSpent = log.args?.jitSpent ? BigInt(log.args.jitSpent) : 0n
            const caller = (log.args?.caller as `0x${string}`) ?? '0x0000000000000000000000000000000000000000'

            executionMap.set(log.transactionHash, {
              transactionHash: log.transactionHash,
              briahBurned,
              jitSpent,
              timestamp,
              blockNumber: Number(blockNumber),
              caller,
            })
          })

          localNextFrom = fromBlock > 0n ? fromBlock - 1n : null
          toBlock = localNextFrom ?? -1n
          batches += 1
        }

        const ordered = Array.from(executionMap.values()).sort((a, b) => b.timestamp - a.timestamp)
        const nextCursor = loadMore ? localNextFrom : nextFromBlockRef.current ?? localNextFrom
        setExecutions(ordered)
        setLastUpdated(Date.now())
        setNextFromBlock(nextCursor)
        setHasMore(nextCursor !== null)
        void fetchPrice()
      } catch (fetchError) {
        console.error('Error fetching Briah burn activity:', fetchError)
        const message = fetchError instanceof Error ? fetchError.message : 'Failed to load burn activity'
        setError(message)
      } finally {
        console.log('fetchData finished, releasing lock')
        isFetchingRef.current = false
        if (loadMore) {
          setIsLoadingMore(false)
        } else if (!silent) {
          setIsLoading(false)
        }
      }
    },
    [fetchPrice]
  )

  useEffect(() => {
    fetchData({ reset: true, targetCount: TARGET_EXECUTION_COUNT })
    void fetchPrice()
    const interval = setInterval(() => {
      fetchData({
        silent: true,
        targetCount: Math.max(TARGET_EXECUTION_COUNT, executionsRef.current.length + 5),
      })
      void fetchPrice()
    }, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData, fetchPrice])

  return {
    executions,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh: () =>
      fetchData({
        targetCount: Math.max(TARGET_EXECUTION_COUNT, executionsRef.current.length + 5),
      }),
    loadMore: () =>
      fetchData({
        loadMore: true,
        silent: true,
        targetCount: executionsRef.current.length + TARGET_EXECUTION_COUNT,
      }),
    lastUpdated,
    briahUsdPrice,
  }
}
