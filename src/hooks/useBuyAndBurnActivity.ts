import { useCallback, useEffect, useRef, useState } from 'react'
import { getPublicClient } from '@wagmi/core'
import { formatUnits } from 'viem'
import { config, pulseChain } from '@/config/wagmi'
import {
  BRIAH_BUY_AND_BURN_ADDRESS,
  BRIAH_TOKEN_ADDRESS,
  COINMAFIA_BUY_AND_BURN_ADDRESS,
  COINMAFIA_TOKEN_ADDRESS,
  DAI_ADDRESS,
  DUMB_BUY_AND_BURN_ADDRESS,
  DUMB_TOKEN_ADDRESS,
  ERC20_ABI,
  FUPA_BUY_AND_BURN_ADDRESS,
  FUPA_TOKEN_ADDRESS,
  HOLY_C_ADDRESS,
  JIT_ADDRESS,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_FACTORY_ADDRESS,
  UNISWAP_V2_PAIR_ABI,
  WPLS_ADDRESS,
  WPLS_DAI_PAIR_ADDRESS,
} from '@/config/contracts'

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
  contractAddress: `0x${string}`
  startBlock: bigint
  tokenAddress?: `0x${string}`
  logLabel: string
}

const BUY_AND_BURN_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'caller', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'jitSpent', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'tokenBurned', type: 'uint256' },
    ],
    name: 'BuyAndBurn',
    type: 'event',
  },
] as const

const BLOCK_CHUNK = 2_500n
const MIN_BLOCK_CHUNK = 250n
const TARGET_EXECUTION_COUNT = 20
const MAX_BATCHES_PER_FETCH = 40 // Increased to cover same range with smaller chunks
const EMPTY_BATCH_MULTIPLIER = 4
const RETRY_DELAY_MS = 300
const MAX_RETRIES = 3
const REFRESH_INTERVAL = 300_000
const STATIC_SNAPSHOT_TIP_OVERLAP = 8n
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as const

type BurnCache = {
  executions: BuyAndBurnExecution[]
  nextFromBlock: bigint | null
  indexedThroughBlock: bigint | null
  lastUpdated: number | null
  hasMore: boolean
  tokenUsdPrice: number | null
}

const burnCacheByKey = new Map<string, BurnCache>()

const getCachedState = (cacheKey: string) => burnCacheByKey.get(cacheKey) ?? null
const setCachedState = (cacheKey: string, state: BurnCache) => {
  burnCacheByKey.set(cacheKey, state)
}

const BRIAH_CONFIG: BuyAndBurnConfig = {
  cacheKey: 'briah-buy-and-burn',
  snapshotKey: 'briah',
  contractAddress: BRIAH_BUY_AND_BURN_ADDRESS,
  startBlock: 25_075_678n,
  tokenAddress: BRIAH_TOKEN_ADDRESS,
  logLabel: 'Briah',
}

const COINMAFIA_CONFIG: BuyAndBurnConfig = {
  cacheKey: 'coinmafia-buy-and-burn',
  snapshotKey: 'coinmafia',
  contractAddress: COINMAFIA_BUY_AND_BURN_ADDRESS,
  startBlock: 25_673_593n,
  tokenAddress: COINMAFIA_TOKEN_ADDRESS,
  logLabel: 'CoinMafia',
}

const DUMB_CONFIG: BuyAndBurnConfig = {
  cacheKey: 'dumb-buy-and-burn',
  snapshotKey: 'dumb',
  contractAddress: DUMB_BUY_AND_BURN_ADDRESS,
  startBlock: 25_941_856n,
  tokenAddress: DUMB_TOKEN_ADDRESS,
  logLabel: 'Dumb',
}

const FUPA_CONFIG: BuyAndBurnConfig = {
  cacheKey: 'fupa-buy-and-burn',
  snapshotKey: 'fupa',
  contractAddress: FUPA_BUY_AND_BURN_ADDRESS,
  startBlock: 27_099_491n,
  tokenAddress: FUPA_TOKEN_ADDRESS,
  logLabel: 'FUPA',
}

type PulsePublicClient = NonNullable<ReturnType<typeof getPublicClient>>

