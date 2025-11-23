import { describe, expect, test, beforeEach, vi } from 'vitest'
import { ChunkManager } from '../chunk-manager'
import { RetrievalExecutor } from '../retrieval-executor'
import { MockRuntimeAdapter } from '../runtime/mock-adapter'
import { runtime } from '../runtime/manager'
import { Document } from '../types'
import { AzureSearchService } from '../azure-search'

runtime.setRuntime(MockRuntimeAdapter.create())

describe('Chunk-based retrieval', () => {
  const chunkManager = new ChunkManager()
  const knowledgeBaseId = 'kb-test'
  let docs: Document[]

  beforeEach(async () => {
    // Clear storage between runs
    const mock = (runtime as any).kv as MockRuntimeAdapter['kv']
    if (mock.clear) mock.clear()
    vi.restoreAllMocks()

    docs = [
      {
        id: 'doc-1',
        title: 'Alpha Guide',
        content: 'Alpha content about testing chunk retrieval.',
        sourceType: 'markdown',
        sourceUrl: 'local',
        addedAt: Date.now(),
        knowledgeBaseId,
        metadata: {},
        chunkStrategy: 'sentence'
      },
      {
        id: 'doc-2',
        title: 'Beta Manual',
        content: 'Beta content with other data.',
        sourceType: 'markdown',
        sourceUrl: 'local',
        addedAt: Date.now(),
        knowledgeBaseId,
        metadata: {},
        chunkStrategy: 'sentence'
      }
    ]

    for (const doc of docs) {
      await chunkManager.chunkDocument(
        doc.id,
        knowledgeBaseId,
        doc.title,
        doc.content,
        doc.sourceType,
        doc.sourceUrl,
        doc.chunkStrategy || 'semantic'
      )
    }
  })

  test('semantic retrieval uses chunk store when knowledge base id provided', async () => {
    const executor = new RetrievalExecutor(undefined, undefined, undefined, knowledgeBaseId)
    const result = await executor.executeRetrieval('Alpha testing', docs, 'semantic', 2)

    expect(result.metadata?.chunkBased).toBe(true)
    expect(result.documents.some(doc => doc.title === 'Alpha Guide')).toBe(true)
  })

  test('hybrid retrieval falls back to chunks when Azure fails', async () => {
    const executor = new RetrievalExecutor('https://example.search.windows.net', 'fake-key', 'idx', knowledgeBaseId)
    vi.spyOn(AzureSearchService.prototype, 'search').mockRejectedValue(new Error('network down'))

    const result = await executor.executeRetrieval('Alpha topic', docs, 'hybrid', 2)

    expect(result.metadata?.chunkBased).toBe(true)
    expect(result.metadata?.fallbackReason).toBeDefined()
  })
})
