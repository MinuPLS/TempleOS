import { describe, it, expect } from 'vitest'
import { PoolResolver } from '../resolvePool'
import {
  HOLYC_JIT_PAIR_ADDRESS,
  UNISWAP_V2_FACTORY_ADDRESS,
} from '@/config/contracts'

const memStorage = () => {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

// A fake pool address not in the seed set.
const UNKNOWN_POOL = '0xdeadbeef00000000000000000000000000000001'
const UNKNOWN_TOKEN_A = '0xaaaa000000000000000000000000000000000001'
const UNKNOWN_TOKEN_B = '0xbbbb000000000000000000000000000000000002'

describe('PoolResolver — 3-tier discovery', () => {
  it('tier 1: returns seed pools instantly from cache', async () => {
    const resolver = new PoolResolver(
      { readContract: async () => { throw new Error('should not be called') } },
      memStorage()
    )
    const info = await resolver.resolve(HOLYC_JIT_PAIR_ADDRESS.toLowerCase())
    expect(info.isSeed).toBe(true)
    expect(info.verified).toBe(true)
    expect(info.label).toBe('HC/JIT')
    expect(info.token0.symbol).toBe('HolyC')
    expect(info.token1.symbol).toBe('JIT')
  })

  it('tier 2: infers a pool from a Swap log with Sync reserves (no on-chain call)', async () => {
    const resolver = new PoolResolver(
      { readContract: async () => { throw new Error('should not be called for swap-inferred') } },
      memStorage()
    )
    resolver.setInferredFromSwapLog(UNKNOWN_POOL, [1_000_000n, 2_000_000n])
    const info = await resolver.resolve(UNKNOWN_POOL)
    expect(info.verified).toBe(true)
    expect(info.reserves).toEqual([1_000_000n, 2_000_000n])
  })

  it('tier 3: verifies an unknown pool on-chain via token0/token1/getReserves + factory.getPair', async () => {
    const calls: { address: string; functionName: string; args?: unknown[] }[] = []
    const client = {
      readContract: async (args: { address: string; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] }) => {
        calls.push({ address: args.address, functionName: args.functionName, args: args.args ? [...args.args] : undefined })
        if (args.functionName === 'token0') return UNKNOWN_TOKEN_A
        if (args.functionName === 'token1') return UNKNOWN_TOKEN_B
        if (args.functionName === 'getReserves') return [500_000n, 600_000n, 0]
        if (args.functionName === 'getPair') return UNKNOWN_POOL
        throw new Error(`unexpected fn ${args.functionName}`)
      },
    }
    const resolver = new PoolResolver(client, memStorage())
    const info = await resolver.resolve(UNKNOWN_POOL)
    expect(info.verified).toBe(true)
    expect(info.token0.address.toLowerCase()).toBe(UNKNOWN_TOKEN_A)
    expect(info.token1.address.toLowerCase()).toBe(UNKNOWN_TOKEN_B)
    expect(info.reserves).toEqual([500_000n, 600_000n])
    // anti-spoof: getPair was called and matched
    const getPairCall = calls.find((c) => c.functionName === 'getPair')
    expect(getPairCall).toBeDefined()
    expect(getPairCall!.address.toLowerCase()).toBe(UNISWAP_V2_FACTORY_ADDRESS.toLowerCase())
  })

  it('marks a pool as unverified when factory.getPair does not match (anti-spoof)', async () => {
    const client = {
      readContract: async (args: { functionName: string }) => {
        if (args.functionName === 'token0') return UNKNOWN_TOKEN_A
        if (args.functionName === 'token1') return UNKNOWN_TOKEN_B
        if (args.functionName === 'getReserves') return [1n, 2n, 0]
        if (args.functionName === 'getPair') return '0x' + '0'.repeat(40)
        throw new Error('unexpected')
      },
    }
    const resolver = new PoolResolver(client, memStorage())
    const info = await resolver.resolve(UNKNOWN_POOL)
    expect(info.verified).toBe(false)
    expect(info.label).toMatch(/\//)
  })

  it('degrades gracefully to an unknown-pool label when all on-chain calls fail', async () => {
    const resolver = new PoolResolver(
      { readContract: async () => { throw new Error('rpc down') } },
      memStorage()
    )
    const info = await resolver.resolve(UNKNOWN_POOL)
    expect(info.verified).toBe(false)
    expect(info.token0.symbol).toBe('UNK')
  })

  it('persists verified pools to storage so they are resolved once', async () => {
    const storage = memStorage()
    let callCount = 0
    const client = {
      readContract: async (args: { functionName: string }) => {
        callCount += 1
        if (args.functionName === 'token0') return UNKNOWN_TOKEN_A
        if (args.functionName === 'token1') return UNKNOWN_TOKEN_B
        if (args.functionName === 'getReserves') return [1n, 2n, 0]
        if (args.functionName === 'getPair') return UNKNOWN_POOL
        throw new Error('unexpected')
      },
    }
    const r1 = new PoolResolver(client, storage)
    await r1.resolve(UNKNOWN_POOL)
    const firstCount = callCount
    // new resolver reusing the same storage should NOT re-call on-chain
    const r2 = new PoolResolver(client, storage)
    await r2.resolve(UNKNOWN_POOL)
    expect(callCount).toBe(firstCount)
  })
})
