import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { Activity } from 'lucide-react'
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type ForceLink as D3ForceLink,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { formatUnits } from 'viem'
import { fetchDexscreenerLogo, resolveTokenLogo } from '@/arb-flow/getTokenLogo'
import type {
  VolumeExecution,
  VolumePool,
  VolumeSnapshot,
  VolumeSwap,
  VolumeToken,
} from './useManagerVolume'
import styles from './LandingPage.module.css'

export type VolumeWindow = '24h' | '7d' | '30d' | 'all'

type NodeStats = {
  pool: VolumePool
  executions: number
  swaps: number
  volumeWpls: number
  tokenFlows: Map<string, { bought: bigint; sold: bigint }>
}

type TokenFlowTotals = { bought: bigint; sold: bigint }

type RouteEdge = {
  id: string
  from: string
  to: string
  executions: number
  volumeWpls: number
  poolVolumeWpls: Map<string, number>
  tokenFlows: Map<string, TokenFlowTotals>
}

type RouteVisualStyle = CSSProperties & {
  '--route-width': string
  '--route-opacity': string
  '--route-color': string
  '--route-dash': string
  '--route-glow-radius': string
  '--route-glow-opacity': string
}

type PoolVisualStyle = CSSProperties & {
  '--pool-scale': string
}

type LiquidityVolumeNetworkProps = {
  snapshot: VolumeSnapshot | null
  isLoading: boolean
  error: string | null
  window: VolumeWindow
  onWindowChange: (window: VolumeWindow) => void
}

const WINDOWS: Array<{ id: VolumeWindow; label: string; ms: number | null }> = [
  { id: '24h', label: '24H', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7D', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: '30d', label: '30D', ms: 30 * 24 * 60 * 60 * 1000 },
  { id: 'all', label: 'ALL', ms: null },
]

const DEFAULT_GRAPH_WIDTH = 600
const DEFAULT_GRAPH_HEIGHT = 360
const MOBILE_GRAPH_WIDTH = 420
const NODE_EDGE_MARGIN_X = 58
const NODE_EDGE_MARGIN_TOP = 42
const NODE_EDGE_MARGIN_BOTTOM = 50
const POOL_COLLISION_RADIUS = 48
const WPLS_ADDRESS = '0xa1077a294dde1b09bb078844df40758a5d0f9a27'
const JIT_ADDRESS = '0x57909025ace10d5de114d96e3ec84f282895870c'

type GraphPosition = { x: number; y: number }

type GraphDimensions = {
  width: number
  height: number
}

type ForceNode = SimulationNodeDatum & {
  id: string
}

type ForceLinkDatum = SimulationLinkDatum<ForceNode> & {
  distance: number
  strength: number
}

type NodeDrag = {
  address: string
  pointerId: number
  offsetX: number
  offsetY: number
  startClientX: number
  startClientY: number
  moved: boolean
}

const poolLabel = (pool: VolumePool) => `${pool.token0.symbol}/${pool.token1.symbol}`

const formatRouteShare = (share: number) => {
  const percentage = share * 100
  if (percentage >= 10) return `${Math.round(percentage)}%`
  if (percentage >= 1) return `${percentage.toFixed(1)}%`
  return '<1%'
}

const forceLinkEndpointId = (endpoint: ForceNode | string | number) =>
  typeof endpoint === 'object' ? endpoint.id : String(endpoint)

const pointerToGraphPosition = (
  svg: SVGSVGElement,
  clientX: number,
  clientY: number
): GraphPosition | null => {
  const matrix = svg.getScreenCTM()
  if (!matrix) return null
  const point = svg.createSVGPoint()
  point.x = clientX
  point.y = clientY
  const transformed = point.matrixTransform(matrix.inverse())
  return { x: transformed.x, y: transformed.y }
}

const constrainToGraph = (
  { x, y }: GraphPosition,
  dimensions: GraphDimensions
): GraphPosition => ({
  x: Math.min(dimensions.width - NODE_EDGE_MARGIN_X, Math.max(NODE_EDGE_MARGIN_X, x)),
  y: Math.min(dimensions.height - NODE_EDGE_MARGIN_BOTTOM, Math.max(NODE_EDGE_MARGIN_TOP, y)),
})

const routePathBetween = (
  from: GraphPosition,
  to: GraphPosition,
  fromScale: number,
  toScale: number,
  routeId: string
) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy)
  if (distance < 1) return `M ${from.x} ${from.y}`

  const ux = dx / distance
  const uy = dy / distance
  const boundaryDistance = (scale: number) => {
    const radiusX = 42 * scale + 3
    const radiusY = 43 * scale + 3
    return 1 / Math.sqrt((ux * ux) / (radiusX * radiusX) + (uy * uy) / (radiusY * radiusY))
  }
  const fromInset = Math.min(distance * 0.38, boundaryDistance(fromScale))
  const toInset = Math.min(distance * 0.38, boundaryDistance(toScale))
  const start = {
    x: from.x + ux * fromInset,
    y: from.y + uy * fromInset,
  }
  const end = {
    x: to.x - ux * toInset,
    y: to.y - uy * toInset,
  }
  const visibleDistance = Math.hypot(end.x - start.x, end.y - start.y)
  const routeHash = [...routeId].reduce((hash, character) => hash + character.charCodeAt(0), 0)
  const curveDirection = routeHash % 2 === 0 ? 1 : -1
  const curve = Math.min(18, Math.max(6, visibleDistance * 0.065)) * curveDirection
  const control = {
    x: (start.x + end.x) / 2 - uy * curve,
    y: (start.y + end.y) / 2 + ux * curve,
  }

  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} Q ${control.x.toFixed(2)} ${control.y.toFixed(2)} ${end.x.toFixed(2)} ${end.y.toFixed(2)}`
}

const compactTokenAmount = (value: bigint, token: VolumeToken) => {
  const amount = Number(formatUnits(value, token.decimals))
  if (!Number.isFinite(amount) || amount === 0) return '0'
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
  if (amount >= 1) return amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return amount.toLocaleString(undefined, { maximumSignificantDigits: 3 })
}

const compactWplsAmount = (amount: number) => {
  if (!Number.isFinite(amount) || amount === 0) return '0'
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`
  if (amount >= 1) return amount.toLocaleString(undefined, { maximumFractionDigits: 2 })
  return amount.toLocaleString(undefined, { maximumSignificantDigits: 3 })
}

