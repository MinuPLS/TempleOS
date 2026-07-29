import { getAddress } from 'viem'
import {
  DIVINE_MANAGER_ADDRESS,
  JIT_ADDRESS,
  HOLY_C_ADDRESS,
  WPLS_ADDRESS,
} from '@/config/contracts'
import { decodeExecuteCalldata } from './decodeCalldata'
import { decodeSwapPath, type DecodedSwapPath } from './decodeSwapPath'
import { parseReceiptLogs, ParsedTransfer, ParsedLogs } from './parseLogs'
import { PoolResolver, poolInfoToNode, poolLabel, shortAddr } from './resolvePool'
import { TokenResolver } from './resolveToken'
import {
  ArbFlow,
  AssetRef,
  BURN_ADDRESS,
  FlowEdge,
  FlowNode,
  InventoryDelta,
  isBurnSink,
  toNodeId,
  ZERO_ADDRESS,
} from './types'
import {
  ASSET_HC,
  ASSET_JIT,
  ASSET_WPLS,
  ExecutionTicket,
  LEG_COMPILE,
  LEG_RESTORE,
  LEG_SWAP_EXACT,
  LEG_SWAP_SUPPORTING_FOT,
  TicketLeg,
} from './abi'
import { isDivineManagerV2, parseV2ProfitSettlement } from '@/lib/divineManagerV2'

export interface BuildInput {
  txHash: string
  blockNumber: bigint
  timestamp: number
  input: string
  logs: readonly {
    address: string
    topics: readonly string[]
    data: string
    logIndex: number
  }[]
  from?: string
}

export interface BuildContext {
  managerAddress?: string
  jitCompilerAddress?: string
  splitDestination?: string | null
  poolResolver: PoolResolver
  tokenResolver: TokenResolver
}

export interface BuildResult {
  flow: ArbFlow
  warnings: string[]
}

const MANAGER_DEFAULT = DIVINE_MANAGER_ADDRESS
const JIT_DEFAULT = JIT_ADDRESS

const assetRef = (address: string, symbol: string, decimals = 18): AssetRef => ({
  address: getAddress(address),
  symbol,
  decimals,
})

const HC_REF: AssetRef = assetRef(HOLY_C_ADDRESS, 'HolyC', 18)
const JIT_REF: AssetRef = assetRef(JIT_ADDRESS, 'JIT', 18)
const WPLS_REF: AssetRef = assetRef(WPLS_ADDRESS, 'WPLS', 18)

const assetByIndex = (idx: 0 | 1 | 2): AssetRef => {
  if (idx === ASSET_HC) return HC_REF
  if (idx === ASSET_JIT) return JIT_REF
  return WPLS_REF
}

const matchTransfer = (
  transfers: ParsedTransfer[],
  consumed: Set<number>,
  predicate: (t: ParsedTransfer, idx: number) => boolean
): { transfer: ParsedTransfer; index: number } | null => {
  for (let i = 0; i < transfers.length; i += 1) {
    if (consumed.has(i)) continue
    if (predicate(transfers[i], i)) {
      return { transfer: transfers[i], index: i }
    }
  }
  return null
}

const isSwapLeg = (leg: TicketLeg): boolean =>
  leg.key === LEG_SWAP_EXACT || leg.key === LEG_SWAP_SUPPORTING_FOT

const sameAddress = (left: string, right: string): boolean =>
  left.toLowerCase() === right.toLowerCase()

// The VPS compiler derives these two values through mathematically equivalent
// floating-point expressions before encoding them independently. That can leave
// a few wei of dust between the swap minimum and burn liability (500 wei in the
// first live WPLS example), so compare only within a deliberately tiny bound.
const matchesCompilerRounding = (left: bigint, right: bigint): boolean => {
  const difference = left >= right ? left - right : right - left
  const relativeTolerance = right / 1_000_000_000_000n
  const tolerance = relativeTolerance > 1_000n ? relativeTolerance : 1_000n
  return difference <= tolerance
}

