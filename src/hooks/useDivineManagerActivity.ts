import { useCallback, useEffect, useRef, useState } from 'react'
import { getPublicClient } from '@wagmi/core'
import { getAddress, parseAbiItem } from 'viem'
import { config, pulseChain } from '@/config/wagmi'
import {
  CONTRACT_ADDRESSES,
  DIVINE_MANAGER_ABI,
  DIVINE_MANAGER_ADDRESS,
  FEEDER_BOT_ADDRESS,
  FEEDER_PARTNER_ADDRESS,
  FEEDER_SETTLEMENT_DEAD_ADDRESS,
  HOLY_C_ADDRESS,
  HOLYC_JIT_PAIR_ADDRESS,
  HOLYC_WPLS_PAIR_ADDRESS,
  JIT_ADDRESS,
  JIT_WPLS_PAIR_ADDRESS,
  PULSEX_ROUTER_ADDRESS,
  WPLS_ADDRESS,
} from '@/config/contracts'

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
  burns: {
    holyc: bigint
    jit: bigint
  }
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
  strategyId: string
  jobNonce: string
  holyBurned: bigint
  jitBurned: bigint
  holyIn: bigint
  holyOut: bigint
  jitIn: bigint
  jitOut: bigint
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

interface FetchOptions {
  silent?: boolean
  reset?: boolean
  loadMore?: boolean
}

interface FeedCursor {
  divine: bigint | null
  feeder: bigint | null
}

type ActivityCache = {
  executions: ActivityExecution[]
  nextFromBlock: FeedCursor
  lastUpdated: number | null
  hasMore: boolean
}

type RawLog = {
  address: `0x${string}`
  topics: `0x${string}`[]
  data: `0x${string}`
}

type ParsedTransfer = {
  tokenAddress: string
  tokenSymbol: StepToken
  from: string
  to: string
  value: bigint
}

type PulsePublicClient = NonNullable<ReturnType<typeof getPublicClient>>

type FeederTxKind = 'compile' | 'restore' | 'swap' | 'settlement-burn' | 'settlement-partner' | 'ignore'

type FeederTxSummary = {
  hash: `0x${string}`
  nonce: number
  kind: FeederTxKind
  route: FeederRoute | null
  blockNumber: bigint
  timestamp: number
  amountIn: bigint
  amountOut: bigint
  tokenInSymbol: StepToken
  tokenOutSymbol: StepToken
  directHolyBurned: bigint
  compilerFeeEquivalentHolyc: bigint
  jitTransferTaxBurned: bigint
  jitRestorePrincipalBurned: bigint
  effectiveHolyContribution: bigint
  pool?: PoolKey
}

const BLOCK_CHUNK = 2_500n
const MIN_BLOCK_CHUNK = 250n
const REFRESH_INTERVAL = 300_000
const TARGET_EXECUTION_COUNT = 100
const MAX_BATCHES_PER_FETCH = 40
const EMPTY_BATCH_MULTIPLIER = 4
const RETRY_DELAY_MS = 300
const MAX_RETRIES = 3
const FEEDER_CURSOR_OVERLAP = 128n
const MAX_FEEDER_CORE_NONCE_GAP = 4
const MAX_FEEDER_LOOP_NONCE_SPAN = 6
const MAX_FEEDER_LOOP_BLOCK_SPAN = 128n
const MAX_FEEDER_LOOP_TIME_SPAN_MS = 12 * 60 * 1000
const MAX_FEEDER_SETTLEMENT_NONCE_GAP = 2
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const TRANSFER_EVENT = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)')

const HOLY_ADDRESS_LOWER = HOLY_C_ADDRESS.toLowerCase()
const JIT_ADDRESS_LOWER = JIT_ADDRESS.toLowerCase()
const WPLS_ADDRESS_LOWER = WPLS_ADDRESS.toLowerCase()
const DIVINE_MANAGER_ADDRESS_LOWER = DIVINE_MANAGER_ADDRESS.toLowerCase()
const FEEDER_BOT_ADDRESS_LOWER = FEEDER_BOT_ADDRESS.toLowerCase()
const FEEDER_PARTNER_ADDRESS_LOWER = FEEDER_PARTNER_ADDRESS.toLowerCase()
const FEEDER_SETTLEMENT_DEAD_ADDRESS_LOWER = FEEDER_SETTLEMENT_DEAD_ADDRESS.toLowerCase()
const ROUTER_ADDRESS_LOWER = PULSEX_ROUTER_ADDRESS.toLowerCase()
const BURN_ADDRESS_LOWER = CONTRACT_ADDRESSES.burn.toLowerCase()
const BURN_ADDRESS_SET = new Set([ZERO_ADDRESS.toLowerCase(), BURN_ADDRESS_LOWER])

const PAIR_METADATA: Record<string, { key: PoolKey; label: string; short: string }> = {
  [HOLYC_WPLS_PAIR_ADDRESS.toLowerCase()]: {
    key: 'HOLYC_WPLS',
    label: 'HolyC/WPLS pool',
    short: 'HC/WPLS',
  },
  [JIT_WPLS_PAIR_ADDRESS.toLowerCase()]: {
    key: 'JIT_WPLS',
    label: 'JIT/WPLS pool',
    short: 'JIT/WPLS',
  },
  [HOLYC_JIT_PAIR_ADDRESS.toLowerCase()]: {
    key: 'HOLYC_JIT',
    label: 'HolyC/JIT pool',
    short: 'HC/JIT',
  },
}

let cachedActivityState: ActivityCache | null = null

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

const bnAbs = (value: bigint) => (value >= 0n ? value : value * -1n)
const clampBigInt = (value: bigint) => (value > 0n ? value : 0n)

const sumTransfers = (transfers: ParsedTransfer[], predicate: (transfer: ParsedTransfer) => boolean) =>
  transfers.reduce((total, transfer) => (predicate(transfer) ? total + transfer.value : total), 0n)

