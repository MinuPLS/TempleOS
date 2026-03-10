#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_RPC_URL = 'https://rpc.pulsechain.com'
const HOLYC_ADDRESS = '0x6c8fdfd2cec0b83d69045074d57a87fa1525225a'
const JIT_ADDRESS = '0x57909025ace10d5de114d96e3ec84f282895870c'
const BURN_ADDRESS = '0x0000000000000000000000000000000000000369'
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ZERO_TOPIC = '0x0000000000000000000000000000000000000000000000000000000000000000'
const LOG_CHUNK_SIZE = 8000n
const BLOCK_BATCH_SIZE = 50
const HOUR_MS = 60 * 60 * 1000
const HISTORY_DAYS = 30
const DEFAULT_OUTPUT = '../public/effective-burn-stats.json'

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const now = options.now ? new Date(options.now) : new Date()
  if (Number.isNaN(now.getTime())) {
    throw new Error(`Invalid --now value: ${options.now}`)
  }

  const outputPath = resolveOutputPath(options.output)
  const existingStats = await readStatsFile(outputPath)
  const currentHourMs = truncateToHourMs(now.getTime())
  let snapshots

  if (options.seed || !existingStats) {
    snapshots = await buildSeedSnapshots(options.rpcUrl, currentHourMs)
  } else {
    snapshots = loadSnapshots(existingStats)
    if (snapshots.size === 0) {
      snapshots = await buildSeedSnapshots(options.rpcUrl, currentHourMs)
    } else {
      const current = await fetchEffectiveRemoved(options.rpcUrl, JIT_ADDRESS)
      snapshots.set(isoHourFromMs(currentHourMs), current)
    }
  }

  pruneSnapshots(snapshots, currentHourMs)
  const stats = buildStatsFromSnapshots(snapshots, currentHourMs, now)

  if (existingStats && statsPayload(existingStats) === statsPayload(stats)) {
    console.log(`No material change for ${outputPath}`)
    console.log(`Current remains ${stats.current}`)
    return
  }

  await writeStatsFile(outputPath, stats)

  console.log(`Updated ${outputPath}`)
  console.log(`Current: ${stats.current}`)
  console.log(`24h: ${stats.delta24h}`)
  console.log(`7d: ${stats.delta7d}`)
  console.log(`30d: ${stats.delta30d}`)
}

function parseArgs(args) {
  const options = {
    now: '',
    output: DEFAULT_OUTPUT,
    rpcUrl: process.env.PULSECHAIN_RPC_URL || process.env.RPC_URL || DEFAULT_RPC_URL,
    seed: false,
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--seed') {
      options.seed = true
    } else if (arg === '--rpc-url') {
      options.rpcUrl = requireValue(args[++i], '--rpc-url')
    } else if (arg === '--output') {
      options.output = requireValue(args[++i], '--output')
    } else if (arg === '--now') {
      options.now = requireValue(args[++i], '--now')
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  return options
}

function printHelp() {
  console.log(`Usage:
  node scripts/update-effective-burn-stats.mjs
  node scripts/update-effective-burn-stats.mjs --seed

Options:
  --seed         Rebuild the last 30 days of hourly snapshots from chain data.
  --rpc-url URL  Override the PulseChain RPC URL.
  --output FILE  Override the output JSON path.
  --now ISO      Use a fixed timestamp for repeatable runs.`)
}

function requireValue(value, flag) {
  if (!value) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

function resolveOutputPath(relativePath) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(scriptDir, relativePath)
}

async function readStatsFile(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null
    }
    throw error
  }
}

function loadSnapshots(existingStats) {
  const entries = Object.entries(existingStats?.snapshots || {})
  const snapshots = new Map()

  for (const [hour, value] of entries) {
    if (typeof hour !== 'string' || typeof value !== 'string') {
      continue
    }
    snapshots.set(hour, BigInt(value))
  }

  return snapshots
}

function statsPayload(stats) {
  return JSON.stringify({
    current: stats.current || '0',
    delta24h: stats.delta24h || '0',
    delta7d: stats.delta7d || '0',
    delta30d: stats.delta30d || '0',
    snapshots: stats.snapshots || {},
  })
}