export const findVoluntaryHolyCBurnPurchase = (
  ticket: ExecutionTicket | null,
  decodedSwapPaths: ReadonlyMap<TicketLeg, DecodedSwapPath>,
  transfers: readonly ParsedTransfer[],
  manager: string,
  isV2: boolean
): TicketLeg | null => {
  if (!isV2 || !ticket || ticket.targetAsset !== ASSET_WPLS || ticket.legs.length < 2) return null
  if (ticket.burn.owedHolyC <= 0n || ticket.burn.owedJIT !== 0n) return null

  const [candidate, ...routeLegs] = ticket.legs
  if (candidate.key !== LEG_SWAP_EXACT || candidate.path.length !== 2) return null

  const candidatePath = decodedSwapPaths.get(candidate)?.tokens
  if (
    !candidatePath ||
    candidatePath.length !== 2 ||
    !sameAddress(candidatePath[0], WPLS_ADDRESS) ||
    !sameAddress(candidatePath[1], HOLY_C_ADDRESS) ||
    !matchesCompilerRounding(candidate.amountOutMin, ticket.burn.owedHolyC)
  ) {
    return null
  }

  // The burn itself is the authoritative receipt-level link between the
  // otherwise disconnected purchase and the ticket's BurnInstruction.
  const settledExactly = transfers.some(
    (transfer) =>
      sameAddress(transfer.tokenAddress, HOLY_C_ADDRESS) &&
      sameAddress(transfer.from, manager) &&
      sameAddress(transfer.to, BURN_ADDRESS) &&
      transfer.value === ticket.burn.owedHolyC
  )
  if (!settledExactly) return null

  // After removing the sidecar purchase, the remaining ticket must still be a
  // connected WPLS→…→WPLS cycle. This preserves any future economic route that
  // genuinely uses a WPLS→HolyC leg as part of its own connected path.
  let expectedInput = WPLS_ADDRESS
  for (const leg of routeLegs) {
    if (!isSwapLeg(leg)) return null
    const path = decodedSwapPaths.get(leg)?.tokens
    if (!path || path.length < 2 || !sameAddress(path[0], expectedInput)) return null
    expectedInput = path[path.length - 1]
  }
  if (!sameAddress(expectedInput, WPLS_ADDRESS)) return null

  // If another ticket leg also looks linked to the same burn liability, the
  // evidence is ambiguous; retain the full flow rather than hiding a real swap.
  const matchingLegs = ticket.legs.filter((leg) => {
    if (leg.key !== LEG_SWAP_EXACT || leg.path.length !== 2) return false
    const path = decodedSwapPaths.get(leg)?.tokens
    return Boolean(
      path &&
        path.length === 2 &&
        sameAddress(path[0], WPLS_ADDRESS) &&
        sameAddress(path[1], HOLY_C_ADDRESS) &&
        matchesCompilerRounding(leg.amountOutMin, ticket.burn.owedHolyC)
    )
  })

  return matchingLegs.length === 1 && matchingLegs[0] === candidate ? candidate : null
}

const classifyRoute = (ticket: ExecutionTicket | null, legs: FlowEdge[]): string => {
  if (!ticket) {
    const target = legs.length > 0 ? legs[legs.length - 1].tokenOut.symbol : 'arb'
    return `${target} arb · ${legs.length} legs`
  }
  const target = assetByIndex(ticket.targetAsset).symbol
  const hasCompile = legs.some((l) => l.kind === 'compile')
  const hasRestore = legs.some((l) => l.kind === 'restore')
  const swaps = legs.filter((l) => l.kind === 'swap')
  const allSwap = !hasCompile && !hasRestore

  if (allSwap && ticket.targetAsset === ASSET_JIT) return 'JIT_CYCLE'
  if (allSwap && ticket.targetAsset === ASSET_WPLS) return 'WPLS_CYCLE'
  if (hasCompile && ticket.targetAsset === ASSET_HC) {
    const touchesWpls = swaps.some((s) => s.tokenIn.symbol === 'WPLS' || s.tokenOut.symbol === 'WPLS')
    return touchesWpls ? 'HC_WPLS' : 'HC_CORE'
  }
  if (hasRestore && ticket.targetAsset === ASSET_JIT) {
    const touchesWpls = swaps.some((s) => s.tokenIn.symbol === 'WPLS' || s.tokenOut.symbol === 'WPLS')
    return touchesWpls ? 'JIT_WPLS' : 'JIT_CORE'
  }
  if (hasCompile && ticket.targetAsset === ASSET_JIT) return 'JIT_CYCLE_COMPILE'
  return `${target} arb · ${legs.length} legs`
}

