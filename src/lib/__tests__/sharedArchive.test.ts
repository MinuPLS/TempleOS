import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SharedArchiveClient,
  mergeItemsByTransactionHash,
  type DataManifestV2,
} from '../sharedArchive'

const manifest: DataManifestV2 = {
  schemaVersion: 2,
  generatedAt: '2026-08-02T20:00:00Z',
  chainId: 369,
  indexedThroughBlock: '27188489',
  archives: {
    divineManager: { base: 'v2/base/divine.json', chunks: ['v2/chunks/divine-1.json'], openChunk: null },
    feeder: { base: null, chunks: [], openChunk: null },
    buyAndBurn: { base: 'v2/base/burn.json', chunks: [], openChunk: null },
    managerVolume: { base: 'v2/base/volume.json', chunks: [], openChunk: null },
  },
  current: {
    managerPools: 'v2/current/pools.json',
    effectiveBurn: 'v2/current/burn.json',
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('SharedArchiveClient', () => {
  it('loads a V1 base and only the manifest-referenced V2 chunks', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/manifest.json')
        ? manifest
        : url.endsWith('/divine.json')
          ? { items: [{ transactionHash: '0xold', blockNumber: '1', timestamp: 1 }] }
          : {
              schemaVersion: 2,
              resource: 'divineManager',
              fromBlock: '2',
              throughBlock: '2',
              generatedAt: manifest.generatedAt,
              items: [{ transactionHash: '0xnew', blockNumber: '2', timestamp: 2 }],
            }
      return new Response(JSON.stringify(body), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new SharedArchiveClient('https://data.example/v2/manifest.json')
    const archive = await client.loadArchive<{ items: Array<{ transactionHash: string; blockNumber: string; timestamp: number }> }>('divineManager')

    expect(archive.base?.items).toHaveLength(1)
    expect(archive.chunks).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain('https://data.example/v2/manifest.json')
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain('https://data.example/v2/base/divine.json')
  })

  it('deduplicates a reorg-overlap record in favor of the published chunk', () => {
    const items = mergeItemsByTransactionHash(
      [{ transactionHash: '0xduplicate', blockNumber: '1', timestamp: 1 }],
      [{
        schemaVersion: 2,
        resource: 'divineManager',
        fromBlock: '2',
        throughBlock: '2',
        generatedAt: manifest.generatedAt,
        items: [
          { transactionHash: '0xduplicate', blockNumber: '2', timestamp: 2 },
          { transactionHash: '0xnew', blockNumber: '3', timestamp: 3 },
        ],
      }]
    )

    expect(items).toEqual([
      { transactionHash: '0xnew', blockNumber: '3', timestamp: 3 },
      { transactionHash: '0xduplicate', blockNumber: '2', timestamp: 2 },
    ])
  })

  it('reuses immutable objects when the manifest has not changed', async () => {
    const objects = new Map<string, Response>()
    vi.stubGlobal('window', {
      caches: {
        open: vi.fn(async () => ({
          match: async (request: RequestInfo | URL) => objects.get(String(request)),
          put: async (request: RequestInfo | URL, response: Response) => objects.set(String(request), response),
        })),
      },
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/manifest.json')
        ? manifest
        : url.endsWith('/divine.json')
          ? { items: [] }
          : { schemaVersion: 2, resource: 'divineManager', fromBlock: '1', throughBlock: '1', items: [] }
      return new Response(JSON.stringify(body), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const client = new SharedArchiveClient('https://data.example/manifest.json')
    await client.loadArchive('divineManager')
    await client.loadArchive('divineManager')

    // The manifest is intentionally revalidated; its immutable references are
    // fetched only on the first pass.
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('surfaces a missing manifest-referenced chunk', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/manifest.json')) return new Response(JSON.stringify(manifest), { status: 200 })
      if (url.endsWith('/divine.json')) return new Response(JSON.stringify({ items: [] }), { status: 200 })
      return new Response('Not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(new SharedArchiveClient('https://data.example/manifest.json').loadArchive('divineManager'))
      .rejects.toThrow('Shared archive request failed (404)')
  })

  it('rejects a chunk from the wrong archive resource', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/manifest.json')
        ? manifest
        : url.endsWith('/divine.json')
          ? { items: [] }
          : { schemaVersion: 2, resource: 'buyAndBurn', fromBlock: '1', throughBlock: '1', items: [] }
      return new Response(JSON.stringify(body), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(new SharedArchiveClient('https://data.example/manifest.json').loadArchive('divineManager'))
      .rejects.toThrow('Shared divineManager chunk has an unsupported schema')
  })
})
