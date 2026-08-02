const CHUNK_SIZE = 25
const REORG_OVERLAP_BLOCKS = 128n
const HOUR_MS = 60 * 60 * 1000
const RETAINED_SNAPSHOT_HOURS = 31 * 24
const MANIFEST_KEY = 'v2/manifest.json'
const HOLYC_ADDRESS = '0x6c8fdfd2cec0b83d69045074d57a87fa1525225a'
const JIT_ADDRESS = '0x57909025ace10d5de114d96e3ec84f282895870c'
const BURN_ADDRESS = '0x0000000000000000000000000000000000000369'
const BUY_AND_BURN_TOPIC = '0x0a4fc48e069d97912d8588b922b3e22d211ac9956159b80beaa63987c0a32672'
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const SWAP_TOPIC = '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const WPLS_ADDRESS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
const FEEDER_BOT_ADDRESS = '0x01f04ad75bc557ed6072e870278b99f40fd75b2d'
const FEEDER_PARTNER_ADDRESS = '0x4d5b84cc20d991803bdf0bd1f53e72a9435ce21a'
const FEEDER_SETTLEMENT_DEAD_ADDRESS = '0x000000000000000000000000000000000000dead'
const PULSEX_ROUTER_ADDRESS = '0x165c3410fc91ef562c50559f7d2289febed552d9'
const HOLYC_WPLS_PAIR_ADDRESS = '0x28be4ad6d58ab4aacea3cb42bde457b7da251bac'
const HOLYC_JIT_PAIR_ADDRESS = '0x7fa560cbe6d7c0d6d408b3fd9e59137d3324c76e'
const JIT_WPLS_PAIR_ADDRESS = '0xc68a84655fa4ef48f8dd5273821183216da4de37'
const FEEDER_START_BLOCK = 27122135n
const FEEDER_CONTEXT_BLOCKS = 256n
const FEEDER_BACKFILL_BLOCKS = 2500n
const MAX_FEEDER_CORE_NONCE_GAP = 4
const MAX_FEEDER_LOOP_NONCE_SPAN = 6
const MAX_FEEDER_LOOP_BLOCK_SPAN = 128n
const MAX_FEEDER_LOOP_TIME_SPAN_MS = 12 * 60 * 1000
const MAX_FEEDER_SETTLEMENT_NONCE_GAP = 2

const PAIR_KEYS = {
  [HOLYC_WPLS_PAIR_ADDRESS]: 'HOLYC_WPLS',
  [JIT_WPLS_PAIR_ADDRESS]: 'JIT_WPLS',
  [HOLYC_JIT_PAIR_ADDRESS]: 'HOLYC_JIT',
}

const BUY_AND_BURN_FEEDS = [
  { key: 'briah', address: '0x7da770d10b6a62fc9dc5a9682bdf2849d2b617d4', startBlock: 25075678n },
  { key: 'coinmafia', address: '0xbc289b8a84acf05d1aa9ec72cdf5f22de4bb3a39', startBlock: 25673593n },
  { key: 'dumb', address: '0x3adc613625d5c2668c921821d91b602c36c7f401', startBlock: 25941856n },
  { key: 'fupa', address: '0x12f715fc5e9e62fbe816d1f15b66bf1c85c1a38a', startBlock: 27099491n },
]

const jsonHeaders = (cacheControl) => ({
  httpMetadata: { contentType: 'application/json', cacheControl },
})

const now = () => Date.now()
const asHex = (value) => `0x${value.toString(16)}`
const decodeAddress = (value) => /^0x[0-9a-fA-F]{64}$/.test(value ?? '') ? `0x${value.slice(-40)}`.toLowerCase() : null
const decodeUint = (value) => /^0x[0-9a-fA-F]+$/.test(value ?? '') ? BigInt(value).toString() : null
const hour = (timestamp = now()) => Math.floor(timestamp / HOUR_MS) * HOUR_MS
const asBigInt = (value) => BigInt(value ?? 0)
const clampBigInt = (value) => value > 0n ? value : 0n
const absBigInt = (value) => value < 0n ? -value : value

const decodeAbiString = (value) => {
  if (!/^0x[0-9a-fA-F]+$/.test(value ?? '') || value.length < 66) return null
  try {
    const hex = value.slice(2)
    const offset = Number(BigInt(`0x${hex.slice(0, 64)}`))
    if (offset === 32 && hex.length >= 128) {
      const length = Number(BigInt(`0x${hex.slice(64, 128)}`))
      return new TextDecoder().decode(Uint8Array.from((hex.slice(128, 128 + length * 2).match(/.{1,2}/g) ?? []).map((part) => Number.parseInt(part, 16)))).replaceAll('\0', '').trim() || null
    }
    return new TextDecoder().decode(Uint8Array.from((hex.slice(0, 64).match(/.{1,2}/g) ?? []).map((part) => Number.parseInt(part, 16)))).replaceAll('\0', '').trim() || null
  } catch {
    return null
  }
}

const decodeSwapAmounts = (value) => {
  if (!/^0x[0-9a-fA-F]{256}$/.test(value ?? '')) return null
  const word = (index) => BigInt(`0x${value.slice(2 + index * 64, 2 + (index + 1) * 64)}`)
  return { amount0In: word(0), amount1In: word(1), amount0Out: word(2), amount1Out: word(3) }
}

const queryRows = async (db, statement, ...values) => (await db.prepare(statement).bind(...values).all()).results
const queryOne = async (db, statement, ...values) => (await db.prepare(statement).bind(...values).first())

const getState = async (env, key) => (await queryOne(env.ARCHIVE_DB, 'SELECT state_value FROM archive_state WHERE state_key = ?', key))?.state_value ?? null
const setState = (env, key, value) => env.ARCHIVE_DB.prepare(
  'INSERT INTO archive_state(state_key, state_value, updated_at) VALUES(?, ?, ?) ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value, updated_at = excluded.updated_at'
).bind(key, value, now()).run()

const rpc = async (env, method, params) => {
  const rpcUrl = env.PULSECHAIN_RPC_URL || env.RPC_URL
  if (!rpcUrl) throw new Error('PULSECHAIN_RPC_URL Worker secret or RPC_URL variable is required')
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
  })
  if (!response.ok) throw new Error(`${method} failed with HTTP ${response.status}`)
  const body = await response.json()
  if (body.error) throw new Error(`${method} failed: ${body.error.message ?? JSON.stringify(body.error)}`)
  return body.result
}

const rpcBatch = async (env, requests, { allowErrors = false } = {}) => {
  if (!requests.length) return []
  const rpcUrl = env.PULSECHAIN_RPC_URL || env.RPC_URL
  if (!rpcUrl) throw new Error('PULSECHAIN_RPC_URL Worker secret or RPC_URL variable is required')
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(requests),
  })
  if (!response.ok) throw new Error(`RPC batch failed with HTTP ${response.status}`)
  const body = await response.json()
  if (!Array.isArray(body)) throw new Error('RPC batch returned a malformed response')
  const failed = body.find((entry) => entry.error)
  if (failed && !allowErrors) throw new Error(`RPC batch returned an error: ${failed.error?.message ?? JSON.stringify(failed.error)}`)
  return body.sort((left, right) => left.id - right.id)
}

const insertEvents = async (env, resource, events) => {
  if (!events.length) return 0
  const statements = events.map((event) => env.ARCHIVE_DB.prepare(
    'INSERT OR IGNORE INTO archive_events(resource, event_key, block_number, timestamp_ms, payload) VALUES(?, ?, ?, ?, ?)'
  ).bind(resource, event.key, String(event.blockNumber), event.timestamp, JSON.stringify(event.payload)))
  const results = await env.ARCHIVE_DB.batch(statements)
  return results.reduce((total, result) => total + Number(result.meta?.changes ?? 0), 0)
}

const deleteUnpublishedFromBlock = (env, resource, fromBlock) =>
  env.ARCHIVE_DB.prepare(
    'DELETE FROM archive_events WHERE resource = ? AND published = 0 AND CAST(block_number AS INTEGER) >= ?'
  ).bind(resource, Number(fromBlock)).run()

