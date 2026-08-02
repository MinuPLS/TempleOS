'use strict'

// This Worker deliberately mirrors the transfer-based parser used by the web UI.
// Values are stored as decimal strings because JSON cannot represent bigint.
const RPC_URL = 'https://rpc.pulsechain.com'
const DIVINE_MANAGER_V2 = '0x50df180ea29a7872b54c5ec5241d4b889e4debf0'
const LEGACY_DIVINE_MANAGER = '0x7ee5476ae357b02f3f61ba0d8369945d3615e0de'
const MANAGERS = [DIVINE_MANAGER_V2, LEGACY_DIVINE_MANAGER]
const HOLYC = '0x6c8fdfd2cec0b83d69045074d57a87fa1525225a'
const JIT = '0x57909025ace10d5de114d96e3ec84f282895870c'
const WPLS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
const ZERO = '0x0000000000000000000000000000000000000000'
const BURN = '0x0000000000000000000000000000000000000369'
const BURN_ADDRESSES = new Set([ZERO, BURN])
const TICKET_EXECUTED_TOPIC = '0xe7d506afd1181041bb8d9ff3ec2150070564e7c1423c11689e42ecd1cd2a2b86'
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const PROFIT_SETTLED_TOPIC = '0xdb9043ebe5dd8dde7a2b48b0c24eb35e85fbd421c1617a8d8a0726c7faf9963f'
const PROFIT_PAID_TOPIC = '0xa3236da9c894299c7079298a7dccf033ee4a02843e0d013132b5e853db2f2d25'
const PAIRS = {
  '0x28be4ad6d58ab4aacea3cb42bde457b7da251bac': { key: 'HOLYC_WPLS', label: 'HolyC/WPLS pool' },
  '0xc68a84655fa4ef48f8dd5273821183216da4de37': { key: 'JIT_WPLS', label: 'JIT/WPLS pool' },
  '0x7fa560cbe6d7c0d6d408b3fd9e59137d3324c76e': { key: 'HOLYC_JIT', label: 'HC/JIT pool' },
}
const PARTNER_LABELS = new Map([
  ['0x7da770d10b6a62fc9dc5a9682bdf2849d2b617d4', 'Briah'],
  ['0xbc289b8a84acf05d1aa9ec72cdf5f22de4bb3a39', 'CoinMafia'],
  ['0x3adc613625d5c2668c921821d91b602c36c7f401', 'Dumb'],
  ['0x12f715fc5e9e62fbe816d1f15b66bf1c85c1a38a', 'FUPA'],
])
const corsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'Content-Type, X-Sync-Secret',
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/divine-manager/activity') {
      return serveActivity(url, env)
    }
    if (request.method === 'GET' && url.pathname === '/divine-manager/status') {
      return serveStatus(env)
    }
    // This is useful immediately after deployment. Protect it in production by
    // adding SYNC_SECRET with `wrangler secret put SYNC_SECRET`.
    if (request.method === 'POST' && url.pathname === '/divine-manager/sync') {
      if (env.SYNC_SECRET && request.headers.get('x-sync-secret') !== env.SYNC_SECRET) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const result = await syncToTip(env)
      return json(result)
    }
    return json({ error: 'Not found' }, 404)
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(syncToTip(env))
  },
}

async function serveActivity(url, env) {
  const limitInput = Number(url.searchParams.get('limit') || '35')
  const limit = Number.isFinite(limitInput) ? Math.min(Math.max(Math.floor(limitInput), 1), 100) : 35
  const cursor = decodeCursor(url.searchParams.get('cursor'))
  const query = cursor
    ? env.DB.prepare(`SELECT payload, block_number, transaction_index, tx_hash
        FROM executions
        WHERE block_number < ?
          OR (block_number = ? AND transaction_index < ?)
          OR (block_number = ? AND transaction_index = ? AND tx_hash < ?)
        ORDER BY block_number DESC, transaction_index DESC, tx_hash DESC
        LIMIT ?`).bind(cursor.blockNumber, cursor.blockNumber, cursor.transactionIndex, cursor.blockNumber, cursor.transactionIndex, cursor.hash, limit + 1)
    : env.DB.prepare(`SELECT payload, block_number, transaction_index, tx_hash
        FROM executions
        ORDER BY block_number DESC, transaction_index DESC, tx_hash DESC
        LIMIT ?`).bind(limit + 1)
  const { results } = await query.all()
  const hasMore = results.length > limit
  const rows = hasMore ? results.slice(0, limit) : results
  const tail = rows[rows.length - 1]
  const body = {
    items: rows.map((row) => JSON.parse(row.payload)),
    nextCursor: hasMore && tail ? encodeCursor(tail) : null,
  }
  return json(body, 200, { 'cache-control': 'public, max-age=15, s-maxage=55' })
}