const tokenAmount = (
  rawAmount: string,
  tokenAddress: string,
  tokens: Map<string, VolumeToken>
) => {
  const token = tokens.get(tokenAddress.toLowerCase())
  if (!token) return null
  try {
    const amount = Number(formatUnits(BigInt(rawAmount), token.decimals))
    return Number.isFinite(amount) ? amount : null
  } catch {
    return null
  }
}

const estimateJitInWpls = (
  executions: VolumeExecution[],
  tokens: Map<string, VolumeToken>
) => {
  let jitVolume = 0
  let wplsVolume = 0

  executions.forEach((execution) => {
    execution.swaps.forEach((swap) => {
      const tokenIn = swap.tokenIn.toLowerCase()
      const tokenOut = swap.tokenOut.toLowerCase()
      if (!(
        (tokenIn === JIT_ADDRESS && tokenOut === WPLS_ADDRESS)
        || (tokenIn === WPLS_ADDRESS && tokenOut === JIT_ADDRESS)
      )) return

      const jitAmount = tokenAmount(
        tokenIn === JIT_ADDRESS ? swap.amountIn : swap.amountOut,
        JIT_ADDRESS,
        tokens
      )
      const wplsAmount = tokenAmount(
        tokenIn === WPLS_ADDRESS ? swap.amountIn : swap.amountOut,
        WPLS_ADDRESS,
        tokens
      )
      if (jitAmount === null || wplsAmount === null) return
      jitVolume += jitAmount
      wplsVolume += wplsAmount
    })
  })

  return jitVolume > 0 && wplsVolume > 0 ? wplsVolume / jitVolume : null
}

const estimateSwapVolumeWpls = (
  swap: VolumeSwap,
  jitInWpls: number,
  tokens: Map<string, VolumeToken>
) => {
  const tokenIn = swap.tokenIn.toLowerCase()
  const tokenOut = swap.tokenOut.toLowerCase()

  if (tokenIn === WPLS_ADDRESS || tokenOut === WPLS_ADDRESS) {
    return tokenAmount(
      tokenIn === WPLS_ADDRESS ? swap.amountIn : swap.amountOut,
      WPLS_ADDRESS,
      tokens
    )
  }

  if (tokenIn === JIT_ADDRESS || tokenOut === JIT_ADDRESS) {
    const jitAmount = tokenAmount(
      tokenIn === JIT_ADDRESS ? swap.amountIn : swap.amountOut,
      JIT_ADDRESS,
      tokens
    )
    return jitAmount === null ? null : jitAmount * jitInWpls
  }

  return null
}

const addTokenFlow = (
  flows: Map<string, TokenFlowTotals>,
  tokenAddress: string,
  direction: keyof TokenFlowTotals,
  amount: string
) => {
  const address = tokenAddress.toLowerCase()
  const flow = flows.get(address) ?? { bought: 0n, sold: 0n }
  flow[direction] += BigInt(amount)
  flows.set(address, flow)
}

const toTooltipFlows = (flows: Map<string, TokenFlowTotals>, tokens: Map<string, VolumeToken>) =>
  Array.from(flows.entries()).flatMap(([tokenAddress, flow]) => {
    const token = tokens.get(tokenAddress)
    if (!token) return []
    return [{
      symbol: token.symbol,
      bought: flow.bought > 0n ? `+${compactTokenAmount(flow.bought, token)}` : null,
      sold: flow.sold > 0n ? `−${compactTokenAmount(flow.sold, token)}` : null,
    }]
  })

const aggregateVolume = (snapshot: VolumeSnapshot, window: VolumeWindow) => {
  const now = Date.now()
  const windowMs = WINDOWS.find((item) => item.id === window)?.ms ?? null
  const cutoff = windowMs === null ? null : now - windowMs
  const pools = [...snapshot.pools].sort((a, b) => poolLabel(a).localeCompare(poolLabel(b)))
  const nodeByAddress = new Map<string, NodeStats>(
    pools.map((pool) => [
      pool.pairAddress.toLowerCase(),
      { pool, executions: 0, swaps: 0, volumeWpls: 0, tokenFlows: new Map() },
    ])
  )
  const tokenByAddress = new Map<string, VolumeToken>()
  pools.forEach((pool) => {
    tokenByAddress.set(pool.token0.address.toLowerCase(), pool.token0)
    tokenByAddress.set(pool.token1.address.toLowerCase(), pool.token1)
  })
  const edgeById = new Map<string, RouteEdge>()

  const visibleExecutions = snapshot.executions.filter(
    (execution) => cutoff === null || execution.timestamp >= cutoff
  )
  const jitInWpls = estimateJitInWpls(visibleExecutions, tokenByAddress)
    ?? estimateJitInWpls(snapshot.executions, tokenByAddress)
    ?? 0

  visibleExecutions.forEach((execution) => {

    const route = execution.route
      .map((address) => address.toLowerCase())
      .filter((address, index, values) => index === 0 || values[index - 1] !== address)
    const poolsInExecution = new Set(route)
    poolsInExecution.forEach((address) => {
      const node = nodeByAddress.get(address)
      if (node) node.executions += 1
    })

    execution.swaps.forEach((swap) => {
      const node = nodeByAddress.get(swap.poolAddress.toLowerCase())
      if (!node) return
      node.swaps += 1
      const volumeWpls = estimateSwapVolumeWpls(swap, jitInWpls, tokenByAddress)
      if (volumeWpls !== null) node.volumeWpls += volumeWpls
      try {
        addTokenFlow(node.tokenFlows, swap.tokenIn, 'sold', swap.amountIn)
        addTokenFlow(node.tokenFlows, swap.tokenOut, 'bought', swap.amountOut)
      } catch {
        // Keep rendering valid route data if an indexed amount is malformed.
      }
    })

    for (let index = 1; index < route.length; index += 1) {
      const [first, second] = [route[index - 1], route[index]].sort()
      const id = `${first}:${second}`
      let edge = edgeById.get(id)
      if (edge) {
        edge.executions += 1
      } else {
        edge = {
          id,
          from: first,
          to: second,
          executions: 1,
          volumeWpls: 0,
          poolVolumeWpls: new Map(),
          tokenFlows: new Map(),
        }
        edgeById.set(id, edge)
      }

      execution.swaps.forEach((swap) => {
        const poolAddress = swap.poolAddress.toLowerCase()
        if (poolAddress !== first && poolAddress !== second) return
        const volumeWpls = estimateSwapVolumeWpls(swap, jitInWpls, tokenByAddress)
        if (volumeWpls !== null) {
          edge.poolVolumeWpls.set(
            poolAddress,
            (edge.poolVolumeWpls.get(poolAddress) ?? 0) + volumeWpls
          )
        }
        try {
          addTokenFlow(edge.tokenFlows, swap.tokenIn, 'sold', swap.amountIn)
          addTokenFlow(edge.tokenFlows, swap.tokenOut, 'bought', swap.amountOut)
        } catch {
          // Ignore only the malformed amount for this route.
        }
      })
    }
  })

  edgeById.forEach((edge) => {
    const endpointVolumes = [edge.from, edge.to]
      .map((address) => edge.poolVolumeWpls.get(address))
      .filter((volume): volume is number => volume !== undefined)
    edge.volumeWpls = endpointVolumes.length > 0
      ? endpointVolumes.reduce((total, volume) => total + volume, 0) / endpointVolumes.length
      : 0
  })

  return {
    nodes: Array.from(nodeByAddress.values()),
    tokenByAddress,
    edges: Array.from(edgeById.values()).sort((a, b) => b.volumeWpls - a.volumeWpls),
  }
}

