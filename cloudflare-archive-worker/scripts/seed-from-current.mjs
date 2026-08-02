import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const workerUrl = process.env.ARCHIVE_PUBLISHER_URL?.replace(/\/$/, '')
const token = process.env.PUBLISH_TOKEN
if (!workerUrl || !token) throw new Error('ARCHIVE_PUBLISHER_URL and PUBLISH_TOKEN are required')

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const frontendDirectory = path.resolve(scriptDirectory, '../..')
const snapshotRef = process.env.ARCHIVE_SNAPSHOT_REF?.trim()
const executeFile = promisify(execFile)
const overrides = {
  'divine-manager-pools.json': process.env.ARCHIVE_MANAGER_POOLS_PATH,
  'divine-manager-volume.json': process.env.ARCHIVE_MANAGER_VOLUME_PATH,
}
const readJson = async (name) => {
  if (overrides[name]) return JSON.parse(await readFile(path.resolve(overrides[name]), 'utf8'))
  if (!snapshotRef) return JSON.parse(await readFile(path.join(frontendDirectory, 'public', name), 'utf8'))
  const { stdout } = await executeFile('git', ['show', `${snapshotRef}:public/${name}`], { cwd: frontendDirectory, maxBuffer: 20 * 1024 * 1024 })
  return JSON.parse(stdout)
}

const [divineManagerFeed, buyAndBurnFeed, managerPools, managerVolume, effectiveBurn] = await Promise.all([
  readJson('divine-manager-feed.json'),
  readJson('buy-and-burn-feed.json'),
  readJson('divine-manager-pools.json'),
  readJson('divine-manager-volume.json'),
  readJson('effective-burn-stats.json'),
])

const cutover = String(divineManagerFeed.indexedThroughBlock)
const feederFeed = { indexedThroughBlock: cutover, items: [] }
const response = await fetch(`${workerUrl}/archive/admin/seed`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    snapshots: { divineManagerFeed, feederFeed, buyAndBurnFeed, managerPools, managerVolume, effectiveBurn },
    cutovers: {
      divineManager: cutover,
      feeder: cutover,
      buyAndBurn: String(buyAndBurnFeed.indexedThroughBlock),
      managerVolume: String(managerVolume.sourceIndexedThroughBlock),
    },
  }),
})
if (!response.ok) throw new Error(`Seed failed (${response.status}): ${await response.text()}`)
await response.json()

const publication = await fetch(`${workerUrl}/archive/admin/publish`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}` },
})
if (!publication.ok) throw new Error(`Initial publication failed (${publication.status}): ${await publication.text()}`)
console.log(JSON.stringify(await publication.json(), null, 2))