async function buildSeedSnapshots(rpcUrl, currentHourMs) {
  const startHourMs = currentHourMs - HISTORY_DAYS * 24 * HOUR_MS
  const latestBlock = await getLatestBlock(rpcUrl)
  const startBlock = await findFirstBlockAtOrAfter(rpcUrl, Math.floor(startHourMs / 1000), latestBlock)
  const timedEvents = []
  const blockNumbers = new Set()

  await collectTransferDeltas({
    address: HOLYC_ADDRESS,
    blockNumbers,
    deltaSign: 1n,
    fromBlock: startBlock,
    label: 'HolyC inflows to JIT',
    rpcUrl,
    timedEvents,
    toBlock: latestBlock,
    topics: [TRANSFER_TOPIC, null, topicAddress(JIT_ADDRESS)],
  })

  await collectTransferDeltas({
    address: HOLYC_ADDRESS,
    blockNumbers,
    deltaSign: -1n,
    fromBlock: startBlock,
    label: 'HolyC outflows from JIT',
    rpcUrl,
    timedEvents,
    toBlock: latestBlock,
    topics: [TRANSFER_TOPIC, topicAddress(JIT_ADDRESS)],
  })

  await collectTransferDeltas({
    address: HOLYC_ADDRESS,
    blockNumbers,
    deltaSign: 1n,
    fromBlock: startBlock,
    label: 'HolyC inflows to burn',
    rpcUrl,
    timedEvents,
    toBlock: latestBlock,
    topics: [TRANSFER_TOPIC, null, topicAddress(BURN_ADDRESS)],
  })

  await collectTransferDeltas({
    address: HOLYC_ADDRESS,
    blockNumbers,
    deltaSign: -1n,
    fromBlock: startBlock,
    label: 'HolyC outflows from burn',
    rpcUrl,
    timedEvents,
    toBlock: latestBlock,
    topics: [TRANSFER_TOPIC, topicAddress(BURN_ADDRESS)],
  })

  await collectTransferDeltas({
    address: JIT_ADDRESS,
    blockNumbers,
    deltaSign: -1n,
    fromBlock: startBlock,
    label: 'JIT mints',
    rpcUrl,
    timedEvents,
    toBlock: latestBlock,
    topics: [TRANSFER_TOPIC, ZERO_TOPIC],
  })

  await collectTransferDeltas({
    address: JIT_ADDRESS,
    blockNumbers,
    deltaSign: 1n,
    fromBlock: startBlock,
    label: 'JIT burns',
    rpcUrl,
    timedEvents,
    toBlock: latestBlock,
    topics: [TRANSFER_TOPIC, null, ZERO_TOPIC],
  })

  const blockTimestamps = await fetchBlockTimestamps(rpcUrl, blockNumbers)
  const hourlyDeltas = new Map()

  for (const event of timedEvents) {
    const timestamp = blockTimestamps.get(event.blockNumber)
    if (timestamp === undefined) {
      throw new Error(`Missing timestamp for block ${event.blockNumber.toString()}`)
    }
    const hourIso = isoHourFromSeconds(timestamp)
    if (Date.parse(hourIso) < startHourMs || Date.parse(hourIso) > currentHourMs) {
      continue
    }
    addBigInt(hourlyDeltas, hourIso, event.delta)
  }

  const liveCurrent = await fetchEffectiveRemoved(rpcUrl, JIT_ADDRESS)
  const currentHourIso = isoHourFromMs(currentHourMs)
  const currentHourDelta = hourlyDeltas.get(currentHourIso) || 0n
  const snapshots = new Map()
  const currentHourSnapshot = liveCurrent - currentHourDelta

  if (currentHourSnapshot < 0n) {
    throw new Error('Computed negative snapshot for current hour')
  }

  snapshots.set(currentHourIso, currentHourSnapshot)

  for (let hourMs = currentHourMs - HOUR_MS; hourMs >= startHourMs; hourMs -= HOUR_MS) {
    const hourIso = isoHourFromMs(hourMs)
    const nextHourIso = isoHourFromMs(hourMs + HOUR_MS)
    const nextSnapshot = snapshots.get(nextHourIso)
    if (nextSnapshot === undefined) {
      throw new Error(`Missing next-hour snapshot for ${nextHourIso}`)
    }
    const delta = hourlyDeltas.get(hourIso) || 0n
    const value = nextSnapshot - delta
    if (value < 0n) {
      throw new Error(`Computed negative snapshot for ${hourIso}`)
    }
    snapshots.set(hourIso, value)
  }

  return snapshots
}