const toLowerAddress = (value: string) => {
  try {
    return getAddress(value).toLowerCase()
  } catch {
    return value.toLowerCase()
  }
}

const getTopicAddress = (topic?: `0x${string}`) => {
  if (!topic) return ZERO_ADDRESS
  const normalized = `0x${topic.slice(topic.length - 40)}`
  try {
    return getAddress(normalized)
  } catch {
    return ZERO_ADDRESS
  }
}

const parseTransfer = (log: RawLog) => {
  if (!log.topics?.length || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) return null
  const from = getTopicAddress(log.topics[1])
  const to = getTopicAddress(log.topics[2])
  const value = log.data ? BigInt(log.data) : 0n
  return { from, to, value }
}

const getTokenSymbol = (tokenAddress: string): StepToken => {
  const normalized = tokenAddress.toLowerCase()
  if (normalized === HOLY_ADDRESS_LOWER) return 'HOLYC'
  if (normalized === JIT_ADDRESS_LOWER) return 'JIT'
  if (normalized === WPLS_ADDRESS_LOWER) return 'WPLS'
  return 'UNKNOWN'
}

const parseReceiptTransfers = (logs: readonly { address: string; topics: readonly string[]; data: string }[]): ParsedTransfer[] =>
  logs.flatMap((receiptLog) => {
    const transfer = parseTransfer({
      address: receiptLog.address as `0x${string}`,
      topics: receiptLog.topics as `0x${string}`[],
      data: receiptLog.data as `0x${string}`,
    })
    if (!transfer) return []

    const tokenAddress = toLowerAddress(receiptLog.address)
    return [
      {
        tokenAddress,
        tokenSymbol: getTokenSymbol(tokenAddress),
        from: transfer.from.toLowerCase(),
        to: transfer.to.toLowerCase(),
        value: transfer.value,
      },
    ]
  })

type TransferLogWithHash = {
  transactionHash: `0x${string}` | null
}

const createStep = (
  id: string,
  type: StepType,
  label: string,
  tokenInSymbol: StepToken,
  tokenOutSymbol: StepToken,
  tokenInAmount: bigint,
  tokenOutAmount = 0n,
  burns: { holyc: bigint; jit: bigint } = { holyc: 0n, jit: 0n },
  pool?: PoolKey
): DivineManagerStep => ({
  id,
  type,
  label,
  tokenInSymbol,
  tokenOutSymbol,
  tokenInAmount,
  tokenOutAmount,
  burns,
  pool,
})

const buildDivineExecution = async (
  publicClient: PulsePublicClient,
  log: Awaited<ReturnType<PulsePublicClient['getContractEvents']>>[number]
): Promise<DivineManagerExecution | null> => {
  const blockNumber = log.blockNumber ?? 0n
  let block: Awaited<ReturnType<PulsePublicClient['getBlock']>>
  let receipt: Awaited<ReturnType<PulsePublicClient['getTransactionReceipt']>>
  try {
    ;[block, receipt] = await Promise.all([
      withRetry(() => publicClient.getBlock({ blockNumber }), MAX_RETRIES) as Promise<
        Awaited<ReturnType<PulsePublicClient['getBlock']>>
      >,
      withRetry(() => publicClient.getTransactionReceipt({ hash: log.transactionHash }), MAX_RETRIES) as Promise<
        Awaited<ReturnType<PulsePublicClient['getTransactionReceipt']>>
      >,
    ])
  } catch {
    return null
  }
  let holyBurned = 0n
  let jitBurned = 0n
  let holyIn = 0n
  let holyOut = 0n
  let jitIn = 0n
  let jitOut = 0n
  const steps: DivineManagerStep[] = []
  const compileQueue: DivineManagerStep[] = []
  const restoreQueue: DivineManagerStep[] = []
  const completedRestores: DivineManagerStep[] = []
  const swapQueues = new Map<string, DivineManagerStep[]>()

  receipt.logs?.forEach((receiptLog: (typeof receipt.logs)[number]) => {
    const transfer = parseTransfer({
      address: receiptLog.address,
      topics: receiptLog.topics as `0x${string}`[],
      data: receiptLog.data as `0x${string}`,
    })
    if (!transfer) return

    const tokenAddress = toLowerAddress(receiptLog.address)
    const tokenSymbol = getTokenSymbol(tokenAddress)
    const fromAddress = transfer.from.toLowerCase()
    const toAddress = transfer.to.toLowerCase()
    const poolTo = PAIR_METADATA[toAddress]
    const poolFrom = PAIR_METADATA[fromAddress]

    if (poolTo && fromAddress === DIVINE_MANAGER_ADDRESS_LOWER) {
      const step = createStep(
        `${log.transactionHash}-${steps.length + 1}-swap`,
        'swap',
        `${poolTo.label} swap`,
        tokenSymbol,
        'UNKNOWN',
        transfer.value,
        0n,
        { holyc: 0n, jit: 0n },
        poolTo.key
      )
      steps.push(step)
      if (!swapQueues.has(toAddress)) swapQueues.set(toAddress, [])
      swapQueues.get(toAddress)!.push(step)
    }

    if (poolFrom && toAddress === DIVINE_MANAGER_ADDRESS_LOWER) {
      const queue = swapQueues.get(fromAddress)
      if (queue?.length) {
        const step = queue.find((candidate) => candidate.tokenOutAmount === 0n) ?? queue.shift()
        if (step) {
          step.tokenOutSymbol = tokenSymbol
          step.tokenOutAmount = transfer.value
        }
      }
    }

    if (tokenAddress === HOLY_ADDRESS_LOWER) {
      if (fromAddress === DIVINE_MANAGER_ADDRESS_LOWER && BURN_ADDRESS_SET.has(toAddress)) {
        holyBurned += transfer.value
        for (let index = completedRestores.length - 1; index >= 0; index -= 1) {
          const candidate = completedRestores[index]
          if (!candidate.isSettlement && candidate.tokenOutAmount === transfer.value) {
            candidate.isSettlement = true
            candidate.settlementAmount = transfer.value
            break
          }
        }
      }

      if (toAddress === DIVINE_MANAGER_ADDRESS_LOWER) {
        holyIn += transfer.value
      }

      if (fromAddress === DIVINE_MANAGER_ADDRESS_LOWER) {
        holyOut += transfer.value
        if (toAddress === JIT_ADDRESS_LOWER) {
          const step = createStep(
            `${log.transactionHash}-${steps.length + 1}-compile`,
            'compile',
            'Divine Compiler (HC→JIT)',
            'HOLYC',
            'JIT',
            transfer.value
          )
          steps.push(step)
          compileQueue.push(step)
        }
      }

      if (fromAddress === JIT_ADDRESS_LOWER && toAddress === DIVINE_MANAGER_ADDRESS_LOWER) {
        const restoreStep = restoreQueue.find((candidate) => candidate.tokenOutAmount === 0n)
        if (restoreStep) {
          restoreStep.tokenOutAmount = transfer.value
          completedRestores.push(restoreStep)
        }
      }
    }

    if (tokenAddress === JIT_ADDRESS_LOWER) {
      if (BURN_ADDRESS_SET.has(toAddress)) {
        jitBurned += transfer.value
      }

      if (toAddress === DIVINE_MANAGER_ADDRESS_LOWER) {
        jitIn += transfer.value
        if (fromAddress === ZERO_ADDRESS.toLowerCase()) {
          const pendingCompile = compileQueue.find((candidate) => candidate.tokenOutAmount === 0n)
          if (pendingCompile) {
            pendingCompile.tokenOutAmount = transfer.value
            const fee = pendingCompile.tokenInAmount > transfer.value ? pendingCompile.tokenInAmount - transfer.value : 0n
            if (fee > 0n) {
              pendingCompile.burns.holyc += fee
              holyBurned += fee
            }
          }
        }
      }

      if (fromAddress === DIVINE_MANAGER_ADDRESS_LOWER) {
        jitOut += transfer.value
        if (toAddress === ZERO_ADDRESS.toLowerCase()) {
          const step = createStep(
            `${log.transactionHash}-${steps.length + 1}-restore`,
            'restore',
            'Divine Compiler (JIT→HolyC)',
            'JIT',
            'HOLYC',
            transfer.value,
            0n,
            { holyc: 0n, jit: transfer.value }
          )
          steps.push(step)
          restoreQueue.push(step)
        }
      }
    }
  })

  if (holyBurned === 0n && jitBurned === 0n && holyIn === 0n && holyOut === 0n && jitIn === 0n && jitOut === 0n) {
    return null
  }

  return {
    source: 'divine-manager',
    transactionHash: log.transactionHash,
    blockNumber,
    timestamp: Number(block.timestamp) * 1000,
    strategyId: log.args?.strategyId ? (log.args.strategyId as `0x${string}`) : '0x',
    jobNonce: log.args?.jobNonce ? (log.args.jobNonce as `0x${string}`) : '0x',
    holyBurned,
    jitBurned,
    holyIn,
    holyOut,
    jitIn,
    jitOut,
    steps,
  }
}

