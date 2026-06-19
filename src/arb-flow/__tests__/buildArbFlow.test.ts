import { describe, it, expect } from 'vitest'
import { buildArbFlow, BuildContext } from '../buildArbFlow'
import { PoolResolver } from '../resolvePool'
import { TokenResolver } from '../resolveToken'
import { loadFixture, FIXTURE_TX_1, FIXTURE_TX_2 } from './fixtureLoader'
import { JIT_ADDRESS } from '@/config/contracts'

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