async function serveStatus(env) {
  const [state, count] = await Promise.all([
    env.DB.prepare('SELECT initial_cursor, last_block, historical_complete, updated_at FROM sync_state WHERE id = 1').first(),
    env.DB.prepare('SELECT COUNT(*) AS count FROM executions').first(),
  ])
  return json({
    indexedExecutions: Number(count?.count || 0),
    historicalComplete: Boolean(state?.historical_complete),
    lastBlock: state?.last_block?.toString() ?? null,
    updatedAt: state?.updated_at ?? null,
  }, 200, { 'cache-control': 'no-store' })
}

async function syncToTip(env) {
  const rpcUrl = env.RPC_URL || RPC_URL
  const latestBlock = Number(hexToBigInt(await rpc(rpcUrl, 'eth_blockNumber', [])))
  const state = await env.DB.prepare('SELECT initial_cursor, last_block, historical_complete FROM sync_state WHERE id = 1').first()
  const now = Date.now()

  if (!state || !state.historical_complete) {
    const historical = await syncHistoricalBatch(env, rpcUrl, latestBlock, state?.initial_cursor || null)
    await env.DB.prepare(`INSERT INTO sync_state (id, initial_cursor, last_block, historical_complete, updated_at)
      VALUES (1, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        initial_cursor = excluded.initial_cursor,
        last_block = excluded.last_block,
        historical_complete = excluded.historical_complete,
        updated_at = excluded.updated_at`)
      .bind(historical.cursor, historical.complete ? latestBlock : null, historical.complete ? 1 : 0, now).run()
    return { mode: 'historical', latestBlock, ...historical }
  }

  const overlap = boundedInt(env.REORG_OVERLAP_BLOCKS, 8, 0, 128)
  const fromBlock = Math.max(0, Number(state.last_block) - overlap)
  const logs = await getTicketLogs(rpcUrl, fromBlock, latestBlock)
  const inserted = await indexLogs(env, rpcUrl, logs)
  await env.DB.prepare('UPDATE sync_state SET last_block = ?, updated_at = ? WHERE id = 1').bind(latestBlock, now).run()
  return { mode: 'incremental', fromBlock, latestBlock, found: logs.length, inserted }
}

async function syncHistoricalBatch(env, rpcUrl, latestBlock, initialCursor) {
  const allLogs = await getTicketLogs(rpcUrl, 0, latestBlock)
  const cursor = decodeCursor(initialCursor)
  const pending = allLogs
    .sort(compareLogAsc)
    .filter((log) => !cursor || compareLogPosition(log, cursor) > 0)
  const batchSize = boundedInt(env.HISTORICAL_BATCH_SIZE, 25, 1, 50)
  const batch = pending.slice(0, batchSize)
  const inserted = await indexLogs(env, rpcUrl, batch)
  const last = batch[batch.length - 1]
  return {
    found: allLogs.length,
    inserted,
    processed: batch.length,
    cursor: last ? encodeCursor(last) : initialCursor,
    complete: batch.length === pending.length,
  }
}