const fetchDivineExecutions = async ({
  publicClient,
  existingExecutions,
  latestBlock,
  loadMore,
  cursor,
  targetCount,
}: {
  publicClient: PulsePublicClient
  existingExecutions: Map<string, DivineManagerExecution>
  latestBlock: bigint
  loadMore: boolean
  cursor: bigint | null
  targetCount: number
}) => {
  if (loadMore && cursor === null) {
    return {
      executions: Array.from(existingExecutions.values()),
      nextFromBlock: null,
    }
  }

  const executionMap = new Map(existingExecutions)
  const batchLimit = executionMap.size === 0 ? MAX_BATCHES_PER_FETCH * EMPTY_BATCH_MULTIPLIER : MAX_BATCHES_PER_FETCH
  let toBlock = loadMore && cursor !== null ? cursor : latestBlock
  let batches = 0
  let localNextFrom: bigint | null = cursor
  let currentChunk = BLOCK_CHUNK

  while (toBlock >= 0n && batches < batchLimit && executionMap.size < targetCount) {
    const fromBlock = toBlock >= currentChunk ? toBlock - currentChunk + 1n : 0n
    let logs: Awaited<ReturnType<PulsePublicClient['getContractEvents']>>

    try {
      logs = (await withRetry(
        () =>
          publicClient.getContractEvents({
            address: DIVINE_MANAGER_ADDRESS,
            abi: DIVINE_MANAGER_ABI,
            eventName: 'TicketExecuted',
            fromBlock,
            toBlock,
          }),
        MAX_RETRIES
      )) as Awaited<ReturnType<PulsePublicClient['getContractEvents']>>
      if (currentChunk < BLOCK_CHUNK) {
        const nextChunk = currentChunk * 2n
        currentChunk = nextChunk > BLOCK_CHUNK ? BLOCK_CHUNK : nextChunk
      }
    } catch (error) {
      if (currentChunk > MIN_BLOCK_CHUNK) {
        currentChunk = currentChunk / 2n < MIN_BLOCK_CHUNK ? MIN_BLOCK_CHUNK : currentChunk / 2n
        continue
      }
      throw error
    }

    if (logs.length) {
      const CHUNK_SIZE = 2
      for (let index = 0; index < logs.length; index += CHUNK_SIZE) {
        const result = await Promise.all(
          logs
            .slice(index, index + CHUNK_SIZE)
            .map((log: Awaited<ReturnType<PulsePublicClient['getContractEvents']>>[number]) => buildDivineExecution(publicClient, log))
        )
        result.forEach((execution) => {
          if (execution) {
            executionMap.set(execution.transactionHash, execution)
          }
        })
      }
    }

    localNextFrom = fromBlock > 0n ? fromBlock - 1n : null
    toBlock = localNextFrom ?? -1n
    batches += 1
  }

  return {
    executions: Array.from(executionMap.values()),
    nextFromBlock: localNextFrom,
  }
}

