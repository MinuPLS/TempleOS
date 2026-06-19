import { getAddress } from 'viem'
import { SWAP_TOPIC, SYNC_TOPIC, TRANSFER_TOPIC } from './abi'

export interface RawLog {
  address: string
  topics: readonly string[]
  data: string
  logIndex: number
}

export interface ParsedTransfer {
  tokenAddress: string
  from: string
  to: string
  value: bigint
  logIndex: number
}

export interface ParsedSwap {
  poolAddress: string
  sender: string
  to: string
  amount0In: bigint
  amount1In: bigint
  amount0Out: bigint
  amount1Out: bigint
  logIndex: number
}

export interface ParsedSync {
  poolAddress: string
  reserve0: bigint
  reserve1: bigint
  logIndex: number
}

export interface ParsedLogs {
  transfers: ParsedTransfer[]
  swaps: ParsedSwap[]
  syncs: ParsedSync[]
  swapPoolAddresses: Set<string>
}

const topicAddress = (topic?: string): string => {
  if (!topic) return '0x0000000000000000000000000000000000000000'
  const normalized = `0x${topic.slice(topic.length - 40)}`
  try {
    return getAddress(normalized)
  } catch {
    return normalized.toLowerCase()
  }
}

const hexToBigInt = (hex: string): bigint => {
  if (!hex || hex === '0x') return 0n
  try {
    return BigInt(hex)
  } catch {
    return 0n
  }
}

export const parseTransferLog = (log: RawLog): ParsedTransfer | null => {
  if (!log.topics?.length) return null
  if (log.topics[0].toLowerCase() !== TRANSFER_TOPIC) return null
  const from = topicAddress(log.topics[1])
  const to = topicAddress(log.topics[2])
  const value = hexToBigInt(log.data)
  return {
    tokenAddress: getAddress(log.address),
    from,
    to,
    value,
    logIndex: log.logIndex,
  }
}

const decodeSwapData = (data: string): {
  amount0In: bigint
  amount1In: bigint
  amount0Out: bigint
  amount1Out: bigint
} => {
  if (!data || data === '0x' || data.length < 130) {
    return { amount0In: 0n, amount1In: 0n, amount0Out: 0n, amount1Out: 0n }
  }
  // Swap event data = 4x uint256 (amount0In, amount1In, amount0Out, amount1Out), each 32 bytes
  const chunk = (offset: number): bigint => hexToBigInt('0x' + data.slice(2 + offset * 64, 2 + offset * 64 + 64))
  return {
    amount0In: chunk(0),
    amount1In: chunk(1),
    amount0Out: chunk(2),
    amount1Out: chunk(3),
  }
}

export const parseSwapLog = (log: RawLog): ParsedSwap | null => {
  if (!log.topics?.length) return null
  if (log.topics[0].toLowerCase() !== SWAP_TOPIC) return null
  if (log.topics.length < 3) return null
  const sender = topicAddress(log.topics[1])
  const to = topicAddress(log.topics[2])
  const { amount0In, amount1In, amount0Out, amount1Out } = decodeSwapData(log.data)
  return {
    poolAddress: getAddress(log.address),
    sender,
    to,
    amount0In,
    amount1In,
    amount0Out,
    amount1Out,
    logIndex: log.logIndex,
  }
}

const decodeSyncData = (data: string): { reserve0: bigint; reserve1: bigint } => {
  if (!data || data === '0x' || data.length < 66) {
    return { reserve0: 0n, reserve1: 0n }
  }
  return {
    reserve0: hexToBigInt('0x' + data.slice(2, 66)),
    reserve1: hexToBigInt('0x' + data.slice(66, 130)),
  }
}

export const parseSyncLog = (log: RawLog): ParsedSync | null => {
  if (!log.topics?.length) return null
  if (log.topics[0].toLowerCase() !== SYNC_TOPIC) return null
  const { reserve0, reserve1 } = decodeSyncData(log.data)
  return {
    poolAddress: getAddress(log.address),
    reserve0,
    reserve1,
    logIndex: log.logIndex,
  }
}

export const parseReceiptLogs = (logs: readonly RawLog[]): ParsedLogs => {
  const transfers: ParsedTransfer[] = []
  const swaps: ParsedSwap[] = []
  const syncs: ParsedSync[] = []
  const swapPoolAddresses = new Set<string>()

  const ordered = [...logs].sort((a, b) => a.logIndex - b.logIndex)

  for (const log of ordered) {
    const t = parseTransferLog(log)
    if (t) {
      transfers.push(t)
      continue
    }
    const s = parseSwapLog(log)
    if (s) {
      swaps.push(s)
      swapPoolAddresses.add(s.poolAddress.toLowerCase())
      continue
    }
    const sync = parseSyncLog(log)
    if (sync) {
      syncs.push(sync)
    }
  }

  return { transfers, swaps, syncs, swapPoolAddresses }
}

export const lower = (addr: string): string => addr.toLowerCase()

export const getTopicAddress = topicAddress