async function indexLogs(env, rpcUrl, logs) {
  if (!logs.length) return 0
  const uniqueBlocks = [...new Set(logs.map((log) => log.blockNumber.toLowerCase()))]
  const [receipts, blocks] = await Promise.all([
    rpcBatch(rpcUrl, logs.map((log, index) => ({ id: index + 1, method: 'eth_getTransactionReceipt', params: [log.transactionHash] }))),
    rpcBatch(rpcUrl, uniqueBlocks.map((block, index) => ({ id: index + 1, method: 'eth_getBlockByNumber', params: [block, false] }))),
  ])
  const receiptByHash = new Map(receipts.map((entry) => [entry.result?.transactionHash?.toLowerCase(), entry.result]))
  const blockByNumber = new Map(blocks.map((entry) => [entry.result?.number?.toLowerCase(), entry.result]))
  const rows = []
  for (const log of logs) {
    const receipt = receiptByHash.get(log.transactionHash.toLowerCase())
    const block = blockByNumber.get(log.blockNumber.toLowerCase())
    if (!receipt || !block || receipt.status === '0x0') continue
    const execution = buildExecution(log, receipt, block)
    if (!execution) continue
    rows.push(env.DB.prepare(`INSERT INTO executions
      (tx_hash, block_number, transaction_index, timestamp_ms, manager_address, payload, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tx_hash) DO UPDATE SET
        block_number = excluded.block_number,
        transaction_index = excluded.transaction_index,
        timestamp_ms = excluded.timestamp_ms,
        manager_address = excluded.manager_address,
        payload = excluded.payload,
        indexed_at = excluded.indexed_at`)
      .bind(execution.transactionHash, Number(execution.blockNumber), Number(hexToBigInt(log.transactionIndex || '0x0')), execution.timestamp, execution.managerAddress, JSON.stringify(execution), Date.now()))
  }
  if (rows.length) await env.DB.batch(rows)
  return rows.length
}

function buildExecution(eventLog, receipt, block) {
  const manager = eventLog.address.toLowerCase()
  let holyBurned = 0n
  let jitBurned = 0n
  let holyIn = 0n
  let holyOut = 0n
  let jitIn = 0n
  let jitOut = 0n
  let wplsIn = 0n
  let wplsOut = 0n
  const steps = []
  const compileQueue = []
  const restoreQueue = []
  const completedRestores = []
  const swapQueues = new Map()

  for (const receiptLog of receipt.logs || []) {
    const transfer = parseTransfer(receiptLog)
    if (!transfer) continue
    const token = receiptLog.address.toLowerCase()
    const symbol = tokenSymbol(token)
    const from = transfer.from
    const to = transfer.to
    const poolTo = PAIRS[to]
    const poolFrom = PAIRS[from]

    if (poolTo && from === manager) {
      const step = createStep(`${eventLog.transactionHash}-${steps.length + 1}-swap`, 'swap', `${poolTo.label} swap`, symbol, 'UNKNOWN', transfer.value, 0n, 0n, 0n, poolTo.key)
      steps.push(step)
      if (!swapQueues.has(to)) swapQueues.set(to, [])
      swapQueues.get(to).push(step)
    }
    if (poolFrom && to === manager) {
      const queue = swapQueues.get(from)
      if (queue?.length) {
        const step = queue.find((candidate) => candidate.tokenOutAmount === '0') || queue.shift()
        if (step) {
          step.tokenOutSymbol = symbol
          step.tokenOutAmount = transfer.value.toString()
        }
      }
    }

    if (token === HOLYC) {
      if (from === manager && BURN_ADDRESSES.has(to)) {
        holyBurned += transfer.value
        for (let index = completedRestores.length - 1; index >= 0; index -= 1) {
          const candidate = completedRestores[index]
          if (!candidate.isSettlement && candidate.tokenOutAmount === transfer.value.toString()) {
            candidate.isSettlement = true
            candidate.settlementAmount = transfer.value.toString()
            break
          }
        }
      }
      if (to === manager) holyIn += transfer.value
      if (from === manager) {
        holyOut += transfer.value
        if (to === JIT) {
          const step = createStep(`${eventLog.transactionHash}-${steps.length + 1}-compile`, 'compile', 'Divine Compiler (HC→JIT)', 'HOLYC', 'JIT', transfer.value)
          steps.push(step)
          compileQueue.push(step)
        }
      }
      if (from === JIT && to === manager) {
        const restore = restoreQueue.find((candidate) => candidate.tokenOutAmount === '0')
        if (restore) {
          restore.tokenOutAmount = transfer.value.toString()
          completedRestores.push(restore)
        }
      }
    }

    if (token === JIT) {
      if (BURN_ADDRESSES.has(to)) jitBurned += transfer.value
      if (to === manager) {
        jitIn += transfer.value
        if (from === ZERO) {
          const compile = compileQueue.find((candidate) => candidate.tokenOutAmount === '0')
          if (compile) {
            compile.tokenOutAmount = transfer.value.toString()
            const fee = BigInt(compile.tokenInAmount) > transfer.value ? BigInt(compile.tokenInAmount) - transfer.value : 0n
            if (fee > 0n) {
              compile.burns.holyc = (BigInt(compile.burns.holyc) + fee).toString()
              holyBurned += fee
            }
          }
        }
      }
      if (from === manager) {
        jitOut += transfer.value
        if (to === ZERO) {
          const step = createStep(`${eventLog.transactionHash}-${steps.length + 1}-restore`, 'restore', 'Divine Compiler (JIT→HolyC)', 'JIT', 'HOLYC', transfer.value, 0n, 0n, transfer.value)
          steps.push(step)
          restoreQueue.push(step)
        }
      }
    }

    if (token === WPLS) {
      if (to === manager) wplsIn += transfer.value
      if (from === manager) wplsOut += transfer.value
    }
  }

  if (holyBurned === 0n && jitBurned === 0n && holyIn === 0n && holyOut === 0n && jitIn === 0n && jitOut === 0n && wplsIn === 0n && wplsOut === 0n) return null
  return {
    source: 'divine-manager',
    managerAddress: manager,
    transactionHash: eventLog.transactionHash.toLowerCase(),
    blockNumber: hexToBigInt(eventLog.blockNumber).toString(),
    timestamp: Number(hexToBigInt(block.timestamp)) * 1000,
    strategyId: eventLog.topics?.[1] || '0x',
    jobNonce: eventLog.topics?.[2] || '0x',
    holyBurned: holyBurned.toString(),
    jitBurned: jitBurned.toString(),
    holyIn: holyIn.toString(),
    holyOut: holyOut.toString(),
    jitIn: jitIn.toString(),
    jitOut: jitOut.toString(),
    wplsIn: wplsIn.toString(),
    wplsOut: wplsOut.toString(),
    v2Settlement: manager === DIVINE_MANAGER_V2 ? parseV2Settlement(receipt.logs || [], manager) : null,
    steps,
  }
}