export const buildArbFlow = async (input: BuildInput, ctx: BuildContext): Promise<BuildResult> => {
  const manager = (ctx.managerAddress ?? MANAGER_DEFAULT).toLowerCase()
  const compiler = (ctx.jitCompilerAddress ?? JIT_DEFAULT).toLowerCase()
  const warnings: string[] = []

  const parsed: ParsedLogs = parseReceiptLogs(input.logs)
  const transfers = parsed.transfers
  const consumed = new Set<number>()
  const isV2 = isDivineManagerV2(manager)
  const v2Settlement = isV2 ? parseV2ProfitSettlement(input.logs, manager) : null
  if (v2Settlement?.warnings.length) warnings.push(...v2Settlement.warnings)

  const { ticket } = decodeExecuteCalldata(input.input)
  if (!ticket && input.input && input.input.slice(0, 10).toLowerCase() === '0x09c5eabe') {
    warnings.push('execute() calldata present but failed to decode ticket; reconstructing from transfers only')
  }

  // Pre-resolve all token addresses appearing in transfers (so we have AssetRefs for matching).
  const tokenAddresses = new Set<string>()
  for (const t of transfers) {
    tokenAddresses.add(t.tokenAddress.toLowerCase())
  }
  const decodedSwapPaths = new Map<TicketLeg, DecodedSwapPath>()
  if (ticket) {
    for (const leg of ticket.legs) {
      if (leg.key !== LEG_SWAP_EXACT && leg.key !== LEG_SWAP_SUPPORTING_FOT) continue
      try {
        const decodedPath = decodeSwapPath(leg.path)
        decodedSwapPaths.set(leg, decodedPath)
        for (const token of decodedPath.tokens) tokenAddresses.add(token.toLowerCase())
      } catch (error) {
        warnings.push(error instanceof Error ? `swap path decode failed: ${error.message}` : 'swap path decode failed')
      }
    }
  }
  const tokenMap = new Map<string, AssetRef>()
  for (const addr of tokenAddresses) {
    const ref = await ctx.tokenResolver.resolve(addr)
    tokenMap.set(addr, ref)
  }

  const voluntaryHolyCBurnPurchase = findVoluntaryHolyCBurnPurchase(
    ticket,
    decodedSwapPaths,
    transfers,
    manager,
    isV2
  )
  const voluntaryHolyCBurn =
    voluntaryHolyCBurnPurchase && ticket
      ? { amount: ticket.burn.owedHolyC, fundedWith: WPLS_REF }
      : null

  // Pre-discover pools from Swap logs (tier-2 inference) + resolve them.
  for (const swap of parsed.swaps) {
    const lowerAddr = swap.poolAddress.toLowerCase()
    const sync = parsed.syncs.find((s) => s.poolAddress.toLowerCase() === lowerAddr)
    const reserves = sync ? ([sync.reserve0, sync.reserve1] as [bigint, bigint]) : null
    ctx.poolResolver.setInferredFromSwapLog(lowerAddr, reserves)
  }

  // If ticket present, also seed binding.pairs as a hint (reserves snapshot).
  if (ticket) {
    for (const pair of ticket.binding.pairs) {
      const lowerAddr = pair.pair.toLowerCase()
      const existing = ctx.poolResolver.getCached(lowerAddr)
      if (existing && existing.isSeed) {
        existing.reserves = [pair.reserve0, pair.reserve1]
      }
    }
  }

  const nodes = new Map<string, FlowNode>()
  const pools = new Map<string, FlowNode>()
  const legs: FlowEdge[] = []
  const sinks: FlowEdge[] = []
  let order = 0

  const ensureAssetNode = (ref: AssetRef): string => {
    const id = toNodeId('asset', ref.address)
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        kind: 'asset',
        label: ref.symbol,
        address: ref.address,
      })
    }
    return id
  }

  const ensurePoolNode = async (lowerAddr: string): Promise<{ id: string; info: ReturnType<PoolResolver['getCached']> }> => {
    const info = await ctx.poolResolver.resolve(lowerAddr)
    const id = toNodeId('pool', info.address)
    if (!pools.has(id)) {
      pools.set(id, poolInfoToNode(info))
      nodes.set(id, pools.get(id)!)
    }
    return { id, info }
  }

  const ensureCompilerNode = (): string => {
    const addr = ctx.jitCompilerAddress ?? JIT_DEFAULT
    const id = toNodeId('compiler', addr)
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        kind: 'compiler',
        label: 'Compiler (peg)',
        address: addr,
      })
    }
    return id
  }

  const ensureBurnNode = (addr: string): string => {
    const id = toNodeId('burn', addr)
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        kind: 'burn',
        label: '🔥 Burn',
        address: addr,
      })
    }
    return id
  }

  const ensureSplitNode = (addr: string): string => {
    const id = toNodeId('split', addr)
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        kind: 'split',
        label: '💧 Split',
        address: addr,
      })
    }
    return id
  }

  const ensurePartnerNode = (addr: string, label: string): string => {
    const id = toNodeId('partner', addr)
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        kind: 'partner',
        label,
        address: addr,
      })
    }
    return id
  }

  const ensureManagerNode = (): string => {
    const addr = ctx.managerAddress ?? MANAGER_DEFAULT
    const id = toNodeId('manager', addr)
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        kind: 'manager',
        label: 'DivineManager',
        address: addr,
      })
    }
    return id
  }

  // ---- Leg reconstruction (ticket-guided) ----
  const buildCompileLeg = async (leg: TicketLeg): Promise<void> => {
    const inMatch = matchTransfer(
      transfers,
      consumed,
      (t) =>
        t.tokenAddress.toLowerCase() === HOLY_C_ADDRESS.toLowerCase() &&
        t.from.toLowerCase() === manager &&
        t.to.toLowerCase() === compiler
    )
    const outMatch = matchTransfer(
      transfers,
      consumed,
      (t) =>
        t.tokenAddress.toLowerCase() === JIT_ADDRESS.toLowerCase() &&
        t.from.toLowerCase() === ZERO_ADDRESS &&
        t.to.toLowerCase() === manager
    )

    const amountIn = inMatch?.transfer.value ?? leg.amountIn
    const amountOut = outMatch?.transfer.value ?? leg.amountIn
    if (inMatch) consumed.add(inMatch.index)
    if (outMatch) consumed.add(outMatch.index)
    if (!inMatch) warnings.push('compile leg: no matching HolyC→compiler transfer found')
    if (!outMatch) warnings.push('compile leg: no matching JIT mint transfer found')

    const fromId = ensureAssetNode(HC_REF)
    const toId = ensureAssetNode(JIT_REF)
    const compilerId = ensureCompilerNode()
    const fee = amountIn > amountOut ? amountIn - amountOut : 0n
    legs.push({
      id: `${input.txHash}-leg-${order}-compile`,
      kind: 'compile',
      order,
      from: fromId,
      to: toId,
      poolId: compilerId,
      tokenIn: HC_REF,
      amountIn,
      tokenOut: JIT_REF,
      amountOut,
      feeOrTax: fee,
    })
    order += 1
  }

  const buildRestoreLeg = async (leg: TicketLeg): Promise<void> => {
    const inMatch = matchTransfer(
      transfers,
      consumed,
      (t) =>
        t.tokenAddress.toLowerCase() === JIT_ADDRESS.toLowerCase() &&
        t.from.toLowerCase() === manager &&
        isBurnSink(t.to)
    )
    const outMatch = matchTransfer(
      transfers,
      consumed,
      (t) =>
        t.tokenAddress.toLowerCase() === HOLY_C_ADDRESS.toLowerCase() &&
        t.from.toLowerCase() === compiler &&
        t.to.toLowerCase() === manager
    )

    const amountIn = inMatch?.transfer.value ?? leg.amountIn
    const amountOut = outMatch?.transfer.value ?? leg.amountIn
    if (inMatch) consumed.add(inMatch.index)
    if (outMatch) consumed.add(outMatch.index)
    if (!inMatch) warnings.push('restore leg: no matching JIT burn transfer found')
    if (!outMatch) warnings.push('restore leg: no matching HolyC return transfer found')

    const fromId = ensureAssetNode(JIT_REF)
    const toId = ensureAssetNode(HC_REF)
    const compilerId = ensureCompilerNode()
    const fee = amountIn > amountOut ? amountIn - amountOut : 0n
    legs.push({
      id: `${input.txHash}-leg-${order}-restore`,
      kind: 'restore',
      order,
      from: fromId,
      to: toId,
      poolId: compilerId,
      tokenIn: JIT_REF,
      amountIn,
      tokenOut: HC_REF,
      amountOut,
      feeOrTax: fee,
    })
    order += 1
  }

  const findPoolForHop = async (
    tokenInAddr: string,
    tokenOutAddr: string
  ): Promise<string> => {
    const inLower = tokenInAddr.toLowerCase()
    const outLower = tokenOutAddr.toLowerCase()

    // 1. Scan Swap-emitting pools for one that received tokenIn and sent tokenOut.
    for (const swap of parsed.swaps) {
      const poolLower = swap.poolAddress.toLowerCase()
      const hasIn = transfers.some(
        (t, i) =>
          !consumed.has(i) &&
          t.tokenAddress.toLowerCase() === inLower &&
          t.to.toLowerCase() === poolLower
      )
      const hasOut = transfers.some(
        (t, i) =>
          !consumed.has(i) &&
          t.tokenAddress.toLowerCase() === outLower &&
          t.from.toLowerCase() === poolLower
      )
      if (hasIn && hasOut) return poolLower
    }

    // 2. Fall back to any transfer pair (pool may not have emitted a Swap we parsed).
    for (let i = 0; i < transfers.length; i += 1) {
      if (consumed.has(i)) continue
      const t = transfers[i]
      if (t.tokenAddress.toLowerCase() !== inLower) continue
      const poolLower = t.to.toLowerCase()
      if (poolLower === manager || isBurnSink(poolLower)) continue
      const hasOut = transfers.some(
        (tt, j) =>
          !consumed.has(j) &&
          tt.tokenAddress.toLowerCase() === outLower &&
          tt.from.toLowerCase() === poolLower
      )
      if (hasOut) return poolLower
    }

    // 3. Last resort: resolve via factory / on-chain (PoolResolver will try getPair indirectly).
    // Return the tokenIn-derived candidate — PoolResolver.resolve will verify on-chain.
    return inLower
  }

  const buildSwapLeg = async (leg: TicketLeg, visible = true): Promise<void> => {
    const decodedPath = decodedSwapPaths.get(leg)
    if (!decodedPath) return
    const path = decodedPath.tokens
    if (path.length < 2) {
      warnings.push(`swap leg with path.length=${path.length}, skipping`)
      return
    }

    for (let hop = 0; hop < path.length - 1; hop += 1) {
      const tokenInAddr = path[hop]
      const tokenOutAddr = path[hop + 1]
      const inLower = tokenInAddr.toLowerCase()
      const outLower = tokenOutAddr.toLowerCase()

      const tokenIn = tokenMap.get(inLower) ?? (await ctx.tokenResolver.resolve(inLower))
      const tokenOut = tokenMap.get(outLower) ?? (await ctx.tokenResolver.resolve(outLower))

      const poolLower = decodedPath.encoded
        ? decodedPath.pairs[hop].toLowerCase()
        : await findPoolForHop(tokenInAddr, tokenOutAddr)
      const poolInfo = await ctx.poolResolver.resolve(poolLower, {
        token0: tokenIn,
        token1: tokenOut,
      })
      const poolId = toNodeId('pool', poolInfo.address)

      // amountIn: transfer of tokenIn to the pool (from manager or prev pool)
      const inMatch = matchTransfer(
        transfers,
        consumed,
        (t) =>
          t.tokenAddress.toLowerCase() === inLower &&
          t.to.toLowerCase() === poolInfo.address.toLowerCase()
      )
      // amountOut: transfer of tokenOut from the pool (to manager or next pool)
      const outMatch = matchTransfer(
        transfers,
        consumed,
        (t) =>
          t.tokenAddress.toLowerCase() === outLower &&
          t.from.toLowerCase() === poolInfo.address.toLowerCase()
      )

      const amountIn = inMatch?.transfer.value ?? leg.amountIn
      const amountOut = outMatch?.transfer.value ?? leg.amountOutMin
      if (inMatch) consumed.add(inMatch.index)
      // For mid-hops, the out transfer is the next hop's in — don't consume it here
      // so the next hop can match it as its `to`. We only consume the final hop's out.
      if (outMatch && hop === path.length - 2) consumed.add(outMatch.index)

      // Settlement-only swaps still have to consume their receipt transfers;
      // otherwise they reappear later as unknown sinks. They are simply omitted
      // from the economic route spine.
      if (!visible) continue

      if (!pools.has(poolId)) {
        const node = poolInfoToNode(poolInfo)
        pools.set(poolId, node)
        nodes.set(poolId, node)
      }

      const fromId = ensureAssetNode(tokenIn)
      const toId = ensureAssetNode(tokenOut)

      legs.push({
        id: `${input.txHash}-leg-${order}-swap-h${hop}`,
        kind: 'swap',
        order,
        from: fromId,
        to: toId,
        poolId,
        tokenIn,
        amountIn,
        tokenOut,
        amountOut,
        hopIndex: hop,
      })
      order += 1
    }
  }

  if (ticket) {
    for (const leg of ticket.legs) {
      if (leg.key === LEG_COMPILE) {
        await buildCompileLeg(leg)
      } else if (leg.key === LEG_RESTORE) {
        await buildRestoreLeg(leg)
      } else if (leg.key === LEG_SWAP_EXACT || leg.key === LEG_SWAP_SUPPORTING_FOT) {
        await buildSwapLeg(leg, leg !== voluntaryHolyCBurnPurchase)
      }
    }
  } else {
    // ---- Transfer-only fallback (no ticket) ----
    await buildLegsFromTransfers(transfers, consumed, manager, compiler, ctx, {
      ensureAssetNode,
      ensurePoolNode,
      ensureCompilerNode,
      legs,
      sinks,
      orderRef: { value: order },
      txHash: input.txHash,
      parsed,
      warnings,
    })
    order = legs.length + sinks.length
  }

  // ---- Sinks: remaining unconsumed transfers ----
  const splitDest = isV2
    ? null
    : ctx.splitDestination
      ? ctx.splitDestination.toLowerCase()
      : detectSplitDestination(transfers, manager, consumed)

  if (v2Settlement) {
    for (const allocation of v2Settlement.allocations) {
      const sourceToken = assetByIndex(allocation.sourceAsset)
      const paidToken = assetByIndex(allocation.paidAsset)
      const recipientLower = allocation.recipient.toLowerCase()
      const transferMatch = matchTransfer(
        transfers,
        consumed,
        (transfer) =>
          transfer.tokenAddress.toLowerCase() === paidToken.address.toLowerCase() &&
          transfer.from.toLowerCase() === manager &&
          transfer.to.toLowerCase() === recipientLower &&
          transfer.value === allocation.paidAmount
      )
      if (transferMatch) consumed.add(transferMatch.index)
      else warnings.push(`ProfitPaid transfer to ${allocation.recipientLabel} was not found in receipt transfers`)

      sinks.push({
        id: `${input.txHash}-sink-${order}-partner`,
        kind: 'partner',
        order,
        from: ensureManagerNode(),
        to: ensurePartnerNode(allocation.recipient, allocation.recipientLabel),
        tokenIn: sourceToken,
        amountIn: allocation.sourceAmount,
        tokenOut: paidToken,
        amountOut: allocation.paidAmount,
        recipientLabel: allocation.recipientLabel,
        recipientBps: allocation.bps,
      })
      order += 1
    }
  }

  for (let i = 0; i < transfers.length; i += 1) {
    if (consumed.has(i)) continue
    const t = transfers[i]
    if (t.from.toLowerCase() !== manager) {
      // token arriving at manager after legs complete (e.g. a swap out we missed)
      continue
    }
    const toLower = t.to.toLowerCase()

    if (isBurnSink(toLower)) {
      const token = tokenMap.get(t.tokenAddress.toLowerCase()) ?? {
        address: t.tokenAddress,
        symbol: 'UNK',
        decimals: 18,
      }
      const burnId = ensureBurnNode(t.to)
      sinks.push({
        id: `${input.txHash}-sink-${order}-burn`,
        kind: 'burn',
        order,
        from: ensureManagerNode(),
        to: burnId,
        tokenIn: token,
        amountIn: t.value,
        tokenOut: token,
        amountOut: t.value,
      })
      order += 1
      consumed.add(i)
      continue
    }

    if (splitDest && toLower === splitDest) {
      const token = tokenMap.get(t.tokenAddress.toLowerCase()) ?? {
        address: t.tokenAddress,
        symbol: 'UNK',
        decimals: 18,
      }
      const splitId = ensureSplitNode(t.to)
      sinks.push({
        id: `${input.txHash}-sink-${order}-split`,
        kind: 'split',
        order,
        from: ensureManagerNode(),
        to: splitId,
        tokenIn: token,
        amountIn: t.value,
        tokenOut: token,
        amountOut: t.value,
      })
      order += 1
      consumed.add(i)
      continue
    }

    // Gas top-off: manager → tx.from (bot EOA)
    if (input.from && toLower === input.from.toLowerCase()) {
      const token = tokenMap.get(t.tokenAddress.toLowerCase()) ?? {
        address: t.tokenAddress,
        symbol: 'PLS',
        decimals: 18,
      }
      const topoffId = `topoff:${t.to.toLowerCase()}`
      if (!nodes.has(topoffId)) {
        nodes.set(topoffId, {
          id: topoffId,
          kind: 'topoff',
          label: 'Gas top-off',
          address: t.to,
        })
      }
      sinks.push({
        id: `${input.txHash}-sink-${order}-topoff`,
        kind: 'topoff',
        order,
        from: ensureManagerNode(),
        to: topoffId,
        tokenIn: token,
        amountIn: t.value,
        tokenOut: token,
        amountOut: t.value,
      })
      order += 1
      consumed.add(i)
      continue
    }

    // Unrecognized manager→X transfer: render as a generic sink, never drop.
    warnings.push(`unrecognized manager→${shortAddr(t.to)} transfer of ${t.value} ${tokenMap.get(t.tokenAddress.toLowerCase())?.symbol ?? 'UNK'}`)
    const token = tokenMap.get(t.tokenAddress.toLowerCase()) ?? {
      address: t.tokenAddress,
      symbol: 'UNK',
      decimals: 18,
    }
    const sinkKind = isV2 ? 'unknown' : 'split'
    const sinkId = toNodeId(sinkKind, t.to)
    if (!nodes.has(sinkId)) {
      nodes.set(sinkId, {
        id: sinkId,
        kind: sinkKind,
        label: `Sink ${shortAddr(t.to)}`,
        address: t.to,
      })
    }
    sinks.push({
      id: `${input.txHash}-sink-${order}-unknown`,
      kind: sinkKind,
      order,
      from: ensureManagerNode(),
      to: sinkId,
      tokenIn: token,
      amountIn: t.value,
      tokenOut: token,
      amountOut: t.value,
    })
    order += 1
    consumed.add(i)
  }

  // ---- Inventory deltas: all tokens whose manager balance moved ----
  const deltaMap = new Map<string, { asset: AssetRef; in: bigint; out: bigint }>()
  for (const t of transfers) {
    const tokenAddrLower = t.tokenAddress.toLowerCase()
    const asset = tokenMap.get(tokenAddrLower) ?? {
      address: t.tokenAddress,
      symbol: 'UNK',
      decimals: 18,
    }
    if (!deltaMap.has(tokenAddrLower)) {
      deltaMap.set(tokenAddrLower, { asset, in: 0n, out: 0n })
    }
    const entry = deltaMap.get(tokenAddrLower)!
    if (t.to.toLowerCase() === manager) entry.in += t.value
    if (t.from.toLowerCase() === manager) entry.out += t.value
  }
  const inventoryDeltas: InventoryDelta[] = []
  for (const [, entry] of deltaMap) {
    const delta = entry.in - entry.out
    if (delta !== 0n) {
      inventoryDeltas.push({ asset: entry.asset, delta })
    }
  }

  // ---- Burned HolyC (settlement burns) ----
  let burnedHolyC = 0n
  for (const sink of sinks) {
    if (sink.kind === 'burn' && sink.tokenIn.address.toLowerCase() === HOLY_C_ADDRESS.toLowerCase()) {
      burnedHolyC += sink.amountIn
    }
  }
  // Also count JIT burned to burn sinks
  // (kept separate; burnedHolyC is the headline 🔥 HC number)

  // ---- Start / end assets ----
  const targetAsset = ticket ? assetByIndex(ticket.targetAsset) : legs[0]?.tokenIn ?? HC_REF
  const startAsset = legs[0]?.tokenIn ?? targetAsset
  const endAsset = legs.length > 0 ? legs[legs.length - 1].tokenOut : targetAsset

  // ---- Gross: the realized end-asset gain before sinks ----
  let gross: { asset: AssetRef; amount: bigint } | null = null
  if (legs.length > 0) {
    const firstIn = legs[0].amountIn
    const lastOut = legs[legs.length - 1].amountOut
    if (startAsset.address.toLowerCase() === endAsset.address.toLowerCase()) {
      const amount = lastOut > firstIn ? lastOut - firstIn : 0n
      gross = { asset: endAsset, amount }
    } else {
      gross = { asset: endAsset, amount: lastOut }
    }
  }
  if (v2Settlement && v2Settlement.asset !== null && v2Settlement.status !== 'missing') {
    gross = { asset: assetByIndex(v2Settlement.asset), amount: v2Settlement.grossProfit }
  }

  ensureManagerNode()

  const routeLabel = classifyRoute(ticket, legs)

  const flow: ArbFlow = {
    txHash: input.txHash,
    blockNumber: input.blockNumber,
    timestamp: input.timestamp,
    routeLabel,
    startAsset,
    endAsset,
    legs,
    sinks,
    inventoryDeltas,
    gross,
    burnedHolyC,
    voluntaryHolyCBurn,
    pools: Array.from(pools.values()),
    nodes: Array.from(nodes.values()),
    profitWPLS: ticket?.minProfitWPLS ?? 0n,
    splitDestination: splitDest ? getAddress(splitDest) : null,
    targetAsset,
    decodeWarnings: warnings,
    v2Settlement,
  }

  return { flow, warnings }
}