async function ingestDivineManager(env) {
  const stateCutover = await getState(env, 'cutover:divineManager')
  const cutoverBlock = stateCutover ? BigInt(stateCutover) : null
  const previousBlock = await getState(env, 'indexed:divineManager')
  const replayFrom = previousBlock
    ? (BigInt(previousBlock) > REORG_OVERLAP_BLOCKS ? BigInt(previousBlock) - REORG_OVERLAP_BLOCKS : 0n)
    : cutoverBlock
  const upstreamState = await queryOne(env.ARCHIVE_DB,
    'SELECT last_block, historical_complete FROM sync_state WHERE id = 1'
  )
  if (!upstreamState?.historical_complete || !/^\d+$/.test(String(upstreamState.last_block ?? ''))) {
    throw new Error('Divine Manager index is not ready')
  }
  const pending = await queryRows(env.ARCHIVE_DB,
    `SELECT tx_hash, block_number, timestamp_ms, payload FROM executions
      WHERE block_number >= ? AND block_number <= ?
      ORDER BY block_number ASC, transaction_index ASC, tx_hash ASC`,
    Number(replayFrom ?? 0n),
    Number(upstreamState.last_block)
  ).then((rows) => rows.flatMap((row) => {
    try {
      const item = JSON.parse(row.payload)
      return item?.transactionHash && /^\d+$/.test(String(item.blockNumber ?? '')) ? [item] : []
    } catch {
      return []
    }
  }))
  if (pending.length) {
    const earliestBlock = pending.reduce((lowest, item) => {
      const block = BigInt(item.blockNumber)
      return block < lowest ? block : lowest
    }, BigInt(pending[0].blockNumber))
    await deleteUnpublishedFromBlock(env, 'divineManager', earliestBlock)
  }
  const inserted = await insertEvents(env, 'divineManager', pending.map((item) => ({
    key: item.transactionHash.toLowerCase(),
    blockNumber: item.blockNumber,
    timestamp: Number(item.timestamp ?? now()),
    payload: item,
  })))
  await setState(env, 'indexed:divineManager', String(upstreamState.last_block))
  return { inserted, throughBlock: String(upstreamState.last_block) }
}

async function getBlockTimestamps(env, blocks) {
  const unique = [...new Set(blocks.map(String))]
  const responses = await rpcBatch(env, unique.map((block, index) => ({
    id: index + 1,
    jsonrpc: '2.0',
    method: 'eth_getBlockByNumber',
    params: [asHex(BigInt(block)), false],
  })))
  return new Map(responses.flatMap((response) => response.result?.number && response.result?.timestamp
    ? [[BigInt(response.result.number).toString(), Number(BigInt(response.result.timestamp)) * 1000]]
    : []))
}

async function ingestBuyAndBurn(env) {
  const latestBlock = BigInt(await rpc(env, 'eth_blockNumber', []))
  const previous = await getState(env, 'indexed:buyAndBurn')
  const fromBase = previous ? BigInt(previous) : BigInt(await getState(env, 'cutover:buyAndBurn') ?? latestBlock)
  const scanFrom = fromBase > REORG_OVERLAP_BLOCKS ? fromBase - REORG_OVERLAP_BLOCKS : 0n
  await deleteUnpublishedFromBlock(env, 'buyAndBurn', scanFrom)
  const perFeed = await Promise.all(BUY_AND_BURN_FEEDS.map(async (feed) => {
    const fromBlock = scanFrom > feed.startBlock ? scanFrom : feed.startBlock
    const logs = await rpc(env, 'eth_getLogs', [{
      address: feed.address,
      topics: [BUY_AND_BURN_TOPIC],
      fromBlock: asHex(fromBlock),
      toBlock: asHex(latestBlock),
    }])
    return { feed, logs: Array.isArray(logs) ? logs : [] }
  }))
  const timestamps = await getBlockTimestamps(env, perFeed.flatMap(({ logs }) => logs.map((log) => log.blockNumber)))
  const events = perFeed.flatMap(({ feed, logs }) => logs.flatMap((log) => {
    if (!log.transactionHash || !log.blockNumber || !log.data || !log.topics?.[1]) return []
    const jitSpent = decodeUint(`0x${log.data.slice(2, 66)}`)
    const tokenBurned = decodeUint(`0x${log.data.slice(66, 130)}`)
    const blockNumber = BigInt(log.blockNumber)
    const timestamp = timestamps.get(blockNumber.toString())
    if (jitSpent === null || tokenBurned === null || timestamp === undefined) return []
    return [{
      key: `${feed.key}:${log.transactionHash.toLowerCase()}:${log.logIndex ?? '0'}`,
      blockNumber,
      timestamp,
      payload: {
        feedKey: feed.key,
        transactionHash: log.transactionHash,
        jitSpent,
        tokenBurned,
        timestamp,
        blockNumber: Number(blockNumber),
        caller: decodeAddress(log.topics[1]) ?? '0x0000000000000000000000000000000000000000',
      },
    }]
  }))
  const inserted = await insertEvents(env, 'buyAndBurn', events)
  await setState(env, 'indexed:buyAndBurn', latestBlock.toString())
  return { inserted, throughBlock: latestBlock.toString() }
}

const feederTopicAddress = (address) => `0x${address.slice(2).padStart(64, '0')}`
const lowerAddress = (value) => String(value ?? '').toLowerCase()
const transferAddress = (topic) => /^0x[0-9a-fA-F]{64}$/.test(topic ?? '') ? `0x${topic.slice(-40)}`.toLowerCase() : ZERO_ADDRESS
const feederTokenSymbol = (address) => {
  const normalized = lowerAddress(address)
  if (normalized === HOLYC_ADDRESS) return 'HOLYC'
  if (normalized === JIT_ADDRESS) return 'JIT'
  if (normalized === WPLS_ADDRESS) return 'WPLS'
  return 'UNKNOWN'
}

const parseFeederTransfers = (logs) => (logs ?? []).flatMap((log) => {
  if (lowerAddress(log.topics?.[0]) !== TRANSFER_TOPIC) return []
  try {
    return [{
      tokenAddress: lowerAddress(log.address),
      tokenSymbol: feederTokenSymbol(log.address),
      from: transferAddress(log.topics?.[1]),
      to: transferAddress(log.topics?.[2]),
      value: asBigInt(log.data),
    }]
  } catch {
    return []
  }
})

const sumFeederTransfers = (transfers, predicate) => transfers.reduce(
  (total, transfer) => predicate(transfer) ? total + transfer.value : total,
  0n
)

const feederPoolForTransfers = (transfers) => {
  const transfer = transfers.find((item) => PAIR_KEYS[item.from] || PAIR_KEYS[item.to])
  return transfer ? PAIR_KEYS[transfer.from] ?? PAIR_KEYS[transfer.to] : undefined
}

async function fetchFeederTransferHashes(env, fromBlock, toBlock) {
  const feederTopic = feederTopicAddress(FEEDER_BOT_ADDRESS)
  const requests = [HOLYC_ADDRESS, JIT_ADDRESS].flatMap((address, index) => [
    {
      id: index * 2 + 1,
      jsonrpc: '2.0',
      method: 'eth_getLogs',
      params: [{ address, topics: [TRANSFER_TOPIC, feederTopic], fromBlock: asHex(fromBlock), toBlock: asHex(toBlock) }],
    },
    {
      id: index * 2 + 2,
      jsonrpc: '2.0',
      method: 'eth_getLogs',
      params: [{ address, topics: [TRANSFER_TOPIC, null, feederTopic], fromBlock: asHex(fromBlock), toBlock: asHex(toBlock) }],
    },
  ])
  const results = await rpcBatch(env, requests)
  return [...new Set(results.flatMap((result) => Array.isArray(result.result) ? result.result : [])
    .map((log) => log.transactionHash)
    .filter((hash) => typeof hash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(hash))
    .map((hash) => hash.toLowerCase()))]
}