function createStep(id, type, label, tokenInSymbol, tokenOutSymbol, tokenInAmount, tokenOutAmount = 0n, holycBurn = 0n, jitBurn = 0n, pool) {
  return {
    id, type, label, tokenInSymbol, tokenOutSymbol,
    tokenInAmount: tokenInAmount.toString(), tokenOutAmount: tokenOutAmount.toString(),
    burns: { holyc: holycBurn.toString(), jit: jitBurn.toString() },
    ...(pool ? { pool } : {}),
  }
}

function parseV2Settlement(logs, manager) {
  const allocations = []
  const warnings = []
  let settled = null
  for (const log of logs) {
    if (log.address.toLowerCase() !== manager || !log.topics?.length) continue
    const topic = log.topics[0].toLowerCase()
    if (topic === PROFIT_SETTLED_TOPIC && log.topics.length >= 3) {
      const asset = Number(hexToBigInt(log.topics[2]))
      if (asset > 2) { warnings.push(`ProfitSettled emitted unsupported asset ${asset}`); continue }
      const values = decodeWords(log.data, 4)
      if (!values) { warnings.push('ProfitSettled data was malformed'); continue }
      settled = { jobNonce: log.topics[1], asset, grossProfit: values[0], protectedProfit: values[1], shareableProfit: values[2], totalAllocated: values[3] }
    } else if (topic === PROFIT_PAID_TOPIC && log.topics.length >= 4) {
      const sourceAsset = Number(hexToBigInt(log.topics[2]))
      const paidAsset = Number(hexToBigInt(log.topics[3]))
      const values = decodeWords(log.data, 3)
      if (sourceAsset > 2 || paidAsset > 2 || !values) { warnings.push('ProfitPaid data was malformed or used an unsupported asset'); continue }
      const recipient = topicAddress(log.topics[1])
      allocations.push({ recipient, recipientLabel: PARTNER_LABELS.get(recipient) || `${recipient.slice(0, 6)}…${recipient.slice(-4)}`, sourceAsset, paidAsset, sourceAmount: values[0], paidAmount: values[1], bps: Number(BigInt(values[2])) })
    }
  }
  if (!settled) return { status: 'missing', jobNonce: null, asset: null, grossProfit: '0', protectedProfit: '0', shareableProfit: '0', totalAllocated: '0', retainedProfit: '0', allocations, warnings: ['ProfitSettled event was not found; V2 settlement totals are unavailable'] }
  const allocated = allocations.reduce((total, allocation) => total + BigInt(allocation.sourceAmount), 0n)
  if (allocated !== BigInt(settled.totalAllocated)) warnings.push(`ProfitPaid total ${allocated} does not match ProfitSettled totalAllocated ${settled.totalAllocated}`)
  if (allocations.some((allocation) => allocation.sourceAsset !== settled.asset)) warnings.push('ProfitPaid source asset does not match ProfitSettled asset')
  if (BigInt(settled.totalAllocated) > BigInt(settled.grossProfit)) warnings.push('ProfitSettled totalAllocated exceeds grossProfit')
  return { ...settled, status: warnings.length ? 'mismatch' : 'complete', retainedProfit: (BigInt(settled.grossProfit) > BigInt(settled.totalAllocated) ? BigInt(settled.grossProfit) - BigInt(settled.totalAllocated) : 0n).toString(), allocations, warnings }
}

