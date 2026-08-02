import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const rpcUrl = process.env.PULSECHAIN_RPC_URL || 'https://rpc.pulsechain.com'
const snapshotOutputDirectory = path.resolve(process.env.DIVINE_MANAGER_SNAPSHOT_OUTPUT_DIRECTORY || 'public')
const feedPath = path.resolve('public/divine-manager-feed.json')
const feedRef = process.env.DIVINE_MANAGER_FEED_REF?.trim()
const outputPath = path.join(snapshotOutputDirectory, 'divine-manager-pools.json')
const volumeOutputPath = path.join(snapshotOutputDirectory, 'divine-manager-volume.json')
const holyCAddress = '0x6c8fdfd2cec0b83d69045074d57a87fa1525225a'
const jitAddress = '0x57909025ace10d5de114d96e3ec84f282895870c'
const connectedTokenAddresses = new Set([holyCAddress, jitAddress])
const ignoredAddresses = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  '0x0000000000000000000000000000000000000369',
  holyCAddress,
  jitAddress,
])
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const swapTopic = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'
const selectors = {
  token0: '0x0dfe1681',
  token1: '0xd21220a7',
  symbol: '0x95d89b41',
  decimals: '0x313ce567',
}

let requestId = 0
const executeFile = promisify(execFile)

const rpcBatch = async (calls, batchSize = 75) => {
  const results = []
  for (let index = 0; index < calls.length; index += batchSize) {
    const chunk = calls.slice(index, index + batchSize)
    const requests = chunk.map(({ method, params }) => ({
      jsonrpc: '2.0',
      id: ++requestId,
      method,
      params,
    }))
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(requests),
    })
    if (!response.ok) throw new Error(`PulseChain RPC returned ${response.status}`)
    const payload = await response.json()
    if (!Array.isArray(payload)) throw new Error('PulseChain RPC did not return a batch response')
    const byId = new Map(payload.map((entry) => [entry.id, entry]))
    results.push(...requests.map((request) => byId.get(request.id)?.result ?? null))
  }
  return results
}

const decodeTopicAddress = (topic) =>
  typeof topic === 'string' && topic.length >= 42 ? `0x${topic.slice(-40)}`.toLowerCase() : null

const decodeAddress = (value) => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null
  return `0x${value.slice(-40)}`.toLowerCase()
}

const decodeUint = (value) => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) return null
  const decoded = Number(BigInt(value))
  return Number.isSafeInteger(decoded) ? decoded : null
}

const decodeString = (value) => {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]*$/.test(value)) return null
  const hex = value.slice(2)
  if (hex.length < 64) return null

  try {
    const firstWord = Number(BigInt(`0x${hex.slice(0, 64)}`))
    if (firstWord === 32 && hex.length >= 128) {
      const length = Number(BigInt(`0x${hex.slice(64, 128)}`))
      const encoded = hex.slice(128, 128 + length * 2)
      return Buffer.from(encoded, 'hex').toString('utf8').replaceAll('\u0000', '').trim() || null
    }

    return Buffer.from(hex.slice(0, 64), 'hex').toString('utf8').replaceAll('\u0000', '').trim() || null
  } catch {
    return null
  }
}

