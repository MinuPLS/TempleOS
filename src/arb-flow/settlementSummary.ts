import { HOLY_C_ADDRESS, JIT_ADDRESS } from '@/config/contracts'
import type { AssetRef, FlowEdge, FlowEdgeKind } from './types'

export type SettlementEntry = {
  asset: AssetRef
  amount: bigint
}

const aggregateSinks = (sinks: FlowEdge[], kind: FlowEdgeKind): SettlementEntry[] => {
  const byToken = new Map<string, SettlementEntry>()
  for (const sink of sinks) {
    if (sink.kind !== kind) continue
    const key = sink.tokenIn.address.toLowerCase()
    const entry = byToken.get(key)
    if (entry) entry.amount += sink.amountIn
    else byToken.set(key, { asset: sink.tokenIn, amount: sink.amountIn })
  }
  return Array.from(byToken.values()).filter((entry) => entry.amount > 0n)
}

export const buildSettlementSummary = (sinks: FlowEdge[]) => {
  const burned = aggregateSinks(sinks, 'burn')
  const holyCBurn = burned.find((entry) => entry.asset.address.toLowerCase() === HOLY_C_ADDRESS.toLowerCase())
  const jitBurn = burned.find((entry) => entry.asset.address.toLowerCase() === JIT_ADDRESS.toLowerCase())

  // A 1:1 JIT burn paired with an equal HolyC burn represents a free restore
  // followed by the HolyC supply burn. JIT and HolyC share the same economic
  // supply, so displaying both would double-count the removal.
  const visibleBurned =
    holyCBurn && jitBurn && holyCBurn.amount === jitBurn.amount
      ? burned.filter((entry) => entry.asset.address.toLowerCase() !== JIT_ADDRESS.toLowerCase())
      : burned

  return {
    burned: visibleBurned,
    buyBurn: aggregateSinks(sinks, 'split'),
    partnerBuyBurn: aggregateSinks(sinks, 'partner'),
  }
}
