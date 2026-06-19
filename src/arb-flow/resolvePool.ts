import { getAddress } from 'viem'
import {
  HOLYC_JIT_PAIR_ADDRESS,
  HOLYC_WPLS_PAIR_ADDRESS,
  JIT_WPLS_PAIR_ADDRESS,
  WPLS_DAI_PAIR_ADDRESS,
  HOLY_C_ADDRESS,
  JIT_ADDRESS,
  WPLS_ADDRESS,
  DAI_ADDRESS,
  UNISWAP_V2_FACTORY_ADDRESS,
  UNISWAP_V2_PAIR_ABI,
  UNISWAP_V2_FACTORY_ABI,
} from '@/config/contracts'
import type { AssetRef, FlowNode } from './types'

export interface PoolInfo {
  address: string
  token0: AssetRef
  token1: AssetRef
  reserves: [bigint, bigint]
  verified: boolean
  isSeed: boolean
  label: string
}

export interface ResolveClient {
  readContract: (args: {
    address: string
    abi: readonly unknown[]
    functionName: string
    args?: readonly unknown[]
  }) => Promise<unknown>
}

export interface ResolveStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

const POOL_CACHE_KEY = 'arbflow.pool.v1'

interface SeedEntry {
  address: string
  tokens: [string, string]
  label: string
}

const SEED_POOLS: SeedEntry[] = [
  {
    address: HOLYC_JIT_PAIR_ADDRESS,
    tokens: [HOLY_C_ADDRESS, JIT_ADDRESS],
    label: 'HC/JIT',
  },
  {
    address: HOLYC_WPLS_PAIR_ADDRESS,
    tokens: [HOLY_C_ADDRESS, WPLS_ADDRESS],
    label: 'HC/WPLS',
  },
  {
    address: JIT_WPLS_PAIR_ADDRESS,
    tokens: [JIT_ADDRESS, WPLS_ADDRESS],
    label: 'JIT/WPLS',
  },
  {
    address: WPLS_DAI_PAIR_ADDRESS,
    tokens: [WPLS_ADDRESS, DAI_ADDRESS],
    label: 'WPLS/DAI',
  },
]

const SEED_BY_LOWER: Map<string, PoolInfo> = new Map()

const makeSeedPool = (entry: SeedEntry): PoolInfo => {
  const t0: AssetRef = {
    address: entry.tokens[0],
    symbol: symbolForSeed(entry.tokens[0]),
    decimals: 18,
  }
  const t1: AssetRef = {
    address: entry.tokens[1],
    symbol: symbolForSeed(entry.tokens[1]),
    decimals: 18,
  }
  return {
    address: getAddress(entry.address),
    token0: t0,
    token1: t1,
    reserves: [0n, 0n],
    verified: true,
    isSeed: true,
    label: entry.label,
  }
}

const symbolForSeed = (addr: string): string => {
  const l = addr.toLowerCase()
  if (l === HOLY_C_ADDRESS.toLowerCase()) return 'HolyC'
  if (l === JIT_ADDRESS.toLowerCase()) return 'JIT'
  if (l === WPLS_ADDRESS.toLowerCase()) return 'WPLS'
  if (l === DAI_ADDRESS.toLowerCase()) return 'DAI'
  return 'UNK'
}

for (const entry of SEED_POOLS) {
  const info = makeSeedPool(entry)
  SEED_BY_LOWER.set(entry.address.toLowerCase(), info)
}

const safeStorage = (): ResolveStorage => {
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage) return window.localStorage
    } catch {
      // fall through to memory storage
    }
  }
  const mem = new Map<string, string>()
  return {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => void mem.set(k, v),
  }
}

interface PoolCacheState {
  [lowerAddress: string]: {
    address: string
    token0: AssetRef
    token1: AssetRef
    reserves: [string, string]
    verified: boolean
    isSeed: boolean
    label: string
  }
}

