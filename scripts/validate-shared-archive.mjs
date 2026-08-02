import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const manifestUrl = process.env.SHARED_ARCHIVE_MANIFEST_URL
if (!manifestUrl) throw new Error('SHARED_ARCHIVE_MANIFEST_URL is required')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const readJson = async (name) => JSON.parse(await readFile(path.join(root, 'public', name), 'utf8'))
const getJson = async (url) => {
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`${url} returned ${response.status}`)
  return response.json()
}
const resolve = (reference) => new URL(`/${String(reference).replace(/^\/+/, '')}`, new URL(manifestUrl).origin).toString()
const eventKey = (item) => typeof item?.transactionHash === 'string' ? item.transactionHash.toLowerCase() : null
const uniqueEvents = (items) => new Map(items.flatMap((item) => {
  const key = eventKey(item)
  return key ? [[key, item]] : []
}))
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const manifest = await getJson(manifestUrl)
assert(manifest?.schemaVersion === 2, 'Manifest schemaVersion must be 2')
assert(manifest?.chainId === 369, 'Manifest chainId must be 369')
assert(Date.now() - Date.parse(manifest.generatedAt) < 2 * 60 * 60 * 1000, 'Manifest is older than two hours')

const loadArchive = async (resource) => {
  const descriptor = manifest.archives?.[resource]
  assert(descriptor, `Manifest lacks ${resource}`)
  const [base, ...chunks] = await Promise.all([
    ...(descriptor.base ? [getJson(resolve(descriptor.base))] : []),
    ...(descriptor.chunks ?? []).map((key) => getJson(resolve(key))),
    ...(descriptor.openChunk ? [getJson(resolve(descriptor.openChunk))] : []),
  ])
  for (const chunk of chunks) {
    assert(chunk?.schemaVersion === 2 && chunk.resource === resource && Array.isArray(chunk.items), `Invalid ${resource} chunk`)
  }
  return { base: base ?? null, chunks }
}

const [expectedManager, expectedBurns, expectedPools, expectedVolume, expectedJit] = await Promise.all([
  readJson('divine-manager-feed.json'),
  readJson('buy-and-burn-feed.json'),
  readJson('divine-manager-pools.json'),
  readJson('divine-manager-volume.json'),
  readJson('effective-burn-stats.json'),
])
const [manager, burns, volume, currentPools, currentJit] = await Promise.all([
  loadArchive('divineManager'),
  loadArchive('buyAndBurn'),
  loadArchive('managerVolume'),
  getJson(resolve(manifest.current?.managerPools)),
  getJson(resolve(manifest.current?.effectiveBurn)),
])

const managerEvents = uniqueEvents([...(manager.base?.items ?? []), ...manager.chunks.flatMap((chunk) => chunk.items)])
for (const item of expectedManager.items ?? []) assert(managerEvents.has(eventKey(item)), `Missing manager event ${item.transactionHash}`)

const burnEvents = new Map()
for (const [feedKey, feed] of Object.entries(burns.base?.feeds ?? {})) {
  for (const item of feed.items ?? []) {
    const hash = eventKey(item)
    if (hash) burnEvents.set(`${feedKey}:${hash}`, item)
  }
}
for (const item of burns.chunks.flatMap((chunk) => chunk.items)) {
  const key = item?.feedKey && eventKey(item) ? `${item.feedKey}:${eventKey(item)}` : null
  if (key) burnEvents.set(key, item)
}
for (const [feedKey, feed] of Object.entries(expectedBurns.feeds ?? {})) {
  for (const item of feed.items ?? []) assert(burnEvents.has(`${feedKey}:${eventKey(item)}`), `Missing ${feedKey} burn ${item.transactionHash}`)
}

const volumeEvents = uniqueEvents([...(volume.base?.executions ?? []), ...volume.chunks.flatMap((chunk) => chunk.items)])
for (const item of expectedVolume.executions ?? []) assert(volumeEvents.has(eventKey(item)), `Missing manager-volume event ${item.transactionHash}`)

const currentPoolAddresses = new Set((currentPools?.items ?? []).map((pool) => String(pool.pairAddress).toLowerCase()))
for (const pool of expectedPools.items ?? []) assert(currentPoolAddresses.has(String(pool.pairAddress).toLowerCase()), `Missing pool ${pool.pairAddress}`)
assert((currentPools?.items ?? []).every((pool) => /^\d+$/.test(String(pool.reserve0)) && /^\d+$/.test(String(pool.reserve1))), 'Pool reserves are invalid')
for (const key of ['current', 'delta24h', 'delta7d', 'delta30d']) {
  assert(/^\d+$/.test(String(currentJit?.[key])), `Invalid JIT ${key}`)
  assert(/^\d+$/.test(String(expectedJit?.[key])), `Invalid current GitHub JIT ${key}`)
  assert(String(currentJit[key]) === String(expectedJit[key]), `JIT ${key} differs from the GitHub archive`)
}

console.log(JSON.stringify({
  manifestGeneratedAt: manifest.generatedAt,
  managerEvents: managerEvents.size,
  partnerBurnEvents: burnEvents.size,
  managerVolumeEvents: volumeEvents.size,
  pools: currentPoolAddresses.size,
  jitCurrent: currentJit.current,
}, null, 2))
