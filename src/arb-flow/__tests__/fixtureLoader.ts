import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface FixtureLog {
  address: string
  topics: string[]
  data: string
  logIndex: number
}

export interface FixtureData {
  id: string
  hash: string
  chainId: number
  blockNumber: bigint
  timestamp: number
  input: string
  from: string
  to: string
  value: bigint
  ticketEvent: {
    strategyId: string
    jobNonce: string
    profitWPLS: bigint
  } | null
  splitPaidEvent: {
    destination: string
    wplsAmount: bigint
    holyCAmount: bigint
    jitAmount: bigint
  } | null
  logs: FixtureLog[]
}

const revive = (_key: string, value: unknown): unknown => {
  if (typeof value === 'string' && value.startsWith('bigint:')) {
    return BigInt(value.slice(7))
  }
  return value
}

export const loadFixture = (id: string): FixtureData =>
  JSON.parse(readFileSync(join(__dirname, '..', '__fixtures__', `${id}.json`), 'utf8'), revive) as FixtureData

export const FIXTURE_TX_1 = 'tx-34a495'
export const FIXTURE_TX_2 = 'tx-d1336c'