function pruneSnapshots(snapshots, currentHourMs) {
  const cutoffMs = currentHourMs - HISTORY_DAYS * 24 * HOUR_MS
  for (const hour of snapshots.keys()) {
    const timestamp = Date.parse(hour)
    if (Number.isNaN(timestamp) || timestamp < cutoffMs) {
      snapshots.delete(hour)
    }
  }
}

function buildStatsFromSnapshots(snapshots, currentHourMs, now) {
  const orderedEntries = Array.from(snapshots.entries())
    .sort(([left], [right]) => left.localeCompare(right))
  const current = findSnapshotAtOrBefore(orderedEntries, currentHourMs)

  const delta = (snapshot) => {
    if (snapshot === null || current === null || current === 0n) {
      return '0'
    }
    const difference = current - snapshot
    return difference > 0n ? difference.toString() : '0'
  }

  const compactedEntries = compactSnapshotEntries(orderedEntries)
  const orderedSnapshots = Object.fromEntries(
    compactedEntries.map(([hour, value]) => [hour, value.toString()]),
  )

  return {
    current: (current || 0n).toString(),
    delta24h: delta(findSnapshotAtOrBefore(orderedEntries, currentHourMs - 24 * HOUR_MS)),
    delta7d: delta(findSnapshotAtOrBefore(orderedEntries, currentHourMs - 7 * 24 * HOUR_MS)),
    delta30d: delta(findSnapshotAtOrBefore(orderedEntries, currentHourMs - 30 * 24 * HOUR_MS)),
    snapshots: orderedSnapshots,
    updatedAt: now.toISOString(),
  }
}

function findSnapshotAtOrBefore(orderedEntries, targetMs) {
  let result = null

  for (const [hour, value] of orderedEntries) {
    const hourMs = Date.parse(hour)
    if (Number.isNaN(hourMs) || hourMs > targetMs) {
      break
    }
    result = value
  }

  return result
}

function compactSnapshotEntries(orderedEntries) {
  const compacted = []
  let previousValue = null

  for (const [hour, value] of orderedEntries) {
    if (previousValue !== null && value === previousValue) {
      continue
    }
    compacted.push([hour, value])
    previousValue = value
  }

  return compacted
}

async function writeStatsFile(filePath, stats) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8')
}

async function collectTransferDeltas({ address, blockNumbers, deltaSign, fromBlock, label, rpcUrl, timedEvents, toBlock, topics }) {
  console.log(`Fetching ${label}...`)
  const logs = await fetchLogs(rpcUrl, address, fromBlock, toBlock, topics)

  for (const log of logs) {
    const amount = BigInt(log.data || '0x0')
    if (amount === 0n) {
      continue
    }
    const blockNumber = BigInt(log.blockNumber)
    timedEvents.push({ blockNumber, delta: deltaSign * amount })
    blockNumbers.add(blockNumber)
  }
}

async function fetchLogs(rpcUrl, address, fromBlock, toBlock, topics) {
  const results = []
  let current = fromBlock

  while (current <= toBlock) {
    const chunkEnd = current + LOG_CHUNK_SIZE - 1n > toBlock ? toBlock : current + LOG_CHUNK_SIZE - 1n
    const params = [{
      address,
      fromBlock: toHex(current),
      toBlock: toHex(chunkEnd),
      topics,
    }]
    const chunk = await rpcCall(rpcUrl, 'eth_getLogs', params)
    results.push(...chunk)
    current = chunkEnd + 1n
  }

  return results
}

