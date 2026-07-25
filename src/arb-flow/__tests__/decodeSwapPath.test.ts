import { describe, expect, it } from 'vitest'
import { decodeSwapPath } from '../decodeSwapPath'
import { ZERO_ADDRESS } from '../types'

const address = (suffix: string) => `0x${suffix.padStart(40, '0')}`

describe('decodeSwapPath', () => {
  it('keeps ordinary token-only paths unchanged', () => {
    const tokens = [address('11'), address('22'), address('33')]
    expect(decodeSwapPath(tokens)).toEqual({ encoded: false, tokens, pairs: [] })
  })

  it('decodes exact mixed PulseX token and pair sequences', () => {
    const tokens = [address('11'), address('22'), address('33')]
    const pairs = [address('101'), address('102')]
    expect(decodeSwapPath([tokens[0], ZERO_ADDRESS, pairs[0], tokens[1], pairs[1], tokens[2]])).toEqual({
      encoded: true,
      tokens,
      pairs,
    })
  })

  it('rejects malformed mixed PulseX paths', () => {
    expect(() => decodeSwapPath([address('11'), ZERO_ADDRESS, address('101')])).toThrow('malformed mixed PulseX path')
    expect(() => decodeSwapPath([address('11'), ZERO_ADDRESS, ZERO_ADDRESS, address('22')])).toThrow(
      'mixed PulseX path contains a zero pair or token'
    )
  })
})
