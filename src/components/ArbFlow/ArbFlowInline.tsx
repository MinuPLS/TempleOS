import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { formatUnits } from 'viem'
import { ChevronLeft, ChevronRight, Droplet, Flame, Workflow, ExternalLink } from 'lucide-react'
import type { ArbFlow, AssetRef, FlowEdge, FlowEdgeKind, FlowNode } from '@/arb-flow/types'
import { PULSEX_LOGO, colorForSymbol, resolveTokenLogo } from '@/arb-flow/getTokenLogo'
import { useArbFlow } from '@/arb-flow/useArbFlow'
import { TokenLogo } from './TokenLogo'
import styles from './ArbFlow.module.css'

const EXPLORER = 'https://otter.pulsechain.com'

// Horizontal spacing between stations. Short arbs (≈2-step) keep the full BASE
// spacing, unchanged. Longer arbs compress toward the floor so the whole row
// still fits the card (no scrolling) while the logos stay as large as possible —
// trading horizontal gap for node size, exactly the "sacrifice distance to make
// them bigger" idea. The floor is kept just wide enough that the step verb
// ("compile"/"restore"/"swap") still fits on the line between two nodes, even
// beside the dashed start/end ring, so it never hides behind a token.
const BASE_STATION_W = 150
const MIN_STATION_W = 120
const TARGET_INNER_W = BASE_STATION_W * 4

const stationSpacing = (positionedCount: number): number =>
  Math.min(BASE_STATION_W, Math.max(MIN_STATION_W, TARGET_INNER_W / Math.max(1, positionedCount - 1)))
const SPINE_Y = 72
const NODE_R = 30
const PAD_X = 58

const shortHex = (value: string, size = 5) =>
  value ? `${value.slice(0, size + 2)}…${value.slice(-size)}` : ''

const tokenColor = (symbol: string): string => {
  const key = symbol.toLowerCase()
  if (key === 'holyc' || key === 'hc') return '#3b82f6'
  if (key === 'jit') return '#f59e0b'
  if (key === 'wpls') return '#a78bfa'
  return colorForSymbol(symbol)
}

