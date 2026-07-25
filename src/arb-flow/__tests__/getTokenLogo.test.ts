import { describe, expect, it } from 'vitest'
import { LEGACY_DAI_ADDRESS } from '@/config/contracts'
import { resolveTokenLogo } from '../getTokenLogo'

describe('resolveTokenLogo', () => {
  it('always uses the bundled DAI logo for the legacy DAI token', () => {
    const logo = resolveTokenLogo({ address: LEGACY_DAI_ADDRESS, symbol: 'DAI' })

    expect(logo.isInitials).toBe(false)
    expect(logo.src).toContain('pDAI')
  })
})