export class PoolResolver {
  private cache: Map<string, PoolInfo> = new Map(SEED_BY_LOWER)
  private storage: ResolveStorage
  private inflight: Map<string, Promise<PoolInfo>> = new Map()
  private client: ResolveClient
  private factoryAddress: string

  constructor(client: ResolveClient, storage?: ResolveStorage, factoryAddress?: string) {
    this.client = client
    this.storage = storage ?? safeStorage()
    this.factoryAddress = factoryAddress ?? UNISWAP_V2_FACTORY_ADDRESS
    this.hydrate()
  }

  private hydrate(): void {
    try {
      const raw = this.storage.getItem(POOL_CACHE_KEY)
      if (!raw) return
      const state = JSON.parse(raw) as PoolCacheState
      for (const [lowerAddr, entry] of Object.entries(state)) {
        if (this.cache.has(lowerAddr)) continue
        this.cache.set(lowerAddr, {
          address: entry.address,
          token0: entry.token0,
          token1: entry.token1,
          reserves: [BigInt(entry.reserves[0]), BigInt(entry.reserves[1])],
          verified: entry.verified,
          isSeed: false,
          label: entry.label,
        })
      }
    } catch {
      // ignore corrupt cache
    }
  }

  private persist(): void {
    try {
      const state: PoolCacheState = {}
      for (const [lowerAddr, info] of this.cache.entries()) {
        if (info.isSeed && !info.reserves.some((r) => r > 0n)) continue
        state[lowerAddr] = {
          address: info.address,
          token0: info.token0,
          token1: info.token1,
          reserves: [info.reserves[0].toString(), info.reserves[1].toString()],
          verified: info.verified,
          isSeed: info.isSeed,
          label: info.label,
        }
      }
      this.storage.setItem(POOL_CACHE_KEY, JSON.stringify(state))
    } catch {
      // storage full / disabled — non-fatal
    }
  }

  getCached(lowerAddr: string): PoolInfo | undefined {
    return this.cache.get(lowerAddr)
  }

  setInferredFromSwapLog(
    lowerAddr: string,
    reserves: [bigint, bigint] | null,
    token0?: AssetRef,
    token1?: AssetRef
  ): PoolInfo {
    const existing = this.cache.get(lowerAddr)
    const resolvedReserves = reserves ?? existing?.reserves ?? [0n, 0n]
    if (existing) {
      if (reserves) {
        existing.reserves = resolvedReserves
      }
      if (token0 && token1 && existing.token0.symbol.startsWith('UNK')) {
        existing.token0 = token0
        existing.token1 = token1
        existing.label = poolLabel(token0, token1)
      }
      this.persist()
      return existing
    }
    const t0 = token0 ?? { address: '', symbol: 'UNK', decimals: 18 }
    const t1 = token1 ?? { address: '', symbol: 'UNK', decimals: 18 }
    const label = poolLabel(t0, t1)
    const info: PoolInfo = {
      address: getAddress(lowerAddr),
      token0: t0,
      token1: t1,
      reserves: resolvedReserves,
      verified: true,
      isSeed: false,
      label,
    }
    this.cache.set(lowerAddr, info)
    this.persist()
    return info
  }

