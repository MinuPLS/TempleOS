import { describe, expect, it } from 'vitest'
import { HOLY_C_ADDRESS, JIT_ADDRESS, WPLS_ADDRESS } from '@/config/contracts'
import { buildSettlementSummary } from '../settlementSummary'
import type { AssetRef, FlowEdge, FlowEdgeKind } from '../types'

const holyc: AssetRef = { address: HOLY_C_ADDRESS, symbol: 'HolyC', decimals: 18 }
const jit: AssetRef = { address: JIT_ADDRESS, symbol: 'JIT', decimals: 18 }
const wpls: AssetRef = { address: WPLS_ADDRESS, symbol: 'WPLS', decimals: 18 }

const sink = (kind: FlowEdgeKind, asset: AssetRef, amount: bigint, id: string): FlowEdge => ({
  id,
  kind,
  order: 0,
  from: 'manager',
  to: 'destination',
  tokenIn: asset,
  amountIn: amount,
  tokenOut: asset,
  amountOut: amount,
})

describe('buildSettlementSummary', () => {
  it('shows only HolyC for matching 1:1 JIT-to-HolyC supply burns', () => {
    const summary = buildSettlementSummary([
      sink('burn', jit, 75_480n, 'jit-burn'),
      sink('burn', holyc, 75_480n, 'holyc-burn'),
    ])

    expect(summary.burned).toEqual([{ asset: holyc, amount: 75_480n }])
  })

  it('keeps distinct burn amounts visible', () => {
    const summary = buildSettlementSummary([
      sink('burn', jit, 75_480n, 'jit-burn'),
      sink('burn', holyc, 75_479n, 'holyc-burn'),
    ])

    expect(summary.burned).toEqual([
      { asset: jit, amount: 75_480n },
      { asset: holyc, amount: 75_479n },
    ])
  })

  it('groups all partner allocations by token instead of recipient', () => {
    const summary = buildSettlementSummary([
      sink('partner', jit, 10n, 'partner-one'),
      sink('partner', jit, 15n, 'partner-two'),
      sink('partner', wpls, 20n, 'partner-three'),
    ])

    expect(summary.partnerBuyBurn).toEqual([
      { asset: jit, amount: 25n },
      { asset: wpls, amount: 20n },
    ])
  })
})