const summarizeFeederTransaction = async (
  publicClient: PulsePublicClient,
  hash: `0x${string}`
): Promise<FeederTxSummary | null> => {
  let transaction: Awaited<ReturnType<PulsePublicClient['getTransaction']>>
  let receipt: Awaited<ReturnType<PulsePublicClient['getTransactionReceipt']>>
  let block: Awaited<ReturnType<PulsePublicClient['getBlock']>>

  try {
    transaction = (await withRetry(() => publicClient.getTransaction({ hash }), MAX_RETRIES)) as Awaited<
      ReturnType<PulsePublicClient['getTransaction']>
    >
    receipt = (await withRetry(() => publicClient.getTransactionReceipt({ hash }), MAX_RETRIES)) as Awaited<
      ReturnType<PulsePublicClient['getTransactionReceipt']>
    >
    block = (await withRetry(() => publicClient.getBlock({ blockNumber: receipt.blockNumber }), MAX_RETRIES)) as Awaited<
      ReturnType<PulsePublicClient['getBlock']>
    >
  } catch {
    return null
  }
  const toAddress = transaction.to ? transaction.to.toLowerCase() : ''
  const transfers = parseReceiptTransfers(receipt.logs)

  const holyIn = sumTransfers(transfers, (transfer) => transfer.tokenSymbol === 'HOLYC' && transfer.to === FEEDER_BOT_ADDRESS_LOWER)
  const holyOut = sumTransfers(transfers, (transfer) => transfer.tokenSymbol === 'HOLYC' && transfer.from === FEEDER_BOT_ADDRESS_LOWER)
  const jitIn = sumTransfers(transfers, (transfer) => transfer.tokenSymbol === 'JIT' && transfer.to === FEEDER_BOT_ADDRESS_LOWER)
  const jitOut = sumTransfers(transfers, (transfer) => transfer.tokenSymbol === 'JIT' && transfer.from === FEEDER_BOT_ADDRESS_LOWER)
  const settlementHolyBurned = sumTransfers(
    transfers,
    (transfer) =>
      transfer.tokenSymbol === 'HOLYC' &&
      transfer.from === FEEDER_BOT_ADDRESS_LOWER &&
      transfer.to === FEEDER_SETTLEMENT_DEAD_ADDRESS_LOWER
  )
  const settlementHolyPartnerAmount = sumTransfers(
    transfers,
    (transfer) =>
      transfer.tokenSymbol === 'HOLYC' &&
      transfer.from === FEEDER_BOT_ADDRESS_LOWER &&
      transfer.to === FEEDER_PARTNER_ADDRESS_LOWER
  )
  const settlementJitPartnerAmount = sumTransfers(
    transfers,
    (transfer) =>
      transfer.tokenSymbol === 'JIT' &&
      transfer.from === FEEDER_BOT_ADDRESS_LOWER &&
      transfer.to === FEEDER_PARTNER_ADDRESS_LOWER
  )
  const directHolyBurned = sumTransfers(
    transfers,
    (transfer) => transfer.tokenSymbol === 'HOLYC' && BURN_ADDRESS_SET.has(transfer.to)
  )
  const rawJitBurned = sumTransfers(transfers, (transfer) => transfer.tokenSymbol === 'JIT' && BURN_ADDRESS_SET.has(transfer.to))
  const pool = transfers.find(
    (transfer) => PAIR_METADATA[transfer.from] || PAIR_METADATA[transfer.to]
  )
  const poolKey = pool ? PAIR_METADATA[pool.from]?.key ?? PAIR_METADATA[pool.to]?.key : undefined
  const isSwap = toAddress === ROUTER_ADDRESS_LOWER || Boolean(poolKey)
  const isCompilerCall = toAddress === JIT_ADDRESS_LOWER

  let kind: FeederTxKind = 'ignore'
  let route: FeederRoute | null = null
  let amountIn = 0n
  let amountOut = 0n
  let tokenInSymbol: StepToken = 'UNKNOWN'
  let tokenOutSymbol: StepToken = 'UNKNOWN'

  if (settlementHolyBurned > 0n) {
    kind = 'settlement-burn'
    amountIn = settlementHolyBurned
    amountOut = settlementHolyBurned
    tokenInSymbol = 'HOLYC'
    tokenOutSymbol = 'HOLYC'
  } else if (settlementHolyPartnerAmount > 0n || settlementJitPartnerAmount > 0n) {
    kind = 'settlement-partner'
    amountIn = settlementHolyPartnerAmount > 0n ? settlementHolyPartnerAmount : settlementJitPartnerAmount
    amountOut = amountIn
    tokenInSymbol = settlementHolyPartnerAmount > 0n ? 'HOLYC' : 'JIT'
    tokenOutSymbol = tokenInSymbol
  } else if (isSwap) {
    if (jitOut > 0n && holyIn > 0n) {
      kind = 'swap'
      route = 'hc-start-jit-gain'
      amountIn = jitOut
      amountOut = holyIn
      tokenInSymbol = 'JIT'
      tokenOutSymbol = 'HOLYC'
    } else if (holyOut > 0n && jitIn > 0n) {
      kind = 'swap'
      route = 'jit-start-hc-gain'
      amountIn = holyOut
      amountOut = jitIn
      tokenInSymbol = 'HOLYC'
      tokenOutSymbol = 'JIT'
    }
  } else if (isCompilerCall) {
    if (holyOut > 0n && jitIn > 0n) {
      kind = 'compile'
      amountIn = holyOut
      amountOut = jitIn
      tokenInSymbol = 'HOLYC'
      tokenOutSymbol = 'JIT'
    } else if (jitOut > 0n && holyIn > 0n) {
      kind = 'restore'
      amountIn = jitOut
      amountOut = holyIn
      tokenInSymbol = 'JIT'
      tokenOutSymbol = 'HOLYC'
    }
  }

  if (kind === 'ignore') {
    return null
  }

  const compilerFeeEquivalentHolyc =
    kind === 'compile' || kind === 'restore' ? (amountIn > amountOut ? amountIn - amountOut : 0n) : 0n
  const jitTransferTaxBurned = kind === 'swap' ? rawJitBurned : 0n
  const jitRestorePrincipalBurned = kind === 'restore' ? rawJitBurned : 0n
  const effectiveHolyContribution = directHolyBurned + compilerFeeEquivalentHolyc + jitTransferTaxBurned

  return {
    hash,
    nonce: transaction.nonce,
    kind,
    route,
    blockNumber: receipt.blockNumber,
    timestamp: Number(block.timestamp) * 1000,
    amountIn,
    amountOut,
    tokenInSymbol,
    tokenOutSymbol,
    directHolyBurned,
    compilerFeeEquivalentHolyc,
    jitTransferTaxBurned,
    jitRestorePrincipalBurned,
    effectiveHolyContribution,
    pool: poolKey,
  }
}