async function summarizeFeederTransaction(env, hash) {
  const [transactionResult, receiptResult] = await rpcBatch(env, [
    { id: 1, jsonrpc: '2.0', method: 'eth_getTransactionByHash', params: [hash] },
    { id: 2, jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [hash] },
  ], { allowErrors: true })
  const transaction = transactionResult?.result
  const receipt = receiptResult?.result
  if (!transaction || !receipt?.blockNumber) return null
  const block = await rpc(env, 'eth_getBlockByNumber', [receipt.blockNumber, false])
  if (!block?.timestamp) return null

  const transfers = parseFeederTransfers(receipt.logs)
  const holyIn = sumFeederTransfers(transfers, (transfer) => transfer.tokenSymbol === 'HOLYC' && transfer.to === FEEDER_BOT_ADDRESS)
  const holyOut = sumFeederTransfers(transfers, (transfer) => transfer.tokenSymbol === 'HOLYC' && transfer.from === FEEDER_BOT_ADDRESS)
  const jitIn = sumFeederTransfers(transfers, (transfer) => transfer.tokenSymbol === 'JIT' && transfer.to === FEEDER_BOT_ADDRESS)
  const jitOut = sumFeederTransfers(transfers, (transfer) => transfer.tokenSymbol === 'JIT' && transfer.from === FEEDER_BOT_ADDRESS)
  const settlementHolyBurned = sumFeederTransfers(transfers, (transfer) =>
    transfer.tokenSymbol === 'HOLYC' && transfer.from === FEEDER_BOT_ADDRESS && transfer.to === FEEDER_SETTLEMENT_DEAD_ADDRESS
  )
  const settlementHolyPartnerAmount = sumFeederTransfers(transfers, (transfer) =>
    transfer.tokenSymbol === 'HOLYC' && transfer.from === FEEDER_BOT_ADDRESS && transfer.to === FEEDER_PARTNER_ADDRESS
  )
  const settlementJitPartnerAmount = sumFeederTransfers(transfers, (transfer) =>
    transfer.tokenSymbol === 'JIT' && transfer.from === FEEDER_BOT_ADDRESS && transfer.to === FEEDER_PARTNER_ADDRESS
  )
  const directHolyBurned = sumFeederTransfers(transfers, (transfer) =>
    transfer.tokenSymbol === 'HOLYC' && (transfer.to === ZERO_ADDRESS || transfer.to === BURN_ADDRESS)
  )
  const rawJitBurned = sumFeederTransfers(transfers, (transfer) =>
    transfer.tokenSymbol === 'JIT' && (transfer.to === ZERO_ADDRESS || transfer.to === BURN_ADDRESS)
  )
  const pool = feederPoolForTransfers(transfers)
  const toAddress = lowerAddress(transaction.to)
  const isSwap = toAddress === PULSEX_ROUTER_ADDRESS || Boolean(pool)
  const isCompilerCall = toAddress === JIT_ADDRESS

  let kind = 'ignore'
  let route = null
  let amountIn = 0n
  let amountOut = 0n
  let tokenInSymbol = 'UNKNOWN'
  let tokenOutSymbol = 'UNKNOWN'
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
      kind = 'swap'; route = 'hc-start-jit-gain'; amountIn = jitOut; amountOut = holyIn; tokenInSymbol = 'JIT'; tokenOutSymbol = 'HOLYC'
    } else if (holyOut > 0n && jitIn > 0n) {
      kind = 'swap'; route = 'jit-start-hc-gain'; amountIn = holyOut; amountOut = jitIn; tokenInSymbol = 'HOLYC'; tokenOutSymbol = 'JIT'
    }
  } else if (isCompilerCall) {
    if (holyOut > 0n && jitIn > 0n) {
      kind = 'compile'; amountIn = holyOut; amountOut = jitIn; tokenInSymbol = 'HOLYC'; tokenOutSymbol = 'JIT'
    } else if (jitOut > 0n && holyIn > 0n) {
      kind = 'restore'; amountIn = jitOut; amountOut = holyIn; tokenInSymbol = 'JIT'; tokenOutSymbol = 'HOLYC'
    }
  }
  if (kind === 'ignore') return null
  const compilerFeeEquivalentHolyc = kind === 'compile' || kind === 'restore' ? clampBigInt(amountIn - amountOut) : 0n
  const jitTransferTaxBurned = kind === 'swap' ? rawJitBurned : 0n
  const jitRestorePrincipalBurned = kind === 'restore' ? rawJitBurned : 0n
  return {
    hash: hash.toLowerCase(),
    nonce: Number(asBigInt(transaction.nonce)),
    kind,
    route,
    blockNumber: asBigInt(receipt.blockNumber).toString(),
    timestamp: Number(asBigInt(block.timestamp)) * 1000,
    amountIn: amountIn.toString(),
    amountOut: amountOut.toString(),
    tokenInSymbol,
    tokenOutSymbol,
    directHolyBurned: directHolyBurned.toString(),
    compilerFeeEquivalentHolyc: compilerFeeEquivalentHolyc.toString(),
    jitTransferTaxBurned: jitTransferTaxBurned.toString(),
    jitRestorePrincipalBurned: jitRestorePrincipalBurned.toString(),
    effectiveHolyContribution: (directHolyBurned + compilerFeeEquivalentHolyc + jitTransferTaxBurned).toString(),
    ...(pool ? { pool } : {}),
  }
}

const feederBlockNumber = (transaction) => asBigInt(transaction.blockNumber)

const findAdjacentFeederTransaction = ({ items, index, direction, expectedKind, reference }) => {
  for (let current = index + direction; current >= 0 && current < items.length; current += direction) {
    const candidate = items[current]
    if (candidate.kind === 'swap') break
    if (reference.nonce - candidate.nonce > MAX_FEEDER_CORE_NONCE_GAP && direction === -1) break
    if (candidate.nonce - reference.nonce > MAX_FEEDER_CORE_NONCE_GAP && direction === 1) break
    if (absBigInt(feederBlockNumber(reference) - feederBlockNumber(candidate)) > MAX_FEEDER_LOOP_BLOCK_SPAN) break
    if (Math.abs(reference.timestamp - candidate.timestamp) > MAX_FEEDER_LOOP_TIME_SPAN_MS) break
    if (candidate.kind === expectedKind) return candidate
  }
  return null
}

const buildFeederStep = (transaction, role, index) => {
  const type = role === 'rebalance' ? 'rebalance' : transaction.kind === 'swap' ? 'swap' : transaction.kind === 'compile' ? 'compile' : 'restore'
  let label = 'Feeder Bot step'
  if (transaction.kind === 'compile') label = role === 'rebalance' ? 'Rebalance compile (HC→JIT)' : 'Feeder compile (HC→JIT)'
  if (transaction.kind === 'restore') label = role === 'rebalance' ? 'Rebalance restore (JIT→HolyC)' : 'Feeder restore (JIT→HolyC)'
  if (transaction.kind === 'swap') label = transaction.route === 'hc-start-jit-gain' ? 'PulseX swap (JIT→HolyC)' : 'PulseX swap (HolyC→JIT)'
  return {
    id: `${transaction.hash}-${index}-${role}`,
    type,
    label,
    tokenInSymbol: transaction.tokenInSymbol,
    tokenOutSymbol: transaction.tokenOutSymbol,
    tokenInAmount: transaction.amountIn,
    tokenOutAmount: transaction.amountOut,
    burns: {
      holyc: (asBigInt(transaction.directHolyBurned) + asBigInt(transaction.compilerFeeEquivalentHolyc)).toString(),
      jit: (asBigInt(transaction.jitTransferTaxBurned) + asBigInt(transaction.jitRestorePrincipalBurned)).toString(),
    },
    ...(transaction.pool ? { pool: transaction.pool } : {}),
  }
}