const detectSplitDestination = (
  transfers: ParsedTransfer[],
  manager: string,
  consumed: Set<number>
): string | null => {
  // Heuristic: an address (not burn, not pool, not manager) that receives from manager
  // and is not a known pool. Prefer the SplitPaid event destination if available,
  // else the most common non-burn recipient.
  const candidates = new Map<string, bigint>()
  for (let i = 0; i < transfers.length; i += 1) {
    if (consumed.has(i)) continue
    const t = transfers[i]
    if (t.from.toLowerCase() !== manager) continue
    const toLower = t.to.toLowerCase()
    if (isBurnSink(toLower)) continue
    if (toLower === manager) continue
    candidates.set(toLower, (candidates.get(toLower) ?? 0n) + t.value)
  }
  if (candidates.size === 0) return null
  // Pick the candidate with the most transfers (or largest value).
  let best: string | null = null
  let bestValue = 0n
  for (const [addr, value] of candidates) {
    if (value > bestValue) {
      best = addr
      bestValue = value
    }
  }
  return best
}

// ---- Transfer-only fallback (no ticket) ----
interface FallbackCtx {
  ensureAssetNode: (ref: AssetRef) => string
  ensurePoolNode: (lowerAddr: string) => Promise<{ id: string; info: ReturnType<PoolResolver['getCached']> }>
  ensureCompilerNode: () => string
  legs: FlowEdge[]
  sinks: FlowEdge[]
  orderRef: { value: number }
  txHash: string
  parsed: ParsedLogs
  warnings: string[]
}