const findAdjacentFeederTx = ({
  items,
  index,
  direction,
  expectedKind,
  reference,
}: {
  items: FeederTxSummary[]
  index: number
  direction: -1 | 1
  expectedKind: Extract<FeederTxKind, 'compile' | 'restore'>
  reference: FeederTxSummary
}) => {
  for (let current = index + direction; current >= 0 && current < items.length; current += direction) {
    const candidate = items[current]
    if (candidate.kind === 'swap') break
    if (reference.nonce - candidate.nonce > MAX_FEEDER_CORE_NONCE_GAP && direction === -1) break
    if (candidate.nonce - reference.nonce > MAX_FEEDER_CORE_NONCE_GAP && direction === 1) break
    if (bnAbs(reference.blockNumber - candidate.blockNumber) > MAX_FEEDER_LOOP_BLOCK_SPAN) break
    if (bnAbs(BigInt(reference.timestamp - candidate.timestamp)) > BigInt(MAX_FEEDER_LOOP_TIME_SPAN_MS)) break
    if (candidate.kind === expectedKind) return candidate
  }

  return null
}

const buildFeederStep = (tx: FeederTxSummary, role: 'rebalance' | 'core' | 'swap', index: number): DivineManagerStep => {
  const type: StepType =
    role === 'rebalance' ? 'rebalance' : tx.kind === 'swap' ? 'swap' : tx.kind === 'compile' ? 'compile' : 'restore'

  let label = 'Feeder Bot step'
  if (tx.kind === 'compile') {
    label = role === 'rebalance' ? 'Rebalance compile (HC→JIT)' : 'Feeder compile (HC→JIT)'
  } else if (tx.kind === 'restore') {
    label = role === 'rebalance' ? 'Rebalance restore (JIT→HolyC)' : 'Feeder restore (JIT→HolyC)'
  } else if (tx.kind === 'swap') {
    label = tx.route === 'hc-start-jit-gain' ? 'PulseX swap (JIT→HolyC)' : 'PulseX swap (HolyC→JIT)'
  }

  return createStep(
    `${tx.hash}-${index}-${role}`,
    type,
    label,
    tx.tokenInSymbol,
    tx.tokenOutSymbol,
    tx.amountIn,
    tx.amountOut,
    {
      holyc: tx.directHolyBurned + tx.compilerFeeEquivalentHolyc,
      jit: tx.jitTransferTaxBurned + tx.jitRestorePrincipalBurned,
    },
    tx.pool
  )
}

type FeederSettlementAttachment = {
  swapTx: FeederTxSummary | null
  burnTx: FeederTxSummary | null
  partnerTx: FeederTxSummary | null
  transactions: FeederTxSummary[]
}

const toFeederSettlementTransaction = (tx: FeederTxSummary): FeederSettlementTransaction => {
  if (tx.kind === 'settlement-burn') {
    return {
      hash: tx.hash,
      nonce: tx.nonce,
      kind: 'burn',
      label: 'Settlement burn',
      tokenInSymbol: tx.tokenInSymbol,
      tokenOutSymbol: tx.tokenOutSymbol,
      amountIn: tx.amountIn,
      amountOut: tx.amountOut,
    }
  }

  if (tx.kind === 'settlement-partner') {
    return {
      hash: tx.hash,
      nonce: tx.nonce,
      kind: 'partner',
      label: tx.tokenInSymbol === 'HOLYC' ? 'Partner payout (HolyC)' : 'Partner payout (JIT)',
      tokenInSymbol: tx.tokenInSymbol,
      tokenOutSymbol: tx.tokenOutSymbol,
      amountIn: tx.amountIn,
      amountOut: tx.amountOut,
    }
  }

  return {
    hash: tx.hash,
    nonce: tx.nonce,
    kind: 'swap',
    label: 'Settlement swap (JIT→HolyC)',
    tokenInSymbol: tx.tokenInSymbol,
    tokenOutSymbol: tx.tokenOutSymbol,
    amountIn: tx.amountIn,
    amountOut: tx.amountOut,
  }
}