const toFeederSettlementTransaction = (transaction) => {
  if (transaction.kind === 'settlement-burn') return {
    hash: transaction.hash, nonce: transaction.nonce, kind: 'burn', label: 'Settlement burn',
    tokenInSymbol: transaction.tokenInSymbol, tokenOutSymbol: transaction.tokenOutSymbol,
    amountIn: transaction.amountIn, amountOut: transaction.amountOut,
  }
  if (transaction.kind === 'settlement-partner') return {
    hash: transaction.hash, nonce: transaction.nonce, kind: 'partner',
    label: transaction.tokenInSymbol === 'HOLYC' ? 'Partner payout (HolyC)' : 'Partner payout (JIT)',
    tokenInSymbol: transaction.tokenInSymbol, tokenOutSymbol: transaction.tokenOutSymbol,
    amountIn: transaction.amountIn, amountOut: transaction.amountOut,
  }
  return {
    hash: transaction.hash, nonce: transaction.nonce, kind: 'swap', label: 'Settlement swap (JIT→HolyC)',
    tokenInSymbol: transaction.tokenInSymbol, tokenOutSymbol: transaction.tokenOutSymbol,
    amountIn: transaction.amountIn, amountOut: transaction.amountOut,
  }
}

const collectFeederSettlement = ({ items, startIndex, reference, route, used }) => {
  let lastVisibleTransaction = reference
  let swapTransaction = null
  let burnTransaction = null
  let partnerTransaction = null
  const transactions = []
  const expectedPartnerToken = route === 'hc-start-jit-gain' ? 'JIT' : 'HOLYC'
  for (let current = startIndex + 1; current < items.length; current += 1) {
    const candidate = items[current]
    if (used.has(candidate.hash)) break
    if (candidate.nonce - lastVisibleTransaction.nonce > MAX_FEEDER_SETTLEMENT_NONCE_GAP) break
    if (absBigInt(feederBlockNumber(reference) - feederBlockNumber(candidate)) > MAX_FEEDER_LOOP_BLOCK_SPAN) break
    if (Math.abs(reference.timestamp - candidate.timestamp) > MAX_FEEDER_LOOP_TIME_SPAN_MS) break
    if (candidate.kind === 'compile' || candidate.kind === 'restore') break
    if (candidate.kind === 'swap') {
      const isSettlementSwap = route === 'hc-start-jit-gain' && !swapTransaction && candidate.route === 'hc-start-jit-gain' && candidate.tokenInSymbol === 'JIT' && candidate.tokenOutSymbol === 'HOLYC'
      if (!isSettlementSwap) break
      swapTransaction = candidate; transactions.push(candidate); lastVisibleTransaction = candidate; continue
    }
    if (candidate.kind === 'settlement-burn') {
      if (burnTransaction || (route === 'hc-start-jit-gain' && !swapTransaction)) break
      burnTransaction = candidate; transactions.push(candidate); lastVisibleTransaction = candidate; continue
    }
    if (candidate.kind === 'settlement-partner') {
      if (partnerTransaction || candidate.tokenInSymbol !== expectedPartnerToken) break
      partnerTransaction = candidate; transactions.push(candidate); lastVisibleTransaction = candidate; continue
    }
    break
  }
  return { swapTransaction, burnTransaction, partnerTransaction, transactions }
}

const buildFeederExecution = (loopTransactions, settlementAttachment) => {
  const swapTransaction = loopTransactions.find((transaction) => transaction.kind === 'swap')
  if (!swapTransaction?.route) return null
  const coreKind = swapTransaction.route === 'hc-start-jit-gain' ? 'compile' : 'restore'
  const coreSteps = loopTransactions.filter((transaction) => transaction.kind === coreKind)
  if (coreSteps.length < 2) return null
  const openingCore = coreSteps[0]
  const closingCore = coreSteps.at(-1)
  const netTokenAmount = asBigInt(closingCore.amountOut) - asBigInt(openingCore.amountOut)
  if (netTokenAmount <= 0n) return null
  const sum = (property) => loopTransactions.reduce((total, transaction) => total + asBigInt(transaction[property]), 0n)
  const latest = settlementAttachment.transactions.at(-1) ?? loopTransactions.at(-1)
  const expectedCount = swapTransaction.route === 'hc-start-jit-gain' ? 3 : 2
  const burnedAmount = asBigInt(settlementAttachment.burnTransaction?.amountOut)
  const burnInputAmount = swapTransaction.route === 'hc-start-jit-gain' ? asBigInt(settlementAttachment.swapTransaction?.amountIn) : asBigInt(settlementAttachment.burnTransaction?.amountIn)
  const partnerAmount = asBigInt(settlementAttachment.partnerTransaction?.amountOut)
  return {
    source: 'feeder-bot',
    transactionHash: swapTransaction.hash,
    blockNumber: latest.blockNumber,
    timestamp: latest.timestamp,
    route: swapTransaction.route,
    loopTransactionHashes: loopTransactions.map((transaction) => transaction.hash),
    netTokenSymbol: swapTransaction.route === 'hc-start-jit-gain' ? 'JIT' : 'HOLYC',
    netTokenAmount: netTokenAmount.toString(),
    effectiveHolyBurned: sum('effectiveHolyContribution').toString(),
    directHolyBurned: sum('directHolyBurned').toString(),
    compilerFeeHolyc: sum('compilerFeeEquivalentHolyc').toString(),
    jitTransferTaxBurned: sum('jitTransferTaxBurned').toString(),
    jitRestorePrincipalBurned: sum('jitRestorePrincipalBurned').toString(),
    steps: loopTransactions.map((transaction, index) => {
      const role = transaction.kind === 'swap' ? 'swap' : index === 0 && transaction.kind !== coreKind ? 'rebalance' : 'core'
      return buildFeederStep(transaction, role, index)
    }),
    settlement: {
      status: settlementAttachment.transactions.length === 0 ? 'none' : settlementAttachment.transactions.length === expectedCount ? 'complete' : 'partial',
      burnedAmount: burnedAmount.toString(),
      burnInputAmount: burnInputAmount.toString(),
      partnerAmount: partnerAmount.toString(),
      partnerTokenSymbol: swapTransaction.route === 'hc-start-jit-gain' ? 'JIT' : 'HOLYC',
      retainedAmount: clampBigInt(netTokenAmount - burnInputAmount - partnerAmount).toString(),
      retainedTokenSymbol: swapTransaction.route === 'hc-start-jit-gain' ? 'JIT' : 'HOLYC',
      transactions: settlementAttachment.transactions.map(toFeederSettlementTransaction),
    },
  }
}

export const groupFeederLoops = (transactions, claimedHashes) => {
  const sorted = [...transactions].sort((left, right) => left.nonce - right.nonce || Number(feederBlockNumber(left) - feederBlockNumber(right)) || left.timestamp - right.timestamp)
  const indexByHash = new Map(sorted.map((transaction, index) => [transaction.hash, index]))
  const used = new Set(claimedHashes)
  const loops = []
  sorted.forEach((transaction, index) => {
    if (transaction.kind !== 'swap' || !transaction.route || used.has(transaction.hash)) return
    const coreKind = transaction.route === 'hc-start-jit-gain' ? 'compile' : 'restore'
    const rebalanceKind = transaction.route === 'hc-start-jit-gain' ? 'restore' : 'compile'
    const previousCore = findAdjacentFeederTransaction({ items: sorted, index, direction: -1, expectedKind: coreKind, reference: transaction })
    const nextCore = findAdjacentFeederTransaction({ items: sorted, index, direction: 1, expectedKind: coreKind, reference: transaction })
    if (!previousCore || !nextCore) return
    const previousCoreIndex = indexByHash.get(previousCore.hash) ?? -1
    const rebalanceTransaction = previousCoreIndex >= 0 ? findAdjacentFeederTransaction({ items: sorted, index: previousCoreIndex, direction: -1, expectedKind: rebalanceKind, reference: previousCore }) : null
    const loopTransactions = rebalanceTransaction ? [rebalanceTransaction, previousCore, transaction, nextCore] : [previousCore, transaction, nextCore]
    const first = loopTransactions[0]
    const last = loopTransactions.at(-1)
    if (last.nonce - first.nonce > MAX_FEEDER_LOOP_NONCE_SPAN || feederBlockNumber(last) - feederBlockNumber(first) > MAX_FEEDER_LOOP_BLOCK_SPAN || last.timestamp - first.timestamp > MAX_FEEDER_LOOP_TIME_SPAN_MS) return
    const lastIndex = indexByHash.get(last.hash)
    const settlementAttachment = lastIndex === undefined
      ? { swapTransaction: null, burnTransaction: null, partnerTransaction: null, transactions: [] }
      : collectFeederSettlement({ items: sorted, startIndex: lastIndex, reference: last, route: transaction.route, used })
    const execution = buildFeederExecution(loopTransactions, settlementAttachment)
    if (!execution) return
    loopTransactions.forEach((item) => used.add(item.hash))
    settlementAttachment.transactions.forEach((item) => used.add(item.hash))
    loops.push(execution)
  })
  return loops
}

