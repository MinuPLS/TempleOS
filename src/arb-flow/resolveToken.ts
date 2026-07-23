import { getAddress } from 'viem'
import { DAI_ADDRESS, ERC20_ABI, HOLY_C_ADDRESS, JIT_ADDRESS, PDAI_ADDRESS, WPLS_ADDRESS } from '@/config/contracts'
import type { AssetRef } from './types'
import { shortAddr } from './resolvePool'
import type { ResolveClient, ResolveStorage } from './resolvePool'

const TOKEN_CACHE_KEY = 'arbflow.token.v1'

interface TokenCacheEntry {
  address: string
  symbol: string
  decimals: number
}

const SEED_TOKENS: Record<string, AssetRef> = {
  [HOLY_C_ADDRESS.toLowerCase()]: {
    address: HOLY_C_ADDRESS,
    symbol: 'HolyC',
    decimals: 18,
  },
  [JIT_ADDRESS.toLowerCase()]: {
    address: JIT_ADDRESS,
    symbol: 'JIT',
    decimals: 18,
  },
  [WPLS_ADDRESS.toLowerCase()]: {
    address: WPLS_ADDRESS,
    symbol: 'WPLS',
    decimals: 18,
  },
  [DAI_ADDRESS.toLowerCase()]: {
    address: DAI_ADDRESS,
    symbol: 'DAI',
    decimals: 18,
  },
  [PDAI_ADDRESS.toLowerCase()]: {
    address: PDAI_ADDRESS,
    symbol: 'DAI',
    decimals: 18,
  },
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

const unknownToken = (address: string): AssetRef => ({
  address,
  symbol: shortAddr(address),
  decimals: 18,
})

export class TokenResolver {
  private cache: Map<string, AssetRef> = new Map(
    Object.entries(SEED_TOKENS).map(([l, ref]) => [l, ref] as const)
  )
  private storage: ResolveStorage
  private inflight: Map<string, Promise<AssetRef>> = new Map()
  private client: ResolveClient

  constructor(client: ResolveClient, storage?: ResolveStorage) {
    this.client = client
    this.storage = storage ?? safeStorage()
    this.hydrate()
  }

  private hydrate(): void {
    try {
      const raw = this.storage.getItem(TOKEN_CACHE_KEY)
      if (!raw) return
      const state = JSON.parse(raw) as Record<string, TokenCacheEntry>
      for (const [lowerAddr, entry] of Object.entries(state)) {
        if (this.cache.has(lowerAddr)) continue
        this.cache.set(lowerAddr, {
          address: entry.address,
          symbol: entry.symbol,
          decimals: entry.decimals,
        })
      }
    } catch {
      // ignore corrupt cache
    }
  }

  private persist(): void {
    try {
      const state: Record<string, TokenCacheEntry> = {}
      for (const [lowerAddr, ref] of this.cache.entries()) {
        if (SEED_TOKENS[lowerAddr]) continue
        state[lowerAddr] = {
          address: ref.address,
          symbol: ref.symbol,
          decimals: ref.decimals,
        }
      }
      this.storage.setItem(TOKEN_CACHE_KEY, JSON.stringify(state))
    } catch {
      // storage full / disabled — non-fatal
    }
  }

  getCached(lowerAddr: string): AssetRef | undefined {
    return this.cache.get(lowerAddr)
  }

  async resolve(lowerAddr: string): Promise<AssetRef> {
    const existing = this.cache.get(lowerAddr)
    if (existing) return existing

    const inflight = this.inflight.get(lowerAddr)
    if (inflight) return inflight

    const promise = this.verifyOnChain(lowerAddr).catch(() => {
      const fallback = unknownToken(getAddress(lowerAddr))
      this.cache.set(lowerAddr, fallback)
      this.persist()
      return fallback
    })

    this.inflight.set(lowerAddr, promise)
    try {
      const ref = await promise
      this.cache.set(lowerAddr, ref)
      this.persist()
      return ref
    } finally {
      this.inflight.delete(lowerAddr)
    }
  }

  private async verifyOnChain(lowerAddr: string): Promise<AssetRef> {
    const address = getAddress(lowerAddr)
    const symbol = (await this.client.readContract({
      address,
      abi: ERC20_ABI,
      functionName: 'symbol',
    })) as string
    let decimals = 18
    try {
      const dec = (await this.client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      })) as number
      decimals = typeof dec === 'number' ? dec : Number(dec)
    } catch {
      decimals = 18
    }
    const cleanSymbol = typeof symbol === 'string' && symbol.length > 0 ? symbol : shortAddr(address)
    return { address, symbol: cleanSymbol, decimals }
  }
}

export const isKnownSeedToken = (lowerAddr: string): boolean =>
  Boolean(SEED_TOKENS[lowerAddr])