type VolumeTooltip = {
  x: number
  y: number
  placeBelow: boolean
  title: string
  lines: string[]
  flows?: Array<{ symbol: string; bought: string | null; sold: string | null }>
}

export const LiquidityVolumeNetwork = ({
  snapshot,
  isLoading,
  error,
  window,
  onWindowChange,
}: LiquidityVolumeNetworkProps) => {
  const [selectedPool, setSelectedPool] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<VolumeTooltip | null>(null)
  const [remoteTokenLogos, setRemoteTokenLogos] = useState<Record<string, string>>({})
  const [positions, setPositions] = useState<Map<string, GraphPosition>>(new Map())
  const [draggingPool, setDraggingPool] = useState<string | null>(null)
  const [hasAdjustedLayout, setHasAdjustedLayout] = useState(false)
  const [graphDimensions, setGraphDimensions] = useState<GraphDimensions>({
    width: DEFAULT_GRAPH_WIDTH,
    height: DEFAULT_GRAPH_HEIGHT,
  })
  const graphFrameRef = useRef<HTMLDivElement | null>(null)
  const previousGraphDimensionsRef = useRef<GraphDimensions>({
    width: DEFAULT_GRAPH_WIDTH,
    height: DEFAULT_GRAPH_HEIGHT,
  })
  const dragRef = useRef<NodeDrag | null>(null)
  const ignoredClickRef = useRef<{ address: string; time: number } | null>(null)
  const layoutAdjustmentVersionRef = useRef(0)
  const resetReleaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const simulationRef = useRef<Simulation<ForceNode, ForceLinkDatum> | null>(null)
  const forceNodeByIdRef = useRef<Map<string, ForceNode>>(new Map())
  const allForceLinksRef = useRef<ForceLinkDatum[]>([])
  const linkForceRef = useRef<D3ForceLink<ForceNode, ForceLinkDatum> | null>(null)
  const aggregate = useMemo(() => (snapshot ? aggregateVolume(snapshot, window) : null), [snapshot, window])

  useEffect(() => {
    const graphFrame = graphFrameRef.current
    if (!aggregate || !graphFrame) return

    const updateDimensions = () => {
      const { width, height } = graphFrame.getBoundingClientRect()
      if (width < 1 || height < 1) return
      const logicalWidth = width <= 520 ? MOBILE_GRAPH_WIDTH : DEFAULT_GRAPH_WIDTH
      const logicalHeight = Math.max(
        DEFAULT_GRAPH_HEIGHT,
        Math.min(780, logicalWidth * (height / width))
      )
      const nextDimensions = {
        width: logicalWidth,
        height: Math.round(logicalHeight),
      }
      setGraphDimensions((current) => (
        current.width === nextDimensions.width && current.height === nextDimensions.height
          ? current
          : nextDimensions
      ))
    }

    updateDimensions()
    const observer = new ResizeObserver(updateDimensions)
    observer.observe(graphFrame)
    return () => observer.disconnect()
  }, [aggregate])

  const resolvedTokenLogos = useMemo(() => {
    if (!snapshot) return []
    const tokens = new Map<string, VolumeToken>()
    snapshot.pools.forEach((pool) => {
      tokens.set(pool.token0.address.toLowerCase(), pool.token0)
      tokens.set(pool.token1.address.toLowerCase(), pool.token1)
    })
    return Array.from(tokens.values()).map((token) => ({ token, initial: resolveTokenLogo(token) }))
  }, [snapshot])

  useEffect(() => {
    const unresolved = resolvedTokenLogos.filter(({ initial }) => initial.isInitials)
    if (unresolved.length === 0) return
    let active = true
    void Promise.all(
      unresolved.map(async ({ token }) => ({
        address: token.address.toLowerCase(),
        logo: await fetchDexscreenerLogo(token),
      }))
    ).then((results) => {
      if (!active) return
      const additions = results.filter((result): result is { address: string; logo: string } => Boolean(result.logo))
      if (additions.length === 0) return
      setRemoteTokenLogos((current) => ({
        ...current,
        ...Object.fromEntries(additions.map(({ address, logo }) => [address, logo])),
      }))
    })
    return () => {
      active = false
    }
  }, [resolvedTokenLogos])

  const tokenLogoByAddress = useMemo(
    () => new Map(
      resolvedTokenLogos.map(({ token, initial }) => [
        token.address.toLowerCase(),
        remoteTokenLogos[token.address.toLowerCase()] ?? initial.src,
      ])
    ),
    [remoteTokenLogos, resolvedTokenLogos]
  )

  useEffect(() => {
    if (!aggregate || !selectedPool) return
    const selectedStillExists = aggregate.nodes.some((node) => node.pool.pairAddress.toLowerCase() === selectedPool)
    if (selectedStillExists) return
    setSelectedPool(null)
  }, [aggregate, selectedPool])

  const selectedRoutePools = useMemo(() => {
    if (!aggregate || !selectedPool) return null
    const routePools = new Set([selectedPool])
    aggregate.edges.forEach((edge) => {
      if (edge.from !== selectedPool && edge.to !== selectedPool) return
      routePools.add(edge.from)
      routePools.add(edge.to)
    })
    return routePools
  }, [aggregate, selectedPool])

  const routeContext = useMemo(() => {
    if (!aggregate) return {
      metrics: new Map<string, { share: number; relativeStrength: number; volumeWpls: number }>(),
      renderedEdges: [] as RouteEdge[],
    }

    const connectedEdges = selectedPool === null
      ? aggregate.edges
      : aggregate.edges.filter((edge) => edge.from === selectedPool || edge.to === selectedPool)
    const volumeForContext = (edge: RouteEdge) => selectedPool === null
      ? edge.volumeWpls
      : edge.poolVolumeWpls.get(selectedPool) ?? 0
    const totalVolumeWpls = connectedEdges.reduce((total, edge) => total + volumeForContext(edge), 0)
    const strongestVolumeWpls = connectedEdges.reduce(
      (strongest, edge) => Math.max(strongest, volumeForContext(edge)),
      0
    )
    const connectedIds = new Set(connectedEdges.map((edge) => edge.id))
    const metrics = new Map(
      aggregate.edges.map((edge) => [
        edge.id,
        {
          share: connectedIds.has(edge.id) && totalVolumeWpls > 0
            ? volumeForContext(edge) / totalVolumeWpls
            : 0,
          relativeStrength: connectedIds.has(edge.id) && strongestVolumeWpls > 0
            ? volumeForContext(edge) / strongestVolumeWpls
            : 0,
          volumeWpls: connectedIds.has(edge.id) ? volumeForContext(edge) : 0,
        },
      ])
    )

    return {
      metrics,
      // SVG paints later elements on top, so the strongest routes should render last.
      renderedEdges: [...aggregate.edges].reverse(),
    }
  }, [aggregate, selectedPool])

  const routedVolumeByPool = useMemo(() => {
    if (!aggregate) return new Map<string, number>()
    const routedVolumeByPool = new Map<string, number>()
    aggregate.edges.forEach((edge) => {
      routedVolumeByPool.set(edge.from, (routedVolumeByPool.get(edge.from) ?? 0) + edge.volumeWpls)
      routedVolumeByPool.set(edge.to, (routedVolumeByPool.get(edge.to) ?? 0) + edge.volumeWpls)
    })
    return routedVolumeByPool
  }, [aggregate])

  const poolScaleByAddress = useMemo(() => {
    if (!aggregate) return new Map<string, number>()
    const strongestRoutedVolume = Math.max(0, ...routedVolumeByPool.values())

    return new Map<string, number>(aggregate.nodes.map((node): [string, number] => {
      const address = node.pool.pairAddress.toLowerCase()
      if (selectedPool === null) {
        const routedVolume = routedVolumeByPool.get(address) ?? 0
        const relativeVolume = strongestRoutedVolume > 0 ? routedVolume / strongestRoutedVolume : 0
        return [address, routedVolume === 0 ? 0.88 : 0.88 + 0.26 * Math.pow(relativeVolume, 0.72)]
      }
      if (address === selectedPool) return [address, 1.14]
      if (!selectedRoutePools?.has(address)) return [address, 0.88]

      const connectingEdge = aggregate.edges.find((edge) => (
        (edge.from === selectedPool && edge.to === address)
        || (edge.to === selectedPool && edge.from === address)
      ))
      const relativeStrength = connectingEdge
        ? routeContext.metrics.get(connectingEdge.id)?.relativeStrength ?? 0
        : 0
      return [address, 0.88 + 0.26 * Math.pow(relativeStrength, 0.72)]
    }))
  }, [aggregate, routeContext, routedVolumeByPool, selectedPool, selectedRoutePools])

  const graphCenterX = graphDimensions.width / 2
  const graphCenterY = graphDimensions.height / 2

  const defaultPositions = useMemo(() => {
    if (!aggregate) return new Map<string, GraphPosition>()
    const radiusX = Math.min(
      graphDimensions.width / 2 - NODE_EDGE_MARGIN_X - 4,
      graphDimensions.width * (aggregate.nodes.length > 8 ? 0.39 : 0.35)
    )
    const radiusY = Math.min(
      graphDimensions.height / 2 - NODE_EDGE_MARGIN_BOTTOM - 2,
      graphDimensions.height * (aggregate.nodes.length > 8 ? 0.4 : 0.36)
    )
    return new Map(
      aggregate.nodes.map((node, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / Math.max(1, aggregate.nodes.length)
        return [
          node.pool.pairAddress.toLowerCase(),
          {
            x: graphCenterX + Math.cos(angle) * radiusX,
            y: graphCenterY + Math.sin(angle) * radiusY,
          },
        ]
      })
    )
  }, [aggregate, graphCenterX, graphCenterY, graphDimensions])

  useEffect(() => {
    if (!aggregate) return

    const previousNodes = forceNodeByIdRef.current
    const previousDimensions = previousGraphDimensionsRef.current
    previousGraphDimensionsRef.current = graphDimensions
    const widthScale = graphDimensions.width / previousDimensions.width
    const heightScale = graphDimensions.height / previousDimensions.height
    const previousCenterX = previousDimensions.width / 2
    const previousCenterY = previousDimensions.height / 2
    const poolNodes: ForceNode[] = aggregate.nodes.map((node) => {
      const address = node.pool.pairAddress.toLowerCase()
      const previous = previousNodes.get(address)
      const initial = defaultPositions.get(address) ?? { x: graphCenterX, y: graphCenterY }
      const previousPosition = Number.isFinite(previous?.x) && Number.isFinite(previous?.y)
        ? constrainToGraph({
          x: graphCenterX + ((previous?.x ?? previousCenterX) - previousCenterX) * widthScale,
          y: graphCenterY + ((previous?.y ?? previousCenterY) - previousCenterY) * heightScale,
        }, graphDimensions)
        : initial
      return {
        id: address,
        x: previousPosition.x,
        y: previousPosition.y,
        vx: (previous?.vx ?? 0) * widthScale,
        vy: (previous?.vy ?? 0) * heightScale,
      }
    })
    const routeDegrees = new Map<string, number>()
    aggregate.edges.forEach((edge) => {
      routeDegrees.set(edge.from, (routeDegrees.get(edge.from) ?? 0) + 1)
      routeDegrees.set(edge.to, (routeDegrees.get(edge.to) ?? 0) + 1)
    })
    const forceLinks: ForceLinkDatum[] = aggregate.edges.map((edge) => {
      const sharedDegree = Math.max(1, Math.min(
        routeDegrees.get(edge.from) ?? 1,
        routeDegrees.get(edge.to) ?? 1
      ))
      const trafficWeight = 1 + Math.min(1.1, Math.log2(edge.executions + 1) * 0.18)
      return {
        source: edge.from,
        target: edge.to,
        distance: 154,
        strength: Math.min(0.065, (0.07 * trafficWeight) / sharedDegree),
      }
    })

    forceNodeByIdRef.current = new Map(poolNodes.map((node) => [node.id, node]))
    setPositions(new Map(poolNodes.map((node) => [node.id, {
      x: node.x ?? graphCenterX,
      y: node.y ?? graphCenterY,
    }])))

    const linkForce = forceLink<ForceNode, ForceLinkDatum>(forceLinks)
      .id((node) => node.id)
      .distance((link) => link.distance)
      .strength((link) => link.strength)

    allForceLinksRef.current = forceLinks
    linkForceRef.current = linkForce

    const simulation = forceSimulation<ForceNode, ForceLinkDatum>(poolNodes)
      .alpha(0.82)
      .alphaMin(0.002)
      .alphaDecay(0.03)
      .velocityDecay(0.22)
      .force('links', linkForce)
      .force('charge', forceManyBody<ForceNode>()
        .strength(-120)
        .distanceMin(50)
        .distanceMax(300))
      .force('collision', forceCollide<ForceNode>()
        .radius(POOL_COLLISION_RADIUS)
        .strength(0.72)
        .iterations(1))
      .force('center', forceCenter<ForceNode>(graphCenterX, graphCenterY).strength(0.09))
      .on('tick', () => {
        poolNodes.forEach((node) => {
          const constrained = constrainToGraph({
            x: node.x ?? graphCenterX,
            y: node.y ?? graphCenterY,
          }, graphDimensions)
          if (node.x !== constrained.x) {
            node.x = constrained.x
            node.vx = (node.vx ?? 0) * -0.2
          }
          if (node.y !== constrained.y) {
            node.y = constrained.y
            node.vy = (node.vy ?? 0) * -0.2
          }
        })
        setPositions(new Map(poolNodes.map((node) => [node.id, {
          x: node.x ?? graphCenterX,
          y: node.y ?? graphCenterY,
        }])))
      })

    simulationRef.current = simulation

    return () => {
      if (resetReleaseTimeoutRef.current !== null) {
        globalThis.clearTimeout(resetReleaseTimeoutRef.current)
        resetReleaseTimeoutRef.current = null
      }
      simulation.stop()
      simulation.on('tick', null)
      if (simulationRef.current === simulation) simulationRef.current = null
      if (linkForceRef.current === linkForce) linkForceRef.current = null
      if (allForceLinksRef.current === forceLinks) allForceLinksRef.current = []
    }
  }, [aggregate, defaultPositions, graphCenterX, graphCenterY, graphDimensions])

  useEffect(() => {
    const linkForce = linkForceRef.current
    const simulation = simulationRef.current
    if (!linkForce || !simulation) return

    const activeLinks = selectedPool === null
      ? allForceLinksRef.current
      : allForceLinksRef.current.filter((link) => (
        forceLinkEndpointId(link.source) === selectedPool || forceLinkEndpointId(link.target) === selectedPool
      ))

    linkForce.links(activeLinks)
    if (selectedPool === null || selectedRoutePools === null) {
      simulation
        .force('selection-x', null)
        .force('selection-y', null)
    } else {
      const targetByAddress = new Map(aggregate.nodes.map((node): [string, GraphPosition] => {
        const address = node.pool.pairAddress.toLowerCase()
        if (address === selectedPool) {
          return [address, { x: graphCenterX, y: graphCenterY }]
        }

        const initial = defaultPositions.get(address) ?? {
          x: graphCenterX,
          y: graphCenterY,
        }
        const distanceScale = selectedRoutePools.has(address) ? 0.6 : 1.08
        return [address, constrainToGraph({
          x: graphCenterX + (initial.x - graphCenterX) * distanceScale,
          y: graphCenterY + (initial.y - graphCenterY) * distanceScale,
        }, graphDimensions)]
      }))
      const selectionStrength = (node: ForceNode) => (
        selectedRoutePools.has(node.id) ? (node.id === selectedPool ? 0.035 : 0.02) : 0.052
      )

      simulation
        .force('selection-x', forceX<ForceNode>((node) => (
          targetByAddress.get(node.id)?.x ?? graphCenterX
        )).strength(selectionStrength))
        .force('selection-y', forceY<ForceNode>((node) => (
          targetByAddress.get(node.id)?.y ?? graphCenterY
        )).strength(selectionStrength))
    }

    if (resetReleaseTimeoutRef.current !== null) return

    simulation
      .alphaTarget(0)
      .alpha(Math.max(simulation.alpha(), selectedPool === null ? 0.5 : 0.42))
      .restart()
  }, [
    aggregate,
    defaultPositions,
    graphCenterX,
    graphCenterY,
    graphDimensions,
    selectedPool,
    selectedRoutePools,
  ])

  const resetLayout = useCallback(() => {
    setSelectedPool(null)
    setTooltip(null)

    const simulation = simulationRef.current
    if (!simulation) {
      setHasAdjustedLayout(false)
      return
    }
    const adjustmentVersion = layoutAdjustmentVersionRef.current
    if (resetReleaseTimeoutRef.current !== null) {
      globalThis.clearTimeout(resetReleaseTimeoutRef.current)
    }

    forceNodeByIdRef.current.forEach((node) => {
      node.fx = null
      node.fy = null
      node.vx = (node.vx ?? 0) * 0.25
      node.vy = (node.vy ?? 0) * 0.25
    })

    simulation
      .force('reset-x', forceX<ForceNode>((node) => (
        defaultPositions.get(node.id)?.x ?? graphCenterX
      )).strength(0.0065))
      .force('reset-y', forceY<ForceNode>((node) => (
        defaultPositions.get(node.id)?.y ?? graphCenterY
      )).strength(0.0065))
      .alphaTarget(0.035)
      .alpha(Math.max(simulation.alpha(), 0.38))
      .restart()

    resetReleaseTimeoutRef.current = globalThis.setTimeout(() => {
      if (simulationRef.current !== simulation) return
      simulation
        .force('reset-x', null)
        .force('reset-y', null)
        .alphaTarget(0)
        .alpha(Math.max(simulation.alpha(), 0.16))
        .restart()
      if (layoutAdjustmentVersionRef.current === adjustmentVersion) {
        setHasAdjustedLayout(false)
      }
      resetReleaseTimeoutRef.current = null
    }, 2400)
  }, [defaultPositions, graphCenterX, graphCenterY])

  const finishPoolDrag = useCallback((event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const forceNode = forceNodeByIdRef.current.get(drag.address)
    if (forceNode) {
      forceNode.fx = null
      forceNode.fy = null
    }
    const simulation = simulationRef.current
    simulation?.alphaTarget(0)
    if (drag.moved) {
      layoutAdjustmentVersionRef.current += 1
      ignoredClickRef.current = { address: drag.address, time: Date.now() }
      setHasAdjustedLayout(true)
      simulation?.alpha(Math.max(simulation.alpha(), 0.28)).restart()
    }
    dragRef.current = null
    setDraggingPool(null)
  }, [])

  const handlePoolPointerDown = useCallback((
    event: ReactPointerEvent<SVGGElement>,
    address: string,
    position: GraphPosition
  ) => {
    if (event.button !== 0) return
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const pointer = pointerToGraphPosition(svg, event.clientX, event.clientY)
    if (!pointer) return
    const forceNode = forceNodeByIdRef.current.get(address)
    if (forceNode) {
      forceNode.fx = position.x
      forceNode.fy = position.y
    }
    dragRef.current = {
      address,
      pointerId: event.pointerId,
      offsetX: position.x - pointer.x,
      offsetY: position.y - pointer.y,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setDraggingPool(address)
    setTooltip(null)
    event.preventDefault()
  }, [])

  const handlePoolPointerMove = useCallback((event: ReactPointerEvent<SVGGElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const svg = event.currentTarget.ownerSVGElement
    if (!svg) return
    const pointer = pointerToGraphPosition(svg, event.clientX, event.clientY)
    if (!pointer) return
    if (!drag.moved && Math.hypot(
      event.clientX - drag.startClientX,
      event.clientY - drag.startClientY
    ) < 3) return
    drag.moved = true
    const nextPosition = constrainToGraph({
      x: pointer.x + drag.offsetX,
      y: pointer.y + drag.offsetY,
    }, graphDimensions)
    const forceNode = forceNodeByIdRef.current.get(drag.address)
    if (forceNode) {
      forceNode.fx = nextPosition.x
      forceNode.fy = nextPosition.y
      forceNode.x = nextPosition.x
      forceNode.y = nextPosition.y
    }
    const simulation = simulationRef.current
    simulation?.alphaTarget(0.12).alpha(Math.max(simulation.alpha(), 0.34)).restart()
    setTooltip(null)
    event.preventDefault()
  }, [graphDimensions])

  const handlePoolKeyDown = useCallback((
    event: ReactKeyboardEvent<SVGGElement>,
    address: string,
    position: GraphPosition
  ) => {
    const direction = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    }[event.key]

    if (direction) {
      event.preventDefault()
      const distance = event.shiftKey ? 15 : 5
      const nextPosition = constrainToGraph({
        x: position.x + direction.x * distance,
        y: position.y + direction.y * distance,
      }, graphDimensions)
      const forceNode = forceNodeByIdRef.current.get(address)
      if (forceNode) {
        forceNode.x = nextPosition.x
        forceNode.y = nextPosition.y
        forceNode.vx = direction.x * 4
        forceNode.vy = direction.y * 4
      }
      setPositions((current) => new Map(current).set(address, nextPosition))
      layoutAdjustmentVersionRef.current += 1
      setHasAdjustedLayout(true)
      simulationRef.current?.alpha(0.34).restart()
      setSelectedPool(address)
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSelectedPool((current) => current === address ? null : address)
    } else if (event.key === 'Escape') {
      setSelectedPool(null)
    }
  }, [graphDimensions])

  const showTooltip = (
    event: ReactMouseEvent<SVGElement>,
    title: string,
    lines: string[],
    flows?: VolumeTooltip['flows']
  ) => {
    if (dragRef.current) return
    const tooltipHalfWidth = Math.min(120, Math.max(0, (globalThis.innerWidth - 24) / 2))
    const x = Math.min(
      globalThis.innerWidth - tooltipHalfWidth - 12,
      Math.max(tooltipHalfWidth + 12, event.clientX)
    )
    const y = Math.min(globalThis.innerHeight - 18, Math.max(18, event.clientY))
    setTooltip({ x, y, placeBelow: y < 130, title, lines, flows })
  }

  if (isLoading && !snapshot) {
    return <div className={styles.volumeLoading}><Activity size={17} /> Loading indexed on-chain routes…</div>
  }

  if (error && !snapshot) {
    return <div className={styles.liquidityPoolsError}>{error}</div>
  }

  if (!snapshot || !aggregate) return null

  const isResetAvailable = hasAdjustedLayout || selectedPool !== null

  return (
    <section className={styles.volumePanel} aria-label="Divine Manager route volume">
      <div ref={graphFrameRef} className={styles.volumeGraphFrame}>
        <div className={styles.volumeGraphControls}>
          <div className={styles.volumeGraphWindows} role="group" aria-label="Volume period">
            {WINDOWS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`${styles.volumeGraphControlButton}${window === item.id ? ` ${styles.volumeGraphControlButtonActive}` : ''}`}
                onClick={() => onWindowChange(item.id)}
                aria-pressed={window === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`${styles.volumeGraphResetButton} ${isResetAvailable ? styles.volumeGraphResetButtonVisible : styles.volumeGraphResetButtonHidden}`}
            onClick={resetLayout}
            disabled={!isResetAvailable}
            tabIndex={isResetAvailable ? 0 : -1}
            aria-hidden={!isResetAvailable}
            title="Reset network layout"
            aria-label="Reset network layout"
          >
            Reset
          </button>
        </div>
        <svg
          className={styles.volumeGraph}
          viewBox={`0 0 ${graphDimensions.width} ${graphDimensions.height}`}
          role="img"
          aria-label="Interactive network of manager-routed liquidity pools"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedPool(null)
          }}
        >
          {routeContext.renderedEdges.map((edge) => {
            const from = positions.get(edge.from) ?? defaultPositions.get(edge.from)
            const to = positions.get(edge.to) ?? defaultPositions.get(edge.to)
            if (!from || !to) return null
            const isConnected = selectedPool === null || edge.from === selectedPool || edge.to === selectedPool
            const routeMetric = routeContext.metrics.get(edge.id) ?? {
              share: 0,
              relativeStrength: 0,
              volumeWpls: 0,
            }
            const routeShareLabel = formatRouteShare(routeMetric.share)
            const routeVolumeLabel = `${compactWplsAmount(routeMetric.volumeWpls)} WPLS`
            const routeWidth = 0.65 + 2.15 * Math.sqrt(routeMetric.share)
            const routeOpacity = 0.18 + 0.82 * Math.pow(routeMetric.relativeStrength, 0.75)
            const routeRed = Math.round(148 + 61 * routeMetric.relativeStrength)
            const routeGreen = Math.round(104 + 60 * routeMetric.relativeStrength)
            const routeBlue = Math.round(230 + 25 * routeMetric.relativeStrength)
            const dashLength = 2 + 12 * routeMetric.relativeStrength
            const dashGap = 8 - 6 * routeMetric.relativeStrength
            const routeStyle: RouteVisualStyle = {
              '--route-width': `${routeWidth.toFixed(2)}px`,
              '--route-opacity': routeOpacity.toFixed(3),
              '--route-color': `rgb(${routeRed} ${routeGreen} ${routeBlue})`,
              '--route-dash': `${dashLength.toFixed(2)}px ${dashGap.toFixed(2)}px`,
              '--route-glow-radius': `${(0.8 + routeMetric.relativeStrength * 2.2).toFixed(2)}px`,
              '--route-glow-opacity': (0.04 + routeMetric.relativeStrength * 0.22).toFixed(3),
            }
            const fromNode = aggregate.nodes.find((node) => node.pool.pairAddress.toLowerCase() === edge.from)
            const toNode = aggregate.nodes.find((node) => node.pool.pairAddress.toLowerCase() === edge.to)
            const otherPool = edge.from === selectedPool ? edge.to : edge.from
            const edgeFlowRows = toTooltipFlows(edge.tokenFlows, aggregate.tokenByAddress)
            const routePath = routePathBetween(
              from,
              to,
              poolScaleByAddress.get(edge.from) ?? 1,
              poolScaleByAddress.get(edge.to) ?? 1,
              edge.id
            )
            return (
              <g
                key={edge.id}
                className={`${styles.volumeRouteGroup}${isConnected ? '' : ` ${styles.volumeRouteGroupOutsideSelection}`}${routeMetric.relativeStrength === 1 ? ` ${styles.volumeRouteGroupDominant}` : ''}`}
                style={routeStyle}
                role="button"
                tabIndex={isConnected ? 0 : -1}
                aria-hidden={!isConnected || undefined}
                aria-label={`Follow route between ${fromNode ? poolLabel(fromNode.pool) : 'pool'} and ${toNode ? poolLabel(toNode.pool) : 'pool'}, ${routeVolumeLabel}, ${routeShareLabel} of ${selectedPool ? "this pool's routed WPLS volume" : 'all routed WPLS volume'}`}
                onMouseEnter={(event) => showTooltip(
                  event,
                  `${fromNode ? poolLabel(fromNode.pool) : 'Pool'} ↔ ${toNode ? poolLabel(toNode.pool) : 'Pool'}`,
                  [
                    `${routeShareLabel} of ${selectedPool ? "this pool's routed WPLS volume" : 'all routed WPLS volume'}`,
                    `${routeVolumeLabel} routed volume`,
                    `${edge.executions} routed run${edge.executions === 1 ? '' : 's'}`,
                    'Click to follow this path',
                  ],
                  edgeFlowRows
                )}
                onMouseMove={(event) => showTooltip(
                  event,
                  `${fromNode ? poolLabel(fromNode.pool) : 'Pool'} ↔ ${toNode ? poolLabel(toNode.pool) : 'Pool'}`,
                  [
                    `${routeShareLabel} of ${selectedPool ? "this pool's routed WPLS volume" : 'all routed WPLS volume'}`,
                    `${routeVolumeLabel} routed volume`,
                    `${edge.executions} routed run${edge.executions === 1 ? '' : 's'}`,
                    'Click to follow this path',
                  ],
                  edgeFlowRows
                )}
                onMouseLeave={() => setTooltip(null)}
                onClick={() => setSelectedPool(otherPool)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedPool(otherPool)
                  }
                }}
              >
                <path d={routePath} className={styles.volumeRouteEdge} />
                <path d={routePath} className={styles.volumeRouteHitArea} />
              </g>
            )
          })}

          {aggregate.nodes.map((node) => {
            const address = node.pool.pairAddress.toLowerCase()
            const position = positions.get(address) ?? defaultPositions.get(address)
            if (!position) return null
            const isSelected = address === selectedPool
            const isOutsideSelection = selectedRoutePools !== null && !selectedRoutePools.has(address)
            const poolVisualStyle: PoolVisualStyle = {
              '--pool-scale': (poolScaleByAddress.get(address) ?? 1).toFixed(3),
            }
            const connectedRouteVolume = routedVolumeByPool.get(address) ?? 0
            const flowRows = toTooltipFlows(node.tokenFlows, aggregate.tokenByAddress)
            const token0Address = node.pool.token0.address.toLowerCase()
            const token1Address = node.pool.token1.address.toLowerCase()
            const token0Logo = tokenLogoByAddress.get(token0Address)
            const token1Logo = tokenLogoByAddress.get(token1Address)
            const token0ClipId = `volume-logo-${address.slice(2)}-0`
            const token1ClipId = `volume-logo-${address.slice(2)}-1`
            return (
              <g
                key={address}
                className={`${styles.volumePoolNode}${isSelected ? ` ${styles.volumePoolNodeSelected}` : ''}${node.swaps === 0 ? ` ${styles.volumePoolNodeQuiet}` : ''}${isOutsideSelection ? ` ${styles.volumePoolNodeOutsideSelection}` : ''}${draggingPool === address ? ` ${styles.volumePoolNodeDragging}` : ''}`}
                transform={`translate(${position.x} ${position.y})`}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                aria-label={`Show volume details for ${poolLabel(node.pool)}. Drag or use arrow keys to reposition.`}
                onPointerDown={(event) => handlePoolPointerDown(event, address, position)}
                onPointerMove={handlePoolPointerMove}
                onPointerUp={finishPoolDrag}
                onPointerCancel={finishPoolDrag}
                onLostPointerCapture={finishPoolDrag}
                onClick={() => {
                  const ignoredClick = ignoredClickRef.current
                  if (ignoredClick?.address === address && Date.now() - ignoredClick.time < 500) {
                    ignoredClickRef.current = null
                    return
                  }
                  setSelectedPool((current) => current === address ? null : address)
                }}
                onMouseEnter={(event) => showTooltip(
                  event,
                  poolLabel(node.pool),
                  [
                    `${compactWplsAmount(connectedRouteVolume)} WPLS connected route volume`,
                    `${compactWplsAmount(node.volumeWpls)} WPLS total pool volume`,
                    `${node.swaps} manager swap${node.swaps === 1 ? '' : 's'}`,
                    'Click to isolate connections',
                  ],
                  flowRows
                )}
                onMouseMove={(event) => showTooltip(
                  event,
                  poolLabel(node.pool),
                  [
                    `${compactWplsAmount(connectedRouteVolume)} WPLS connected route volume`,
                    `${compactWplsAmount(node.volumeWpls)} WPLS total pool volume`,
                    `${node.swaps} manager swap${node.swaps === 1 ? '' : 's'}`,
                    'Click to isolate connections',
                  ],
                  flowRows
                )}
                onMouseLeave={() => setTooltip(null)}
                onKeyDown={(event) => handlePoolKeyDown(event, address, position)}
              >
                <rect
                  x="-50"
                  y="-36"
                  width="100"
                  height="82"
                  rx="24"
                  className={styles.volumePoolNodeHitArea}
                />
                <g className={styles.volumePoolNodeVisual} style={poolVisualStyle}>
                  <defs>
                    <clipPath id={token0ClipId}><circle cx="-14" cy="-8" r="20" /></clipPath>
                    <clipPath id={token1ClipId}><circle cx="14" cy="-8" r="20" /></clipPath>
                  </defs>
                  {token1Logo ? <circle cx="14" cy="-8" r="22" className={styles.volumePoolLogoBase} /> : null}
                  {token1Logo ? (
                    <image
                      href={token1Logo}
                      x="-6"
                      y="-28"
                      width="40"
                      height="40"
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#${token1ClipId})`}
                      className={styles.volumePoolLogoImage}
                    />
                  ) : null}
                  {token0Logo ? <circle cx="-14" cy="-8" r="22" className={styles.volumePoolLogoBase} /> : null}
                  {token0Logo ? (
                    <image
                      href={token0Logo}
                      x="-34"
                      y="-28"
                      width="40"
                      height="40"
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#${token0ClipId})`}
                      className={styles.volumePoolLogoImage}
                    />
                  ) : null}
                  <text y="35" className={styles.volumePoolNodeLabel}>{poolLabel(node.pool)}</text>
                </g>
              </g>
            )
          })}
        </svg>

      </div>

      {tooltip && typeof document !== 'undefined' ? createPortal(
        <div
          className={`${styles.volumeTooltip}${tooltip.placeBelow ? ` ${styles.volumeTooltipBelow}` : ''}`}
          style={{ left: tooltip.x, top: tooltip.y }}
          role="tooltip"
        >
          <strong>{tooltip.title}</strong>
          {tooltip.lines.map((line) => <span key={line}>{line}</span>)}
          {tooltip.flows && tooltip.flows.length > 0 ? (
            <div className={styles.volumeTooltipFlows}>
              {tooltip.flows.map((flow) => (
                <div className={styles.volumeTooltipFlow} key={flow.symbol}>
                  <b>{flow.symbol}</b>
                  <span className={styles.volumeTooltipBought}>{flow.bought ?? '—'}</span>
                  <span className={styles.volumeTooltipSold}>{flow.sold ?? '—'}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>,
        document.body
      ) : null}
    </section>
  )
}
