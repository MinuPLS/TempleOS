import HolyCLogo from '../assets/TokenLogos/HolyC.png'
import JITLogo from '../assets/TokenLogos/JIT.png'
import WplsLogo from '../assets/TokenLogos/wpls.png'
import PulseXLogo from '../assets/TokenLogos/PulseX.png'
import CompilerLogo from '../assets/TokenLogos/Compilerv0.png'
import CoinMafiaLogo from '../assets/TokenLogos/CoinMafiaLogo.png'
import BriahLogo from '../assets/TokenLogos/Briah.png'
import DumbLogo from '../assets/TokenLogos/Dumb.png'
import FupaLogo from '../assets/TokenLogos/FUPA.jpg'
import PdaiLogo from '../assets/TokenLogos/pDAI.jpg'
import {
  BRIAH_TOKEN_ADDRESS,
  COINMAFIA_TOKEN_ADDRESS,
  DUMB_TOKEN_ADDRESS,
  FUPA_TOKEN_ADDRESS,
  HOLY_C_ADDRESS,
  JIT_ADDRESS,
  PDAI_ADDRESS,
  WPLS_ADDRESS,
} from '@/config/contracts'

const LOCAL_LOGOS: Record<string, string> = {
  [HOLY_C_ADDRESS.toLowerCase()]: HolyCLogo,
  [JIT_ADDRESS.toLowerCase()]: JITLogo,
  [WPLS_ADDRESS.toLowerCase()]: WplsLogo,
  [COINMAFIA_TOKEN_ADDRESS.toLowerCase()]: CoinMafiaLogo,
  [BRIAH_TOKEN_ADDRESS.toLowerCase()]: BriahLogo,
  [DUMB_TOKEN_ADDRESS.toLowerCase()]: DumbLogo,
  [FUPA_TOKEN_ADDRESS.toLowerCase()]: FupaLogo,
  [PDAI_ADDRESS.toLowerCase()]: PdaiLogo,
}

const LOCAL_LOGO_BY_SYMBOL_LOWER: Record<string, string> = {
  holyc: HolyCLogo,
  hc: HolyCLogo,
  jit: JITLogo,
  wpls: WplsLogo,
  pulsex: PulseXLogo,
  pxv2: PulseXLogo,
  mafia: CoinMafiaLogo,
  coinmafia: CoinMafiaLogo,
  briah: BriahLogo,
  dumb: DumbLogo,
  fupa: FupaLogo,
}

export const COMPILER_LOGO = CompilerLogo
export const PULSEX_LOGO = PulseXLogo

const DEXSCREENER_CACHE_KEY = 'arbflow.dexlogo.v1'

interface DexLogoCache {
  [symbolLower: string]: { url: string; ts: number }
}

const readDexCache = (): DexLogoCache => {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(DEXSCREENER_CACHE_KEY)
    return raw ? (JSON.parse(raw) as DexLogoCache) : {}
  } catch {
    return {}
  }
}

const writeDexCache = (cache: DexLogoCache): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DEXSCREENER_CACHE_KEY, JSON.stringify(cache))
  } catch {
    // non-fatal
  }
}

const TOKEN_COLOR: Record<string, string> = {
  holyc: '#3b82f6',
  hc: '#3b82f6',
  jit: '#f59e0b',
  wpls: '#a78bfa',
  dai: '#fbbf24',
  weth: '#94a3b8',
  usdc: '#38bdf8',
  usdt: '#22c55e',
}

const colorForSymbol = (symbol: string): string => {
  const key = symbol.toLowerCase()
  if (TOKEN_COLOR[key]) return TOKEN_COLOR[key]
  let hash = 0
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash << 5) - hash + symbol.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 55%)`
}

const buildInitialsDataUrl = (symbol: string): string => {
  const initials = symbol.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3) || '?'
  const color = colorForSymbol(symbol)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80"><circle cx="40" cy="40" r="38" fill="${color}"/><text x="40" y="40" font-family="system-ui,sans-serif" font-size="${initials.length > 2 ? 22 : 30}" font-weight="700" fill="white" text-anchor="middle" dominant-baseline="central">${initials}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export interface TokenLogoResult {
  src: string
  isInitials: boolean
}

export const resolveTokenLogo = (asset: { address: string; symbol: string }): TokenLogoResult => {
  const lowerAddr = asset.address.toLowerCase()
  const local = LOCAL_LOGOS[lowerAddr]
  if (local) return { src: local, isInitials: false }

  const symKey = asset.symbol.toLowerCase()
  const bySymbol = LOCAL_LOGO_BY_SYMBOL_LOWER[symKey]
  if (bySymbol) return { src: bySymbol, isInitials: false }

  const dexCache = readDexCache()
  const cached = dexCache[symKey]
  if (cached?.url) return { src: cached.url, isInitials: false }

  return { src: buildInitialsDataUrl(asset.symbol), isInitials: true }
}

export const fetchDexscreenerLogo = async (
  symbol: string,
  chainId = 369
): Promise<string | null> => {
  if (!symbol || symbol.startsWith('0x')) return null
  const symKey = symbol.toLowerCase()
  const dexCache = readDexCache()
  const cached = dexCache[symKey]
  if (cached?.url) return cached.url

  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(symbol)}`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      pairs?: Array<{
        chainId?: string
        baseToken?: { symbol?: string }
        info?: { imageUrl?: string }
      }>
    }
    const pairs = data.pairs ?? []
    const match = pairs.find((p) => p.chainId === String(chainId) && p.baseToken?.symbol?.toLowerCase() === symKey)
    const logo = match?.info?.imageUrl ?? null
    if (logo) {
      dexCache[symKey] = { url: logo, ts: Date.now() }
      writeDexCache(dexCache)
    }
    return logo
  } catch {
    return null
  }
}

export { buildInitialsDataUrl, colorForSymbol }