const feederContextStart = (block) => block > FEEDER_CONTEXT_BLOCKS && block - FEEDER_CONTEXT_BLOCKS > FEEDER_START_BLOCK ? block - FEEDER_CONTEXT_BLOCKS : FEEDER_START_BLOCK

async function ingestFeederRange(env, fromBlock, toBlock) {
  const contextFrom = feederContextStart(fromBlock)
  const hashes = await fetchFeederTransferHashes(env, contextFrom, toBlock)
  const summaries = []
  for (let index = 0; index < hashes.length; index += 2) {
    const current = await Promise.all(hashes.slice(index, index + 2).map((hash) => summarizeFeederTransaction(env, hash).catch(() => null)))
    summaries.push(...current.filter(Boolean))
  }
  const statements = [
    env.ARCHIVE_DB.prepare('DELETE FROM feeder_transactions WHERE CAST(block_number AS INTEGER) >= ? AND CAST(block_number AS INTEGER) <= ?').bind(Number(contextFrom), Number(toBlock)),
    ...summaries.map((summary) => env.ARCHIVE_DB.prepare(
      'INSERT INTO feeder_transactions(tx_hash, block_number, timestamp_ms, payload) VALUES(?, ?, ?, ?) ON CONFLICT(tx_hash) DO UPDATE SET block_number = excluded.block_number, timestamp_ms = excluded.timestamp_ms, payload = excluded.payload'
    ).bind(summary.hash, summary.blockNumber, summary.timestamp, JSON.stringify(summary))),
  ]
  await env.ARCHIVE_DB.batch(statements)
  await deleteUnpublishedFromBlock(env, 'feeder', contextFrom)
  const [rawRows, publishedRows] = await Promise.all([
    queryRows(env.ARCHIVE_DB, 'SELECT payload FROM feeder_transactions WHERE CAST(block_number AS INTEGER) >= ? AND CAST(block_number AS INTEGER) <= ? ORDER BY timestamp_ms ASC, tx_hash ASC', Number(contextFrom), Number(toBlock)),
    queryRows(env.ARCHIVE_DB, 'SELECT payload FROM archive_events WHERE resource = ? AND published = 1 AND CAST(block_number AS INTEGER) >= ?', 'feeder', Number(contextFrom)),
  ])
  const claimedHashes = new Set(publishedRows.flatMap((row) => {
    try {
      const execution = JSON.parse(row.payload)
      return [...(execution.loopTransactionHashes ?? []), ...(execution.settlement?.transactions ?? []).map((transaction) => transaction.hash)]
    } catch {
      return []
    }
  }))
  const transactions = rawRows.flatMap((row) => {
    try { return [JSON.parse(row.payload)] } catch { return [] }
  })
  const loops = groupFeederLoops(transactions, claimedHashes)
  const inserted = await insertEvents(env, 'feeder', loops.map((execution) => ({
    key: execution.transactionHash.toLowerCase(),
    blockNumber: execution.blockNumber,
    timestamp: execution.timestamp,
    payload: execution,
  })))
  return { inserted, throughBlock: toBlock.toString(), scannedFromBlock: contextFrom.toString(), transactions: summaries.length }
}

async function ingestFeeder(env) {
  const latestBlock = BigInt(await rpc(env, 'eth_blockNumber', []))
  const cutover = BigInt(await getState(env, 'cutover:feeder') ?? latestBlock)
  const previous = BigInt(await getState(env, 'indexed:feeder') ?? cutover)
  const fromBlock = previous > REORG_OVERLAP_BLOCKS ? previous - REORG_OVERLAP_BLOCKS : FEEDER_START_BLOCK
  const result = await ingestFeederRange(env, fromBlock > FEEDER_START_BLOCK ? fromBlock : FEEDER_START_BLOCK, latestBlock)
  await setState(env, 'indexed:feeder', latestBlock.toString())
  return result
}

export async function seedFeeder(env) {
  const existing = await getState(env, 'base:feeder')
  if (existing) return { initialized: false, base: existing, cutover: await getState(env, 'cutover:feeder') }
  const latestBlock = BigInt(await rpc(env, 'eth_blockNumber', []))
  const key = `v2/base/feeder/cutover-${latestBlock}-${now()}.json`
  await env.PUBLIC_ARCHIVES.put(key, JSON.stringify({ indexedThroughBlock: latestBlock.toString(), items: [] }), jsonHeaders('public, max-age=31536000, immutable'))
  await env.ARCHIVE_DB.batch([
    env.ARCHIVE_DB.prepare('DELETE FROM archive_events WHERE resource = ?').bind('feeder'),
    env.ARCHIVE_DB.prepare('DELETE FROM feeder_transactions').bind(),
  ])
  await Promise.all([
    setState(env, 'base:feeder', key),
    setState(env, 'cutover:feeder', latestBlock.toString()),
    setState(env, 'indexed:feeder', latestBlock.toString()),
    setState(env, 'backfill:feeder', latestBlock.toString()),
  ])
  return { initialized: true, base: key, cutover: latestBlock.toString() }
}

export async function runFeederBackfill(env) {
  const base = await getState(env, 'base:feeder')
  if (!base) throw new Error('Feeder archive must be initialized before backfill')
  const cursor = BigInt(await getState(env, 'backfill:feeder') ?? await getState(env, 'cutover:feeder'))
  if (cursor < FEEDER_START_BLOCK) return { complete: true, nextBlock: null, inserted: 0, transactions: 0 }
  const fromBlock = cursor - FEEDER_BACKFILL_BLOCKS + 1n > FEEDER_START_BLOCK ? cursor - FEEDER_BACKFILL_BLOCKS + 1n : FEEDER_START_BLOCK
  const result = await ingestFeederRange(env, fromBlock, cursor)
  const nextBlock = fromBlock > FEEDER_START_BLOCK ? fromBlock - 1n : FEEDER_START_BLOCK - 1n
  await setState(env, 'backfill:feeder', nextBlock.toString())
  await publishResource(env, 'feeder', cursor)
  const indexedThroughBlock = await getState(env, 'indexed:divineManager') ?? cursor.toString()
  const manifest = await buildManifest(env, indexedThroughBlock)
  await env.PUBLIC_ARCHIVES.put(MANIFEST_KEY, JSON.stringify(manifest), jsonHeaders('public, max-age=300, s-maxage=300'))
  return { complete: nextBlock < FEEDER_START_BLOCK, nextBlock: nextBlock < FEEDER_START_BLOCK ? null : nextBlock.toString(), ...result }
}