function parseTransfer(log) {
  if (log.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC || log.topics.length < 3) return null
  return { from: topicAddress(log.topics[1]), to: topicAddress(log.topics[2]), value: hexToBigInt(log.data || '0x0') }
}
function tokenSymbol(address) { return address === HOLYC ? 'HOLYC' : address === JIT ? 'JIT' : address === WPLS ? 'WPLS' : 'UNKNOWN' }
function topicAddress(topic) { return `0x${topic.slice(-40)}`.toLowerCase() }
function decodeWords(data, count) {
  if (!data?.startsWith('0x') || data.length < 2 + count * 64) return null
  return Array.from({ length: count }, (_, index) => BigInt(`0x${data.slice(2 + index * 64, 2 + (index + 1) * 64)}`).toString())
}

async function getTicketLogs(rpcUrl, fromBlock, toBlock) {
  const requests = MANAGERS.map((address) => rpc(rpcUrl, 'eth_getLogs', [{ address, fromBlock: toHex(fromBlock), toBlock: toHex(toBlock), topics: [TICKET_EXECUTED_TOPIC] }]))
  return (await Promise.all(requests)).flat().filter((log) => !log.removed)
}
async function rpc(url, method, params) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`)
  const body = await response.json()
  if (body.error) throw new Error(`${method}: ${body.error.message || JSON.stringify(body.error)}`)
  return body.result
}
async function rpcBatch(url, calls) {
  if (!calls.length) return []
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(calls.map((call) => ({ jsonrpc: '2.0', ...call }))) })
  if (!response.ok) throw new Error(`RPC batch HTTP ${response.status}`)
  const body = await response.json()
  if (!Array.isArray(body)) throw new Error('RPC batch did not return an array')
  return body.sort((a, b) => a.id - b.id)
}
function compareLogAsc(a, b) { return Number(hexToBigInt(a.blockNumber) - hexToBigInt(b.blockNumber)) || Number(hexToBigInt(a.transactionIndex || '0x0') - hexToBigInt(b.transactionIndex || '0x0')) || Number(hexToBigInt(a.logIndex || '0x0') - hexToBigInt(b.logIndex || '0x0')) }
function compareLogPosition(log, cursor) { return Number(hexToBigInt(log.blockNumber) - BigInt(cursor.blockNumber)) || Number(hexToBigInt(log.transactionIndex || '0x0') - BigInt(cursor.transactionIndex)) || log.transactionHash.localeCompare(cursor.hash) }
function encodeCursor(value) {
  const blockNumber = value.blockNumber ?? value.block_number
  const transactionIndex = value.transactionIndex ?? value.transaction_index ?? '0x0'
  const hash = value.transactionHash ?? value.tx_hash ?? value.hash
  return `${Number(hexToBigInt(blockNumber)).toString(36)}.${Number(hexToBigInt(transactionIndex)).toString(36)}.${hash.toLowerCase()}`
}
function decodeCursor(value) {
  if (!value) return null
  const [block, index, hash] = value.split('.')
  if (!block || !index || !/^0x[0-9a-f]{64}$/i.test(hash || '')) return null
  const blockNumber = Number.parseInt(block, 36); const transactionIndex = Number.parseInt(index, 36)
  return Number.isSafeInteger(blockNumber) && Number.isSafeInteger(transactionIndex) ? { blockNumber, transactionIndex, hash: hash.toLowerCase() } : null
}
function hexToBigInt(value) { return BigInt(value || '0x0') }
function toHex(value) { return `0x${BigInt(value).toString(16)}` }
function boundedInt(value, fallback, min, max) { const parsed = Number(value); return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback }
function json(body, status = 200, headers = {}) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders, ...headers } }) }
