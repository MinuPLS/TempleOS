import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createPublicClient, defineChain, formatUnits, getAddress, http } from 'viem'

const HR_LINE = '———————————————-'
const RPC_URL = process.env.PULSECHAIN_RPC_URL || 'https://rpc.pulsechain.com'
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID
const DRY_RUN = process.env.DRY_RUN === 'true'
const POST_ON_BOOTSTRAP = process.env.POST_ON_BOOTSTRAP === 'true'
const FORCE_DAILY_POST = process.env.FORCE_DAILY_POST === 'true'
const FORCE_ARB_POST = process.env.FORCE_ARB_POST === 'true'
const MAX_LOOKBACK_BLOCKS = BigInt(process.env.MAX_LOOKBACK_BLOCKS || '200000')
const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000

if (!DRY_RUN) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('Missing TELEGRAM_BOT_TOKEN')
  if (!TELEGRAM_CHAT_ID) throw new Error('Missing TELEGRAM_CHAT_ID')
}

const pulseChain = defineChain({
  id: 369,
  name: 'PulseChain',
  nativeCurrency: {
    decimals: 18,
    name: 'Pulse',
    symbol: 'PLS',
  },
  rpcUrls: {
    default: {
      http: [RPC_URL],
    },
  },
})

const client = createPublicClient({
  chain: pulseChain,
  transport: http(RPC_URL),
})

const STATE_PATH = path.resolve(process.cwd(), '.github/arb-bot/state.json')

const DEFAULT_STATE = {
  lastProcessedBlock: null,
  lastProcessedTxHash: null,
  lastDailySummaryAt: null,
  lastDailyStats: {
    permanentlyLockedHolyC: '0',
    holycFeesBurned: '0',
  },
  lastBuyBurn: {
    blockNumber: null,
    txHash: null,
    briahBurned: '0',
    jitSpent: '0',
    timestamp: null,
  },
}

const DIVINE_MANAGER_ADDRESS = '0x7EE5476ae357b02F3F61Ba0d8369945d3615E0de'
const HOLY_C_ADDRESS = '0x6c8fdfd2CeC0b83d69045074d57A87Fa1525225A'
const JIT_ADDRESS = '0x57909025ACE10D5dE114d96E3EC84F282895870c'
const WPLS_ADDRESS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27'
const BURN_ADDRESS = '0x0000000000000000000000000000000000000369'
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const WPLS_DAI_PAIR_ADDRESS = '0xE56043671df55dE5CDf8459710433C10324DE0aE'
const HOLYC_WPLS_PAIR_ADDRESS = '0x28be4ad6d58ab4aacea3cb42bde457b7da251bac'
const JIT_WPLS_PAIR_ADDRESS = '0xc68a84655fa4ef48f8dd5273821183216da4de37'
const HOLYC_INITIAL_SUPPLY = 1_000_000_000n * 10n ** 18n

const BUY_AND_BURN_CONTRACT = '0x7DA770d10B6a62Fc9DC5A9682bDF2849d2b617d4'
const BRIAH_TOKEN = '0xA80736067abDc215a3b6B66a57c6e608654d0C9a'
const DEXSCREENER_ENDPOINT = `https://api.dexscreener.com/latest/dex/tokens/${BRIAH_TOKEN}`

const DIVINE_MANAGER_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'strategyId', type: 'bytes32' },
      { indexed: true, internalType: 'bytes32', name: 'jobNonce', type: 'bytes32' },
      { indexed: false, internalType: 'uint256', name: 'profitWPLS', type: 'uint256' },
    ],
    name: 'TicketExecuted',
    type: 'event',
  },
]

const BUY_AND_BURN_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'caller', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'jitSpent', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'briahBurned', type: 'uint256' },
    ],
    name: 'BuyAndBurn',
    type: 'event',
  },
]

const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
]

const UNISWAP_V2_PAIR_ABI = [
  {
    type: 'function',
    name: 'getReserves',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: '_reserve0', type: 'uint112' },
      { name: '_reserve1', type: 'uint112' },
      { name: '_blockTimestampLast', type: 'uint32' },
    ],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: '_owner', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'token0',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
]

const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

const usdFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const withRetry = async (fn, retries = 3, delayMs = 300) => {
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

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const bold = (value) => `<b>${escapeHtml(value)}</b>`
const italic = (value) => `<i>${escapeHtml(value)}</i>`

const parseBigInt = (value, fallback = 0n) => {
  if (typeof value === 'string') {
    try {
      return BigInt(value)
    } catch {
      return fallback
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(value)
  }
  return fallback
}

const formatAmount = (amount, digits = 2) => {
  const value = Number(formatUnits(amount, 18))
  if (!Number.isFinite(value)) return '0'
  const absValue = Math.abs(value)

  if (absValue >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`
  }

  if (absValue >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`
  }

  if (absValue >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

const formatCompact = (amount) => {
  if (amount === 0n) return '0'
  const sign = amount > 0n ? '+' : '-'
  const abs = amount >= 0n ? amount : amount * -1n
  return `${sign}${formatAmount(abs)}`
}

const formatUsdSigned = (value) => {
  const normalized = value < 0 ? 0 : value
  const formatted = usdFormatter.format(normalized)
  return normalized > 0 ? `+ ${formatted}` : formatted
}

const formatUnitsSigned = (amount, decimals = 18) => {
  const sign = amount < 0n ? -1 : 1
  const magnitude = amount < 0n ? amount * -1n : amount
  return Number(formatUnits(magnitude, decimals)) * sign
}

const formatCurrency = (amount, currency = 'USD') => {
  const number = Number(amount)
  if (isNaN(number)) return '$0.00'
  let decimals = 2
  if (number < 0.000001) decimals = 12
  else if (number < 0.00001) decimals = 11
  else if (number < 0.0001) decimals = 10
  else if (number < 0.001) decimals = 9
  else if (number < 0.01) decimals = 8
  else if (number < 0.1) decimals = 6
  else if (number < 1) decimals = 4

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(number)
}

const formatRoundedCompact = (amount) => {
  const value = Number(formatUnits(amount, 18))
  if (!Number.isFinite(value)) return '0'
  const absValue = Math.abs(value)

  if (absValue >= 1_000_000_000) {
    return `${Math.round(value / 1_000_000_000)}B`
  }

  if (absValue >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M`
  }

  if (absValue >= 1_000) {
    return `${Math.round(value / 1_000)}K`
  }

  return Math.round(value).toLocaleString()
}

const formatRoundedWholeTokens = (amount) => {
  const DECIMALS = 10n ** 18n
  const isNegative = amount < 0n
  const magnitude = isNegative ? amount * -1n : amount
  const roundedUp = magnitude === 0n ? 0n : (magnitude + DECIMALS - 1n) / DECIMALS
  const value = isNegative ? -roundedUp : roundedUp
  return value.toString()
}

const formatExactUnits = (amount) => {
  const sign = amount < 0n ? '-' : ''
  const magnitude = amount < 0n ? amount * -1n : amount
  const raw = formatUnits(magnitude, 18)
  const trimmed = raw.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  return `${sign}${trimmed === '' ? '0' : trimmed}`
}

const getTopicAddress = (topic) => {
  if (!topic) return ZERO_ADDRESS
  const normalized = `0x${topic.slice(topic.length - 40)}`
  try {
    return getAddress(normalized)
  } catch {
    return ZERO_ADDRESS
  }
}

const parseTransfer = (log) => {
  if (!log.topics?.length || log.topics[0].toLowerCase() !== TRANSFER_TOPIC) return null
  const from = getTopicAddress(log.topics[1])
  const to = getTopicAddress(log.topics[2])
  const value = log.data ? BigInt(log.data) : 0n
  return { from, to, value }
}

const loadState = async () => {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    return {
      ...DEFAULT_STATE,
      ...parsed,
      lastDailyStats: {
        ...DEFAULT_STATE.lastDailyStats,
        ...(parsed?.lastDailyStats ?? {}),
      },
      lastBuyBurn: {
        ...DEFAULT_STATE.lastBuyBurn,
        ...(parsed?.lastBuyBurn ?? {}),
      },
    }
  } catch (error) {
    if (error && error.code !== 'ENOENT') {
      console.warn('Failed to read state file, using defaults:', error)
    }
    return { ...DEFAULT_STATE }
  }
}

const saveState = async (state) => {
  await fs.mkdir(path.dirname(STATE_PATH), { recursive: true })
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8')
}

const fetchEventsInRange = async ({ address, abi, eventName, fromBlock, toBlock }) => {
  if (fromBlock > toBlock) return []
  const results = []
  let start = fromBlock
  let chunk = 25_000n

  while (start <= toBlock) {
    let end = start + chunk - 1n
    if (end > toBlock) end = toBlock

    try {
      const batch = await withRetry(() =>
        client.getContractEvents({
          address,
          abi,
          eventName,
          fromBlock: start,
          toBlock: end,
        })
      )
      results.push(...batch)
      start = end + 1n
      if (chunk < 200_000n) chunk = chunk * 2n
    } catch (error) {
      if (chunk <= 500n) throw error
      chunk = chunk / 2n
    }
  }

  return results
}

const fetchTokenPrices = async () => {
  let wplsDaiReserves
  let holycWplsReserves
  let jitWplsReserves

  try {
    const reservesResults = await withRetry(() =>
      client.multicall({
        contracts: [
          {
            address: WPLS_DAI_PAIR_ADDRESS,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'getReserves',
          },
          {
            address: HOLYC_WPLS_PAIR_ADDRESS,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'getReserves',
          },
          {
            address: JIT_WPLS_PAIR_ADDRESS,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'getReserves',
          },
        ],
      })
    )

    if (reservesResults.some((result) => result.status !== 'success')) {
      throw new Error('Could not fetch all pair reserves')
    }

    ;[wplsDaiReserves, holycWplsReserves, jitWplsReserves] = reservesResults.map(
      (result) => result.result
    )
  } catch (error) {
    const [wplsDaiRes, holycWplsRes, jitWplsRes] = await Promise.all([
      withRetry(() =>
        client.readContract({
          address: WPLS_DAI_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'getReserves',
        })
      ),
      withRetry(() =>
        client.readContract({
          address: HOLYC_WPLS_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'getReserves',
        })
      ),
      withRetry(() =>
        client.readContract({
          address: JIT_WPLS_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'getReserves',
        })
      ),
    ])

    wplsDaiReserves = wplsDaiRes
    holycWplsReserves = holycWplsRes
    jitWplsReserves = jitWplsRes
  }

  const PRECISION = 10n ** 18n
  const wplsPriceInUsd = (wplsDaiReserves[1] * PRECISION) / wplsDaiReserves[0]
  const holycPriceInUsd = (holycWplsReserves[1] * wplsPriceInUsd) / holycWplsReserves[0]
  const jitPriceInUsd = (jitWplsReserves[1] * wplsPriceInUsd) / jitWplsReserves[0]

  return {
    holycUSD: Number(formatUnits(holycPriceInUsd, 18)),
    jitUSD: Number(formatUnits(jitPriceInUsd, 18)),
  }
}

const fetchTokenStats = async () => {
  let holyCLocked
  let jitSupply
  let holyCBurned
  let lpTotalSupply
  let lpBurnBalance
  let reserves
  let token0

  try {
    const results = await withRetry(() =>
      client.multicall({
        contracts: [
          {
            address: HOLY_C_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [JIT_ADDRESS],
          },
          {
            address: JIT_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'totalSupply',
          },
          {
            address: HOLY_C_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [BURN_ADDRESS],
          },
          {
            address: HOLYC_WPLS_PAIR_ADDRESS,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'totalSupply',
          },
          {
            address: HOLYC_WPLS_PAIR_ADDRESS,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'balanceOf',
            args: [ZERO_ADDRESS],
          },
          {
            address: HOLYC_WPLS_PAIR_ADDRESS,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'getReserves',
          },
          {
            address: HOLYC_WPLS_PAIR_ADDRESS,
            abi: UNISWAP_V2_PAIR_ABI,
            functionName: 'token0',
          },
        ],
      })
    )

    if (results.some((result) => result.status !== 'success')) {
      throw new Error('Could not fetch token stats via multicall')
    }

    ;[
      holyCLocked,
      jitSupply,
      holyCBurned,
      lpTotalSupply,
      lpBurnBalance,
      reserves,
      token0,
    ] = results.map((result) => result.result)
  } catch (error) {
    ;[
      holyCLocked,
      jitSupply,
      holyCBurned,
      lpTotalSupply,
      lpBurnBalance,
      reserves,
      token0,
    ] = await Promise.all([
      withRetry(() =>
        client.readContract({
          address: HOLY_C_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [JIT_ADDRESS],
        })
      ),
      withRetry(() =>
        client.readContract({
          address: JIT_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'totalSupply',
        })
      ),
      withRetry(() =>
        client.readContract({
          address: HOLY_C_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [BURN_ADDRESS],
        })
      ),
      withRetry(() =>
        client.readContract({
          address: HOLYC_WPLS_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'totalSupply',
        })
      ),
      withRetry(() =>
        client.readContract({
          address: HOLYC_WPLS_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'balanceOf',
          args: [ZERO_ADDRESS],
        })
      ),
      withRetry(() =>
        client.readContract({
          address: HOLYC_WPLS_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'getReserves',
        })
      ),
      withRetry(() =>
        client.readContract({
          address: HOLYC_WPLS_PAIR_ADDRESS,
          abi: UNISWAP_V2_PAIR_ABI,
          functionName: 'token0',
        })
      ),
    ])
  }

  let holycLockedAsLP = 0n
  if (lpTotalSupply > 0n) {
    const isToken0HolyC = token0.toLowerCase() === HOLY_C_ADDRESS.toLowerCase()
    const holycReserve = isToken0HolyC ? reserves[0] : reserves[1]
    const shareBurned = (lpBurnBalance * 10n ** 18n) / lpTotalSupply
    holycLockedAsLP = (holycReserve * shareBurned) / (10n ** 18n)
  }

  const permanentlyLockedHolyC = holyCLocked - jitSupply
  const removedTotalHolyC = permanentlyLockedHolyC + holyCBurned + holycLockedAsLP
  const circulatingHolyC = HOLYC_INITIAL_SUPPLY - removedTotalHolyC

  return {
    holycLocked: holyCLocked,
    jitCirculating: jitSupply,
    holycFeesBurned: holyCBurned,
    permanentlyLockedHolyC,
    removedTotalHolyC,
    circulatingHolyC,
    holycLockedAsLP,
  }
}

const fetchBriahUsdPrice = async () => {
  try {
    const response = await fetch(DEXSCREENER_ENDPOINT)
    if (!response.ok) return null
    const json = await response.json()
    const price = json?.pairs?.find((pair) => pair?.priceUsd)?.priceUsd
    const parsed = price ? Number(price) : null
    if (parsed && Number.isFinite(parsed)) return parsed
    return null
  } catch (error) {
    return null
  }
}

const fetchLatestBuyBurn = async (state, latestBlock) => {
  const previousBlock = state.lastBuyBurn?.blockNumber
    ? parseBigInt(state.lastBuyBurn.blockNumber)
    : null
  const fallbackFromBlock =
    latestBlock > MAX_LOOKBACK_BLOCKS ? latestBlock - MAX_LOOKBACK_BLOCKS : 0n
  const fromBlock = previousBlock !== null ? previousBlock + 1n : fallbackFromBlock

  const logs = await fetchEventsInRange({
    address: BUY_AND_BURN_CONTRACT,
    abi: BUY_AND_BURN_ABI,
    eventName: 'BuyAndBurn',
    fromBlock,
    toBlock: latestBlock,
  })

  if (!logs.length) {
    return state.lastBuyBurn?.txHash ? state.lastBuyBurn : null
  }

  const ordered = [...logs].sort((a, b) => {
    const blockDiff = Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n))
    if (blockDiff !== 0) return blockDiff
    const logIndexA = typeof a.logIndex === 'number' ? a.logIndex : 0
    const logIndexB = typeof b.logIndex === 'number' ? b.logIndex : 0
    return logIndexA - logIndexB
  })

  const latest = ordered[ordered.length - 1]
  const blockNumber = latest.blockNumber ?? latestBlock
  const block = await withRetry(() => client.getBlock({ blockNumber }))
  const briahBurned = latest.args?.briahBurned ? BigInt(latest.args.briahBurned) : 0n
  const jitSpent = latest.args?.jitSpent ? BigInt(latest.args.jitSpent) : 0n

  const updated = {
    blockNumber: blockNumber.toString(),
    txHash: latest.transactionHash,
    briahBurned: briahBurned.toString(),
    jitSpent: jitSpent.toString(),
    timestamp: Number(block.timestamp) * 1000,
  }

  state.lastBuyBurn = updated
  return updated
}

const parseExecutionMetrics = (receiptLogs) => {
  const divineAddress = DIVINE_MANAGER_ADDRESS.toLowerCase()
  const holyAddress = HOLY_C_ADDRESS.toLowerCase()
  const jitAddress = JIT_ADDRESS.toLowerCase()
  const burnAddress = BURN_ADDRESS.toLowerCase()
  const zeroAddress = ZERO_ADDRESS.toLowerCase()

  let holyBurned = 0n
  let jitBurned = 0n
  let holyIn = 0n
  let holyOut = 0n
  let jitIn = 0n
  let jitOut = 0n

  const compileQueue = []

  for (const receiptLog of receiptLogs ?? []) {
    const baseLog = {
      address: receiptLog.address,
      topics: receiptLog.topics,
      data: receiptLog.data,
    }

    const transfer = parseTransfer(baseLog)
    if (!transfer) continue

    const tokenAddress = getAddress(baseLog.address).toLowerCase()
    const fromAddress = transfer.from.toLowerCase()
    const toAddress = transfer.to.toLowerCase()

    if (tokenAddress === holyAddress) {
      const isHolyBurn =
        fromAddress === divineAddress && (toAddress === zeroAddress || toAddress === burnAddress)
      if (isHolyBurn) holyBurned += transfer.value
      if (toAddress === divineAddress) holyIn += transfer.value
      if (fromAddress === divineAddress) {
        holyOut += transfer.value
        if (toAddress === jitAddress) {
          compileQueue.push({ input: transfer.value, output: 0n })
        }
      }
    }

    if (tokenAddress === jitAddress) {
      if (toAddress === zeroAddress || toAddress === burnAddress) {
        jitBurned += transfer.value
      }
      if (toAddress === divineAddress) {
        jitIn += transfer.value
        if (fromAddress === zeroAddress) {
          const pending = compileQueue.find((entry) => entry.output === 0n)
          if (pending) {
            pending.output = transfer.value
            const fee = pending.input > transfer.value ? pending.input - transfer.value : 0n
            if (fee > 0n) holyBurned += fee
          }
        }
      }
      if (fromAddress === divineAddress) {
        jitOut += transfer.value
      }
    }
  }

  return {
    holyBurned,
    jitBurned,
    holyIn,
    holyOut,
    jitIn,
    jitOut,
  }
}

const buildExecutionFromLog = async (log) => {
  const txHash = log.transactionHash
  if (!txHash) return null

  const receipt = await withRetry(() => client.getTransactionReceipt({ hash: txHash }))
  if (receipt.status !== 'success') return null

  const blockNumber = receipt.blockNumber
  const block = await withRetry(() => client.getBlock({ blockNumber }))

  const metrics = parseExecutionMetrics(receipt.logs)
  const hasMovement =
    metrics.holyBurned > 0n ||
    metrics.jitBurned > 0n ||
    metrics.holyIn > 0n ||
    metrics.holyOut > 0n ||
    metrics.jitIn > 0n ||
    metrics.jitOut > 0n
  if (!hasMovement) return null

  return {
    transactionHash: txHash,
    blockNumber,
    timestamp: Number(block.timestamp) * 1000,
    ...metrics,
  }
}

const buildArbMessage = (execution, tokenPrices, buyBurnInfo, briahUsdPrice) => {
  const netHoly = execution.holyIn - execution.holyOut
  const netJit = execution.jitIn - execution.jitOut
  const usdNumber =
    formatUnitsSigned(netHoly, 18) * tokenPrices.holycUSD +
    formatUnitsSigned(netJit, 18) * tokenPrices.jitUSD
  const usdValue = formatUsdSigned(usdNumber)

  const lines = []
  lines.push(HR_LINE)
  lines.push(bold('Divine Manager Activity'))
  lines.push(`HolyC Gained: ${escapeHtml(formatCompact(netHoly))}`)
  lines.push(`JIT Gained: ${escapeHtml(formatCompact(netJit))}`)
  lines.push('')
  lines.push(`Value gained: ${escapeHtml(usdValue)}`)
  lines.push(`HolyC burned: ${escapeHtml(formatAmount(execution.holyBurned))} HC`)
  lines.push('')

  if (buyBurnInfo?.txHash) {
    const briahBurned = parseBigInt(buyBurnInfo.briahBurned)
    if (briahBurned > 0n) {
      const briahAmount = formatAmount(briahBurned, 4)
      const briahValue = briahUsdPrice
        ? usdFormatter.format(Number(formatUnits(briahBurned, 18)) * briahUsdPrice)
        : '—'

      lines.push(bold('Partner Buy&Burn'))
      lines.push(`${escapeHtml(briahAmount)} Briah`)
      lines.push(`Value: ${escapeHtml(briahValue)}`)
      lines.push('')
    }
  }

  lines.push(bold('OtterScan Transaction'))
  lines.push(`https://otter.pulsechain.com/tx/${execution.transactionHash}`)
  lines.push(HR_LINE)

  return lines.join('\n')
}

const buildDailyMessage = (tokenPrices, tokenStats, state) => {
  const lines = []
  lines.push(bold('Token Prices'))
  lines.push(`HolyC: ${escapeHtml(formatCurrency(tokenPrices.holycUSD))}`)
  lines.push(`JIT: ${escapeHtml(formatCurrency(tokenPrices.jitUSD))}`)

  if (tokenPrices.holycUSD !== 0 && tokenPrices.jitUSD !== 0) {
    const holycPrice = tokenPrices.holycUSD
    const jitPrice = tokenPrices.jitUSD
    if (holycPrice !== jitPrice) {
      const moreExpensiveTokenName = holycPrice > jitPrice ? 'HolyC' : 'JIT'
      const percentageDiff = holycPrice > jitPrice
        ? ((holycPrice / jitPrice) - 1) * 100
        : ((jitPrice / holycPrice) - 1) * 100
      lines.push(italic(`${moreExpensiveTokenName} is more expensive by ${percentageDiff.toFixed(2)}%`))
    }
  }

  lines.push('')
  lines.push(bold('Circulating Supply'))
  lines.push(`HolyC: ${escapeHtml(formatRoundedCompact(tokenStats.circulatingHolyC))}`)
  lines.push(`JIT: ${escapeHtml(formatRoundedCompact(tokenStats.jitCirculating))}`)

  lines.push('')
  lines.push(bold('Reserves & Liquidity'))
  lines.push(`In Compiler: ${escapeHtml(formatRoundedCompact(tokenStats.holycLocked))}`)
  lines.push(`Burned LP: ${escapeHtml(formatRoundedCompact(tokenStats.holycLockedAsLP))}`)

  lines.push('')
  lines.push(bold('Permanently Removed'))
  lines.push(`Locked HolyC: ${escapeHtml(formatRoundedCompact(tokenStats.permanentlyLockedHolyC))}`)
  lines.push(`Burned HolyC: ${escapeHtml(formatRoundedCompact(tokenStats.holycFeesBurned))}`)

  const prevLocked = parseBigInt(state.lastDailyStats?.permanentlyLockedHolyC)
  const prevBurned = parseBigInt(state.lastDailyStats?.holycFeesBurned)
  const deltaLocked = tokenStats.permanentlyLockedHolyC - prevLocked
  const deltaBurned = tokenStats.holycFeesBurned - prevBurned

  lines.push(
    italic(
      `In the past 24h ${formatRoundedWholeTokens(deltaLocked)} HolyC got locked forever in the Compiler, and ${formatRoundedWholeTokens(deltaBurned)} HolyC is send forever to the burn address`
    )
  )

  return lines.join('\n')
}

const sendTelegram = async (message) => {
  if (DRY_RUN) {
    console.log(message)
    return
  }

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Telegram API error: ${response.status} ${response.statusText} - ${body}`)
  }
}

const main = async () => {
  const state = await loadState()
  const latestBlock = await withRetry(() => client.getBlockNumber())
  const tokenPrices = await fetchTokenPrices()

  const forceArbPost = FORCE_ARB_POST
  let fromBlock = null
  if (forceArbPost) {
    fromBlock = latestBlock > MAX_LOOKBACK_BLOCKS ? latestBlock - MAX_LOOKBACK_BLOCKS : 0n
  } else if (state.lastProcessedBlock === null) {
    if (POST_ON_BOOTSTRAP) {
      const fallback = latestBlock > MAX_LOOKBACK_BLOCKS ? latestBlock - MAX_LOOKBACK_BLOCKS : 0n
      fromBlock = fallback
    } else {
      state.lastProcessedBlock = latestBlock.toString()
    }
  } else {
    const lastProcessed = parseBigInt(state.lastProcessedBlock)
    fromBlock = lastProcessed + 1n
    if (latestBlock - fromBlock > MAX_LOOKBACK_BLOCKS) {
      fromBlock = latestBlock - MAX_LOOKBACK_BLOCKS
    }
  }

  let executions = []
  if (fromBlock !== null && fromBlock <= latestBlock) {
    const logs = await fetchEventsInRange({
      address: DIVINE_MANAGER_ADDRESS,
      abi: DIVINE_MANAGER_ABI,
      eventName: 'TicketExecuted',
      fromBlock,
      toBlock: latestBlock,
    })

    const orderedLogs = [...logs].sort((a, b) => {
      const blockDiff = Number((a.blockNumber ?? 0n) - (b.blockNumber ?? 0n))
      if (blockDiff !== 0) return blockDiff
      const logIndexA = typeof a.logIndex === 'number' ? a.logIndex : 0
      const logIndexB = typeof b.logIndex === 'number' ? b.logIndex : 0
      return logIndexA - logIndexB
    })

    if (forceArbPost) {
      const latestLog = orderedLogs[orderedLogs.length - 1]
      if (latestLog) {
        const execution = await buildExecutionFromLog(latestLog)
        if (execution) executions.push(execution)
      }
    } else {
      for (const log of orderedLogs) {
        const execution = await buildExecutionFromLog(log)
        if (!execution) continue
        if (state.lastProcessedTxHash && execution.transactionHash === state.lastProcessedTxHash) {
          continue
        }
        executions.push(execution)
      }
    }
  }

  if (executions.length > 0) {
    const buyBurnInfo = await fetchLatestBuyBurn(state, latestBlock)
    let briahUsdPrice = null
    if (buyBurnInfo?.txHash && parseBigInt(buyBurnInfo.briahBurned) > 0n) {
      briahUsdPrice = await fetchBriahUsdPrice()
    }
    for (const execution of executions) {
      const message = buildArbMessage(execution, tokenPrices, buyBurnInfo, briahUsdPrice)
      await sendTelegram(message)
    }
    const lastExecution = executions[executions.length - 1]
    state.lastProcessedBlock = lastExecution.blockNumber.toString()
    state.lastProcessedTxHash = lastExecution.transactionHash
  }

  const now = Date.now()
  const lastDaily = typeof state.lastDailySummaryAt === 'number' ? state.lastDailySummaryAt : null
  const shouldPostDaily = FORCE_DAILY_POST || !lastDaily || now - lastDaily >= DAILY_INTERVAL_MS

  if (shouldPostDaily) {
    const tokenStats = await fetchTokenStats()
    const dailyMessage = buildDailyMessage(tokenPrices, tokenStats, state)
    await sendTelegram(dailyMessage)
    state.lastDailySummaryAt = now
    state.lastDailyStats = {
      permanentlyLockedHolyC: tokenStats.permanentlyLockedHolyC.toString(),
      holycFeesBurned: tokenStats.holycFeesBurned.toString(),
    }
  }

  await saveState(state)
}

main().catch((error) => {
  console.error('Telegram arb bot failed:', error)
  process.exit(1)
})