async function updateJitBurnSnapshot(env) {
  const responses = await rpcBatch(env, [
    { id: 1, jsonrpc: '2.0', method: 'eth_call', params: [{ to: HOLYC_ADDRESS, data: `0x70a08231${JIT_ADDRESS.slice(2).padStart(64, '0')}` }, 'latest'] },
    { id: 2, jsonrpc: '2.0', method: 'eth_call', params: [{ to: JIT_ADDRESS, data: '0x18160ddd' }, 'latest'] },
    { id: 3, jsonrpc: '2.0', method: 'eth_call', params: [{ to: HOLYC_ADDRESS, data: `0x70a08231${BURN_ADDRESS.slice(2).padStart(64, '0')}` }, 'latest'] },
  ])
  const locked = BigInt(responses[0].result)
  const supply = BigInt(responses[1].result)
  const burned = BigInt(responses[2].result)
  const current = (locked > supply ? locked - supply : 0n) + burned
  const currentHour = hour()
  await env.ARCHIVE_DB.batch([
    env.ARCHIVE_DB.prepare('INSERT INTO jit_hourly_snapshots(hour_ms, value) VALUES(?, ?) ON CONFLICT(hour_ms) DO UPDATE SET value = excluded.value').bind(currentHour, current.toString()),
    env.ARCHIVE_DB.prepare('DELETE FROM jit_hourly_snapshots WHERE hour_ms < ?').bind(currentHour - RETAINED_SNAPSHOT_HOURS * HOUR_MS),
  ])
  const rows = await queryRows(env.ARCHIVE_DB, 'SELECT hour_ms, value FROM jit_hourly_snapshots ORDER BY hour_ms ASC')
  const valueAt = (target) => {
    let value = null
    for (const row of rows) {
      if (Number(row.hour_ms) > target) break
      value = BigInt(row.value)
    }
    return value
  }
  const delta = (target) => {
    const previous = valueAt(target)
    return previous === null || current <= previous ? '0' : (current - previous).toString()
  }
  const payload = {
    current: current.toString(),
    delta24h: delta(currentHour - 24 * HOUR_MS),
    delta7d: delta(currentHour - 7 * 24 * HOUR_MS),
    delta30d: delta(currentHour - 30 * 24 * HOUR_MS),
    snapshots: Object.fromEntries(rows.map((row) => [new Date(Number(row.hour_ms)).toISOString().replace('.000Z', 'Z'), row.value])),
    updatedAt: new Date().toISOString(),
  }
  // Current objects are immutable too. A retry within an hour must receive a
  // different key so it can never overwrite an edge-cached response.
  const key = `v2/current/effective-burn/${now()}.json`
  await env.PUBLIC_ARCHIVES.put(key, JSON.stringify(payload), jsonHeaders('public, max-age=31536000, immutable'))
  await setState(env, 'current:effectiveBurn', key)
}

async function upsertManagerPool(env, pairAddress, token0, token1) {
  await env.ARCHIVE_DB.prepare(
    'INSERT INTO manager_pools(pair_address, token0_json, token1_json, updated_at) VALUES(?, ?, ?, ?) ON CONFLICT(pair_address) DO UPDATE SET token0_json = excluded.token0_json, token1_json = excluded.token1_json, updated_at = excluded.updated_at'
  ).bind(pairAddress, JSON.stringify(token0), JSON.stringify(token1), now()).run()
}

async function discoverManagerPools(env, receipt) {
  const candidates = new Set()
  for (const log of receipt.logs ?? []) {
    if (String(log.topics?.[0] ?? '').toLowerCase() !== TRANSFER_TOPIC) continue
    if (![HOLYC_ADDRESS, JIT_ADDRESS].includes(String(log.address ?? '').toLowerCase())) continue
    for (const topic of (log.topics ?? []).slice(1, 3)) {
      const candidate = decodeAddress(topic)
      if (candidate && candidate !== HOLYC_ADDRESS && candidate !== JIT_ADDRESS && candidate !== BURN_ADDRESS) candidates.add(candidate)
    }
  }
  const addresses = [...candidates]
  const pairCalls = addresses.flatMap((address, index) => [
    { id: index * 2 + 1, jsonrpc: '2.0', method: 'eth_call', params: [{ to: address, data: '0x0dfe1681' }, 'latest'] },
    { id: index * 2 + 2, jsonrpc: '2.0', method: 'eth_call', params: [{ to: address, data: '0xd21220a7' }, 'latest'] },
  ])
  // Transfer participants include wallets and arbitrary contracts. A failed
  // token0/token1 probe means only that this candidate is not a V2 pair; it
  // must not abort publication of otherwise canonical data.
  const pairResults = await rpcBatch(env, pairCalls, { allowErrors: true })
  const pairs = addresses.flatMap((address, index) => {
    const token0 = decodeAddress(pairResults[index * 2]?.result)
    const token1 = decodeAddress(pairResults[index * 2 + 1]?.result)
    return token0 && token1 && (token0 === HOLYC_ADDRESS || token0 === JIT_ADDRESS || token1 === HOLYC_ADDRESS || token1 === JIT_ADDRESS)
      ? [{ pairAddress: address, token0, token1 }]
      : []
  })
  const tokenAddresses = [...new Set(pairs.flatMap((pair) => [pair.token0, pair.token1]))]
  const metadataResults = await rpcBatch(env, tokenAddresses.flatMap((address, index) => [
    { id: index * 2 + 1, jsonrpc: '2.0', method: 'eth_call', params: [{ to: address, data: '0x95d89b41' }, 'latest'] },
    { id: index * 2 + 2, jsonrpc: '2.0', method: 'eth_call', params: [{ to: address, data: '0x313ce567' }, 'latest'] },
  ]), { allowErrors: true })
  const metadata = new Map(tokenAddresses.map((address, index) => [address, {
    address,
    symbol: decodeAbiString(metadataResults[index * 2]?.result) ?? `${address.slice(0, 6)}…${address.slice(-4)}`,
    decimals: Number(decodeUint(metadataResults[index * 2 + 1]?.result) ?? '18'),
  }]))
  for (const pair of pairs) await upsertManagerPool(env, pair.pairAddress, metadata.get(pair.token0), metadata.get(pair.token1))
}

async function deriveManagerData(env) {
  const pending = await queryRows(env.ARCHIVE_DB,
    'SELECT event_key, payload FROM archive_events WHERE resource = ? AND derived = 0 ORDER BY timestamp_ms ASC LIMIT 4',
    'divineManager'
  )
  for (const row of pending) {
    const execution = JSON.parse(row.payload)
    const receipt = await rpc(env, 'eth_getTransactionReceipt', [execution.transactionHash])
    if (!receipt?.logs) continue
    await discoverManagerPools(env, receipt)
    const poolRows = await queryRows(env.ARCHIVE_DB, 'SELECT pair_address, token0_json, token1_json FROM manager_pools')
    const pools = new Map(poolRows.map((pool) => [pool.pair_address.toLowerCase(), {
      pairAddress: pool.pair_address,
      token0: JSON.parse(pool.token0_json),
      token1: JSON.parse(pool.token1_json),
    }]))
    const swaps = (receipt.logs ?? []).flatMap((log) => {
      const pool = pools.get(String(log.address ?? '').toLowerCase())
      if (!pool || String(log.topics?.[0] ?? '').toLowerCase() !== SWAP_TOPIC) return []
      const amounts = decodeSwapAmounts(log.data)
      if (!amounts) return []
      const tokenIn = amounts.amount0In > 0n ? pool.token0 : amounts.amount1In > 0n ? pool.token1 : null
      const tokenOut = amounts.amount0Out > 0n ? pool.token0 : amounts.amount1Out > 0n ? pool.token1 : null
      const amountIn = amounts.amount0In > 0n ? amounts.amount0In : amounts.amount1In
      const amountOut = amounts.amount0Out > 0n ? amounts.amount0Out : amounts.amount1Out
      if (!tokenIn || !tokenOut || amountIn === 0n || amountOut === 0n) return []
      return [{ poolAddress: pool.pairAddress, tokenIn: tokenIn.address, amountIn: amountIn.toString(), tokenOut: tokenOut.address, amountOut: amountOut.toString(), logIndex: Number(log.logIndex ?? 0) }]
    }).sort((left, right) => left.logIndex - right.logIndex)
    if (swaps.length) {
      const route = swaps.reduce((path, swap) => path.at(-1) === swap.poolAddress ? path : [...path, swap.poolAddress], [])
      await insertEvents(env, 'managerVolume', [{
        key: execution.transactionHash.toLowerCase(),
        blockNumber: execution.blockNumber,
        timestamp: Number(execution.timestamp),
        payload: {
          transactionHash: execution.transactionHash,
          timestamp: Number(execution.timestamp),
          swaps: swaps.map((swap) => ({
            poolAddress: swap.poolAddress,
            tokenIn: swap.tokenIn,
            amountIn: swap.amountIn,
            tokenOut: swap.tokenOut,
            amountOut: swap.amountOut,
          })),
          route,
        },
      }])
      for (const pairAddress of new Set(swaps.map((swap) => swap.poolAddress))) {
        await env.ARCHIVE_DB.batch([
          env.ARCHIVE_DB.prepare('INSERT OR IGNORE INTO manager_pool_links(pair_address, transaction_hash) VALUES(?, ?)').bind(pairAddress, execution.transactionHash),
          env.ARCHIVE_DB.prepare('UPDATE manager_pools SET execution_count = (SELECT COUNT(*) FROM manager_pool_links WHERE pair_address = ?), updated_at = ? WHERE pair_address = ?').bind(pairAddress, now(), pairAddress),
        ])
      }
    }
    await env.ARCHIVE_DB.prepare('UPDATE archive_events SET derived = 1 WHERE resource = ? AND event_key = ?').bind('divineManager', row.event_key).run()
  }
}

