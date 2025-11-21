import { useCallback, useEffect, useState } from 'react'
import { getPublicClient } from '@wagmi/core'
import { getAddress } from 'viem'
import { config, pulseChain } from '@/config/wagmi'
import {
  DIVINE_MANAGER_ADDRESS,
  DIVINE_MANAGER_ABI,
  HOLY_C_ADDRESS,
  JIT_ADDRESS,
  WPLS_ADDRESS,
  HOLYC_WPLS_PAIR_ADDRESS,
  JIT_WPLS_PAIR_ADDRESS,
  HOLYC_JIT_PAIR_ADDRESS,
  CONTRACT_ADDRESSES,
} from '@/config/contracts'

export type StepToken = 'HOLYC' | 'JIT' | 'WPLS' | 'UNKNOWN'
export type StepType = 'compile' | 'restore' | 'swap'
export type PoolKey = 'HOLYC_WPLS' | 'JIT_WPLS' | 'HOLYC_JIT'

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

export interface DivineManagerExecution {
  transactionHash: `0x${string}`
  blockNumber: bigint
  timestamp: number
  strategyId: string
  jobNonce: string
  holyBurned: bigint
  jitBurned: bigint
  holyIn: bigint
  holyOut: bigint
  jitIn: bigint
  jitOut: bigint
  steps: DivineManagerStep[]
}

interface FetchOptions {
  silent?: boolean
}

const LOG_LOOKBACK_BLOCKS = 200_000n
const MAX_EVENTS = 50
const REFRESH_INTERVAL = 60_000
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