const collectFeederSettlement = ({
  items,
  startIndex,
  reference,
  route,
  used,
}: {
  items: FeederTxSummary[]
  startIndex: number
  reference: FeederTxSummary
  route: FeederRoute
  used: Set<string>
}): FeederSettlementAttachment => {
  let lastVisibleTx = reference
  let swapTx: FeederTxSummary | null = null
  let burnTx: FeederTxSummary | null = null
  let partnerTx: FeederTxSummary | null = null
  const settlementTxs: FeederTxSummary[] = []
  const expectedPartnerToken = route === 'hc-start-jit-gain' ? 'JIT' : 'HOLYC'

  for (let current = startIndex + 1; current < items.length; current += 1) {
    const candidate = items[current]

    if (used.has(candidate.hash)) break
    if (candidate.nonce - lastVisibleTx.nonce > MAX_FEEDER_SETTLEMENT_NONCE_GAP) break
    if (bnAbs(reference.blockNumber - candidate.blockNumber) > MAX_FEEDER_LOOP_BLOCK_SPAN) break
    if (bnAbs(BigInt(reference.timestamp - candidate.timestamp)) > BigInt(MAX_FEEDER_LOOP_TIME_SPAN_MS)) break

    if (candidate.kind === 'compile' || candidate.kind === 'restore') {
      break
    }

    if (candidate.kind === 'swap') {
      const isSettlementSwap =
        route === 'hc-start-jit-gain' &&
        swapTx === null &&
        candidate.route === 'hc-start-jit-gain' &&
        candidate.tokenInSymbol === 'JIT' &&
        candidate.tokenOutSymbol === 'HOLYC'

      if (!isSettlementSwap) {
        break
      }

      swapTx = candidate
      settlementTxs.push(candidate)
      lastVisibleTx = candidate
      continue
    }

    if (candidate.kind === 'settlement-burn') {
      if (burnTx || (route === 'hc-start-jit-gain' && !swapTx)) {
        break
      }

      burnTx = candidate
      settlementTxs.push(candidate)
      lastVisibleTx = candidate
      continue
    }

    if (candidate.kind === 'settlement-partner') {
      if (partnerTx || candidate.tokenInSymbol !== expectedPartnerToken) {
        break
      }

      partnerTx = candidate
      settlementTxs.push(candidate)
      lastVisibleTx = candidate
      continue
    }

    break
  }

  return {
    swapTx,
    burnTx,
    partnerTx,
    transactions: settlementTxs,
  }
}

const buildFeederSettlementSummary = ({
  route,
  netTokenAmount,
  attachment,
}: {
  route: FeederRoute
  netTokenAmount: bigint
  attachment: FeederSettlementAttachment
}): FeederSettlementSummary => {
  const expectedCount = route === 'hc-start-jit-gain' ? 3 : 2
  const burnedAmount = attachment.burnTx?.amountOut ?? 0n
  const burnInputAmount = route === 'hc-start-jit-gain' ? attachment.swapTx?.amountIn ?? 0n : attachment.burnTx?.amountIn ?? 0n
  const partnerAmount = attachment.partnerTx?.amountOut ?? 0n
  const partnerTokenSymbol = route === 'hc-start-jit-gain' ? 'JIT' : 'HOLYC'
  const retainedTokenSymbol = route === 'hc-start-jit-gain' ? 'JIT' : 'HOLYC'
  const retainedAmount = clampBigInt(netTokenAmount - burnInputAmount - partnerAmount)
  const status: FeederSettlementStatus =
    attachment.transactions.length === 0
      ? 'none'
      : attachment.transactions.length === expectedCount
      ? 'complete'
      : 'partial'

  return {
    status,
    burnedAmount,
    burnInputAmount,
    partnerAmount,
    partnerTokenSymbol,
    retainedAmount,
    retainedTokenSymbol,
    transactions: attachment.transactions.map(toFeederSettlementTransaction),
  }
}

const buildFeederExecution = (
  loopTxs: FeederTxSummary[],
  settlementAttachment: FeederSettlementAttachment
): FeederArbExecution | null => {
  const swapTx = loopTxs.find((tx) => tx.kind === 'swap')
  if (!swapTx || !swapTx.route) return null

  const coreKind = swapTx.route === 'hc-start-jit-gain' ? 'compile' : 'restore'
  const coreSteps = loopTxs.filter((tx) => tx.kind === coreKind)
  if (coreSteps.length < 2) return null

  const openingCore = coreSteps[0]
  const closingCore = coreSteps[coreSteps.length - 1]
  const netTokenSymbol = swapTx.route === 'hc-start-jit-gain' ? 'JIT' : 'HOLYC'
  const netTokenAmount = closingCore.amountOut - openingCore.amountOut
  if (netTokenAmount <= 0n) return null

  const directHolyBurned = loopTxs.reduce((total, tx) => total + tx.directHolyBurned, 0n)
  const compilerFeeHolyc = loopTxs.reduce((total, tx) => total + tx.compilerFeeEquivalentHolyc, 0n)
  const jitTransferTaxBurned = loopTxs.reduce((total, tx) => total + tx.jitTransferTaxBurned, 0n)
  const jitRestorePrincipalBurned = loopTxs.reduce((total, tx) => total + tx.jitRestorePrincipalBurned, 0n)
  const effectiveHolyBurned = loopTxs.reduce((total, tx) => total + tx.effectiveHolyContribution, 0n)

  const orderedSteps = loopTxs.map((tx, index) => {
    const role: 'rebalance' | 'core' | 'swap' =
      tx.kind === 'swap' ? 'swap' : index === 0 && tx.kind !== coreKind ? 'rebalance' : 'core'
    return buildFeederStep(tx, role, index)
  })
  const latestVisibleTx =
    settlementAttachment.transactions[settlementAttachment.transactions.length - 1] ?? loopTxs[loopTxs.length - 1]
  const settlement = buildFeederSettlementSummary({
    route: swapTx.route,
    netTokenAmount,
    attachment: settlementAttachment,
  })

  return {
    source: 'feeder-bot',
    transactionHash: swapTx.hash,
    blockNumber: latestVisibleTx.blockNumber,
    timestamp: latestVisibleTx.timestamp,
    route: swapTx.route,
    loopTransactionHashes: loopTxs.map((tx) => tx.hash),
    netTokenSymbol,
    netTokenAmount,
    effectiveHolyBurned,
    directHolyBurned,
    compilerFeeHolyc,
    jitTransferTaxBurned,
    jitRestorePrincipalBurned,
    settlement,
    steps: orderedSteps,
  }
}