async function publishManagerPools(env) {
  const pools = await queryRows(env.ARCHIVE_DB, 'SELECT pair_address, token0_json, token1_json, execution_count FROM manager_pools ORDER BY pair_address ASC')
  const reserveResults = await rpcBatch(env, pools.map((pool, index) => ({
    id: index + 1,
    jsonrpc: '2.0',
    method: 'eth_call',
    params: [{ to: pool.pair_address, data: '0x0902f1ac' }, 'latest'],
  })))
  const items = pools.flatMap((pool, index) => {
    const value = reserveResults[index]?.result
    if (!/^0x[0-9a-fA-F]{192}$/.test(value ?? '')) return []
    const reserve0 = BigInt(`0x${value.slice(2, 66)}`).toString()
    const reserve1 = BigInt(`0x${value.slice(66, 130)}`).toString()
    const reserveTimestamp = Number(BigInt(`0x${value.slice(130, 194)}`))
    return [{
      pairAddress: pool.pair_address,
      token0: JSON.parse(pool.token0_json),
      token1: JSON.parse(pool.token1_json),
      executionCount: Number(pool.execution_count),
      reserve0,
      reserve1,
      reserveTimestamp,
    }]
  })
  const key = `v2/current/manager-pools/${now()}.json`
  const payload = { schemaVersion: 2, generatedAt: new Date().toISOString(), items }
  await env.PUBLIC_ARCHIVES.put(key, JSON.stringify(payload), jsonHeaders('public, max-age=31536000, immutable'))
  await setState(env, 'current:managerPools', key)
}

export const chunkRecords = (records, size = CHUNK_SIZE) => {
  const chunks = []
  for (let index = 0; index < records.length; index += size) chunks.push(records.slice(index, index + size))
  return chunks
}

async function publishResource(env, resource, finalizableThrough) {
  const completed = await queryRows(env.ARCHIVE_DB,
    'SELECT event_key, block_number, timestamp_ms, payload FROM archive_events WHERE resource = ? AND published = 0 AND CAST(block_number AS INTEGER) <= ? ORDER BY timestamp_ms ASC, event_key ASC LIMIT ?',
    resource,
    Number(finalizableThrough),
    CHUNK_SIZE
  )
  if (completed.length === CHUNK_SIZE) {
    const items = completed.map((row) => JSON.parse(row.payload))
    const fromBlock = String(completed[0].block_number)
    const last = completed.at(-1)
    const objectKey = `v2/chunks/${resource}/${fromBlock}-${last.block_number}-${last.event_key.replace(/[^a-zA-Z0-9.-]/g, '')}.json`
    const payload = { schemaVersion: 2, resource, fromBlock, throughBlock: String(last.block_number), generatedAt: new Date().toISOString(), items }
    await env.PUBLIC_ARCHIVES.put(objectKey, JSON.stringify(payload), jsonHeaders('public, max-age=31536000, immutable'))
    await env.ARCHIVE_DB.batch([
      ...completed.map((row) => env.ARCHIVE_DB.prepare('UPDATE archive_events SET published = 1 WHERE resource = ? AND event_key = ?').bind(resource, row.event_key)),
      env.ARCHIVE_DB.prepare('INSERT OR IGNORE INTO archive_chunks(resource, object_key, from_block, through_block, item_count, created_at) VALUES(?, ?, ?, ?, ?, ?)')
        .bind(resource, objectKey, fromBlock, String(last.block_number), items.length, now()),
    ])
  }

  const open = await queryRows(env.ARCHIVE_DB,
    'SELECT event_key, block_number, payload FROM archive_events WHERE resource = ? AND published = 0 ORDER BY timestamp_ms ASC, event_key ASC LIMIT ?',
    resource,
    CHUNK_SIZE
  )
  if (!open.length) {
    await setState(env, `open:${resource}`, '')
    return
  }
  const signature = open.map((row) => row.event_key).join('|')
  if (await getState(env, `openSignature:${resource}`) === signature) return
  const first = open[0]
  const last = open.at(-1)
  const key = `v2/open/${resource}/${first.block_number}-${last.block_number}-${now()}.json`
  const payload = {
    schemaVersion: 2,
    resource,
    fromBlock: String(first.block_number),
    throughBlock: String(last.block_number),
    generatedAt: new Date().toISOString(),
    items: open.map((row) => JSON.parse(row.payload)),
  }
  await env.PUBLIC_ARCHIVES.put(key, JSON.stringify(payload), jsonHeaders('public, max-age=31536000, immutable'))
  await env.ARCHIVE_DB.batch([
    env.ARCHIVE_DB.prepare('INSERT INTO archive_state(state_key, state_value, updated_at) VALUES(?, ?, ?) ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value, updated_at = excluded.updated_at').bind(`open:${resource}`, key, now()),
    env.ARCHIVE_DB.prepare('INSERT INTO archive_state(state_key, state_value, updated_at) VALUES(?, ?, ?) ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value, updated_at = excluded.updated_at').bind(`openSignature:${resource}`, signature, now()),
  ])
}

async function buildManifest(env, indexedThroughBlock) {
  const archives = {}
  for (const resource of ['divineManager', 'feeder', 'buyAndBurn', 'managerVolume']) {
    const [base, openChunk, chunks] = await Promise.all([
      getState(env, `base:${resource}`),
      getState(env, `open:${resource}`),
      queryRows(env.ARCHIVE_DB, 'SELECT object_key FROM archive_chunks WHERE resource = ? ORDER BY created_at ASC', resource),
    ])
    archives[resource] = {
      base,
      chunks: chunks.map((chunk) => chunk.object_key),
      openChunk: openChunk || null,
      indexedThroughBlock,
    }
  }
  const manifest = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    chainId: 369,
    indexedThroughBlock,
    archives,
    current: {
      managerPools: await getState(env, 'current:managerPools'),
      effectiveBurn: await getState(env, 'current:effectiveBurn'),
    },
  }
  if (Object.values(manifest.current).some((value) => !value)) throw new Error('Current archive snapshots have not been seeded')
  return manifest
}