  async resolve(
    lowerAddr: string,
    opts?: { syncReserves?: [bigint, bigint]; token0?: AssetRef; token1?: AssetRef }
  ): Promise<PoolInfo> {
    const existing = this.cache.get(lowerAddr)
    if (existing) {
      let changed = false
      if (opts?.syncReserves) {
        existing.reserves = opts.syncReserves
        changed = true
      }
      // Upgrade placeholder UNK tokens/label once real token info is known
      // (e.g. resolved from a leg's path). Pools discovered from Swap logs are
      // pre-cached with UNK tokens; without this they render as "???/???".
      if (opts?.token0 && existing.token0.symbol.startsWith('UNK') && !opts.token0.symbol.startsWith('UNK')) {
        existing.token0 = opts.token0
        changed = true
      }
      if (opts?.token1 && existing.token1.symbol.startsWith('UNK') && !opts.token1.symbol.startsWith('UNK')) {
        existing.token1 = opts.token1
        changed = true
      }
      if (changed) {
        existing.label = poolLabel(existing.token0, existing.token1)
        this.persist()
      }
      return existing
    }

    const inflight = this.inflight.get(lowerAddr)
    if (inflight) return inflight

    const promise = this.verifyOnChain(lowerAddr, opts).catch((): PoolInfo => {
      const t0 = opts?.token0 ?? { address: '', symbol: 'UNK', decimals: 18 }
      const t1 = opts?.token1 ?? { address: '', symbol: 'UNK', decimals: 18 }
      const fallback: PoolInfo = {
        address: getAddress(lowerAddr),
        token0: t0,
        token1: t1,
        reserves: opts?.syncReserves ?? [0n, 0n],
        verified: false,
        isSeed: false,
        label: poolLabel(t0, t1),
      }
      this.cache.set(lowerAddr, fallback)
      this.persist()
      return fallback
    })

    this.inflight.set(lowerAddr, promise)
    try {
      const info = await promise
      this.cache.set(lowerAddr, info)
      this.persist()
      return info
    } finally {
      this.inflight.delete(lowerAddr)
    }
  }

  private async verifyOnChain(
    lowerAddr: string,
    opts?: { syncReserves?: [bigint, bigint]; token0?: AssetRef; token1?: AssetRef }
  ): Promise<PoolInfo> {
    const address = getAddress(lowerAddr)
    const token0Addr = (await this.client.readContract({
      address,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'token0',
    })) as string
    const token1Addr = (await this.client.readContract({
      address,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'token1',
    })) as string

    const t0 = opts?.token0 ?? { address: getAddress(token0Addr), symbol: 'UNK', decimals: 18 }
    const t1 = opts?.token1 ?? { address: getAddress(token1Addr), symbol: 'UNK', decimals: 18 }
    if (t0.symbol === 'UNK') t0.address = getAddress(token0Addr)
    if (t1.symbol === 'UNK') t1.address = getAddress(token1Addr)

    const reservesResult = (await this.client.readContract({
      address,
      abi: UNISWAP_V2_PAIR_ABI,
      functionName: 'getReserves',
    })) as [bigint, bigint, number]
    const reserves: [bigint, bigint] = [reservesResult[0], reservesResult[1]]

    let verified = true
    try {
      const factoryPair = (await this.client.readContract({
        address: this.factoryAddress,
        abi: UNISWAP_V2_FACTORY_ABI,
        functionName: 'getPair',
        args: [token0Addr, token1Addr],
      })) as string
      verified = factoryPair.toLowerCase() === lowerAddr
    } catch {
      verified = true
    }

    const label = poolLabel(t0, t1)
    return {
      address,
      token0: t0,
      token1: t1,
      reserves,
      verified,
      isSeed: false,
      label,
    }
  }
}

export const poolLabel = (t0: AssetRef, t1: AssetRef): string => {
  const s0 = t0.symbol && !t0.symbol.startsWith('UNK') ? t0.symbol : shortAddr(t0.address)
  const s1 = t1.symbol && !t1.symbol.startsWith('UNK') ? t1.symbol : shortAddr(t1.address)
  return `${s0}/${s1}`
}

export const shortAddr = (addr: string): string => {
  if (!addr) return '???'
  const clean = addr.toLowerCase().replace(/^0x/, '')
  if (clean.length < 8) return addr
  return `0x${clean.slice(0, 4)}…${clean.slice(-4)}`
}

export const poolInfoToNode = (info: PoolInfo): FlowNode => ({
  id: `pool:${info.address.toLowerCase()}`,
  kind: 'pool',
  label: `${info.label} pool`,
  address: info.address,
  meta: {
    reserves: info.reserves,
    pairTokens: [info.token0, info.token1],
    verified: info.verified,
    isSeed: info.isSeed,
  },
})

export { SEED_POOLS }