const fmtAmt = (value: bigint, decimals = 18): string => {
  const n = Number(formatUnits(value, decimals))
  if (!Number.isFinite(n)) return '0'
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(2)}K`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

interface Pt {
  x: number
  y: number
}

interface StationView {
  key: string
  node: FlowNode
  x: number
  y: number
  isStart?: boolean
  isEnd?: boolean
  isSink?: boolean
}

interface StepView {
  id: string
  kind: FlowEdgeKind
  points: Pt[]
  colors: string[]
  fromKey: string
  toKey: string
  poolKey?: string
  verb: string
  title: string
  detail: string
  amountLabel: string
  feeLabel?: string
}

const legVerb = (kind: FlowEdgeKind): string => {
  if (kind === 'compile') return 'compile'
  if (kind === 'restore') return 'restore'
  return 'swap'
}

const poolShortLabel = (node: FlowNode): string => node.label.replace(/\s*pool$/i, '')

const buildLayout = (flow: ArbFlow) => {
  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]))
  const getNode = (id: string, fallback: FlowNode): FlowNode => nodeById.get(id) ?? fallback

  const stations: StationView[] = []
  const steps: StepView[] = []
  let xCursor = PAD_X

  // Count the stations we will actually position (mirrors the pushStation calls
  // below: the start node, plus each leg's optional pool node and its output
  // node) so the spacing can be sized before any node is placed.
  const positionedCount =
    flow.legs.length > 0 ? 1 + flow.legs.reduce((n, leg) => n + (leg.poolId ? 2 : 1), 0) : 1
  const stationW = stationSpacing(positionedCount)

  const pushStation = (node: FlowNode, opts?: { isStart?: boolean; isEnd?: boolean; isSink?: boolean }): StationView => {
    const station: StationView = { key: `st-${stations.length}`, node, x: xCursor, y: SPINE_Y, ...opts }
    if (!opts?.isSink) xCursor += stationW
    stations.push(station)
    return station
  }

  const pt = (s: StationView): Pt => ({ x: s.x, y: s.y })

  const legs = flow.legs

  // Attribute the *realized* on-chain settlement burn (the deferred compile/restore
  // peg fee, paid in HolyC to 0x…369) back to the compile/restore leg(s) it came from.
  // The manager is fee-exempt, so the peg is 1:1 in-flight and the fee surfaces only at
  // settlement — we re-home it here. Split proportional to each leg's input with the
  // remainder on the last leg so the parts sum to the actual burn exactly (no made-up
  // rate; the % is derived from the real burned amount). Non-exempt in-flight fees
  // (feeOrTax) are added on top. Routes with no compile/restore leg keep the burn only
  // in the settlement summary — nothing is fabricated.
  const feeByLeg = new Map<string, bigint>()
  const pegLegs = legs.filter((l) => l.kind === 'compile' || l.kind === 'restore')
  const pegInputTotal = pegLegs.reduce((sum, l) => sum + l.amountIn, 0n)
  let allocatedBurn = 0n
  pegLegs.forEach((l, i) => {
    const deferred =
      i === pegLegs.length - 1
        ? flow.burnedHolyC - allocatedBurn
        : pegInputTotal > 0n
          ? (flow.burnedHolyC * l.amountIn) / pegInputTotal
          : 0n
    allocatedBurn += deferred
    const fee = deferred + (l.feeOrTax ?? 0n)
    if (fee > 0n) feeByLeg.set(l.id, fee)
  })

  if (legs.length > 0) {
    const firstFrom = getNode(legs[0].from, {
      id: legs[0].from,
      kind: 'asset',
      label: legs[0].tokenIn.symbol,
      address: legs[0].tokenIn.address,
    })
    let prevStation = pushStation(firstFrom, { isStart: true })

    legs.forEach((leg: FlowEdge, li) => {
      const fromStation = prevStation
      let poolStation: StationView | undefined
      if (leg.poolId) {
        const rawPool = getNode(leg.poolId, { id: leg.poolId, kind: 'pool', label: 'pool' })
        // Guarantee a readable pool label: if the pool couldn't be resolved,
        // fall back to the leg's known tokens instead of "???/???".
        const known = `${leg.tokenIn.symbol}/${leg.tokenOut.symbol}`
        const display = rawPool.label && !rawPool.label.includes('?') ? poolShortLabel(rawPool) : known
        poolStation = pushStation({ ...rawPool, label: `${display} pool` })
      }
      const toNode = getNode(leg.to, {
        id: leg.to,
        kind: 'asset',
        label: leg.tokenOut.symbol,
        address: leg.tokenOut.address,
      })
      const toStation = pushStation(toNode, { isEnd: li === legs.length - 1 })

      const inColor = tokenColor(leg.tokenIn.symbol)
      const outColor = tokenColor(leg.tokenOut.symbol)
      const points = poolStation ? [pt(fromStation), pt(poolStation), pt(toStation)] : [pt(fromStation), pt(toStation)]
      const colors = poolStation ? [inColor, inColor, outColor] : [inColor, outColor]

      const detail =
        leg.kind === 'compile'
          ? 'HolyC → JIT'
          : leg.kind === 'restore'
            ? 'JIT → HolyC'
            : poolStation
              ? `${leg.tokenIn.symbol} → ${leg.tokenOut.symbol} through ${poolShortLabel(poolStation.node)}`
              : `${leg.tokenIn.symbol} → ${leg.tokenOut.symbol}`

      const fee = feeByLeg.get(leg.id)
      const feeLabel = fee && fee > 0n ? `🔥 ${fmtAmt(fee)} HC burned at settlement` : undefined

      steps.push({
        id: leg.id,
        kind: leg.kind,
        points,
        colors,
        fromKey: fromStation.key,
        toKey: toStation.key,
        poolKey: poolStation?.key,
        verb: legVerb(leg.kind),
        title: leg.kind === 'compile' ? 'Compile' : leg.kind === 'restore' ? 'Restore' : `Swap ${leg.tokenIn.symbol} → ${leg.tokenOut.symbol}`,
        detail,
        amountLabel: `${fmtAmt(leg.amountIn, leg.tokenIn.decimals)} ${leg.tokenIn.symbol} → ${fmtAmt(leg.amountOut, leg.tokenOut.decimals)} ${leg.tokenOut.symbol}`,
        feeLabel,
      })

      prevStation = toStation
    })
  }

  // Burn / split are no longer drawn as nodes — they are summarised below the
  // graph as the settlement panel. The flow ends cleanly on the target asset.

  const xs = stations.map((s) => s.x)
  const minX = xs.length ? Math.min(...xs) : 0
  const maxX = xs.length ? Math.max(...xs) : stationW
  const vbX = minX - PAD_X
  const vbW = maxX - minX + PAD_X * 2
  const vbH = SPINE_Y + NODE_R + 46

  const colorSet = Array.from(new Set(steps.flatMap((s) => s.colors)))

  // Map each clickable station to the step it belongs to, so clicking a token
  // node walks the sequence (start node → step 0; a step's pool/output → that step).
  const stationToStep = new Map<string, number>()
  steps.forEach((sv, i) => {
    if (i === 0) stationToStep.set(sv.fromKey, 0)
    if (sv.poolKey) stationToStep.set(sv.poolKey, i)
    stationToStep.set(sv.toKey, i)
  })

  // One continuous route through every station, plus the colour carried on each
  // segment — drives the always-on flowing orbs and the conduit gradient so the
  // whole loop reads as a single living flow, not just the active step.
  const pathPoints: Pt[] = []
  const segColors: string[] = []
  if (stations.length > 0) {
    pathPoints.push({ x: stations[0].x, y: stations[0].y })
    for (const sv of steps) {
      for (let k = 1; k < sv.points.length; k++) {
        pathPoints.push(sv.points[k])
        segColors.push(sv.colors[Math.min(k, sv.colors.length - 1)])
      }
    }
  }

  return { stations, steps, vbX, vbW, vbH, colorSet, stationToStep, pathPoints, segColors }
}

interface ArbFlowInlineProps {
  txHash: string
}

export const ArbFlowInline = memo<ArbFlowInlineProps>(({ txHash }) => {
  const { flow, isLoading, error } = useArbFlow(txHash)

  if (isLoading) {
    return (
      <div className={styles.inlineLoading}>
        <Workflow size={15} /> Decoding arb flow…
      </div>
    )
  }

  if (error || !flow) {
    return (
      <div className={styles.inlineError}>
        <span>Couldn’t decode this arb’s flow{error ? `: ${error}` : '.'}</span>
        <a
          href={`${EXPLORER}/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          Inspect on Otterscan <ExternalLink size={12} />
        </a>
      </div>
    )
  }

  return <SequencedFlow flow={flow} />
})

