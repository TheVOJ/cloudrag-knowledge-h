import { runtime } from './runtime/manager'
import { QueryIntent, RetrievalStrategy } from './agentic-router'

export type UnifiedQueryMethod = 'standard' | 'azure' | 'agentic'

export interface UnifiedQueryRecord {
  id: string
  timestamp: number
  knowledgeBaseId: string
  conversationId?: string
  query: string
  response: string
  sources: string[]
  method: UnifiedQueryMethod
  intent?: QueryIntent
  strategy?: RetrievalStrategy
  confidence?: number
  iterations?: number
  timeMs?: number
  needsImprovement?: boolean
  retrievalMethod?: string
  documentsRetrieved?: number
  retrievalBackend?: 'azure' | 'local'
  userFeedback?: 'positive' | 'negative' | 'neutral'
}

type HistoryFilter = {
  knowledgeBaseId?: string
  method?: UnifiedQueryMethod
  startDate?: number
  endDate?: number
}

export class UnifiedQueryTracker {
  private static STORAGE_KEY = 'unified-query-history'

  async recordQuery(record: UnifiedQueryRecord): Promise<void> {
    const history = await this.getHistory()
    history.push(record)

    // keep recent 2000 entries
    if (history.length > 2000) {
      history.splice(0, history.length - 2000)
    }

    await runtime.kv.set(UnifiedQueryTracker.STORAGE_KEY, history)
  }

  async getHistory(filter: HistoryFilter = {}): Promise<UnifiedQueryRecord[]> {
    const history = await runtime.kv.get<UnifiedQueryRecord[]>(UnifiedQueryTracker.STORAGE_KEY) || []
    return history.filter(h => {
      if (filter.knowledgeBaseId && h.knowledgeBaseId !== filter.knowledgeBaseId) return false
      if (filter.method && h.method !== filter.method) return false
      if (filter.startDate && h.timestamp < filter.startDate) return false
      if (filter.endDate && h.timestamp > filter.endDate) return false
      return true
    })
  }

  async getAnalytics(knowledgeBaseId?: string) {
    const history = await this.getHistory({ knowledgeBaseId })
    const totalQueries = history.length

    const methodBreakdown: Record<UnifiedQueryMethod, number> = {
      standard: 0,
      azure: 0,
      agentic: 0
    }

    let totalConfidence = 0
    let totalIterations = 0
    let totalTime = 0
    let confidenceCount = 0
    let iterationCount = 0
    let timeCount = 0

    const feedbackBreakdown = { positive: 0, neutral: 0, negative: 0 }

    history.forEach(h => {
      methodBreakdown[h.method] = (methodBreakdown[h.method] || 0) + 1 as number
      if (typeof h.confidence === 'number') {
        totalConfidence += h.confidence
        confidenceCount++
      }
      if (typeof h.iterations === 'number') {
        totalIterations += h.iterations
        iterationCount++
      }
      if (typeof h.timeMs === 'number') {
        totalTime += h.timeMs
        timeCount++
      }
      if (h.userFeedback) {
        feedbackBreakdown[h.userFeedback]++
      }
    })

    const successRate = totalQueries === 0 ? 0 : ((feedbackBreakdown.positive || 0) / totalQueries) * 100

    return {
      totalQueries,
      methodBreakdown,
      agenticMetrics: {
        averageConfidence: confidenceCount ? totalConfidence / confidenceCount : 0,
        averageIterations: iterationCount ? totalIterations / iterationCount : 0,
        averageTimeMs: timeCount ? totalTime / timeCount : 0
      },
      feedbackBreakdown,
      successRate
    }
  }

  async recordUserFeedback(queryId: string, feedback: 'positive' | 'negative' | 'neutral'): Promise<void> {
    const history = await this.getHistory()
    const record = history.find(h => h.id === queryId)
    if (record) {
      record.userFeedback = feedback
      await runtime.kv.set(UnifiedQueryTracker.STORAGE_KEY, history)
    }
  }

  async clearHistory() {
    await runtime.kv.delete(UnifiedQueryTracker.STORAGE_KEY)
  }
}
