import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_RPC_URL = 'https://rpc.pulsechain.com'
const DEFAULT_OUTPUT = 'public/buy-and-burn-feed.json'
const REORG_OVERLAP_BLOCKS = 128n
const BLOCK_BATCH_SIZE = 50
const BUY_AND_BURN_TOPIC = '0x0a4fc48e069d97912d8588b922b3e22d211ac9956159b80beaa63987c0a32672'

const feeds = [
  {
    key: 'briah',
    contractAddress: '0x7DA770d10B6a62Fc9DC5A9682bDF2849d2b617d4',
    startBlock: 25_075_678n,
  },
  {
    key: 'coinmafia',
    contractAddress: '0xbC289B8a84ACf05d1aA9Ec72cdf5F22dE4bb3A39',
    startBlock: 25_673_593n,
  },
  {
    key: 'dumb',
    contractAddress: '0x3AdC613625D5c2668c921821d91b602c36c7F401',
    startBlock: 25_941_856n,
  },
  {
    key: 'fupa',
    contractAddress: '0x12F715fc5e9e62fBe816D1f15b66bf1C85c1A38a',
    startBlock: 27_099_491n,
  },
]

const parseArgs = (args) => {
  const options = { output: DEFAULT_OUTPUT, rpcUrl: process.env.PULSECHAIN_RPC_URL || DEFAULT_RPC_URL }
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]
    if (value === '--output') {
      options.output = args[index + 1]
      index += 1
    } else if (value === '--rpc-url') {
      options.rpcUrl = args[index + 1]
      index += 1
    }
  }
  return options
}

const toHex = (value) => `0x${value.toString(16)}`

const rpc = async (rpcUrl, method, params) => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
  })
  if (!response.ok) throw new Error(`${method} returned ${response.status}`)
  const body = await response.json()
  if (body.error) throw new Error(`${method} failed: ${body.error.message || JSON.stringify(body.error)}`)
  return body.result
}

const rpcBatch = async (rpcUrl, requests) => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(requests),
  })
  if (!response.ok) throw new Error(`RPC batch returned ${response.status}`)
  const body = await response.json()
  if (!Array.isArray(body)) throw new Error('RPC batch returned an invalid payload')
  return body
}

const getBlockTimestamps = async (rpcUrl, blockNumbers) => {
  const timestamps = new Map()
  for (let index = 0; index < blockNumbers.length; index += BLOCK_BATCH_SIZE) {
    const chunk = blockNumbers.slice(index, index + BLOCK_BATCH_SIZE)
    const requests = chunk.map((blockNumber, requestIndex) => ({
      id: requestIndex,
      jsonrpc: '2.0',
      method: 'eth_getBlockByNumber',
      params: [toHex(blockNumber), false],
    }))
    const responses = await rpcBatch(rpcUrl, requests)
    const responseById = new Map(responses.map((response) => [response.id, response]))
    chunk.forEach((blockNumber, requestIndex) => {
      const response = responseById.get(requestIndex)
      if (response?.error || !response?.result?.timestamp) {
        throw new Error(`Unable to resolve timestamp for block ${blockNumber}`)
      }
      timestamps.set(blockNumber.toString(), Number(BigInt(response.result.timestamp)) * 1000)
    })
  }
  return timestamps
}

const decodeLog = (log, timestamps) => {
  const data = log.data || '0x'
  if (data.length < 130 || !log.transactionHash || !log.blockNumber || !log.topics?.[1]) {
    throw new Error('Buy & Burn log is missing expected event data')
  }
  const blockNumber = BigInt(log.blockNumber)
  const timestamp = timestamps.get(blockNumber.toString())
  if (!timestamp) throw new Error(`Missing timestamp for block ${blockNumber}`)

  return {
    transactionHash: log.transactionHash,
    jitSpent: BigInt(`0x${data.slice(2, 66)}`).toString(),
    tokenBurned: BigInt(`0x${data.slice(66, 130)}`).toString(),
    timestamp,
    blockNumber: Number(blockNumber),
    caller: `0x${log.topics[1].slice(-40)}`,
  }
}

const loadPreviousSnapshot = async (outputPath) => {
  try {
    const snapshot = JSON.parse(await readFile(outputPath, 'utf8'))
    if (
      snapshot?.schemaVersion !== 1 ||
      !snapshot?.historicalComplete ||
      !/^\d+$/.test(String(snapshot?.indexedThroughBlock || '')) ||
      !snapshot?.feeds
    ) {
      return null
    }
    return snapshot
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    throw error
  }
}

const getExistingItems = (snapshot, key) => (Array.isArray(snapshot?.feeds?.[key]?.items) ? snapshot.feeds[key].items : [])

const mergeItems = ({ existingItems, freshItems, scanFromBlock }) => {
  const merged = new Map()
  existingItems
    .filter((item) => Number(item.blockNumber) < Number(scanFromBlock))
    .forEach((item) => merged.set(item.transactionHash, item))
  freshItems.forEach((item) => merged.set(item.transactionHash, item))
  return Array.from(merged.values()).sort((left, right) => right.blockNumber - left.blockNumber)
}

const main = async () => {
  const options = parseArgs(process.argv.slice(2))
  const outputPath = path.resolve(options.output)
  const previous = await loadPreviousSnapshot(outputPath)
  const latestBlock = BigInt(await rpc(options.rpcUrl, 'eth_blockNumber', []))
  const previousThroughBlock = previous ? BigInt(previous.indexedThroughBlock) : null
  const scanFromBlock = previousThroughBlock && previousThroughBlock <= latestBlock
    ? previousThroughBlock > REORG_OVERLAP_BLOCKS
      ? previousThroughBlock - REORG_OVERLAP_BLOCKS
      : 0n
    : null

  const rawLogsByFeed = await Promise.all(
    feeds.map(async (feed) => {
      const fromBlock = scanFromBlock && scanFromBlock > feed.startBlock ? scanFromBlock : feed.startBlock
      const logs = await rpc(options.rpcUrl, 'eth_getLogs', [
        {
          address: feed.contractAddress,
          topics: [BUY_AND_BURN_TOPIC],
          fromBlock: toHex(fromBlock),
          toBlock: toHex(latestBlock),
        },
      ])
      if (!Array.isArray(logs)) throw new Error(`${feed.key} returned an invalid logs payload`)
      return { feed, fromBlock, logs }
    })
  )

  const blockNumbers = Array.from(
    new Set(rawLogsByFeed.flatMap(({ logs }) => logs.map((log) => BigInt(log.blockNumber).toString())))
  ).map((blockNumber) => BigInt(blockNumber))
  const timestamps = await getBlockTimestamps(options.rpcUrl, blockNumbers)

  const snapshot = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    indexedThroughBlock: latestBlock.toString(),
    historicalComplete: true,
    feeds: Object.fromEntries(
      rawLogsByFeed.map(({ feed, fromBlock, logs }) => [
        feed.key,
        {
          contractAddress: feed.contractAddress,
          startBlock: feed.startBlock.toString(),
          items: mergeItems({
            existingItems: getExistingItems(previous, feed.key),
            freshItems: logs.map((log) => decodeLog(log, timestamps)),
            scanFromBlock: fromBlock,
          }),
        },
      ])
    ),
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`)
  const counts = Object.entries(snapshot.feeds).map(([key, feed]) => `${key}: ${feed.items.length}`).join(', ')
  console.log(`Wrote Buy & Burn archive through block ${latestBlock} (${counts})`)
}

await main()