type DexscreenerPair = {
  chainId?: string
  priceUsd?: string
  liquidity?: {
    usd?: number | string
  }
}

type PairState = {
  token0: `0x${string}`
  token1: `0x${string}`
  reserves: readonly [bigint, bigint, number]
}

type CachedBuyAndBurnExecution = {
  transactionHash?: string
  tokenBurned?: string
  jitSpent?: string
  timestamp?: number
  blockNumber?: number | string
  caller?: string
}

type StaticBuyAndBurnSnapshot = {
  schemaVersion?: number
  indexedThroughBlock?: string
  historicalComplete?: boolean
  feeds?: Record<string, { items?: CachedBuyAndBurnExecution[] }>
}

let staticBuyAndBurnSnapshotPromise: Promise<StaticBuyAndBurnSnapshot> | null = null

const isUsablePrice = (price: number | null | undefined): price is number =>
  typeof price === 'number' && Number.isFinite(price) && price > 0

const hydrateCachedBuyAndBurnExecution = (value: CachedBuyAndBurnExecution): BuyAndBurnExecution | null => {
  const blockNumber = Number(value.blockNumber)
  if (
    !value.transactionHash ||
    !value.caller ||
    !Number.isFinite(value.timestamp) ||
    !Number.isSafeInteger(blockNumber) ||
    blockNumber < 0
  ) {
    return null
  }

  try {
    return {
      transactionHash: value.transactionHash,
      tokenBurned: BigInt(value.tokenBurned ?? '0'),
      jitSpent: BigInt(value.jitSpent ?? '0'),
      timestamp: value.timestamp,
      blockNumber,
      caller: value.caller as `0x${string}`,
    }
  } catch {
    return null
  }
}

