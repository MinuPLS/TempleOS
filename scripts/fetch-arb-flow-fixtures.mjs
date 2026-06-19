#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createPublicClient, http, parseAbiItem, decodeEventLog } from 'viem'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RPC = 'https://rpc.pulsechain.com'

const client = createPublicClient({ transport: http(RPC) })

const TXS = [
  { id: 'tx-34a495', hash: '0x34a49536a1df7f8a72febfa379eaee915ed2dcb4a38251c8bd97414dc75f1df0' },
  { id: 'tx-d1336c', hash: '0xd1336c079e956e71d2e823cdf4661d046a2adc75029f3d35c30967d86a23faec' },
]

const TicketExecuted = parseAbiItem(
  'event TicketExecuted(bytes32 indexed strategyId, bytes32 indexed jobNonce, uint256 profitWPLS)'
)
const SplitPaid = parseAbiItem(
  'event SplitPaid(address indexed destination, uint256 wplsAmount, uint256 holyCAmount, uint256 jitAmount)'
)
const TICKET_TOPIC = '0xe7d506afd1181041bb8d9ff3ec2150070564e7c1423c11689e42ecd1cd2a2b86'
const SPLIT_TOPIC = '0x0e77d5264d2c5d3f03b811f4ffb7d7fcea2d51a417187f518a0b968be6addf87'

const toJSON = (obj) => JSON.stringify(obj, (_, value) => {
  if (typeof value === 'bigint') return `bigint:${value.toString()}`
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) !== Object.prototype && !Array.isArray(value)) {
    return toJSON({ ...value })
  }
  return value
}, 2)

for (const { id, hash } of TXS) {
  process.stdout.write(`fetching ${id} (${hash})... `)
  const tx = await client.getTransaction({ hash })
  const receipt = await client.getTransactionReceipt({ hash })
  const block = await client.getBlock({ blockNumber: receipt.blockNumber })

  // Find the TicketExecuted + SplitPaid events for strategyId / jobNonce / profitWPLS / split amounts
  let ticketEvent = null
  let splitPaidEvent = null
  for (const log of receipt.logs) {
    const topic0 = log.topics[0]?.toLowerCase()
    try {
      if (topic0 === TICKET_TOPIC) {
        const decoded = decodeEventLog({ abi: [TicketExecuted], data: log.data, topics: log.topics })
        ticketEvent = {
          strategyId: decoded.args.strategyId,
          jobNonce: decoded.args.jobNonce,
          profitWPLS: decoded.args.profitWPLS,
        }
      } else if (topic0 === SPLIT_TOPIC) {
        const decoded = decodeEventLog({ abi: [SplitPaid], data: log.data, topics: log.topics })
        splitPaidEvent = {
          destination: decoded.args.destination,
          wplsAmount: decoded.args.wplsAmount,
          holyCAmount: decoded.args.holyCAmount,
          jitAmount: decoded.args.jitAmount,
        }
      }
    } catch {}
  }

  const fixture = {
    id,
    hash,
    chainId: 369,
    blockNumber: `bigint:${receipt.blockNumber.toString()}`,
    timestamp: Number(block.timestamp) * 1000,
    input: tx.input,
    from: tx.from,
    to: tx.to,
    value: `bigint:${tx.value.toString()}`,
    ticketEvent,
    splitPaidEvent,
    logs: receipt.logs.map((log) => ({
      address: log.address,
      topics: log.topics,
      data: log.data,
      logIndex: log.logIndex,
    })),
  }

  const outPath = join(__dirname, '..', 'src', 'arb-flow', '__fixtures__', `${id}.json`)
  writeFileSync(outPath, toJSON(fixture) + '\n')
  console.log(`saved ${outPath}`)
}

console.log('done')
