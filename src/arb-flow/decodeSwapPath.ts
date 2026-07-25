import { getAddress } from 'viem'
import { ZERO_ADDRESS } from './types'

export interface DecodedSwapPath {
  encoded: boolean
  tokens: string[]
  pairs: string[]
}

export const isMixedPulseXEncodedPath = (path: readonly string[]) =>
  path.length >= 2 && path[1]?.toLowerCase() === ZERO_ADDRESS

export const decodeSwapPath = (path: readonly string[]): DecodedSwapPath => {
  const normalized = path.map((value) => getAddress(value))
  if (!isMixedPulseXEncodedPath(normalized)) {
    if (normalized.length < 2) throw new Error('swap path is shorter than two tokens')
    return { encoded: false, tokens: normalized, pairs: [] }
  }

  if (normalized.length < 4 || normalized.length % 2 !== 0) {
    throw new Error('malformed mixed PulseX path')
  }

  const tokens = [normalized[0]]
  const pairs: string[] = []
  for (let index = 2; index < normalized.length; index += 2) {
    const pair = normalized[index]
    const tokenOut = normalized[index + 1]
    if (pair.toLowerCase() === ZERO_ADDRESS || tokenOut.toLowerCase() === ZERO_ADDRESS) {
      throw new Error('mixed PulseX path contains a zero pair or token')
    }
    pairs.push(pair)
    tokens.push(tokenOut)
  }

  return { encoded: true, tokens, pairs }
}
