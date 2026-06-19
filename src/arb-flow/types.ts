export type Address = string

export type AssetRef = {
  address: Address
  symbol: string
  decimals: number
}

export type FlowNodeKind = 'asset' | 'pool' | 'compiler' | 'burn' | 'split' | 'manager' | 'topoff'

export interface FlowNode {
  id: string
  kind: FlowNodeKind
  label: string
  address?: Address
  meta?: {
    reserves?: [bigint, bigint]
    pairTokens?: [AssetRef, AssetRef]
    verified?: boolean
    isSeed?: boolean
  }
}

export type FlowEdgeKind = 'compile' | 'restore' | 'swap' | 'burn' | 'split' | 'topoff'

export interface FlowEdge {
  id: string
  kind: FlowEdgeKind
  order: number
  from: string
  to: string
  poolId?: string
  tokenIn: AssetRef
  amountIn: bigint
  tokenOut: AssetRef
  amountOut: bigint
  feeOrTax?: bigint
  hopIndex?: number
}

export interface InventoryDelta {
  asset: AssetRef
  delta: bigint
}

export interface ArbFlow {
  txHash: string
  blockNumber: bigint
  timestamp: number
  routeLabel: string
  startAsset: AssetRef
  endAsset: AssetRef
  legs: FlowEdge[]
  sinks: FlowEdge[]
  inventoryDeltas: InventoryDelta[]
  gross: { asset: AssetRef; amount: bigint } | null
  burnedHolyC: bigint
  pools: FlowNode[]
  nodes: FlowNode[]
  profitWPLS: bigint
  splitDestination: Address | null
  targetAsset: AssetRef
  decodeWarnings: string[]
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
export const BURN_ADDRESS = '0x0000000000000000000000000000000000000369'

export const isBurnSink = (addr: string): boolean => {
  const l = addr.toLowerCase()
  return l === ZERO_ADDRESS || l === BURN_ADDRESS
}

export const toNodeId = (kind: FlowNodeKind, address: string): string =>
  `${kind}:${address.toLowerCase()}`
