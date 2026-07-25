import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const rpcUrl = process.env.PULSECHAIN_RPC_URL || 'https://rpc.pulsechain.com'
const feedPath = path.resolve('public/divine-manager-feed.json')
const outputPath = path.resolve('public/divine-manager-pools.json')
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
const selectors = {
  token0: '0x0dfe1681',
  token1: '0xd21220a7',
  symbol: '0x95d89b41',
  decimals: '0x313ce567',
}

let requestId = 0

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

const feed = JSON.parse(await readFile(feedPath, 'utf8'))
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

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceIndexedThroughBlock: String(feed.indexedThroughBlock || ''),
  items,
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`)
console.log(`Wrote ${items.length} manager-routed liquidity pools from ${transactionHashes.length} executions`)