type RawLog = {
  address: `0x${string}`
  topics: `0x${string}`[]
  data: `0x${string}`
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

export const useDivineManagerActivity = () => {
  const [executions, setExecutions] = useState<DivineManagerExecution[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const fetchActivity = useCallback(async ({ silent }: FetchOptions = {}) => {
    if (!silent) {
      setIsLoading(true)
    }
    setError(null)

    try {
      const publicClient = getPublicClient(config, { chainId: pulseChain.id })
      if (!publicClient) throw new Error('Public client not available')

      const latestBlock = await publicClient.getBlockNumber()
      const fromBlock = latestBlock > LOG_LOOKBACK_BLOCKS ? latestBlock - LOG_LOOKBACK_BLOCKS : 0n
      const divineAddress = DIVINE_MANAGER_ADDRESS.toLowerCase()

      const logs = await publicClient.getContractEvents({
        address: DIVINE_MANAGER_ADDRESS,
        abi: DIVINE_MANAGER_ABI,
        eventName: 'TicketExecuted',
        fromBlock,
        toBlock: latestBlock,
      })

      const recentLogs = logs.slice(-MAX_EVENTS)
      const holyAddress = HOLY_C_ADDRESS.toLowerCase()
      const jitAddress = JIT_ADDRESS.toLowerCase()
      const wplsAddress = WPLS_ADDRESS.toLowerCase()

      const pairMetadata: Record<string, { key: PoolKey; label: string; short: string }> = {
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

      const enriched = await Promise.all(
        recentLogs.map(async (log) => {
          const blockNumber = log.blockNumber ?? latestBlock
          const [block, receipt] = await Promise.all([
            publicClient.getBlock({ blockNumber }),
            publicClient.getTransactionReceipt({ hash: log.transactionHash }),
          ])

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

          const createStep = (
            type: StepType,
            label: string,
            tokenInSymbol: StepToken,
            tokenOutSymbol: StepToken,
            amountIn: bigint,
            pool?: PoolKey
          ): DivineManagerStep => ({
            id: `${log.transactionHash}-${steps.length + 1}-${type}`,
            type,
            label,
            tokenInSymbol,
            tokenOutSymbol,
            tokenInAmount: amountIn,
            tokenOutAmount: 0n,
            pool,
            isSettlement: false,
            burns: { holyc: 0n, jit: 0n },
          })

          receipt.logs?.forEach((receiptLog) => {
            const baseLog: RawLog = {
              address: receiptLog.address,
              topics: receiptLog.topics as `0x${string}`[],
              data: receiptLog.data as `0x${string}`,
            }

            const transfer = parseTransfer(baseLog)
            if (!transfer) return

            const logAddress = getAddress(receiptLog.address)
            const normalizedZero = ZERO_ADDRESS.toLowerCase()
            const normalizedBurn = CONTRACT_ADDRESSES.burn.toLowerCase()
            const targetAddress = transfer.to.toLowerCase()
            const fromAddress = transfer.from.toLowerCase()
            const tokenAddress = logAddress.toLowerCase()
            const tokenSymbol: StepToken =
              tokenAddress === holyAddress
                ? 'HOLYC'
                : tokenAddress === jitAddress
                ? 'JIT'
                : tokenAddress === wplsAddress
                ? 'WPLS'
                : 'UNKNOWN'
            const poolTo = pairMetadata[targetAddress]
            const poolFrom = pairMetadata[fromAddress]

            if (poolTo && fromAddress === divineAddress) {
              const step = createStep(
                'swap',
                `${poolTo.label} swap`,
                tokenSymbol,
                'UNKNOWN',
                transfer.value,
                poolTo.key
              )
              steps.push(step)
              if (!swapQueues.has(targetAddress)) swapQueues.set(targetAddress, [])
              swapQueues.get(targetAddress)!.push(step)
            }

            if (poolFrom && targetAddress === divineAddress) {
              const queue = swapQueues.get(fromAddress)
              if (queue?.length) {
                const step = queue.find((candidate) => candidate.tokenOutAmount === 0n) || queue.shift()
                if (step) {
                  step.tokenOutSymbol = tokenSymbol
                  step.tokenOutAmount = transfer.value
                }
              }
            }

            if (logAddress.toLowerCase() === HOLY_C_ADDRESS.toLowerCase()) {
              const isHolyBurn =
                fromAddress === divineAddress && (targetAddress === normalizedZero || targetAddress === normalizedBurn)
              if (isHolyBurn) {
                holyBurned += transfer.value
                for (let i = completedRestores.length - 1; i >= 0; i--) {
                  const candidate = completedRestores[i]
                  if (!candidate.isSettlement && candidate.tokenOutAmount === transfer.value) {
                    candidate.isSettlement = true
                    candidate.settlementAmount = transfer.value
                    break
                  }
                }
              }
              if (targetAddress === divineAddress) {
                holyIn += transfer.value
              }
              if (transfer.from.toLowerCase() === divineAddress) {
                holyOut += transfer.value
                if (tokenSymbol === 'HOLYC' && transfer.to.toLowerCase() === jitAddress) {
                  const step = createStep(
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
              if (transfer.from.toLowerCase() === jitAddress && targetAddress === divineAddress) {
                const restoreStep = restoreQueue.find((candidate) => candidate.tokenOutAmount === 0n)
                if (restoreStep) {
                  restoreStep.tokenOutAmount = transfer.value
                  completedRestores.push(restoreStep)
                }
              }
            }

            if (logAddress.toLowerCase() === JIT_ADDRESS.toLowerCase()) {
              if (targetAddress === normalizedZero || targetAddress === normalizedBurn) {
                jitBurned += transfer.value
              }
              if (targetAddress === divineAddress) {
                jitIn += transfer.value
                if (transfer.from.toLowerCase() === ZERO_ADDRESS) {
                  const pendingCompile = compileQueue.find((candidate) => candidate.tokenOutAmount === 0n)
                  if (pendingCompile) {
                    pendingCompile.tokenOutAmount = transfer.value
                    const fee =
                      pendingCompile.tokenInAmount > transfer.value
                        ? pendingCompile.tokenInAmount - transfer.value
                        : 0n
                    if (fee > 0n) {
                      pendingCompile.burns.holyc += fee
                      holyBurned += fee
                    }
                  }
                }
              }
              if (transfer.from.toLowerCase() === divineAddress) {
                jitOut += transfer.value
                if (targetAddress === ZERO_ADDRESS) {
                  const step = createStep(
                    'restore',
                    'Divine Compiler (JIT→HolyC)',
                    'JIT',
                    'HOLYC',
                    transfer.value
                  )
                  step.burns.jit += transfer.value
                  steps.push(step)
                  restoreQueue.push(step)
                }
              }
            }
          })

          return {
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
        })
      )

      const ordered = enriched
        .filter(
          (tx) =>
            tx.transactionHash &&
            (tx.holyBurned > 0n ||
              tx.jitBurned > 0n ||
              tx.holyIn > 0n ||
              tx.holyOut > 0n ||
              tx.jitIn > 0n ||
              tx.jitOut > 0n)
        )
        .sort((a, b) => {
          const blockDiff = Number(b.blockNumber - a.blockNumber)
          if (blockDiff !== 0) return blockDiff
          return b.timestamp - a.timestamp
        })

      setExecutions(ordered)
      setLastUpdated(Date.now())
    } catch (err) {
      console.error('Error fetching Divine Manager activity:', err)
      setError(err instanceof Error ? err.message : 'Failed to load Divine Manager activity')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchActivity()
    const interval = setInterval(() => {
      fetchActivity({ silent: true })
    }, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchActivity])

  return {
    executions,
    isLoading,
    error,
    lastUpdated,
    refresh: () => fetchActivity(),
  }
}
