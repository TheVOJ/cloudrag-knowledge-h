import { beforeEach, describe, expect, test } from 'vitest'
import { UnifiedQueryTracker } from '../unified-query-model'
import { MockRuntimeAdapter } from '../runtime/mock-adapter'
import { runtime } from '../runtime/manager'

runtime.setRuntime(MockRuntimeAdapter.create())

describe('UnifiedQueryTracker analytics', () => {
  const tracker = new UnifiedQueryTracker()

  beforeEach(() => {
    const mock = (runtime as any).kv as MockRuntimeAdapter['kv']
    if (mock.clear) mock.clear()
  })

  test('computes method breakdown and success rate', async () => {
    const now = Date.now()

    await tracker.recordQuery({
      id: '1',
      timestamp: now,
      knowledgeBaseId: 'kb-analytics',
      query: 'standard query',
      response: 'resp',
      sources: [],
      method: 'standard',
      userFeedback: 'positive'
    })

    await tracker.recordQuery({
      id: '2',
      timestamp: now + 1,
      knowledgeBaseId: 'kb-analytics',
      query: 'azure query',
      response: 'resp',
      sources: [],
      method: 'azure',
      userFeedback: 'negative'
    })

    await tracker.recordQuery({
      id: '3',
      timestamp: now + 2,
      knowledgeBaseId: 'kb-analytics',
      query: 'agentic query',
      response: 'resp',
      sources: [],
      method: 'agentic',
      userFeedback: 'positive'
    })

    const analytics = await tracker.getAnalytics('kb-analytics')

    expect(analytics.methodBreakdown).toEqual({
      standard: 1,
      azure: 1,
      agentic: 1
    })
    expect(analytics.successRate).toBeCloseTo((2 / 3) * 100)
  })
})