const groupFeederLoops = (transactions: FeederTxSummary[], claimedHashes: Set<string>) => {
  const sorted = [...transactions].sort((left, right) => {
    if (left.nonce !== right.nonce) return left.nonce - right.nonce
    if (left.blockNumber !== right.blockNumber) return Number(left.blockNumber - right.blockNumber)
    return left.timestamp - right.timestamp
  })

  const indexByHash = new Map(sorted.map((tx, index) => [tx.hash, index]))
  const used = new Set(claimedHashes)
  const loops: FeederArbExecution[] = []

  sorted.forEach((tx, index) => {
    if (tx.kind !== 'swap' || !tx.route || used.has(tx.hash)) {
      return
    }

    const coreKind = tx.route === 'hc-start-jit-gain' ? 'compile' : 'restore'
    const rebalanceKind = tx.route === 'hc-start-jit-gain' ? 'restore' : 'compile'
    const previousCore = findAdjacentFeederTx({
      items: sorted,
      index,
      direction: -1,
      expectedKind: coreKind,
      reference: tx,
    })
    const nextCore = findAdjacentFeederTx({
      items: sorted,
      index,
      direction: 1,
      expectedKind: coreKind,
      reference: tx,
    })

    if (!previousCore || !nextCore) {
      return
    }

    const previousCoreIndex = indexByHash.get(previousCore.hash) ?? -1
    const rebalanceTx = previousCoreIndex >= 0
      ? findAdjacentFeederTx({
          items: sorted,
          index: previousCoreIndex,
          direction: -1,
          expectedKind: rebalanceKind,
          reference: previousCore,
        })
      : null

    const loopTxs = rebalanceTx ? [rebalanceTx, previousCore, tx, nextCore] : [previousCore, tx, nextCore]
    const firstTx = loopTxs[0]
    const lastTx = loopTxs[loopTxs.length - 1]

    if (
      lastTx.nonce - firstTx.nonce > MAX_FEEDER_LOOP_NONCE_SPAN ||
      lastTx.blockNumber - firstTx.blockNumber > MAX_FEEDER_LOOP_BLOCK_SPAN ||
      lastTx.timestamp - firstTx.timestamp > MAX_FEEDER_LOOP_TIME_SPAN_MS
    ) {
      return
    }

    const lastTxIndex = indexByHash.get(lastTx.hash)
    const settlementAttachment =
      lastTxIndex === undefined
        ? { swapTx: null, burnTx: null, partnerTx: null, transactions: [] }
        : collectFeederSettlement({
            items: sorted,
            startIndex: lastTxIndex,
            reference: lastTx,
            route: tx.route,
            used,
          })

    const execution = buildFeederExecution(loopTxs, settlementAttachment)
    if (!execution) {
      return
    }

    loopTxs.forEach((loopTx) => used.add(loopTx.hash))
    settlementAttachment.transactions.forEach((settlementTx) => used.add(settlementTx.hash))
    loops.push(execution)
  })

  return loops
}

const fetchFeederTransferHashes = async (
  publicClient: PulsePublicClient,
  address: `0x${string}`,
  fromBlock: bigint,
  toBlock: bigint
) => {
  const [fromLogs, toLogs] = (await Promise.all([
    withRetry(
      () =>
        publicClient.getLogs({
          address,
          event: TRANSFER_EVENT,
          args: { from: FEEDER_BOT_ADDRESS },
          fromBlock,
          toBlock,
        }),
      MAX_RETRIES
    ),
    withRetry(
      () =>
        publicClient.getLogs({
          address,
          event: TRANSFER_EVENT,
          args: { to: FEEDER_BOT_ADDRESS },
          fromBlock,
          toBlock,
        }),
      MAX_RETRIES
    ),
  ])) as [TransferLogWithHash[], TransferLogWithHash[]]

  return [...fromLogs, ...toLogs]
    .map((log) => log.transactionHash)
    .filter((hash): hash is `0x${string}` => Boolean(hash))
}

const fetchFeederExecutions = async ({
  publicClient,
  existingExecutions,
  latestBlock,
  loadMore,
  cursor,
  targetCount,
}: {
  publicClient: PulsePublicClient
  existingExecutions: Map<string, FeederArbExecution>
  latestBlock: bigint
  loadMore: boolean
  cursor: bigint | null
  targetCount: number
}) => {
  if (loadMore && cursor === null) {
    return {
      executions: Array.from(existingExecutions.values()),
      nextFromBlock: null,
    }
  }

  const executionMap = new Map(existingExecutions)
  const claimedHashes = new Set(
    Array.from(existingExecutions.values()).flatMap((execution) => [
      ...execution.loopTransactionHashes,
      ...execution.settlement.transactions.map((transaction) => transaction.hash),
    ])
  )
  const batchLimit = executionMap.size === 0 ? MAX_BATCHES_PER_FETCH * EMPTY_BATCH_MULTIPLIER : MAX_BATCHES_PER_FETCH
  const collectedTransactions = new Map<string, FeederTxSummary>()
  let toBlock = loadMore && cursor !== null ? cursor : latestBlock
  let batches = 0
  let localNextFrom: bigint | null = cursor
  let currentChunk = BLOCK_CHUNK

  while (toBlock >= 0n && batches < batchLimit && executionMap.size < targetCount) {
    const fromBlock = toBlock >= currentChunk ? toBlock - currentChunk + 1n : 0n
    let hashes: `0x${string}`[] = []

    try {
      const [holyHashes, jitHashes] = await Promise.all([
        fetchFeederTransferHashes(publicClient, HOLY_C_ADDRESS, fromBlock, toBlock),
        fetchFeederTransferHashes(publicClient, JIT_ADDRESS, fromBlock, toBlock),
      ])
      hashes = Array.from(new Set([...holyHashes, ...jitHashes]))
      if (currentChunk < BLOCK_CHUNK) {
        const nextChunk = currentChunk * 2n
        currentChunk = nextChunk > BLOCK_CHUNK ? BLOCK_CHUNK : nextChunk
      }
    } catch (error) {
      if (currentChunk > MIN_BLOCK_CHUNK) {
        currentChunk = currentChunk / 2n < MIN_BLOCK_CHUNK ? MIN_BLOCK_CHUNK : currentChunk / 2n
        continue
      }
      throw error
    }

    if (hashes.length) {
      const CHUNK_SIZE = 2
      for (let index = 0; index < hashes.length; index += CHUNK_SIZE) {
        const summaries = await Promise.all(
          hashes.slice(index, index + CHUNK_SIZE).map((hash) => summarizeFeederTransaction(publicClient, hash))
        )
        summaries.forEach((summary) => {
          if (summary) {
            collectedTransactions.set(summary.hash, summary)
          }
        })
      }

      const grouped = groupFeederLoops(Array.from(collectedTransactions.values()), claimedHashes)
      grouped.forEach((execution) => {
        executionMap.set(execution.transactionHash, execution)
        execution.loopTransactionHashes.forEach((hash) => claimedHashes.add(hash))
        execution.settlement.transactions.forEach((transaction) => claimedHashes.add(transaction.hash))
      })
    }

    localNextFrom = fromBlock > 0n ? fromBlock - 1n : null
    toBlock = localNextFrom ?? -1n
    batches += 1
  }

  const nextCursor =
    localNextFrom === null
      ? null
      : localNextFrom + FEEDER_CURSOR_OVERLAP > latestBlock
      ? latestBlock
      : localNextFrom + FEEDER_CURSOR_OVERLAP

  return {
    executions: Array.from(executionMap.values()),
    nextFromBlock: nextCursor,
  }
}