const SequencedFlow = memo<{ flow: ArbFlow }>(({ flow }) => {
  const layout = useMemo(() => buildLayout(flow), [flow])
  const { stations, steps, vbX, vbW, vbH, colorSet, stationToStep, pathPoints, segColors } = layout
  const stepCount = steps.length

  // Colour carried at each point of the route, for the flowing orbs' fill.
  const pointColors = useMemo(
    () => pathPoints.map((_, i) => segColors[Math.min(i, segColors.length - 1)] ?? '#8aa'),
    [pathPoints, segColors]
  )

  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(0)
  }, [flow.txHash])

  const atStart = step <= 0
  const atEnd = step >= stepCount - 1
  const activeStep = steps[step]

  const goPrev = useCallback(() => setStep((s) => Math.max(0, s - 1)), [])
  const goNext = useCallback(() => setStep((s) => Math.min(stepCount - 1, s + 1)), [stepCount])
  const selectStation = useCallback(
    (key: string) => {
      const target = stationToStep.get(key)
      if (target !== undefined) setStep(target)
    },
    [stationToStep]
  )

  const activeKeys = useMemo(() => {
    if (!activeStep) return new Set<string>()
    return new Set([activeStep.fromKey, activeStep.toKey, activeStep.poolKey].filter(Boolean) as string[])
  }, [activeStep])

  // Where the proceeds went: settlement burn + the split routed to partner buy-&-burn.
  const settlement = useMemo(() => {
    const aggregate = (kind: FlowEdgeKind) => {
      const byToken = new Map<string, { asset: AssetRef; amount: bigint }>()
      for (const sink of flow.sinks) {
        if (sink.kind !== kind) continue
        const key = sink.tokenIn.address.toLowerCase()
        const entry = byToken.get(key)
        if (entry) entry.amount += sink.amountIn
        else byToken.set(key, { asset: sink.tokenIn, amount: sink.amountIn })
      }
      return Array.from(byToken.values()).filter((e) => e.amount > 0n)
    }
    return { burned: aggregate('burn'), buyBurn: aggregate('split') }
  }, [flow])
  const hasSettlement = settlement.burned.length > 0 || settlement.buyBurn.length > 0

  if (stepCount === 0) {
    return (
      <div className={styles.inlineError}>
        <span>No decodable steps for this transaction.</span>
        <a
          href={`${EXPLORER}/tx/${flow.txHash}`}
          target="_blank"
          rel="noreferrer"
          style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          Inspect on Otterscan <ExternalLink size={12} />
        </a>
      </div>
    )
  }

  return (
    <div className={styles.inlineFlow}>
      <div className={styles.inlineHeader}>
        <span className={styles.routeBadge}>
          <Workflow size={13} />
          {flow.routeLabel}
        </span>
        <span className={styles.inlineHeaderNote}>
          DivineManager starts &amp; ends holding <strong>{flow.targetAsset.symbol}</strong>
        </span>
        <a
          href={`${EXPLORER}/tx/${flow.txHash}`}
          target="_blank"
          rel="noreferrer"
          className={styles.txHash}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginLeft: 'auto' }}
        >
          {shortHex(flow.txHash)} <ExternalLink size={11} />
        </a>
      </div>

      <div className={styles.inlineGraphWrap}>
        <svg
          className={styles.flowSvg}
          viewBox={`${vbX} 0 ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {colorSet.map((color) => (
              <marker
                key={color}
                id={`af-arrow-${color.replace(/[^a-z0-9]/gi, '')}`}
                markerWidth="7"
                markerHeight="7"
                refX="5.5"
                refY="2.5"
                orient="auto"
              >
                <path d="M0,0 L5,2.5 L0,5 Z" fill={color} />
              </marker>
            ))}

            {/* ── Compiler orb ──────────────────────────────────────────────
                Two liquids — HolyC-blue and JIT-orange — circling each other
                inside one glass sphere. Orange fills the sphere; blue is a
                wavy half-body laid over it, and the whole interface slowly
                rotates so the two liquids orbit one another. A soft, blurred
                glow rides the wavy boundary as the "compile ⟷ restore" reaction
                seam — the liquids meet and react but never truly mix. Pure
                geometry (rotate + a gentle slosh), no turbulence/noise, so it
                stays smooth and crisp even at this small size. */}
            <radialGradient id="af-orb-base" cx="50%" cy="42%" r="75%">
              <stop offset="0%" stopColor="#1b2540" />
              <stop offset="100%" stopColor="#070b16" />
            </radialGradient>

            {/* Liquid bodies — top-lit so each half reads as a rounded volume.
                User-space coords keep the highlight near the top-left; blue
                lives inside the rotating group, so its highlight orbits with
                the liquid. */}
            <radialGradient id="af-orange-body" gradientUnits="userSpaceOnUse" cx="-5" cy="-9" r="34">
              <stop offset="0%" stopColor="#ffd0a0" />
              <stop offset="45%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#8f3410" />
            </radialGradient>
            <radialGradient id="af-blue-body" gradientUnits="userSpaceOnUse" cx="-5" cy="-9" r="36">
              <stop offset="0%" stopColor="#d6e8ff" />
              <stop offset="46%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1a2f72" />
            </radialGradient>

            {/* Glowing reaction seam: a pale compile/restore blend that rides
                the wavy boundary, softly blurred so the two liquids meet in a
                lit reaction zone instead of a hard line. */}
            <linearGradient id="af-seam-glow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#bfdbfe" stopOpacity="0" />
              <stop offset="50%" stopColor="#f5f3ff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#fed7aa" stopOpacity="0" />
            </linearGradient>
            <filter id="af-seam-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2" />
            </filter>
            {/* Soft colour glows for the active flow line and the travelling packet,
                so the colour-change reads as a bright, energetic flow. */}
            <filter id="af-edge-glow" x="-20%" y="-200%" width="140%" height="500%">
              <feGaussianBlur stdDeviation="2.6" />
            </filter>
            <filter id="af-packet-glow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="2.8" />
            </filter>

            <radialGradient id="af-orb-gloss" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
              <stop offset="55%" stopColor="#ffffff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="af-orb-vignette" cx="50%" cy="50%" r="50%">
              <stop offset="60%" stopColor="#02040a" stopOpacity="0" />
              <stop offset="100%" stopColor="#02040a" stopOpacity="0.55" />
            </radialGradient>
            <clipPath id="af-orb-clip">
              <circle r={NODE_R} />
            </clipPath>
          </defs>

          {/* The whole route as one subdued conduit, with the active step lit up
              on top — the loop is always present, the current step is prominent. */}
          <FlowConduit points={pathPoints} segColors={segColors} activeStep={activeStep} />

          {/* Several orbs flowing the full loop continuously (always on). */}
          <FlowStream points={pathPoints} pointColors={pointColors} />

          {/* Stations (click a token to jump to that step) */}
          {stations.map((station) => (
            <StationGlyph
              key={station.key}
              station={station}
              active={activeKeys.has(station.key)}
              clickable={stationToStep.has(station.key)}
              onSelect={() => selectStation(station.key)}
            />
          ))}
        </svg>
      </div>

      <div className={styles.stepCaption}>
        <div className={styles.stepCaptionTop}>
          <div className={styles.stepCaptionHeading}>
            <span className={styles.stepIndex}>Step {step + 1}/{stepCount}</span>
            <span>· {activeStep.title}</span>
          </div>
          <div className={styles.stepNav}>
            <button type="button" className={styles.flowCtrlBtn} onClick={goPrev} disabled={atStart} aria-label="Previous step">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className={styles.flowCtrlBtn} onClick={goNext} disabled={atEnd} aria-label="Next step">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <span className={styles.stepDetail}>{activeStep.detail}</span>
        <span className={styles.stepAmount}>{activeStep.amountLabel}</span>
        {activeStep.feeLabel && <span className={styles.stepFee}>{activeStep.feeLabel}</span>}
      </div>

      {hasSettlement && (
        <div className={`${styles.settlementPanel}${atEnd ? ` ${styles.settlementPanelActive}` : ''}`}>
          {settlement.buyBurn.length > 0 && (
            <div className={`${styles.settlementCard} ${styles.settlementCardSplit}`}>
              <span className={styles.settlementLabel}>
                <Droplet size={12} /> To partner buy &amp; burn
              </span>
              <div className={styles.settlementTokens}>
                {settlement.buyBurn.map((e) => (
                  <span key={`split-${e.asset.address}`} className={styles.settlementToken}>
                    <TokenLogo address={e.asset.address} symbol={e.asset.symbol} size={18} />
                    {fmtAmt(e.amount, e.asset.decimals)} {e.asset.symbol}
                  </span>
                ))}
              </div>
            </div>
          )}
          {settlement.burned.length > 0 && (
            <div className={`${styles.settlementCard} ${styles.settlementCardBurn}`}>
              <span className={styles.settlementLabel}>
                <Flame size={12} /> Burned (removed from supply)
              </span>
              <div className={styles.settlementTokens}>
                {settlement.burned.map((e) => (
                  <span key={`burn-${e.asset.address}`} className={styles.settlementToken}>
                    <TokenLogo address={e.asset.address} symbol={e.asset.symbol} size={18} />
                    {fmtAmt(e.amount, e.asset.decimals)} {e.asset.symbol}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

/**
 * The whole route as one continuous conduit. A subdued gradient line shows the
 * full loop at all times (each segment carries its token's colour, switching
 * under the nodes), and the active step is re-drawn brightly on top with a soft
 * glow + arrow + verb — prominent "current step" over the ever-present loop.
 */
const FlowConduit = memo<{ points: Pt[]; segColors: string[]; activeStep: StepView | undefined }>(
  ({ points, segColors, activeStep }) => {
    if (points.length < 2) return null
    const x0 = points[0].x
    const xN = points[points.length - 1].x
    const span = xN - x0 || 1
    const fullD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

    let activeD = ''
    let arrowId = ''
    let verb: { x: number; y: number; text: string; fill: string } | null = null
    if (activeStep) {
      const ap = activeStep.points
      activeD = ap.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
      const outColor = activeStep.colors[activeStep.colors.length - 1]
      arrowId = `af-arrow-${outColor.replace(/[^a-z0-9]/gi, '')}`
      const mid = ap[Math.floor((ap.length - 1) / 2)]
      const next = ap[Math.min(Math.floor((ap.length - 1) / 2) + 1, ap.length - 1)]
      verb = { x: (mid.x + next.x) / 2, y: (mid.y + next.y) / 2 - 10, text: activeStep.verb, fill: outColor }
    }

    return (
      <g>
        <defs>
          <linearGradient id="af-flow-grad" gradientUnits="userSpaceOnUse" x1={x0} y1={points[0].y} x2={xN} y2={points[0].y}>
            {segColors.flatMap((c, i) => [
              <stop key={`${i}a`} offset={`${((points[i].x - x0) / span) * 100}%`} stopColor={c} />,
              <stop key={`${i}b`} offset={`${((points[i + 1].x - x0) / span) * 100}%`} stopColor={c} />,
            ])}
          </linearGradient>
        </defs>
        {/* Background conduit — the full loop, always present but subdued. */}
        <path d={fullD} fill="none" stroke="url(#af-flow-grad)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.32} />
        {/* Active step — prominent highlight on top. */}
        {activeStep && (
          <>
            <path d={activeD} fill="none" stroke="url(#af-flow-grad)" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" opacity={0.35} filter="url(#af-edge-glow)" />
            <path d={activeD} fill="none" stroke="url(#af-flow-grad)" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" markerEnd={`url(#${arrowId})`} />
          </>
        )}
        {verb && (
          <text x={verb.x} y={verb.y} className={styles.edgeLabel} fill={verb.fill}>
            {verb.text}
          </text>
        )}
      </g>
    )
  }
)

