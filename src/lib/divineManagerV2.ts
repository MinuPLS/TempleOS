import { decodeEventLog, getAddress } from 'viem'
import {
  BRIAH_BUY_AND_BURN_ADDRESS,
  COINMAFIA_BUY_AND_BURN_ADDRESS,
  DIVINE_MANAGER_ADDRESS,
  DIVINE_MANAGER_V2_EVENTS_ABI,
  DUMB_BUY_AND_BURN_ADDRESS,
  FUPA_BUY_AND_BURN_ADDRESS,
} from '@/config/contracts'

export type DivineManagerAssetKey = 0 | 1 | 2
export type DivineManagerAssetSymbol = 'HOLYC' | 'JIT' | 'WPLS'
export type V2SettlementStatus = 'complete' | 'mismatch' | 'missing'

export interface V2ProfitAllocation {
  recipient: `0x${string}`
  recipientLabel: string
  sourceAsset: DivineManagerAssetKey
  paidAsset: DivineManagerAssetKey
  sourceAmount: bigint
  paidAmount: bigint
  bps: number
}

export interface V2ProfitSettlement {
  status: V2SettlementStatus
  jobNonce: `0x${string}` | null
  asset: DivineManagerAssetKey | null
  grossProfit: bigint
  protectedProfit: bigint
  shareableProfit: bigint
  totalAllocated: bigint
  retainedProfit: bigint
  allocations: V2ProfitAllocation[]
  warnings: string[]
}

type ReceiptLog = {
  address: string
  topics: readonly string[]
  data: string
}

const PARTNER_LABELS = new Map<string, string>([
  [BRIAH_BUY_AND_BURN_ADDRESS.toLowerCase(), 'Briah'],
  [COINMAFIA_BUY_AND_BURN_ADDRESS.toLowerCase(), 'CoinMafia'],
  [DUMB_BUY_AND_BURN_ADDRESS.toLowerCase(), 'Dumb'],
  [FUPA_BUY_AND_BURN_ADDRESS.toLowerCase(), 'FUPA'],
])

const isAssetKey = (value: number): value is DivineManagerAssetKey => value === 0 || value === 1 || value === 2

export const getDivineManagerAssetSymbol = (asset: DivineManagerAssetKey): DivineManagerAssetSymbol =>
  asset === 0 ? 'HOLYC' : asset === 1 ? 'JIT' : 'WPLS'

export const getProfitRecipientLabel = (recipient: string) =>
  PARTNER_LABELS.get(recipient.toLowerCase()) ?? `${recipient.slice(0, 6)}…${recipient.slice(-4)}`

export const isDivineManagerV2 = (address: string) =>
  address.toLowerCase() === DIVINE_MANAGER_ADDRESS.toLowerCase()

export const parseV2ProfitSettlement = (
  logs: readonly ReceiptLog[],
  managerAddress: string
): V2ProfitSettlement => {
  const allocations: V2ProfitAllocation[] = []
  const warnings: string[] = []
  let settled: Omit<V2ProfitSettlement, 'status' | 'retainedProfit' | 'allocations' | 'warnings'> | null = null

  for (const log of logs) {
    if (log.address.toLowerCase() !== managerAddress.toLowerCase()) continue

    try {
      const decoded = decodeEventLog({
        abi: DIVINE_MANAGER_V2_EVENTS_ABI,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        strict: true,
      })

      if (decoded.eventName === 'ProfitSettled') {
        const args = decoded.args
        const asset = Number(args.asset)
        if (!isAssetKey(asset)) {
          warnings.push(`ProfitSettled emitted unsupported asset ${asset}`)
          continue
        }
        settled = {
          jobNonce: args.jobNonce,
          asset,
          grossProfit: args.grossProfit,
          protectedProfit: args.protectedProfit,
          shareableProfit: args.shareableProfit,
          totalAllocated: args.totalAllocated,
        }
      } else if (decoded.eventName === 'ProfitPaid') {
        const args = decoded.args
        const sourceAsset = Number(args.sourceAsset)
        const paidAsset = Number(args.paidAsset)
        if (!isAssetKey(sourceAsset) || !isAssetKey(paidAsset)) {
          warnings.push(`ProfitPaid emitted unsupported asset pair ${sourceAsset}/${paidAsset}`)
          continue
        }
        allocations.push({
          recipient: getAddress(args.recipient),
          recipientLabel: getProfitRecipientLabel(args.recipient),
          sourceAsset,
          paidAsset,
          sourceAmount: args.sourceAmount,
          paidAmount: args.paidAmount,
          bps: Number(args.bps),
        })
      }
    } catch {
      // Receipt contains many unrelated manager events. Ignore non-matching topics.
    }
  }

  if (!settled) {
    return {
      status: 'missing',
      jobNonce: null,
      asset: null,
      grossProfit: 0n,
      protectedProfit: 0n,
      shareableProfit: 0n,
      totalAllocated: 0n,
      retainedProfit: 0n,
      allocations,
      warnings: ['ProfitSettled event was not found; V2 settlement totals are unavailable'],
    }
  }

  const allocatedFromEvents = allocations.reduce((total, allocation) => total + allocation.sourceAmount, 0n)
  if (allocatedFromEvents !== settled.totalAllocated) {
    warnings.push(
      `ProfitPaid total ${allocatedFromEvents} does not match ProfitSettled totalAllocated ${settled.totalAllocated}`
    )
  }
  if (allocations.some((allocation) => allocation.sourceAsset !== settled.asset)) {
    warnings.push('ProfitPaid source asset does not match ProfitSettled asset')
  }
  if (settled.totalAllocated > settled.grossProfit) {
    warnings.push('ProfitSettled totalAllocated exceeds grossProfit')
  }

  return {
    ...settled,
    status: warnings.length > 0 ? 'mismatch' : 'complete',
    retainedProfit: settled.grossProfit > settled.totalAllocated ? settled.grossProfit - settled.totalAllocated : 0n,
    allocations,
    warnings,
  }
}