async function removeExpiredOpenVersions(env, manifest) {
  const active = new Set(Object.values(manifest.archives).map((archive) => archive.openChunk).filter(Boolean))
  const cutoff = now() - 7 * 24 * HOUR_MS
  let cursor = undefined
  do {
    const page = await env.PUBLIC_ARCHIVES.list({ prefix: 'v2/open/', cursor })
    await Promise.all(page.objects
      .filter((object) => !active.has(object.key) && object.uploaded.getTime() < cutoff)
      .map((object) => env.PUBLIC_ARCHIVES.delete(object.key)))
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
}

export async function runPublish(env) {
  let stage = 'indexing Divine Manager activity'
  try {
    const divine = await ingestDivineManager(env)
    stage = 'indexing Feeder activity'
    const feeder = await ingestFeeder(env)
    stage = 'indexing partner buy-and-burn activity'
    const burns = await ingestBuyAndBurn(env)
    stage = 'updating effective JIT burn metrics'
    await updateJitBurnSnapshot(env)
    stage = 'deriving manager pool and volume data'
    await deriveManagerData(env)
    stage = 'reading manager pool reserves'
    await publishManagerPools(env)
  const divineFinalized = BigInt(divine.throughBlock) > REORG_OVERLAP_BLOCKS ? BigInt(divine.throughBlock) - REORG_OVERLAP_BLOCKS : 0n
  const burnsFinalized = BigInt(burns.throughBlock) > REORG_OVERLAP_BLOCKS ? BigInt(burns.throughBlock) - REORG_OVERLAP_BLOCKS : 0n
    stage = 'publishing archive chunks'
  await publishResource(env, 'divineManager', divineFinalized)
  await publishResource(env, 'feeder', BigInt(feeder.throughBlock) > REORG_OVERLAP_BLOCKS ? BigInt(feeder.throughBlock) - REORG_OVERLAP_BLOCKS : 0n)
  await publishResource(env, 'buyAndBurn', burnsFinalized)
  await publishResource(env, 'managerVolume', divineFinalized)
    stage = 'building manifest'
  const manifest = await buildManifest(env, divine.throughBlock)
    stage = 'publishing manifest'
  await env.PUBLIC_ARCHIVES.put(MANIFEST_KEY, JSON.stringify(manifest), jsonHeaders('public, max-age=300, s-maxage=300'))
    stage = 'removing expired open chunks'
  await removeExpiredOpenVersions(env, manifest)
  return manifest
  } catch (error) {
    throw new Error(`${stage}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export async function seed(env, request) {
  const body = await request.json()
  if (!body?.snapshots || !body?.cutovers) throw new Error('Seed request requires snapshots and cutovers')
  const resources = [
    ['divineManager', 'divineManagerFeed'],
    ['feeder', 'feederFeed'],
    ['buyAndBurn', 'buyAndBurnFeed'],
    ['managerVolume', 'managerVolume'],
  ]
  for (const [resource, property] of resources) {
    if (!body.snapshots[property]) throw new Error(`Seed is missing ${property}`)
    const cutover = String(body.cutovers[resource] ?? '')
    if (!/^\d+$/.test(cutover)) throw new Error(`Seed has an invalid ${resource} cutover`)
    // A base snapshot is immutable. Reseeding before public cutover must use a
    // new key rather than overwrite a cacheable object that a client may hold.
    const key = `v2/base/${resource}/cutover-${cutover}-${now()}.json`
    await env.PUBLIC_ARCHIVES.put(key, JSON.stringify(body.snapshots[property]), jsonHeaders('public, max-age=31536000, immutable'))
    await setState(env, `base:${resource}`, key)
    await setState(env, `cutover:${resource}`, cutover)
    await env.ARCHIVE_DB.batch([
      env.ARCHIVE_DB.prepare('DELETE FROM archive_events WHERE resource = ? AND published = 0 AND CAST(block_number AS INTEGER) <= ?').bind(resource, Number(cutover)),
      env.ARCHIVE_DB.prepare('DELETE FROM archive_chunks WHERE resource = ? AND CAST(through_block AS INTEGER) <= ?').bind(resource, Number(cutover)),
      env.ARCHIVE_DB.prepare('DELETE FROM archive_state WHERE state_key IN (?, ?)').bind(`open:${resource}`, `openSignature:${resource}`),
    ])
  }
  await Promise.all([
    setState(env, 'indexed:feeder', String(body.cutovers.feeder)),
    setState(env, 'backfill:feeder', String(body.cutovers.feeder)),
  ])
  for (const [name, property] of [['managerPools', 'managerPools'], ['effectiveBurn', 'effectiveBurn']]) {
    const key = `v2/current/${name}/cutover-${body.cutovers.divineManager}-${now()}.json`
    await env.PUBLIC_ARCHIVES.put(key, JSON.stringify(body.snapshots[property]), jsonHeaders('public, max-age=31536000, immutable'))
    await setState(env, `current:${name}`, key)
  }
  await env.ARCHIVE_DB.prepare('DELETE FROM manager_pool_links').run()
  const poolStatements = (body.snapshots.managerPools?.items ?? []).flatMap((pool) =>
    pool?.pairAddress && pool?.token0 && pool?.token1
      ? [env.ARCHIVE_DB.prepare('INSERT INTO manager_pools(pair_address, token0_json, token1_json, execution_count, updated_at) VALUES(?, ?, ?, ?, ?) ON CONFLICT(pair_address) DO UPDATE SET token0_json = excluded.token0_json, token1_json = excluded.token1_json, execution_count = excluded.execution_count, updated_at = excluded.updated_at')
          .bind(String(pool.pairAddress).toLowerCase(), JSON.stringify(pool.token0), JSON.stringify(pool.token1), Number(pool.executionCount ?? 0), now())]
      : []
  )
  if (poolStatements.length) await env.ARCHIVE_DB.batch(poolStatements)
  // The V1 pool snapshot stores aggregate counts, while its volume snapshot
  // retains the per-execution routes. Seed the link table too, so the first
  // new execution increments an existing pool count instead of resetting it.
  const poolLinkStatements = (body.snapshots.managerVolume?.executions ?? []).flatMap((execution) =>
    execution?.transactionHash && Array.isArray(execution.route)
      ? [...new Set(execution.route.filter((pairAddress) => typeof pairAddress === 'string'))].map((pairAddress) =>
          env.ARCHIVE_DB.prepare('INSERT OR IGNORE INTO manager_pool_links(pair_address, transaction_hash) VALUES(?, ?)')
            .bind(pairAddress.toLowerCase(), execution.transactionHash)
        )
      : []
  )
  if (poolLinkStatements.length) await env.ARCHIVE_DB.batch(poolLinkStatements)
  if (poolStatements.length) {
    await env.ARCHIVE_DB.prepare(
      'UPDATE manager_pools SET execution_count = (SELECT COUNT(*) FROM manager_pool_links WHERE pair_address = manager_pools.pair_address)'
    ).run()
  }
  await env.ARCHIVE_DB.prepare('DELETE FROM jit_hourly_snapshots').run()
  const burnSnapshots = body.snapshots.effectiveBurn?.snapshots ?? {}
  const statements = Object.entries(burnSnapshots).flatMap(([timestamp, value]) => {
    const timestampMs = Date.parse(timestamp)
    return Number.isFinite(timestampMs) && typeof value === 'string'
      ? [env.ARCHIVE_DB.prepare('INSERT OR REPLACE INTO jit_hourly_snapshots(hour_ms, value) VALUES(?, ?)').bind(hour(timestampMs), value)]
      : []
  })
  if (statements.length) await env.ARCHIVE_DB.batch(statements)
  const manifest = await buildManifest(env, String(body.cutovers.divineManager))
  await env.PUBLIC_ARCHIVES.put(MANIFEST_KEY, JSON.stringify(manifest), jsonHeaders('public, max-age=300, s-maxage=300'))
  return manifest
}

export default {
  async scheduled(_event, env, context) {
    context.waitUntil(runPublish(env))
  },
  async fetch(request, env) {
    const url = new URL(request.url)
    if (url.pathname === '/health') return Response.json({ ok: true })
    if (request.headers.get('authorization') !== `Bearer ${env.PUBLISH_TOKEN}`) return new Response('Unauthorized', { status: 401 })
    try {
      if (url.pathname === '/admin/seed' && request.method === 'POST') return Response.json(await seed(env, request))
      if (url.pathname === '/admin/publish' && request.method === 'POST') return Response.json(await runPublish(env))
      return new Response('Not found', { status: 404 })
    } catch (error) {
      console.error(error)
      return Response.json({ error: error instanceof Error ? error.message : 'Publish failed' }, { status: 500 })
    }
  },
}