/**
 * Several orbs flowing the full route continuously — the loop is alive even
 * while you step through. They share one speed and are evenly spaced, so they
 * read as a single steady current; there are enough of them that the stream is
 * always populated (no gaps), and they fade in/out at the ends so the wrap is
 * seamless. Each picks up its segment's colour as it passes (the cycle starts &
 * ends on the same token).
 */
const FlowStream = memo<{ points: Pt[]; pointColors: string[] }>(({ points, pointColors }) => {
  if (points.length < 2) return null
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const cum: number[] = [0]
  for (let i = 1; i < points.length; i++) cum[i] = cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  const total = cum[cum.length - 1] || 1
  const times = cum.map((c) => c / total)
  const dur = Math.max(7, total / 60) // slow, graceful drift
  // One orb roughly every ~170px so the stream stays continuous, never sparse.
  const count = Math.min(6, Math.max(3, Math.round(total / 170)))

  return (
    <g>
      {Array.from({ length: count }).map((_, k) => (
        <FlowOrb key={k} xs={xs} ys={ys} fills={pointColors} times={times} dur={dur} delay={-(k * dur) / count} />
      ))}
    </g>
  )
})

const FlowOrb = memo<{ xs: number[]; ys: number[]; fills: string[]; times: number[]; dur: number; delay: number }>(
  ({ xs, ys, fills, times, dur, delay }) => {
    const pos = { duration: dur, times, repeat: Infinity, ease: 'linear' as const, delay }
    const fade = { duration: dur, times: [0, 0.06, 0.94, 1], repeat: Infinity, ease: 'easeInOut' as const, delay }
    return (
      <g>
        {/* soft colour halo */}
        <motion.circle
          r={9}
          filter="url(#af-packet-glow)"
          initial={{ cx: xs[0], cy: ys[0], fill: fills[0], opacity: 0 }}
          animate={{ cx: xs, cy: ys, fill: fills, opacity: [0, 0.4, 0.4, 0] }}
          transition={{ cx: pos, cy: pos, fill: pos, opacity: fade }}
        />
        {/* bright core with a white rim */}
        <motion.circle
          r={4.5}
          stroke="rgba(255,255,255,0.9)"
          strokeWidth={1.2}
          initial={{ cx: xs[0], cy: ys[0], fill: fills[0], opacity: 0 }}
          animate={{ cx: xs, cy: ys, fill: fills, opacity: [0, 1, 1, 0] }}
          transition={{ cx: pos, cy: pos, fill: pos, opacity: fade }}
        />
      </g>
    )
  }
)

