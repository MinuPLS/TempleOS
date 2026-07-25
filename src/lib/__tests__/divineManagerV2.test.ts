import { describe, expect, it } from 'vitest'
import { DIVINE_MANAGER_ADDRESS } from '@/config/contracts'
import { FIXTURE_TX_V2, loadFixture } from '@/arb-flow/__tests__/fixtureLoader'
import { parseV2ProfitSettlement } from '../divineManagerV2'

describe('parseV2ProfitSettlement', () => {
  const fixture = loadFixture(FIXTURE_TX_V2)

  it('decodes retained profit and all four authoritative allocations', () => {
    const settlement = parseV2ProfitSettlement(fixture.logs, DIVINE_MANAGER_ADDRESS)
    expect(settlement.status).toBe('complete')
    expect(settlement.grossProfit).toBe(686316546072520411459n)
    expect(settlement.totalAllocated).toBe(41763837598616655726n)
    expect(settlement.retainedProfit).toBe(644552708473903755733n)
    expect(settlement.allocations.map((allocation) => allocation.recipientLabel)).toEqual([
      'Briah',
      'CoinMafia',
      'Dumb',
      'FUPA',
    ])
  })

  it('fails safe when ProfitSettled is absent', () => {
    const settlement = parseV2ProfitSettlement([], DIVINE_MANAGER_ADDRESS)
    expect(settlement.status).toBe('missing')
    expect(settlement.retainedProfit).toBe(0n)
    expect(settlement.warnings[0]).toContain('ProfitSettled event was not found')
  })

  it('reports a reconciliation mismatch instead of inferring the missing allocation', () => {
    const settlement = parseV2ProfitSettlement(
      fixture.logs.filter((log) => log.logIndex !== 902),
      DIVINE_MANAGER_ADDRESS
    )
    expect(settlement.status).toBe('mismatch')
    expect(settlement.allocations).toHaveLength(3)
    expect(settlement.warnings[0]).toContain('does not match ProfitSettled totalAllocated')
  })
})