const fetchStaticBuyAndBurnSnapshot = async ({
  snapshotKey,
  snapshotUrl,
}: {
  snapshotKey: string
  snapshotUrl: string
}) => {
  if (!staticBuyAndBurnSnapshotPromise) {
    staticBuyAndBurnSnapshotPromise = fetch(snapshotUrl, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Static Buy & Burn snapshot returned ${response.status}`)
        return (await response.json()) as StaticBuyAndBurnSnapshot
      })
      .catch((error) => {
        staticBuyAndBurnSnapshotPromise = null
        throw error
      })
  }

  const snapshot = await staticBuyAndBurnSnapshotPromise
  if (
    !snapshot.historicalComplete ||
    typeof snapshot.indexedThroughBlock !== 'string' ||
    !/^\d+$/.test(snapshot.indexedThroughBlock) ||
    !Array.isArray(snapshot.feeds?.[snapshotKey]?.items)
  ) {
    throw new Error('Static Buy & Burn snapshot returned an invalid payload')
  }

  return {
    executions: snapshot.feeds[snapshotKey].items.flatMap((item) => {
      const execution = hydrateCachedBuyAndBurnExecution(item)
      return execution ? [execution] : []
    }),
    indexedThroughBlock: BigInt(snapshot.indexedThroughBlock),
  }
}

const getTokenDecimals = async (publicClient: PulsePublicClient, tokenAddress: `0x${string}`) => {
  try {
    const decimals = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'decimals',
    })
    return Number(decimals)
  } catch (error) {
    console.warn(`Falling back to 18 decimals for ${tokenAddress}`, error)
    return 18
  }
}

const toDecimalUnits = (amount: bigint, decimals: number) => Number(formatUnits(amount, decimals))

const getPairState = async (publicClient: PulsePublicClient, pairAddress: `0x${string}`): Promise<PairState> => {
  const [token0, token1, reserves] = await Promise.all([
    publicClient.readContract({
      address: pairAddress,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'token0',
    }),
    publicClient.readContract({
      address: pairAddress,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'token1',
    }),
    publicClient.readContract({
      address: pairAddress,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'getReserves',
    }),
  ])

  return {
    token0: token0 as `0x${string}`,
    token1: token1 as `0x${string}`,
    reserves: reserves as readonly [bigint, bigint, number],
  }
}

const getOrderedReserves = (pairState: PairState, baseToken: `0x${string}`, quoteToken: `0x${string}`) => {
  const token0 = pairState.token0.toLowerCase()
  const token1 = pairState.token1.toLowerCase()
  const base = baseToken.toLowerCase()
  const quote = quoteToken.toLowerCase()

  if (token0 === base && token1 === quote) {
    return {
      baseReserve: pairState.reserves[0],
      quoteReserve: pairState.reserves[1],
    }
  }

  if (token0 === quote && token1 === base) {
    return {
      baseReserve: pairState.reserves[1],
      quoteReserve: pairState.reserves[0],
    }
  }

  return null
}

const fetchDexscreenerTokenUsdPrice = async (tokenAddress: `0x${string}`) => {
  const priceResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`)
  if (!priceResponse.ok) return null

  const priceJson = await priceResponse.json()
  const pairs = Array.isArray(priceJson?.pairs) ? (priceJson.pairs as DexscreenerPair[]) : []
  const pulsePairs = pairs.filter((pair) => pair?.chainId === 'pulsechain')
  const candidates = (pulsePairs.length > 0 ? pulsePairs : pairs)
    .map((pair) => ({
      price: Number(pair?.priceUsd),
      liquidityUsd: Number(pair?.liquidity?.usd ?? 0),
    }))
    .filter((pair) => isUsablePrice(pair.price))
    .sort((left, right) => right.liquidityUsd - left.liquidityUsd)

  return candidates[0]?.price ?? null
}

const fetchWplsUsdPriceFromPulseX = async (publicClient: PulsePublicClient) => {
  const [pairState, wplsDecimals, daiDecimals] = await Promise.all([
    getPairState(publicClient, WPLS_DAI_PAIR_ADDRESS),
    getTokenDecimals(publicClient, WPLS_ADDRESS),
    getTokenDecimals(publicClient, DAI_ADDRESS),
  ])
  const reserves = getOrderedReserves(pairState, WPLS_ADDRESS, DAI_ADDRESS)
  if (!reserves) return null

  const wplsReserve = toDecimalUnits(reserves.baseReserve, wplsDecimals)
  const daiReserve = toDecimalUnits(reserves.quoteReserve, daiDecimals)
  if (!isUsablePrice(wplsReserve) || !isUsablePrice(daiReserve)) return null

  const wplsUsdPrice = daiReserve / wplsReserve
  return isUsablePrice(wplsUsdPrice) ? wplsUsdPrice : null
}

const fetchPulseXPairAddress = async (
  publicClient: PulsePublicClient,
  tokenAddress: `0x${string}`,
  quoteTokenAddress: `0x${string}`
) =>
  publicClient.readContract({
    address: UNISWAP_V2_FACTORY_ADDRESS,
    abi: UNISWAP_V2_FACTORY_ABI,
    functionName: 'getPair',
    args: [tokenAddress, quoteTokenAddress],
  })

const fetchPulseXTokenUsdPriceFromQuote = async (
  publicClient: PulsePublicClient,
  tokenAddress: `0x${string}`,
  quoteTokenAddress: `0x${string}`,
  quoteUsdPrice: number | null
) => {
  if (!isUsablePrice(quoteUsdPrice)) return null
  if (tokenAddress.toLowerCase() === quoteTokenAddress.toLowerCase()) return quoteUsdPrice

  const pairAddress = await fetchPulseXPairAddress(publicClient, tokenAddress, quoteTokenAddress)
  if (pairAddress.toLowerCase() === ZERO_ADDRESS) return null

  const [pairState, tokenDecimals, quoteDecimals] = await Promise.all([
    getPairState(publicClient, pairAddress as `0x${string}`),
    getTokenDecimals(publicClient, tokenAddress),
    getTokenDecimals(publicClient, quoteTokenAddress),
  ])
  const reserves = getOrderedReserves(pairState, tokenAddress, quoteTokenAddress)
  if (!reserves) return null

  const tokenReserve = toDecimalUnits(reserves.baseReserve, tokenDecimals)
  const quoteReserve = toDecimalUnits(reserves.quoteReserve, quoteDecimals)
  if (!isUsablePrice(tokenReserve) || !isUsablePrice(quoteReserve)) return null

  const tokenUsdPrice = (quoteReserve / tokenReserve) * quoteUsdPrice
  return isUsablePrice(tokenUsdPrice) ? tokenUsdPrice : null
}

const fetchPulseXTokenUsdPrice = async (tokenAddress: `0x${string}`) => {
  const publicClient = getPublicClient(config, { chainId: pulseChain.id })
  if (!publicClient) return null

  const wplsUsdPrice = await fetchWplsUsdPriceFromPulseX(publicClient)
  const directWplsPrice = await fetchPulseXTokenUsdPriceFromQuote(
    publicClient,
    tokenAddress,
    WPLS_ADDRESS,
    wplsUsdPrice
  )
  if (isUsablePrice(directWplsPrice)) return directWplsPrice

  const [jitUsdPrice, holycUsdPrice] = await Promise.all([
    fetchPulseXTokenUsdPriceFromQuote(publicClient, JIT_ADDRESS, WPLS_ADDRESS, wplsUsdPrice),
    fetchPulseXTokenUsdPriceFromQuote(publicClient, HOLY_C_ADDRESS, WPLS_ADDRESS, wplsUsdPrice),
  ])

  const partnerQuotePrices = [
    await fetchPulseXTokenUsdPriceFromQuote(publicClient, tokenAddress, JIT_ADDRESS, jitUsdPrice),
    await fetchPulseXTokenUsdPriceFromQuote(publicClient, tokenAddress, HOLY_C_ADDRESS, holycUsdPrice),
  ]

  return partnerQuotePrices.find(isUsablePrice) ?? null
}

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

const useBuyAndBurnActivityBase = (buyAndBurnConfig: BuyAndBurnConfig) => {
  const cachedBurnState = getCachedState(buyAndBurnConfig.cacheKey)
  const [executions, setExecutions] = useState<BuyAndBurnExecution[]>(cachedBurnState?.executions ?? [])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(cachedBurnState?.hasMore ?? true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(cachedBurnState?.lastUpdated ?? null)
  const [tokenUsdPrice, setTokenUsdPrice] = useState<number | null>(cachedBurnState?.tokenUsdPrice ?? null)
  const [nextFromBlock, setNextFromBlock] = useState<bigint | null>(cachedBurnState?.nextFromBlock ?? null)
  const [indexedThroughBlock, setIndexedThroughBlock] = useState<bigint | null>(cachedBurnState?.indexedThroughBlock ?? null)
  const executionsRef = useRef<BuyAndBurnExecution[]>([])
  const nextFromBlockRef = useRef<bigint | null>(null)
  const indexedThroughBlockRef = useRef<bigint | null>(cachedBurnState?.indexedThroughBlock ?? null)
  const isFetchingRef = useRef(false)
  const hasCachedDataRef = useRef(Boolean(cachedBurnState?.executions?.length))
  const tokenUsdPriceRef = useRef<number | null>(cachedBurnState?.tokenUsdPrice ?? null)
  const lastUpdatedRef = useRef<number | null>(cachedBurnState?.lastUpdated ?? null)
  const hasMoreRef = useRef<boolean>(cachedBurnState?.hasMore ?? true)

  useEffect(() => {
    executionsRef.current = executions
  }, [executions])

  useEffect(() => {
    nextFromBlockRef.current = nextFromBlock
  }, [nextFromBlock])

  useEffect(() => {
    indexedThroughBlockRef.current = indexedThroughBlock
  }, [indexedThroughBlock])

  useEffect(() => {
    tokenUsdPriceRef.current = tokenUsdPrice
  }, [tokenUsdPrice])

  useEffect(() => {
    lastUpdatedRef.current = lastUpdated
  }, [lastUpdated])

  useEffect(() => {
    hasMoreRef.current = hasMore
  }, [hasMore])

  const fetchPrice = useCallback(async () => {
    if (!buyAndBurnConfig.tokenAddress) return

    let resolvedPrice: number | null = null

    try {
      resolvedPrice = await fetchDexscreenerTokenUsdPrice(buyAndBurnConfig.tokenAddress)
    } catch (dexscreenerError) {
      console.warn(`Dexscreener price unavailable for ${buyAndBurnConfig.logLabel}:`, dexscreenerError)
    }

    if (!isUsablePrice(resolvedPrice)) {
      try {
        resolvedPrice = await fetchPulseXTokenUsdPrice(buyAndBurnConfig.tokenAddress)
      } catch (pulseXError) {
        console.error(`PulseX on-chain price unavailable for ${buyAndBurnConfig.logLabel}:`, pulseXError)
      }
    }

    if (isUsablePrice(resolvedPrice)) {
      setTokenUsdPrice(resolvedPrice)
      setCachedState(buyAndBurnConfig.cacheKey, {
        executions: executionsRef.current,
        nextFromBlock: nextFromBlockRef.current,
        indexedThroughBlock: indexedThroughBlockRef.current,
        lastUpdated: lastUpdatedRef.current,
        hasMore: hasMoreRef.current,
        tokenUsdPrice: resolvedPrice,
      })
    }
  }, [buyAndBurnConfig.cacheKey, buyAndBurnConfig.logLabel, buyAndBurnConfig.tokenAddress])

  const fetchData = useCallback(
    async ({
      reset = false,
      loadMore = false,
      silent = false,
      forceScan = false,
      minBlockOverride,
      targetCount = TARGET_EXECUTION_COUNT,
    }: {
      reset?: boolean
      loadMore?: boolean
      silent?: boolean
      forceScan?: boolean
      minBlockOverride?: bigint
      targetCount?: number
    } = {}) => {
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
        const minBlock = minBlockOverride && minBlockOverride > buyAndBurnConfig.startBlock
          ? minBlockOverride
          : buyAndBurnConfig.startBlock
        const cursor = nextFromBlockRef.current
        if (loadMore && (cursor === null || cursor < minBlock)) {
          setHasMore(false)
          return
        }
        let toBlock = loadMore && cursor !== null ? cursor : latestBlock
        if (toBlock < minBlock) {
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

        while (toBlock >= minBlock && batches < batchLimit && (forceScan || executionMap.size < desiredCount)) {
          const fromBlock =
            toBlock - currentChunk + 1n > minBlock
              ? toBlock - currentChunk + 1n
              : minBlock
          let logs
          try {
            logs = await withRetry(
              () =>
                publicClient.getContractEvents({
                  address: buyAndBurnConfig.contractAddress,
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
            console.warn(
              `Failed to fetch ${buyAndBurnConfig.logLabel} Buy & Burn logs for range ${fromBlock} - ${toBlock}`,
              logError
            )
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
            localNextFrom = fromBlock > minBlock ? fromBlock - 1n : null
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
            const tokenBurned = log.args?.tokenBurned ? BigInt(log.args.tokenBurned) : 0n
            const jitSpent = log.args?.jitSpent ? BigInt(log.args.jitSpent) : 0n
            const caller = (log.args?.caller as `0x${string}`) ?? '0x0000000000000000000000000000000000000000'

            executionMap.set(log.transactionHash, {
              transactionHash: log.transactionHash,
              tokenBurned,
              jitSpent,
              timestamp,
              blockNumber: Number(blockNumber),
              caller,
            })
          })

          localNextFrom = fromBlock > minBlock ? fromBlock - 1n : null
          toBlock = localNextFrom ?? -1n
          batches += 1
        }

        const ordered = Array.from(executionMap.values()).sort((a, b) => b.timestamp - a.timestamp)
        const nextCursor = forceScan ? nextFromBlockRef.current : loadMore ? localNextFrom : nextFromBlockRef.current ?? localNextFrom
        setExecutions(ordered)
        const updatedAt = Date.now()
        setNextFromBlock(nextCursor)
        setLastUpdated(updatedAt)
        setHasMore(nextCursor !== null)
        executionsRef.current = ordered
        nextFromBlockRef.current = nextCursor
        lastUpdatedRef.current = updatedAt
        hasMoreRef.current = nextCursor !== null
        setCachedState(buyAndBurnConfig.cacheKey, {
          executions: ordered,
          nextFromBlock: nextCursor,
          indexedThroughBlock: indexedThroughBlockRef.current,
          lastUpdated: updatedAt,
          hasMore: nextCursor !== null,
          tokenUsdPrice: tokenUsdPriceRef.current,
        })
        void fetchPrice()
      } catch (fetchError) {
        console.error(`Error fetching ${buyAndBurnConfig.logLabel} burn activity:`, fetchError)
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
    [
      buyAndBurnConfig.cacheKey,
      buyAndBurnConfig.contractAddress,
      buyAndBurnConfig.logLabel,
      buyAndBurnConfig.startBlock,
      fetchPrice,
    ]
  )

  const refreshFromSnapshot = useCallback(
    (silent = false) => {
      const snapshotThroughBlock = indexedThroughBlockRef.current
      const minBlockOverride = snapshotThroughBlock
        ? snapshotThroughBlock > STATIC_SNAPSHOT_TIP_OVERLAP
          ? snapshotThroughBlock - STATIC_SNAPSHOT_TIP_OVERLAP
          : buyAndBurnConfig.startBlock
        : undefined

      return fetchData({
        silent,
        forceScan: Boolean(snapshotThroughBlock),
        minBlockOverride,
        targetCount: Math.max(TARGET_EXECUTION_COUNT, executionsRef.current.length + 5),
      })
    },
    [buyAndBurnConfig.startBlock, fetchData]
  )

  useEffect(() => {
    let cancelled = false
    const snapshotUrl = import.meta.env.VITE_BUY_AND_BURN_STATIC_SNAPSHOT_URL?.trim() || '/buy-and-burn-feed.json'

    const bootstrap = async () => {
      if (!hasCachedDataRef.current) {
        setIsLoading(true)
        try {
          const snapshot = await fetchStaticBuyAndBurnSnapshot({
            snapshotKey: buyAndBurnConfig.snapshotKey,
            snapshotUrl,
          })
          if (cancelled) return

          const ordered = [...snapshot.executions].sort((left, right) => right.timestamp - left.timestamp)
          const updatedAt = Date.now()
          executionsRef.current = ordered
          nextFromBlockRef.current = null
          indexedThroughBlockRef.current = snapshot.indexedThroughBlock
          lastUpdatedRef.current = updatedAt
          hasMoreRef.current = false
          hasCachedDataRef.current = true
          setExecutions(ordered)
          setNextFromBlock(null)
          setIndexedThroughBlock(snapshot.indexedThroughBlock)
          setHasMore(false)
          setLastUpdated(updatedAt)
          setCachedState(buyAndBurnConfig.cacheKey, {
            executions: ordered,
            nextFromBlock: null,
            indexedThroughBlock: snapshot.indexedThroughBlock,
            lastUpdated: updatedAt,
            hasMore: false,
            tokenUsdPrice: tokenUsdPriceRef.current,
          })
          setIsLoading(false)
          void refreshFromSnapshot(true)
        } catch (snapshotError) {
          console.warn(`Static ${buyAndBurnConfig.logLabel} Buy & Burn archive unavailable; falling back to RPC`, snapshotError)
          if (!cancelled) {
            void fetchData({
              reset: true,
              targetCount: Math.max(TARGET_EXECUTION_COUNT, executionsRef.current.length + 5),
            })
          }
        }
      } else {
        void refreshFromSnapshot(true)
      }

      if (!tokenUsdPriceRef.current) {
        void fetchPrice()
      }
    }

    void bootstrap()
    const interval = setInterval(() => {
      void refreshFromSnapshot(true)
      void fetchPrice()
    }, REFRESH_INTERVAL)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [buyAndBurnConfig.cacheKey, buyAndBurnConfig.logLabel, buyAndBurnConfig.snapshotKey, fetchData, fetchPrice, refreshFromSnapshot])

  return {
    executions,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    refresh: () => refreshFromSnapshot(),
    silentRefresh: () => refreshFromSnapshot(true),
    loadMore: () =>
      fetchData({
        loadMore: true,
        silent: true,
        targetCount: executionsRef.current.length + TARGET_EXECUTION_COUNT,
      }),
    lastUpdated,
    tokenUsdPrice,
  }
}

export const useBuyAndBurnActivity = () => useBuyAndBurnActivityBase(BRIAH_CONFIG)
export const useCoinMafiaBuyAndBurnActivity = () => useBuyAndBurnActivityBase(COINMAFIA_CONFIG)
export const useDumbBuyAndBurnActivity = () => useBuyAndBurnActivityBase(DUMB_CONFIG)
export const useFupaBuyAndBurnActivity = () => useBuyAndBurnActivityBase(FUPA_CONFIG)
