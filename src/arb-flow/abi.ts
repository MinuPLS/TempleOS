import { parseAbiParameters, parseAbiItem } from 'viem'

export const EXECUTE_SELECTOR = '0x09c5eabe'

export const TICKET_ABI_PARAMETERS = parseAbiParameters(
  '(bytes32 strategyId, uint8 targetAsset, uint256 minProfitWPLS, uint256 deadline, uint256 basefeeCap, bytes32 policyHash, (uint8 key, address[] path, uint256 amountIn, uint256 amountOutMin)[] legs, (uint8 asset, uint256 minAmount) finalGuard, (uint256 blockNumberObserved, (address pair, uint256 reserve0, uint256 reserve1)[] pairs, uint16 reservesToleranceBps, bytes32 policyHash) binding, (uint256 owedHolyC, uint256 owedJIT) burn, bytes32 jobNonce)'
)

export const BYTES_ABI_PARAMETERS = parseAbiParameters('bytes')

export type LegKey = 0 | 1 | 2 | 3
export const LEG_COMPILE: LegKey = 0
export const LEG_RESTORE: LegKey = 1
export const LEG_SWAP_SUPPORTING_FOT: LegKey = 2
export const LEG_SWAP_EXACT: LegKey = 3

export type AssetKey = 0 | 1 | 2
export const ASSET_HC: AssetKey = 0
export const ASSET_JIT: AssetKey = 1
export const ASSET_WPLS: AssetKey = 2

export interface TicketLeg {
  key: LegKey
  path: readonly string[]
  amountIn: bigint
  amountOutMin: bigint
}

export interface FinalGuard {
  asset: AssetKey
  minAmount: bigint
}

export interface BindingPair {
  pair: string
  reserve0: bigint
  reserve1: bigint
}

export interface BindingData {
  blockNumberObserved: bigint
  pairs: readonly BindingPair[]
  reservesToleranceBps: number
  policyHash: string
}

export interface BurnInstruction {
  owedHolyC: bigint
  owedJIT: bigint
}

export interface ExecutionTicket {
  strategyId: string
  targetAsset: AssetKey
  minProfitWPLS: bigint
  deadline: bigint
  basefeeCap: bigint
  policyHash: string
  legs: readonly TicketLeg[]
  finalGuard: FinalGuard
  binding: BindingData
  burn: BurnInstruction
  jobNonce: string
}

export const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
export const SWAP_TOPIC =
  '0xd78ad95fa46c994b6551d0da85fc275fe613ce37657fb8d5e3d130840159d822'
export const SYNC_TOPIC =
  '0x1c411e9a96e071241c2f21f7726b17ae89e3cab4c78be50e062b03a9fffbbad1'

export const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)'
)
export const SWAP_EVENT = parseAbiItem(
  'event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)'
)
export const SYNC_EVENT = parseAbiItem(
  'event Sync(uint112 reserve0, uint112 reserve1)'
)

export const DIVINE_MANAGER_VIEW_ABI = [
  {
    type: 'function',
    name: 'splitDestination',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address', name: '' }],
  },
  {
    type: 'function',
    name: 'splitBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16', name: '' }],
  },
  {
    type: 'function',
    name: 'HOLYC',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address', name: '' }],
  },
  {
    type: 'function',
    name: 'JIT',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address', name: '' }],
  },
  {
    type: 'function',
    name: 'WPLS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address', name: '' }],
  },
] as const

export const TICKET_EXECUTED_TOPIC =
  '0xe7d506afd1181041bb8d9ff3ec2150070564e7c1423c11689e42ecd1cd2a2b86'
export const SPLIT_PAID_TOPIC =
  '0x0e77d5264d2c5d3f03b811f4ffb7d7fcea2d51a417187f518a0b968be6addf87'

export const LEG_KEY_LABEL: Record<LegKey, string> = {
  0: 'COMPILE',
  1: 'RESTORE',
  2: 'SWAP_SUPPORTING_FOT',
  3: 'SWAP_EXACT',
}

export const ASSET_KEY_LABEL: Record<AssetKey, string> = {
  0: 'HC',
  1: 'JIT',
  2: 'WPLS',
}