// Wavy boundary between the two liquids. Each frame is a sine (plus a small
// second harmonic) sampled and smoothed (Catmull-Rom -> cubic Bezier) so the
// interface curves like a liquid surface rather than a hard pie cut.
const ORB_R = NODE_R
const ORB_W = ORB_R + 12

const smoothPath = (pts: Array<[number, number]>): string => {
  let d = ''
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = i + 2 < pts.length ? pts[i + 2] : p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)} `
  }
  return d
}

// Build the seam + the closed blue half-body for a given wave phase. Animating
// the path d between a few phases (in sync for both the blue body and the
// glowing seam) makes the boundary undulate, so combined with the slow rotation
// it reads as two sloshing liquid halves, not a rigid split that merely spins.
const buildSeam = (phase: number): { seam: string; blue: string } => {
  const pts: Array<[number, number]> = []
  const seg = 22
  for (let i = 0; i <= seg; i++) {
    const x = -ORB_W + (2 * ORB_W * i) / seg
    const t = x / ORB_W
    // single clean sine — one gentle wave; advancing the phase makes it travel
    const y = 4.2 * Math.sin(t * Math.PI + phase)
    pts.push([x, y])
  }
  const seam = `M${pts[0][0].toFixed(2)},${pts[0][1].toFixed(2)} ${smoothPath(pts)}`
  const blue = `${seam}L${ORB_W.toFixed(2)},${(ORB_W + 24).toFixed(2)} L${(-ORB_W).toFixed(2)},${(ORB_W + 24).toFixed(2)} Z`
  return { seam, blue }
}

// Six phase steps over a full wavelength → the wave travels smoothly and loops
// seamlessly back to the start (last value repeats frame 0).
const ORB_FRAMES = [0, 1, 2, 3, 4, 5].map((n) => buildSeam((n * Math.PI) / 3))
const ORB_SEAM_D = ORB_FRAMES[0].seam
const ORB_BLUE_D = ORB_FRAMES[0].blue
const ORB_SEAM_VALUES = `${ORB_FRAMES.map((frame) => frame.seam).join(';')};${ORB_FRAMES[0].seam}`
const ORB_BLUE_VALUES = `${ORB_FRAMES.map((frame) => frame.blue).join(';')};${ORB_FRAMES[0].blue}`
const ORB_MORPH_TIMES = '0;0.1667;0.3333;0.5;0.6667;0.8333;1'
const ORB_MORPH_SPLINES = Array(6).fill('0.42 0 0.58 1').join('; ')

/**
 * Compiler orb — two liquids (HolyC-blue / JIT-orange) circling each other
 * inside one glass sphere. Orange fills the sphere as the base liquid; blue is
 * a wavy half-body laid over it. The whole interface slowly rotates (with a
 * gentle slosh) so the two liquids orbit one another, and a soft blurred glow
 * rides the wavy seam as the compile/restore reaction zone — they meet and
 * react but never truly mix. Pure geometry, no turbulence, so it stays smooth
 * and crisp at this small size. Glass gloss + rim vignette finish the sphere.
 */
const CompilerCore = memo<{ active: boolean }>(({ active }) => {
  const f = (n: number) => n.toFixed(1)
  return (
    <g clipPath="url(#af-orb-clip)" opacity={active ? 1 : 0.92}>
      {/* Dark undertone — only visible if a fill ever fails */}
      <circle r={f(ORB_R)} fill="url(#af-orb-base)" />
      {/* Orange liquid fills the whole sphere */}
      <circle r={f(ORB_R)} fill="url(#af-orange-body)" />

      {/* Blue liquid + glowing reaction seam, slowly orbiting the orange.
          Negative begin offsets start every animation mid-cycle, so the orb is
          already in motion the instant the flow panel opens (no cold wind-up). */}
      <g>
        <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="18s" begin="-7s" repeatCount="indefinite" />
        {/* gentle slosh so the spin never reads as a rigid wheel */}
        <g>
          <animateTransform attributeName="transform" type="translate" values="0 -1.2; 0 1.2; 0 -1.2" dur="6.5s" begin="-2s" repeatCount="indefinite" calcMode="spline" keyTimes="0;0.5;1" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1" />
          <path d={ORB_BLUE_D} fill="url(#af-blue-body)">
            <animate attributeName="d" values={ORB_BLUE_VALUES} dur="12s" begin="-4s" repeatCount="indefinite" calcMode="spline" keyTimes={ORB_MORPH_TIMES} keySplines={ORB_MORPH_SPLINES} />
          </path>
          {/* reaction zone: soft wide glow + a thin hot core, morphing with the seam */}
          <path d={ORB_SEAM_D} fill="none" stroke="url(#af-seam-glow)" strokeWidth={5.5} strokeLinecap="round" filter="url(#af-seam-soft)" opacity={0.9}>
            <animate attributeName="d" values={ORB_SEAM_VALUES} dur="12s" begin="-4s" repeatCount="indefinite" calcMode="spline" keyTimes={ORB_MORPH_TIMES} keySplines={ORB_MORPH_SPLINES} />
          </path>
          <path d={ORB_SEAM_D} fill="none" stroke="url(#af-seam-glow)" strokeWidth={1.6} strokeLinecap="round" opacity={0.7}>
            <animate attributeName="d" values={ORB_SEAM_VALUES} dur="12s" begin="-4s" repeatCount="indefinite" calcMode="spline" keyTimes={ORB_MORPH_TIMES} keySplines={ORB_MORPH_SPLINES} />
          </path>
        </g>
      </g>

      {/* Glass shaping: rim vignette + top-left gloss */}
      <circle r={f(ORB_R)} fill="url(#af-orb-vignette)" />
      <ellipse cx={f(-ORB_R * 0.3)} cy={f(-ORB_R * 0.36)} rx={f(ORB_R * 0.58)} ry={f(ORB_R * 0.42)} fill="url(#af-orb-gloss)" />
    </g>
  )
})

const StationGlyph = memo<{ station: StationView; active: boolean; clickable: boolean; onSelect: () => void }>(
  ({ station, active, clickable, onSelect }) => {
    const { node, x, y, isStart, isEnd } = station
    const interactive = clickable
      ? { onClick: onSelect, style: { cursor: 'pointer' as const } }
      : {}

    if (node.kind === 'pool') {
      // Match the token/compiler node size (NODE_R). The PulseX asset ships with
      // its own dark coin + transparent padding, so the image box is overscanned
      // past the node radius and clipped to a circle — that crops the built-in
      // padding so the coin fills the node like the other glyphs.
      const POOL_IMG = NODE_R + 5
      return (
        <g transform={`translate(${x},${y})`} opacity={active ? 1 : 0.9} {...interactive}>
          {active && <circle r={NODE_R} fill="#a78bfa" opacity={0.55} filter="url(#af-packet-glow)" />}
          <circle r={NODE_R} fill="rgba(15,15,25,0.94)" />
          <clipPath id={`af-pool-clip-${station.key}`}>
            <circle r={NODE_R - 1.5} />
          </clipPath>
          <image
            href={PULSEX_LOGO}
            x={-POOL_IMG}
            y={-POOL_IMG}
            width={POOL_IMG * 2}
            height={POOL_IMG * 2}
            preserveAspectRatio="xMidYMid slice"
            clipPath={`url(#af-pool-clip-${station.key})`}
          />
          <circle r={NODE_R} fill="none" stroke={active ? 'rgba(167,139,250,0.9)' : 'rgba(167,139,250,0.4)'} strokeWidth={active ? 2.6 : 1.8} />
          <text y={NODE_R + 15} className={styles.nodeLabel}>{poolShortLabel(node)}</text>
          {node.meta?.verified === false && <text y={NODE_R + 27} className={styles.nodeSubLabel}>unverified</text>}
        </g>
      )
    }

    if (node.kind === 'compiler') {
      return (
        <g transform={`translate(${x},${y})`} opacity={active ? 1 : 0.9} {...interactive}>
          {active && <circle r={NODE_R} fill="#7dd3fc" opacity={0.5} filter="url(#af-packet-glow)" />}
          {/* No outline — the liquid orb fills the node and is its own edge. */}
          <circle r={NODE_R} fill="rgba(15,15,25,0.94)" />
          <CompilerCore active={active} />
          <text y={NODE_R + 15} className={styles.nodeLabel}>Compiler</text>
        </g>
      )
    }

    // Asset
    const symbol = node.label
    const color = tokenColor(symbol)
    const logoUrl = resolveTokenLogo({ address: node.address ?? '', symbol }).src
    return (
      <g transform={`translate(${x},${y})`} {...interactive}>
        {active && <circle r={NODE_R} fill={color} opacity={0.5} filter="url(#af-packet-glow)" />}
        {(isStart || isEnd) && (
          <motion.circle
            r={NODE_R + 6}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            opacity={0.45}
            animate={{ strokeDashoffset: [0, -18] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        )}
        {/* No coloured outline — the token logo fills the node and is its own edge. */}
        <circle r={NODE_R} fill="rgba(15,15,25,0.94)" opacity={active ? 1 : 0.92} />
        <clipPath id={`af-clip-${station.key}`}>
          <circle r={NODE_R} />
        </clipPath>
        <image href={logoUrl} x={-NODE_R} y={-NODE_R} width={NODE_R * 2} height={NODE_R * 2} clipPath={`url(#af-clip-${station.key})`} />
        <text y={NODE_R + 15} className={styles.nodeLabel} fill={color}>{symbol}</text>
      </g>
    )
  }
)