const buildLegsFromTransfers = async (
  transfers: ParsedTransfer[],
  consumed: Set<number>,
  manager: string,
  compiler: string,
  ctx: BuildContext,
  f: FallbackCtx
): Promise<void> => {
  // Walk transfers in logIndex order, grouping compile/restore/swap patterns.
  for (let i = 0; i < transfers.length; i += 1) {
    if (consumed.has(i)) continue
    const t = transfers[i]

    // COMPILE: M→compiler (HolyC) + Z→M (JIT)
    if (
      t.tokenAddress.toLowerCase() === HOLY_C_ADDRESS.toLowerCase() &&
      t.from.toLowerCase() === manager &&
      t.to.toLowerCase() === compiler
    ) {
      const outMatch = matchTransfer(
        transfers,
        consumed,
        (tt) =>
          tt.tokenAddress.toLowerCase() === JIT_ADDRESS.toLowerCase() &&
          tt.from.toLowerCase() === ZERO_ADDRESS &&
          tt.to.toLowerCase() === manager
      )
      const amountIn = t.value
      const amountOut = outMatch?.transfer.value ?? t.value
      consumed.add(i)
      if (outMatch) consumed.add(outMatch.index)
      const fromId = f.ensureAssetNode(HC_REF)
      const toId = f.ensureAssetNode(JIT_REF)
      const compilerId = f.ensureCompilerNode()
      f.legs.push({
        id: `${f.txHash}-leg-${f.orderRef.value}-compile`,
        kind: 'compile',
        order: f.orderRef.value,
        from: fromId,
        to: toId,
        poolId: compilerId,
        tokenIn: HC_REF,
        amountIn,
        tokenOut: JIT_REF,
        amountOut,
        feeOrTax: amountIn > amountOut ? amountIn - amountOut : 0n,
      })
      f.orderRef.value += 1
      continue
    }

    // RESTORE: M→Z (JIT) + compiler→M (HolyC)
    if (
      t.tokenAddress.toLowerCase() === JIT_ADDRESS.toLowerCase() &&
      t.from.toLowerCase() === manager &&
      isBurnSink(t.to)
    ) {
      const outMatch = matchTransfer(
        transfers,
        consumed,
        (tt) =>
          tt.tokenAddress.toLowerCase() === HOLY_C_ADDRESS.toLowerCase() &&
          tt.from.toLowerCase() === compiler &&
          tt.to.toLowerCase() === manager
      )
      const amountIn = t.value
      const amountOut = outMatch?.transfer.value ?? t.value
      consumed.add(i)
      if (outMatch) consumed.add(outMatch.index)
      const fromId = f.ensureAssetNode(JIT_REF)
      const toId = f.ensureAssetNode(HC_REF)
      const compilerId = f.ensureCompilerNode()
      f.legs.push({
        id: `${f.txHash}-leg-${f.orderRef.value}-restore`,
        kind: 'restore',
        order: f.orderRef.value,
        from: fromId,
        to: toId,
        poolId: compilerId,
        tokenIn: JIT_REF,
        amountIn,
        tokenOut: HC_REF,
        amountOut,
        feeOrTax: amountIn > amountOut ? amountIn - amountOut : 0n,
      })
      f.orderRef.value += 1
      continue
    }

    // SWAP: M→P (tokenIn) + P→M (tokenOut), P emits Swap
    if (t.from.toLowerCase() === manager && !isBurnSink(t.to) && t.to.toLowerCase() !== manager) {
      const poolLower = t.to.toLowerCase()
      const isPool = f.parsed.swapPoolAddresses.has(poolLower)
      if (isPool) {
        const outMatch = matchTransfer(
          transfers,
          consumed,
          (tt) =>
            tt.from.toLowerCase() === poolLower &&
            tt.to.toLowerCase() === manager &&
            tt.tokenAddress.toLowerCase() !== t.tokenAddress.toLowerCase()
        )
        if (outMatch) {
          const tokenIn = await ctx.tokenResolver.resolve(t.tokenAddress.toLowerCase())
          const tokenOut = await ctx.tokenResolver.resolve(outMatch.transfer.tokenAddress.toLowerCase())
          const poolInfo = await ctx.poolResolver.resolve(poolLower, { token0: tokenIn, token1: tokenOut })
          const poolId = toNodeId('pool', poolInfo.address)
          const fromId = f.ensureAssetNode(tokenIn)
          const toId = f.ensureAssetNode(tokenOut)
          f.legs.push({
            id: `${f.txHash}-leg-${f.orderRef.value}-swap`,
            kind: 'swap',
            order: f.orderRef.value,
            from: fromId,
            to: toId,
            poolId,
            tokenIn,
            amountIn: t.value,
            tokenOut,
            amountOut: outMatch.transfer.value,
          })
          f.orderRef.value += 1
          consumed.add(i)
          consumed.add(outMatch.index)
          continue
        }
      }
    }
    // Unrecognized transfer at this stage: leave for sink detection.
  }
}

export { poolLabel }