const decodeSwapAmounts = (data) => {
  if (typeof data !== 'string' || !/^0x[0-9a-fA-F]{256}$/.test(data)) return null

  try {
    const word = (index) => BigInt(`0x${data.slice(2 + index * 64, 2 + (index + 1) * 64)}`)
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

const feed = feedRef
  ? JSON.parse((await executeFile('git', ['show', `${feedRef}:public/divine-manager-feed.json`], { maxBuffer: 20 * 1024 * 1024 })).stdout)
  : JSON.parse(await readFile(feedPath, 'utf8'))
if (!feed.historicalComplete || !Array.isArray(feed.items)) {
  throw new Error('Divine Manager feed snapshot is incomplete or invalid')
}

const transactionHashes = [
  ...new Set(
    feed.items
      .map((item) => item?.transactionHash)
      .filter((hash) => typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash))
  ),
]
const receipts = await rpcBatch(
  transactionHashes.map((hash) => ({ method: 'eth_getTransactionReceipt', params: [hash] }))
)

const candidateTransactions = new Map()
receipts.forEach((receipt, index) => {
  if (!receipt || !Array.isArray(receipt.logs)) return
  const transactionHash = transactionHashes[index]

  for (const log of receipt.logs) {
    if (
      !connectedTokenAddresses.has(String(log?.address || '').toLowerCase()) ||
      !Array.isArray(log.topics) ||
      String(log.topics[0] || '').toLowerCase() !== transferTopic
    ) {
      continue
    }

    for (const topic of log.topics.slice(1, 3)) {
      const address = decodeTopicAddress(topic)
      if (!address || ignoredAddresses.has(address)) continue
      const transactions = candidateTransactions.get(address) || new Set()
      transactions.add(transactionHash)
      candidateTransactions.set(address, transactions)
    }
  }
})

const candidates = [...candidateTransactions.keys()]
const pairCalls = candidates.flatMap((address) => [
  { method: 'eth_call', params: [{ to: address, data: selectors.token0 }, 'latest'] },
  { method: 'eth_call', params: [{ to: address, data: selectors.token1 }, 'latest'] },
])
const pairCallResults = await rpcBatch(pairCalls)
const pairs = candidates.flatMap((pairAddress, index) => {
  const token0 = decodeAddress(pairCallResults[index * 2])
  const token1 = decodeAddress(pairCallResults[index * 2 + 1])
  if (!token0 || !token1 || (!connectedTokenAddresses.has(token0) && !connectedTokenAddresses.has(token1))) {
    return []
  }
  return [{ pairAddress, token0, token1 }]
})

const tokenAddresses = [...new Set(pairs.flatMap((pair) => [pair.token0, pair.token1]))]
const metadataCalls = tokenAddresses.flatMap((address) => [
  { method: 'eth_call', params: [{ to: address, data: selectors.symbol }, 'latest'] },
  { method: 'eth_call', params: [{ to: address, data: selectors.decimals }, 'latest'] },
])
const metadataResults = await rpcBatch(metadataCalls)
const metadata = new Map(
  tokenAddresses.map((address, index) => {
    const symbol = decodeString(metadataResults[index * 2]) || `${address.slice(0, 6)}…${address.slice(-4)}`
    const decimals = decodeUint(metadataResults[index * 2 + 1]) ?? 18
    return [address, { address, symbol, decimals }]
  })
)

const items = pairs
  .map((pair) => ({
    pairAddress: pair.pairAddress,
    token0: metadata.get(pair.token0),
    token1: metadata.get(pair.token1),
    executionCount: candidateTransactions.get(pair.pairAddress)?.size ?? 0,
  }))
  .sort((pairA, pairB) => pairA.pairAddress.localeCompare(pairB.pairAddress))

if (items.length === 0) throw new Error('No manager-routed HolyC or JIT pools were found')

// A Swap event is the on-chain source of truth for a V2 pool trade. We keep the
// source amounts per transaction instead of inventing a common dollar value for
// exotic tokens. The frontend can then aggregate by a selected time window while
// retaining exact token-denominated inputs/outputs for every pool and route.
const pairByAddress = new Map(items.map((pair) => [pair.pairAddress, pair]))
const feedByHash = new Map(feed.items.map((item) => [String(item.transactionHash || '').toLowerCase(), item]))
const volumeExecutions = receipts.flatMap((receipt, index) => {
  if (!receipt || !Array.isArray(receipt.logs)) return []

  const transactionHash = transactionHashes[index]
  const feedItem = feedByHash.get(transactionHash.toLowerCase())
  if (!feedItem || !Number.isFinite(Number(feedItem.timestamp))) return []

  const swaps = receipt.logs
    .flatMap((log) => {
      const pair = pairByAddress.get(String(log?.address || '').toLowerCase())
      if (!pair || String(log?.topics?.[0] || '').toLowerCase() !== swapTopic) return []

      const amounts = decodeSwapAmounts(log.data)
      if (!amounts) return []

      const tokenIn = amounts.amount0In > 0n ? pair.token0 : amounts.amount1In > 0n ? pair.token1 : null
      const amountIn = amounts.amount0In > 0n ? amounts.amount0In : amounts.amount1In
      const tokenOut = amounts.amount0Out > 0n ? pair.token0 : amounts.amount1Out > 0n ? pair.token1 : null
      const amountOut = amounts.amount0Out > 0n ? amounts.amount0Out : amounts.amount1Out
      if (!tokenIn || !tokenOut || amountIn === 0n || amountOut === 0n) return []

      return [{
        poolAddress: pair.pairAddress,
        tokenIn: tokenIn.address,
        amountIn: amountIn.toString(),
        tokenOut: tokenOut.address,
        amountOut: amountOut.toString(),
        logIndex: Number(log.logIndex || 0),
      }]
    })
    .sort((a, b) => a.logIndex - b.logIndex)

  if (swaps.length === 0) return []

  // Repeated swaps in the same pair are one station in the visual route. They
  // remain separate in `swaps`, so its token volume is never discarded.
  const route = swaps.reduce((path, swap) => {
    if (path[path.length - 1] !== swap.poolAddress) path.push(swap.poolAddress)
    return path
  }, [])

  return [{
    transactionHash,
    timestamp: Number(feedItem.timestamp),
    swaps: swaps.map((swap) => ({
      poolAddress: swap.poolAddress,
      tokenIn: swap.tokenIn,
      amountIn: swap.amountIn,
      tokenOut: swap.tokenOut,
      amountOut: swap.amountOut,
    })),
    route,
  }]
})

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceIndexedThroughBlock: String(feed.indexedThroughBlock || ''),
  items,
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`)

const volumeSnapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceIndexedThroughBlock: String(feed.indexedThroughBlock || ''),
  pools: items,
  executions: volumeExecutions,
}

await writeFile(volumeOutputPath, `${JSON.stringify(volumeSnapshot)}\n`)
console.log(
  `Wrote ${items.length} manager-routed liquidity pools and ${volumeExecutions.length} routed volume executions from ${transactionHashes.length} executions`
)
