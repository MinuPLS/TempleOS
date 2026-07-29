import { describe, it, expect } from 'vitest'
import { buildArbFlow, BuildContext, findVoluntaryHolyCBurnPurchase } from '../buildArbFlow'
import { PoolResolver } from '../resolvePool'
import { TokenResolver } from '../resolveToken'
import { decodeExecuteCalldata } from '../decodeCalldata'
import { decodeSwapPath } from '../decodeSwapPath'
import { parseReceiptLogs } from '../parseLogs'
import {
  loadFixture,
  FIXTURE_TX_1,
  FIXTURE_TX_2,
  FIXTURE_TX_V2,
  FIXTURE_TX_V2_WPLS_BURN,
} from './fixtureLoader'
import { DIVINE_MANAGER_ADDRESS, HOLY_C_ADDRESS, JIT_ADDRESS, WPLS_ADDRESS } from '@/config/contracts'
import { TRANSFER_TOPIC } from '../abi'
import { BURN_ADDRESS } from '../types'

const EQUAL_SPLITTER = '0xF40A86C1Edd640e574b6560f155178A2A5267885'

const memStorage = () => {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

const throwClient = {
  readContract: async () => {
    throw new Error('mock: no on-chain calls expected for seed-only fixtures')
  },
}

const makeCtx = (splitDest: string | null = EQUAL_SPLITTER): BuildContext => ({
  managerAddress: '0x7EE5476ae357b02F3F61Ba0d8369945d3615E0de',
  jitCompilerAddress: JIT_ADDRESS,
  splitDestination: splitDest,
  poolResolver: new PoolResolver(throwClient, memStorage()),
  tokenResolver: new TokenResolver(throwClient, memStorage()),
})

const makeV2Ctx = (): BuildContext => ({
  managerAddress: DIVINE_MANAGER_ADDRESS,
  jitCompilerAddress: JIT_ADDRESS,
  splitDestination: null,
  poolResolver: new PoolResolver(throwClient, memStorage()),
  tokenResolver: new TokenResolver(throwClient, memStorage()),
})

const div18 = (v: bigint): number => Number(v) / 1e18

describe('buildArbFlow — tx-34a495 (HC_CORE, spec §8 example 1)', () => {
  const fx = loadFixture(FIXTURE_TX_1)
  const ctx = makeCtx()

  it('decodes 2 legs (compile + swap) and 2 sinks (burn + split)', async () => {
    const { flow, warnings } = await buildArbFlow(
      {
        txHash: fx.hash,
        blockNumber: fx.blockNumber,
        timestamp: fx.timestamp,
        input: fx.input,
        logs: fx.logs,
        from: fx.from,
      },
      ctx
    )

    expect(warnings).toEqual([])
    expect(flow.routeLabel).toBe('HC_CORE')
    expect(flow.legs).toHaveLength(2)
    expect(flow.sinks).toHaveLength(2)

    const compile = flow.legs[0]
    expect(compile.kind).toBe('compile')
    expect(compile.tokenIn.symbol).toBe('HolyC')
    expect(compile.tokenOut.symbol).toBe('JIT')
    expect(div18(compile.amountIn)).toBeCloseTo(102_292.35, 1)
    expect(div18(compile.amountOut)).toBeCloseTo(102_292.35, 1)

    const swap = flow.legs[1]
    expect(swap.kind).toBe('swap')
    expect(swap.tokenIn.symbol).toBe('JIT')
    expect(swap.tokenOut.symbol).toBe('HolyC')
    expect(div18(swap.amountIn)).toBeCloseTo(102_292.35, 1)
    expect(div18(swap.amountOut)).toBeCloseTo(108_858.97, 1)

    const burn = flow.sinks.find((s) => s.kind === 'burn')
    expect(burn).toBeDefined()
    expect(burn!.tokenIn.symbol).toBe('HolyC')
    expect(div18(burn!.amountIn)).toBeCloseTo(4_091.69, 1)

    const split = flow.sinks.find((s) => s.kind === 'split')
    expect(split).toBeDefined()
    expect(split!.tokenIn.symbol).toBe('HolyC')
    expect(div18(split!.amountIn)).toBeCloseTo(1_856.19, 1)

    expect(div18(flow.burnedHolyC)).toBeCloseTo(4_091.69, 1)
    expect(flow.splitDestination?.toLowerCase()).toBe(EQUAL_SPLITTER.toLowerCase())
  })

  it('computes all inventory deltas (HC retained, JIT net zero)', async () => {
    const { flow } = await buildArbFlow(
      { txHash: fx.hash, blockNumber: fx.blockNumber, timestamp: fx.timestamp, input: fx.input, logs: fx.logs, from: fx.from },
      ctx
    )
    const hc = flow.inventoryDeltas.find((d) => d.asset.symbol === 'HolyC')
    const jit = flow.inventoryDeltas.find((d) => d.asset.symbol === 'JIT')
    expect(hc).toBeDefined()
    expect(div18(hc!.delta)).toBeCloseTo(618.7, 0)
    // JIT net zero → not present
    expect(jit).toBeUndefined()
  })

  it('discovers the HC/JIT pool from Swap logs (seed cache, with Sync reserves)', async () => {
    const { flow } = await buildArbFlow(
      { txHash: fx.hash, blockNumber: fx.blockNumber, timestamp: fx.timestamp, input: fx.input, logs: fx.logs, from: fx.from },
      ctx
    )
    expect(flow.pools).toHaveLength(1)
    const pool = flow.pools[0]
    expect(pool.kind).toBe('pool')
    expect(pool.address?.toLowerCase()).toBe('0x7fa560cbe6d7c0d6d408b3fd9e59137d3324c76e')
    expect(pool.meta?.verified).toBe(true)
    expect(pool.meta?.isSeed).toBe(true)
    expect(pool.meta?.reserves?.[0]).toBeGreaterThan(0n)
  })

  it('emits start=end=HolyC and a positive gross', async () => {
    const { flow } = await buildArbFlow(
      { txHash: fx.hash, blockNumber: fx.blockNumber, timestamp: fx.timestamp, input: fx.input, logs: fx.logs, from: fx.from },
      ctx
    )
    expect(flow.startAsset.symbol).toBe('HolyC')
    expect(flow.endAsset.symbol).toBe('HolyC')
    expect(flow.gross).not.toBeNull()
    expect(div18(flow.gross!.amount)).toBeCloseTo(6_566.6, 0)
  })
})

describe('buildArbFlow — tx-d1336c (leftover JIT, spec §8 example 2)', () => {
  const fx = loadFixture(FIXTURE_TX_2)
  const ctx = makeCtx()

  it('shows BOTH a HolyC split and a JIT split (multi-token sink)', async () => {
    const { flow } = await buildArbFlow(
      { txHash: fx.hash, blockNumber: fx.blockNumber, timestamp: fx.timestamp, input: fx.input, logs: fx.logs, from: fx.from },
      ctx
    )
    const splits = flow.sinks.filter((s) => s.kind === 'split')
    const hcSplit = splits.find((s) => s.tokenIn.symbol === 'HolyC')
    const jitSplit = splits.find((s) => s.tokenIn.symbol === 'JIT')
    expect(hcSplit).toBeDefined()
    expect(jitSplit).toBeDefined()
    expect(div18(hcSplit!.amountIn)).toBeCloseTo(1_372.23, 1)
    expect(div18(jitSplit!.amountIn)).toBeCloseTo(48_938.45, 1)
  })

  it('shows BOTH HC and JIT inventory deltas (leftover JIT)', async () => {
    const { flow } = await buildArbFlow(
      { txHash: fx.hash, blockNumber: fx.blockNumber, timestamp: fx.timestamp, input: fx.input, logs: fx.logs, from: fx.from },
      ctx
    )
    const hc = flow.inventoryDeltas.find((d) => d.asset.symbol === 'HolyC')
    const jit = flow.inventoryDeltas.find((d) => d.asset.symbol === 'JIT')
    expect(hc).toBeDefined()
    expect(jit).toBeDefined()
    expect(div18(hc!.delta)).toBeGreaterThan(0)
    expect(div18(jit!.delta)).toBeGreaterThan(0)
  })

  it('burns 65,251 HC to the zero address', async () => {
    const { flow } = await buildArbFlow(
      { txHash: fx.hash, blockNumber: fx.blockNumber, timestamp: fx.timestamp, input: fx.input, logs: fx.logs, from: fx.from },
      ctx
    )
    const burn = flow.sinks.find((s) => s.kind === 'burn')
    expect(burn).toBeDefined()
    expect(div18(burn!.amountIn)).toBeCloseTo(65_251.27, 1)
    expect(div18(flow.burnedHolyC)).toBeCloseTo(65_251.27, 1)
  })
})

describe('buildArbFlow — tx-a2e9e4 (DivineManagerV2 mixed PulseX JIT cycle)', () => {
  const fx = loadFixture(FIXTURE_TX_V2)

  it('decodes four exact swaps without treating markers or pair addresses as assets', async () => {
    const { flow, warnings } = await buildArbFlow(
      { txHash: fx.hash, blockNumber: fx.blockNumber, timestamp: fx.timestamp, input: fx.input, logs: fx.logs, from: fx.from },
      makeV2Ctx()
    )

    expect(flow.routeLabel).toBe('JIT_CYCLE')
    expect(flow.legs).toHaveLength(4)
    expect(flow.legs.map((leg) => `${leg.tokenIn.symbol}->${leg.tokenOut.symbol}`)).toEqual([
      'JIT->DAI',
      'DAI->WPLS',
      'WPLS->Briah',
      'Briah->JIT',
    ])
    expect(flow.legs.map((leg) => flow.nodes.find((node) => node.id === leg.poolId)?.address?.toLowerCase())).toEqual([
      '0xccf4d4d6c0945bc0fe3ceb83ff491b279f464bac',
      '0x947b4633e32e0c7f2c76753b43f008480715416d',
      '0xd8836e8975a6bbeafbde651e4d1ff59dc99d45c0',
      '0xd303beb71c5ab830b45680c5f2788eda88e0d856',
    ])
    expect(flow.legs.some((leg) => leg.tokenIn.address === '0x0000000000000000000000000000000000000000')).toBe(false)
    expect(warnings.filter((warning) => warning.includes('unrecognized manager'))).toEqual([])
  })

  it('uses authoritative V2 settlement and exact partner allocations', async () => {
    const { flow } = await buildArbFlow(
      { txHash: fx.hash, blockNumber: fx.blockNumber, timestamp: fx.timestamp, input: fx.input, logs: fx.logs, from: fx.from },
      makeV2Ctx()
    )
    const settlement = flow.v2Settlement
    expect(settlement?.status).toBe('complete')
    expect(div18(settlement!.retainedProfit)).toBeCloseTo(644.5527084739, 9)
    expect(div18(settlement!.totalAllocated)).toBeCloseTo(41.7638375986, 9)
    expect(settlement?.allocations.map((allocation) => allocation.recipientLabel)).toEqual([
      'Briah',
      'CoinMafia',
      'Dumb',
      'FUPA',
    ])
    expect(flow.sinks.filter((sink) => sink.kind === 'partner')).toHaveLength(4)
    expect(flow.sinks.some((sink) => sink.kind === 'partner' && div18(sink.amountIn) > 100_000)).toBe(false)
    expect(div18(flow.burnedHolyC)).toBeCloseTo(75.4799603738, 9)
    expect(div18(flow.gross!.amount)).toBeCloseTo(686.3165460725, 9)
  })
})

describe('buildArbFlow — tx-ec1b6b (DivineManagerV2 WPLS cycle with voluntary HolyC burn)', () => {
  const fx = loadFixture(FIXTURE_TX_V2_WPLS_BURN)

  it('shows only the closed economic cycle while retaining the exact burn settlement', async () => {
    const { flow } = await buildArbFlow(
      {
        txHash: fx.hash,
        blockNumber: fx.blockNumber,
        timestamp: fx.timestamp,
        input: fx.input,
        logs: fx.logs,
        from: fx.from,
      },
      makeV2Ctx()
    )

    expect(flow.routeLabel).toBe('WPLS_CYCLE')
    expect(flow.legs.map((leg) => `${leg.tokenIn.symbol}->${leg.tokenOut.symbol}`)).toEqual([
      'WPLS->FUPA',
      'FUPA->JIT',
      'JIT->WPLS',
    ])
    expect(flow.legs.some((leg) => leg.tokenIn.symbol === 'HolyC' || leg.tokenOut.symbol === 'HolyC')).toBe(false)
    expect(flow.startAsset.symbol).toBe('WPLS')
    expect(flow.endAsset.symbol).toBe('WPLS')
    expect(flow.targetAsset.symbol).toBe('WPLS')
    expect(flow.burnedHolyC).toBe(7_087_245_257_950_625_000n)
    expect(flow.voluntaryHolyCBurn).toEqual({
      amount: 7_087_245_257_950_625_000n,
      fundedWith: expect.objectContaining({ symbol: 'WPLS' }),
    })
    expect(flow.gross).toEqual({ asset: flow.targetAsset, amount: 438_036_483_467_515_502_123n })
    expect(
      flow.sinks.some(
        (sink) => sink.kind === 'unknown' && sink.tokenIn.symbol === 'WPLS' && sink.amountIn === 5_673_396_631_438_990_000n
      )
    ).toBe(false)
  })

  it('keeps the purchase visible when the receipt does not exactly confirm the ticket burn', async () => {
    let changedBurn = false
    const logs = fx.logs.map((log) => {
      const isHolyCBurn =
        log.address.toLowerCase() === HOLY_C_ADDRESS.toLowerCase() &&
        log.topics[0]?.toLowerCase() === TRANSFER_TOPIC &&
        log.topics[2]?.toLowerCase().endsWith(BURN_ADDRESS.slice(2).toLowerCase())
      if (!isHolyCBurn) return log

      changedBurn = true
      return {
        ...log,
        data: `0x${(BigInt(log.data) + 1n).toString(16).padStart(64, '0')}`,
      }
    })
    expect(changedBurn).toBe(true)

    const { flow } = await buildArbFlow(
      {
        txHash: fx.hash,
        blockNumber: fx.blockNumber,
        timestamp: fx.timestamp,
        input: fx.input,
        logs,
        from: fx.from,
      },
      makeV2Ctx()
    )

    expect(flow.legs.map((leg) => `${leg.tokenIn.symbol}->${leg.tokenOut.symbol}`)).toEqual([
      'WPLS->HolyC',
      'WPLS->FUPA',
      'FUPA->JIT',
      'JIT->WPLS',
    ])
    expect(flow.voluntaryHolyCBurn).toBeNull()
  })

  it('keeps a real WPLS→HolyC leg when it connects into the economic cycle', () => {
    const { ticket } = decodeExecuteCalldata(fx.input)
    expect(ticket).not.toBeNull()
    if (!ticket) return

    const connectedRouteLeg = {
      ...ticket.legs[1],
      path: [HOLY_C_ADDRESS, WPLS_ADDRESS],
    }
    const connectedTicket = {
      ...ticket,
      legs: [ticket.legs[0], connectedRouteLeg],
    }
    const decodedPaths = new Map(
      connectedTicket.legs.map((leg) => [leg, decodeSwapPath(leg.path)] as const)
    )
    const { transfers } = parseReceiptLogs(fx.logs)

    expect(
      findVoluntaryHolyCBurnPurchase(
        connectedTicket,
        decodedPaths,
        transfers,
        DIVINE_MANAGER_ADDRESS.toLowerCase(),
        true
      )
    ).toBeNull()
  })
})

describe('buildArbFlow — graceful degradation', () => {
  it('renders a generic label and transfers-only spine when calldata is corrupt', async () => {
    const fx = loadFixture(FIXTURE_TX_1)
    const corruptInput = '0x09c5eabe' + '00'.repeat(200)
    const { flow } = await buildArbFlow(
      { txHash: fx.hash, blockNumber: fx.blockNumber, timestamp: fx.timestamp, input: corruptInput, logs: fx.logs, from: fx.from },
      makeCtx()
    )
    expect(flow.routeLabel).toMatch(/arb/)
    expect(flow.legs.length).toBeGreaterThan(0)
    expect(flow.decodeWarnings.length).toBeGreaterThan(0)
  })

  it('auto-detects the split destination when ctx.splitDestination is null', async () => {
    const fx = loadFixture(FIXTURE_TX_1)
    const { flow } = await buildArbFlow(
      { txHash: fx.hash, blockNumber: fx.blockNumber, timestamp: fx.timestamp, input: fx.input, logs: fx.logs, from: fx.from },
      makeCtx(null)
    )
    expect(flow.splitDestination?.toLowerCase()).toBe(EQUAL_SPLITTER.toLowerCase())
    const split = flow.sinks.find((s) => s.kind === 'split')
    expect(split).toBeDefined()
  })
})