async function fetchBlockTimestamps(rpcUrl, blockNumbers) {
  const timestamps = new Map()
  const sortedBlocks = Array.from(blockNumbers).sort((left, right) => (left < right ? -1 : 1))

  for (let index = 0; index < sortedBlocks.length; index += BLOCK_BATCH_SIZE) {
    const slice = sortedBlocks.slice(index, index + BLOCK_BATCH_SIZE)
    const payload = slice.map((block, offset) => ({
      id: index + offset + 1,
      jsonrpc: '2.0',
      method: 'eth_getBlockByNumber',
      params: [toHex(block), false],
    }))
    const responses = await rpcBatch(rpcUrl, payload)

    for (const response of responses) {
      if (!response?.result?.number || !response?.result?.timestamp) {
        continue
      }
      timestamps.set(BigInt(response.result.number), parseInt(response.result.timestamp, 16))
    }
  }

  return timestamps
}

async function fetchEffectiveRemoved(rpcUrl, jitAddress) {
  const payload = [
    { id: 1, jsonrpc: '2.0', method: 'eth_call', params: [{ to: HOLYC_ADDRESS, data: encodeBalanceOf(jitAddress) }, 'latest'] },
    { id: 2, jsonrpc: '2.0', method: 'eth_call', params: [{ to: jitAddress, data: encodeTotalSupply() }, 'latest'] },
    { id: 3, jsonrpc: '2.0', method: 'eth_call', params: [{ to: HOLYC_ADDRESS, data: encodeBalanceOf(BURN_ADDRESS) }, 'latest'] },
  ]
  const responses = await rpcBatch(rpcUrl, payload)
  const holyCLockedInJit = BigInt(responses[0].result)
  const jitTotalSupply = BigInt(responses[1].result)
  const holyCAtBurn = BigInt(responses[2].result)
  const permanentlyLocked = holyCLockedInJit > jitTotalSupply ? holyCLockedInJit - jitTotalSupply : 0n
  return permanentlyLocked + holyCAtBurn
}

async function getLatestBlock(rpcUrl) {
  const latestHex = await rpcCall(rpcUrl, 'eth_blockNumber', [])
  return BigInt(latestHex)
}

async function findFirstBlockAtOrAfter(rpcUrl, targetTimestamp, latestBlock) {
  let low = 0n
  let high = latestBlock

  while (low < high) {
    const mid = (low + high) / 2n
    const block = await rpcCall(rpcUrl, 'eth_getBlockByNumber', [toHex(mid), false])
    const timestamp = parseInt(block.timestamp, 16)
    if (timestamp >= targetTimestamp) {
      high = mid
    } else {
      low = mid + 1n
    }
  }

  return low
}

async function rpcCall(rpcUrl, method, params) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`RPC ${method} failed with status ${response.status}`)
  }

  const json = await response.json()
  if (json.error) {
    throw new Error(`RPC ${method} error: ${JSON.stringify(json.error)}`)
  }

  return json.result
}

async function rpcBatch(rpcUrl, payload) {
  const response = await fetch(rpcUrl, {
    body: JSON.stringify(payload),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(`RPC batch failed with status ${response.status}`)
  }

  const json = await response.json()
  if (!Array.isArray(json)) {
    throw new Error('RPC batch response malformed')
  }

  const firstError = json.find((entry) => entry && entry.error)
  if (firstError) {
    throw new Error(`RPC batch error: ${JSON.stringify(firstError.error)}`)
  }

  return json.sort((left, right) => left.id - right.id)
}

function topicAddress(address) {
  return `0x${address.toLowerCase().replace('0x', '').padStart(64, '0')}`
}

function encodeBalanceOf(address) {
  return `0x70a08231${address.toLowerCase().replace('0x', '').padStart(64, '0')}`
}

function encodeTotalSupply() {
  return '0x18160ddd'
}

function toHex(value) {
  return `0x${value.toString(16)}`
}

function truncateToHourMs(timestampMs) {
  return Math.floor(timestampMs / HOUR_MS) * HOUR_MS
}

function isoHourFromMs(timestampMs) {
  return new Date(truncateToHourMs(timestampMs)).toISOString().replace('.000Z', 'Z')
}

function isoHourFromSeconds(timestampSeconds) {
  return isoHourFromMs(timestampSeconds * 1000)
}

function addBigInt(map, key, value) {
  map.set(key, (map.get(key) || 0n) + value)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
