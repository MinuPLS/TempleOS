export type ArchiveName = 'divineManager' | 'feeder' | 'buyAndBurn' | 'managerVolume'
export type CurrentSnapshotName = 'managerPools' | 'effectiveBurn'

export type ArchiveResource = {
  base: string | null
  chunks: string[]
  openChunk?: string | null
  indexedThroughBlock?: string
}

export type DataManifestV2 = {
  schemaVersion: 2
  generatedAt: string
  chainId: 369
  indexedThroughBlock: string
  archives: Record<ArchiveName, ArchiveResource>
  current: Record<CurrentSnapshotName, string>
}

export type ArchiveChunkV2<T = unknown> = {
  schemaVersion: 2
  resource: ArchiveName
  fromBlock: string
  throughBlock: string
  generatedAt: string
  items: T[]
}

type CacheStorageLike = {
  match: (request: RequestInfo | URL) => Promise<Response | undefined>
  put: (request: RequestInfo | URL, response: Response) => Promise<void>
}

const CACHE_NAME = 'templeos-shared-archive-v2'
const manifestUrl = import.meta.env.VITE_DATA_MANIFEST_URL?.trim()

const getCache = async (): Promise<CacheStorageLike | null> => {
  if (typeof window === 'undefined' || !('caches' in window)) return null
  return window.caches.open(CACHE_NAME)
}

const isArchiveName = (value: string): value is ArchiveName =>
  value === 'divineManager' || value === 'feeder' || value === 'buyAndBurn' || value === 'managerVolume'

const isCurrentSnapshotName = (value: string): value is CurrentSnapshotName =>
  value === 'managerPools' || value === 'effectiveBurn'

const assertManifest = (value: unknown): DataManifestV2 => {
  if (!value || typeof value !== 'object') throw new Error('Shared archive manifest is invalid')
  const manifest = value as Partial<DataManifestV2>
  if (
    manifest.schemaVersion !== 2 ||
    manifest.chainId !== 369 ||
    typeof manifest.generatedAt !== 'string' ||
    typeof manifest.indexedThroughBlock !== 'string' ||
    !manifest.archives ||
    !manifest.current
  ) {
    throw new Error('Shared archive manifest has an unsupported schema')
  }
  for (const resource of Object.keys(manifest.archives)) {
    if (!isArchiveName(resource)) throw new Error(`Shared archive manifest has unknown resource ${resource}`)
  }
  for (const snapshot of Object.keys(manifest.current)) {
    if (!isCurrentSnapshotName(snapshot)) throw new Error(`Shared archive manifest has unknown snapshot ${snapshot}`)
  }
  return manifest as DataManifestV2
}

const assertChunk = <T>(value: unknown, resource: ArchiveName): ArchiveChunkV2<T> => {
  if (!value || typeof value !== 'object') throw new Error(`Shared ${resource} chunk is invalid`)
  const chunk = value as Partial<ArchiveChunkV2<T>>
  if (
    chunk.schemaVersion !== 2 ||
    chunk.resource !== resource ||
    !Array.isArray(chunk.items) ||
    typeof chunk.fromBlock !== 'string' ||
    typeof chunk.throughBlock !== 'string'
  ) {
    throw new Error(`Shared ${resource} chunk has an unsupported schema`)
  }
  return chunk as ArchiveChunkV2<T>
}

export class SharedArchiveClient {
  readonly manifestUrl: string

  constructor(url = manifestUrl) {
    if (!url) throw new Error('VITE_DATA_MANIFEST_URL must point to the public R2 manifest')
    this.manifestUrl = url
  }

  private resolve(reference: string) {
    // The manifest itself is configured as an absolute public URL, whereas
    // manifest entries are R2 object keys. Only turn the latter into paths.
    if (/^https?:\/\//i.test(reference)) return reference
    // Manifest references are R2 object keys (for example `v2/base/...`), not
    // paths relative to `/v2/manifest.json`.
    return new URL(`/${reference.replace(/^\/+/, '')}`, new URL(this.manifestUrl).origin).toString()
  }

  private async fetchJson<T>(reference: string, immutable: boolean): Promise<T> {
    const url = this.resolve(reference)
    const cache = immutable ? await getCache() : null
    const cached = cache ? await cache.match(url) : undefined
    if (cached) return cached.json() as Promise<T>

    // `no-cache` revalidates the manifest without bypassing Cloudflare's edge
    // cache. Versioned objects use the normal HTTP cache and Cache Storage.
    const response = await fetch(url, { cache: immutable ? 'default' : 'no-cache' })
    if (!response.ok) throw new Error(`Shared archive request failed (${response.status})`)
    if (cache) await cache.put(url, response.clone())
    return response.json() as Promise<T>
  }

  async loadManifest(): Promise<DataManifestV2> {
    return assertManifest(await this.fetchJson<unknown>(this.manifestUrl, false))
  }

  async loadArchive<T>(resource: ArchiveName) {
    const manifest = await this.loadManifest()
    const descriptor = manifest.archives[resource]
    if (!descriptor) throw new Error(`Shared archive manifest is missing ${resource}`)
    const references = [
      ...(descriptor.base ? [descriptor.base] : []),
      ...(descriptor.chunks ?? []),
      ...(descriptor.openChunk ? [descriptor.openChunk] : []),
    ]
    const payloads = await Promise.all(
      references.map(async (reference, index) => {
        const payload = await this.fetchJson<unknown>(reference, true)
        return index === 0 && descriptor.base ? payload as T : assertChunk<T>(payload, resource)
      })
    )
    const base = descriptor.base ? (payloads.shift() as T) : null
    return { manifest, base, chunks: payloads as ArchiveChunkV2<T>[] }
  }

  async loadCurrent<T>(name: CurrentSnapshotName) {
    const manifest = await this.loadManifest()
    const reference = manifest.current[name]
    if (!reference) throw new Error(`Shared archive manifest is missing ${name}`)
    return { manifest, value: await this.fetchJson<T>(reference, true) }
  }
}

let client: SharedArchiveClient | null = null

export const getSharedArchiveClient = () => {
  client ??= new SharedArchiveClient()
  return client
}

type RecordWithTransactionHash = { transactionHash?: unknown; blockNumber?: unknown; timestamp?: unknown }

const newestFirst = <T extends RecordWithTransactionHash>(items: T[]) =>
  [...items].sort((left, right) => {
    const blockDifference = Number(BigInt(String(right.blockNumber ?? 0)) - BigInt(String(left.blockNumber ?? 0)))
    return blockDifference || Number(right.timestamp ?? 0) - Number(left.timestamp ?? 0)
  })

export const mergeItemsByTransactionHash = <T extends RecordWithTransactionHash>(
  base: T[],
  chunks: ArchiveChunkV2<T>[]
) => {
  const merged = new Map<string, T>()
  for (const item of [...base, ...chunks.flatMap((chunk) => chunk.items)]) {
    const key = typeof item.transactionHash === 'string' ? item.transactionHash.toLowerCase() : null
    if (key) merged.set(key, item)
  }
  return newestFirst([...merged.values()])
}
