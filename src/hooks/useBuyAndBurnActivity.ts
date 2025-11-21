import { useCallback, useState } from 'react'

export interface BuyAndBurnExecution {
  transactionHash: string
  briahBurned: bigint
  jitSpent: bigint
  timestamp: number
  blockNumber: number
  caller: `0x${string}`
}

interface LogEntry {
  data: string
  blockNumber: string
  timeStamp?: string
  transactionHash: string
  topics: string[]
}

const BUY_AND_BURN_CONTRACT = '0x7DA770d10B6a62Fc9DC5A9682bDF2849d2b617d4' as const
const BRIAH_TOKEN = '0xA80736067abDc215a3b6B66a57c6e608654d0C9a' as const
const BUY_AND_BURN_TOPIC =
  '0x0a4fc48e069d97912d8588b922b3e22d211ac9956159b80beaa63987c0a32672' as const
const LOGS_ENDPOINT = `https://api.scan.pulsechain.com/api?module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${BUY_AND_BURN_CONTRACT}&topic0=${BUY_AND_BURN_TOPIC}&sort=desc&page=1&offset=10`
const DEXSCREENER_ENDPOINT = `https://api.dexscreener.com/latest/dex/tokens/${BRIAH_TOKEN}`

const parseHexValue = (value?: string) => {
  if (!value) return 0
  if (value.startsWith('0x')) {
    return parseInt(value, 16)
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const decodeBuyAndBurnLog = (log: LogEntry): BuyAndBurnExecution | null => {
  if (!log.data) return null
  const payload = log.data.startsWith('0x') ? log.data.slice(2) : log.data
  if (payload.length < 128) return null

  const jitSpent = BigInt(`0x${payload.slice(0, 64)}`)
  const briahBurned = BigInt(`0x${payload.slice(64, 128)}`)
  const callerTopic = log.topics?.[1]
  if (!callerTopic || callerTopic.length < 42) return null
  const caller = `0x${callerTopic.slice(-40)}` as `0x${string}`

  const timestamp = parseHexValue(log.timeStamp) * 1000 || Date.now()
  const blockNumber = parseHexValue(log.blockNumber)

  return {
    transactionHash: log.transactionHash,
    briahBurned,
    jitSpent,
    timestamp,
    blockNumber,
    caller,
  }
}

export const useBuyAndBurnActivity = () => {
  const [executions, setExecutions] = useState<BuyAndBurnExecution[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)
  const [briahUsdPrice, setBriahUsdPrice] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const logsResponse = await fetch(LOGS_ENDPOINT)
      if (!logsResponse.ok) {
        throw new Error('Unable to load burn activity')
      }
      const logsJson = await logsResponse.json()
      if (logsJson.status === '0' && logsJson.message !== 'No logs found') {
        throw new Error(logsJson.message || 'Failed to load burn logs')
      }

      const parsedLogs: BuyAndBurnExecution[] =
        Array.isArray(logsJson.result)
          ? logsJson.result
              .map((log: LogEntry) => decodeBuyAndBurnLog(log))
              .filter((entry): entry is BuyAndBurnExecution => Boolean(entry))
          : []

      setExecutions(parsedLogs)

      const priceResponse = await fetch(DEXSCREENER_ENDPOINT)
      if (priceResponse.ok) {
        const priceJson = await priceResponse.json()
        const price = priceJson?.pairs?.find((pair: { priceUsd?: string }) => pair?.priceUsd)?.priceUsd
        const parsedPrice = price ? Number(price) : null
        if (parsedPrice && Number.isFinite(parsedPrice)) {
          setBriahUsdPrice(parsedPrice)
        }
      }

      setLastUpdated(Date.now())
    } catch (fetchError) {
      const message = fetchError instanceof Error ? fetchError.message : 'Failed to load burn activity'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    executions,
    isLoading,
    error,
    refresh: fetchData,
    lastUpdated,
    briahUsdPrice,
  }
}
