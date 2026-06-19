import { describe, it, expect } from 'vitest'
import { decodeExecuteCalldata } from '../decodeCalldata'
import { ASSET_HC, LEG_COMPILE, LEG_SWAP_SUPPORTING_FOT } from '../abi'
import { loadFixture, FIXTURE_TX_1, FIXTURE_TX_2 } from './fixtureLoader'

describe('decodeExecuteCalldata', () => {
  it('decodes tx-34a495 as an HC_CORE ticket (compile + swap)', () => {
    const fx = loadFixture(FIXTURE_TX_1)
    const { ticket, isExecuteCall, warning } = decodeExecuteCalldata(fx.input)

    expect(isExecuteCall).toBe(true)
    expect(warning).toBeUndefined()
    expect(ticket).not.toBeNull()
    if (!ticket) return

    expect(ticket.targetAsset).toBe(ASSET_HC)
    expect(ticket.legs).toHaveLength(2)

    const leg0 = ticket.legs[0]
    expect(leg0.key).toBe(LEG_COMPILE)
    expect(leg0.path).toHaveLength(0)
    expect(leg0.amountIn).toBe(102_292_352_244_028_840_000_000n)

    const leg1 = ticket.legs[1]
    expect(leg1.key).toBe(LEG_SWAP_SUPPORTING_FOT)
    expect(leg1.path).toHaveLength(2)
    expect(leg1.path[0].toLowerCase()).toBe('0x57909025ace10d5de114d96e3ec84f282895870c')
    expect(leg1.path[1].toLowerCase()).toBe('0x6c8fdfd2cec0b83d69045074d57a87fa1525225a')

    expect(ticket.burn.owedHolyC).toBe(4_091_694_089_761_153_500_000n)
    expect(ticket.burn.owedJIT).toBe(0n)

    expect(ticket.finalGuard.asset).toBe(ASSET_HC)
    expect(Number(ticket.finalGuard.minAmount) / 1e18).toBeCloseTo(1_930.63, 0)
    expect(ticket.binding.pairs).toHaveLength(3)
  })

  it('decodes tx-d1336c as the same HC_CORE shape', () => {
    const fx = loadFixture(FIXTURE_TX_2)
    const { ticket, isExecuteCall } = decodeExecuteCalldata(fx.input)

    expect(isExecuteCall).toBe(true)
    expect(ticket).not.toBeNull()
    if (!ticket) return

    expect(ticket.targetAsset).toBe(ASSET_HC)
    expect(ticket.legs).toHaveLength(2)
    expect(ticket.legs[0].key).toBe(LEG_COMPILE)
    expect(ticket.legs[1].key).toBe(LEG_SWAP_SUPPORTING_FOT)
    expect(ticket.legs[1].path).toHaveLength(2)
  })

  it('returns isExecuteCall=false for non-execute selectors', () => {
    const { isExecuteCall, ticket } = decodeExecuteCalldata('0x12345678' + '0'.repeat(64))
    expect(isExecuteCall).toBe(false)
    expect(ticket).toBeNull()
  })

  it('returns isExecuteCall=false for empty input', () => {
    const { isExecuteCall, ticket } = decodeExecuteCalldata('0x')
    expect(isExecuteCall).toBe(false)
    expect(ticket).toBeNull()
  })
})
