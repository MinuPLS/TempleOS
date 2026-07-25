import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const feedUrl = process.env.DIVINE_MANAGER_FEED_URL || 'https://divine-manager-feed.info-megainu.workers.dev'
const outputPath = path.resolve('public/divine-manager-feed.json')
const pageSize = 100

const getJson = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.json()
}

const statusUrl = new URL('/divine-manager/status', feedUrl)
const status = await getJson(statusUrl)
if (!status.historicalComplete || !/^\d+$/.test(String(status.lastBlock || ''))) {
  throw new Error('Divine Manager index is not ready for a static snapshot')
}

const items = []
let cursor = null
do {
  const activityUrl = new URL('/divine-manager/activity', feedUrl)
  activityUrl.searchParams.set('limit', String(pageSize))
  if (cursor) activityUrl.searchParams.set('cursor', cursor)
  const page = await getJson(activityUrl)
  if (!Array.isArray(page.items)) throw new Error('Divine Manager activity response is invalid')
  items.push(...page.items)
  cursor = typeof page.nextCursor === 'string' ? page.nextCursor : null
} while (cursor)

const snapshot = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  indexedThroughBlock: String(status.lastBlock),
  historicalComplete: true,
  items,
}

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(snapshot)}\n`)
console.log(`Wrote ${items.length} Divine Manager executions through block ${status.lastBlock}`)