const sortExecutions = (items: ActivityExecution[]) =>
  [...items].sort((left, right) => {
    const blockDiff = Number(right.blockNumber - left.blockNumber)
    if (blockDiff !== 0) return blockDiff
    return right.timestamp - left.timestamp
  })

const emptyCursor: FeedCursor = {
  divine: null,
  feeder: null,
}

export const useDivineManagerActivity = () => {
  const [executions, setExecutions] = useState<ActivityExecution[]>(cachedActivityState?.executions ?? [])
  const [isLoading, setIsLoading] = useState(cachedActivityState ? false : true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(cachedActivityState?.hasMore ?? true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(cachedActivityState?.lastUpdated ?? null)
  const [nextFromBlock, setNextFromBlock] = useState<FeedCursor>(cachedActivityState?.nextFromBlock ?? emptyCursor)
  const executionsRef = useRef<ActivityExecution[]>([])
  const nextFromBlockRef = useRef<FeedCursor>(emptyCursor)
  const isFetchingRef = useRef(false)
  const hasCachedDataRef = useRef(Boolean(cachedActivityState?.executions?.length))

  useEffect(() => {
    executionsRef.current = executions
  }, [executions])

  useEffect(() => {
    nextFromBlockRef.current = nextFromBlock
  }, [nextFromBlock])

  const fetchActivity = useCallback(async ({ silent = false, reset = false, loadMore = false }: FetchOptions = {}) => {
    if (isFetchingRef.current) {
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
      if (!publicClient) {
        throw new Error('Public client not available')
      }

      const latestBlock = await withRetry(() => publicClient.getBlockNumber())
      const existingExecutions = reset ? [] : executionsRef.current
      const divineExisting = new Map(
        existingExecutions
          .filter((execution): execution is DivineManagerExecution => execution.source === 'divine-manager')
          .map((execution) => [execution.transactionHash, execution])
      )
      const feederExisting = new Map(
        existingExecutions
          .filter((execution): execution is FeederArbExecution => execution.source === 'feeder-bot')
          .map((execution) => [execution.transactionHash, execution])
      )

      const sourceTargetCount = loadMore
        ? Math.max(TARGET_EXECUTION_COUNT, Math.max(divineExisting.size, feederExisting.size) + TARGET_EXECUTION_COUNT)
        : Math.max(TARGET_EXECUTION_COUNT, Math.max(divineExisting.size, feederExisting.size) + 5)

      const [divineResult, feederResult] = await Promise.all([
        fetchDivineExecutions({
          publicClient,
          existingExecutions: divineExisting,
          latestBlock,
          loadMore,
          cursor: loadMore ? nextFromBlockRef.current.divine : null,
          targetCount: sourceTargetCount,
        }),
        fetchFeederExecutions({
          publicClient,
          existingExecutions: feederExisting,
          latestBlock,
          loadMore,
          cursor: loadMore ? nextFromBlockRef.current.feeder : null,
          targetCount: sourceTargetCount,
        }),
      ])

      const ordered = sortExecutions([...divineResult.executions, ...feederResult.executions])
      const updatedAt = Date.now()
      const nextCursor: FeedCursor = {
        divine: loadMore ? divineResult.nextFromBlock : nextFromBlockRef.current.divine ?? divineResult.nextFromBlock,
        feeder: loadMore ? feederResult.nextFromBlock : nextFromBlockRef.current.feeder ?? feederResult.nextFromBlock,
      }
      const nextHasMore = nextCursor.divine !== null || nextCursor.feeder !== null

      setExecutions(ordered)
      setLastUpdated(updatedAt)
      setNextFromBlock(nextCursor)
      setHasMore(nextHasMore)
      cachedActivityState = {
        executions: ordered,
        nextFromBlock: nextCursor,
        lastUpdated: updatedAt,
        hasMore: nextHasMore,
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load Divine Manager activity')
    } finally {
      isFetchingRef.current = false
      if (loadMore) {
        setIsLoadingMore(false)
      } else if (!silent) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void fetchActivity({
      reset: !hasCachedDataRef.current,
      silent: hasCachedDataRef.current,
    })

    const interval = setInterval(() => {
      void fetchActivity({ silent: true })
    }, REFRESH_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchActivity])

  return {
    executions,
    isLoading,
    isLoadingMore,
    hasMore,
    error,
    lastUpdated,
    refresh: () => fetchActivity({ silent: false }),
    loadMore: () => fetchActivity({ silent: true, loadMore: true }),
  }
}
