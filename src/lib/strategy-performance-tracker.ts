import { QueryIntent, RetrievalStrategy, RoutingDecision } from './agentic-router'
import { AgenticRAGResponse } from './agentic-rag-orchestrator'

export type StrategyPerformanceMetrics = {
  strategyId: string
  intent: QueryIntent
  strategy: RetrievalStrategy
  totalQueries: number
  successfulQueries: number
  averageConfidence: number
  averageRetrievalTime: number
  averageIterations: number
  successRate: number
  lastUsed: number
  improvementTrend: number
}

export type QueryPerformanceRecord = {
  id: string
  timestamp: number
  query: string
  intent: QueryIntent
  strategy: RetrievalStrategy
  confidence: number
  iterations: number
  timeMs: number
  needsImprovement: boolean
  userFeedback?: 'positive' | 'negative' | 'neutral'
  retrievalMethod: string
  documentsRetrieved: number
}

export type StrategyRecommendation = {
  recommendedStrategy: RetrievalStrategy
  confidence: number
  reasoning: string
  alternativeStrategies: Array<{
    strategy: RetrievalStrategy
    score: number
    reason: string
  }>
  basedOnHistoricalData: boolean
  similarQueriesAnalyzed: number
}

export type LearningInsight = {
  id: string
  type: 'strategy_performance' | 'intent_pattern' | 'failure_mode' | 'optimization_opportunity'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  actionable: boolean
  suggestedAction?: string
  supportingData: {
    queriesAnalyzed: number
    timeRange: string
    keyMetrics: Record<string, number>
  }
  timestamp: number
}

/**
 * Tracks and analyzes the performance of retrieval strategies to optimize future queries.
 * 
 * This class implements a learning system that:
 * 1. Records metrics for every query (success rate, confidence, latency)
 * 2. Aggregates data by Intent and Strategy
 * 3. Provides data-driven recommendations for Strategy Selection
 * 4. Generates actionable insights (e.g., "Strategy X performs poorly for Intent Y")
 * 
 * It uses Spark KV storage to persist performance history and insights.
 */
export class StrategyPerformanceTracker {
  private static STORAGE_KEY = 'strategy-performance-data'
  private static QUERY_HISTORY_KEY = 'query-performance-history'
  private static INSIGHTS_KEY = 'learning-insights'
  
  async recordQueryPerformance(
    query: string,
    response: AgenticRAGResponse
  ): Promise<void> {
    const record: QueryPerformanceRecord = {
      id: this.generateId(),
      timestamp: Date.now(),
      query,
      intent: response.routing.intent,
      strategy: response.routing.strategy,
      confidence: response.evaluation.confidence,
      iterations: response.iterations,
      timeMs: response.metadata.totalTimeMs,
      needsImprovement: response.metadata.needsImprovement,
      retrievalMethod: response.metadata.retrievalMethod,
      documentsRetrieved: response.retrieval.documents.length
    }
    
    const history = await this.getQueryHistory()
    history.push(record)
    
    if (history.length > 1000) {
      history.shift()
    }
    
    await window.spark.kv.set(
      StrategyPerformanceTracker.QUERY_HISTORY_KEY,
      history
    )
    
    await this.updateStrategyMetrics(record)
  }
  
  async recordUserFeedback(
    queryId: string,
    feedback: 'positive' | 'negative' | 'neutral'
  ): Promise<void> {
    const history = await this.getQueryHistory()
    const record = history.find(r => r.id === queryId)
    
    if (record) {
      record.userFeedback = feedback
      await window.spark.kv.set(
        StrategyPerformanceTracker.QUERY_HISTORY_KEY,
        history
      )
      
      await this.updateStrategyMetrics(record)
    }
  }
  
  private async updateStrategyMetrics(record: QueryPerformanceRecord): Promise<void> {
    const metrics = await this.getAllMetrics()
    const strategyId = `${record.intent}-${record.strategy}`
    
    let metric = metrics.find(m => m.strategyId === strategyId)
    
    if (!metric) {
      metric = {
        strategyId,
        intent: record.intent,
        strategy: record.strategy,
        totalQueries: 0,
        successfulQueries: 0,
        averageConfidence: 0,
        averageRetrievalTime: 0,
        averageIterations: 0,
        successRate: 0,
        lastUsed: Date.now(),
        improvementTrend: 0
      }
      metrics.push(metric)
    }
    
    const isSuccessful = record.confidence >= 0.7 && 
      (record.userFeedback === 'positive' || 
       (!record.userFeedback && !record.needsImprovement))
    
    const prevSuccessRate = metric.successRate
    
    metric.totalQueries++
    if (isSuccessful) {
      metric.successfulQueries++
    }
    
    metric.averageConfidence = 
      (metric.averageConfidence * (metric.totalQueries - 1) + record.confidence) / 
      metric.totalQueries
    
    metric.averageRetrievalTime = 
      (metric.averageRetrievalTime * (metric.totalQueries - 1) + record.timeMs) / 
      metric.totalQueries
    
    metric.averageIterations = 
      (metric.averageIterations * (metric.totalQueries - 1) + record.iterations) / 
      metric.totalQueries
    
    metric.successRate = metric.successfulQueries / metric.totalQueries
    metric.lastUsed = Date.now()
    
    metric.improvementTrend = metric.successRate - prevSuccessRate
    
    await window.spark.kv.set(
      StrategyPerformanceTracker.STORAGE_KEY,
      metrics
    )
    
    await this.generateInsights()
  }
  
  async getStrategyRecommendation(
    query: string,
    intent: QueryIntent,
    currentDocCount: number
  ): Promise<StrategyRecommendation> {
    const metrics = await this.getAllMetrics()
    const history = await this.getQueryHistory()
    
    const intentMetrics = metrics.filter(m => m.intent === intent)
    
    if (intentMetrics.length === 0 || intentMetrics.every(m => m.totalQueries < 3)) {
      return this.getDefaultRecommendation(intent, currentDocCount)
    }
    
    const similarQueries = await this.findSimilarQueries(query, history, 10)
    
    const strategyCandidates = intentMetrics.map(metric => {
      let score = metric.successRate * 0.5
      
      score += (metric.averageConfidence / 1.0) * 0.3
      
      const avgTime = intentMetrics.reduce((sum, m) => sum + m.averageRetrievalTime, 0) / 
                      intentMetrics.length
      const timeScore = avgTime > 0 ? (1 - (metric.averageRetrievalTime / avgTime)) * 0.1 : 0
      score += timeScore
      
      const recencyScore = (Date.now() - metric.lastUsed) < 86400000 ? 0.05 : 0
      score += recencyScore
      
      score += metric.improvementTrend * 0.05
      
      const similarSuccessRate = this.calculateSimilarQueriesSuccess(
        similarQueries,
        metric.strategy
      )
      if (similarSuccessRate > 0) {
        score = score * 0.7 + similarSuccessRate * 0.3
      }
      
      return {
        metric,
        score
      }
    })
    
    strategyCandidates.sort((a, b) => b.score - a.score)
    
    const best = strategyCandidates[0]
    const alternatives = strategyCandidates.slice(1, 4)
    
    return {
      recommendedStrategy: best.metric.strategy,
      confidence: Math.min(best.score, 0.95),
      reasoning: this.generateRecommendationReasoning(best.metric, similarQueries.length),
      alternativeStrategies: alternatives.map(alt => ({
        strategy: alt.metric.strategy,
        score: alt.score,
        reason: `Success rate: ${(alt.metric.successRate * 100).toFixed(1)}%, Avg confidence: ${alt.metric.averageConfidence.toFixed(2)}`
      })),
      basedOnHistoricalData: true,
      similarQueriesAnalyzed: similarQueries.length
    }
  }
  
  private getDefaultRecommendation(
    intent: QueryIntent,
    docCount: number
  ): StrategyRecommendation {
    let strategy: RetrievalStrategy
    let reasoning: string
    
    switch (intent) {
      case 'factual':
        strategy = docCount > 20 ? 'hybrid' : 'semantic'
        reasoning = `Default for factual queries: ${strategy} retrieval works best for precise information lookup`
        break
      case 'analytical':
        strategy = 'multi_query'
        reasoning = 'Default for analytical queries: multi-query decomposition helps gather comprehensive information'
        break
      case 'comparative':
        strategy = 'rag_fusion'
        reasoning = 'Default for comparative queries: RAG fusion captures multiple perspectives effectively'
        break
      case 'procedural':
        strategy = 'semantic'
        reasoning = 'Default for procedural queries: semantic search finds step-by-step instructions'
        break
      default:
        strategy = 'hybrid'
        reasoning = 'Default hybrid strategy balances keyword and semantic search'
    }
    
    return {
      recommendedStrategy: strategy,
      confidence: 0.5,
      reasoning: reasoning + ' (no historical data yet)',
      alternativeStrategies: [],
      basedOnHistoricalData: false,
      similarQueriesAnalyzed: 0
    }
  }
  
  private generateRecommendationReasoning(
    metric: StrategyPerformanceMetrics,
    similarCount: number
  ): string {
    const reasons: string[] = []
    
    if (metric.successRate > 0.8) {
      reasons.push(`${(metric.successRate * 100).toFixed(0)}% success rate`)
    }
    
    if (metric.averageConfidence > 0.75) {
      reasons.push(`high confidence (${metric.averageConfidence.toFixed(2)})`)
    }
    
    if (metric.averageIterations < 1.5) {
      reasons.push('typically resolves in one iteration')
    }
    
    if (similarCount > 5) {
      reasons.push(`${similarCount} similar successful queries`)
    }
    
    if (metric.improvementTrend > 0.1) {
      reasons.push('improving performance trend')
    }
    
    if (reasons.length === 0) {
      return `Based on ${metric.totalQueries} queries with ${metric.strategy} strategy`
    }
    
    return `Best choice: ${reasons.join(', ')}`
  }
  
  private calculateSimilarQueriesSuccess(
    similarQueries: QueryPerformanceRecord[],
    strategy: RetrievalStrategy
  ): number {
    const matchingQueries = similarQueries.filter(q => q.strategy === strategy)
    
    if (matchingQueries.length === 0) return 0
    
    const successCount = matchingQueries.filter(q => 
      q.confidence >= 0.7 && q.userFeedback !== 'negative'
    ).length
    
    return successCount / matchingQueries.length
  }
  
  private async findSimilarQueries(
    query: string,
    history: QueryPerformanceRecord[],
    limit: number
  ): Promise<QueryPerformanceRecord[]> {
    const queryWords = query.toLowerCase().split(/\s+/)
    
    const scored = history.map(record => {
      const recordWords = record.query.toLowerCase().split(/\s+/)
      const commonWords = queryWords.filter(w => 
        recordWords.includes(w) && w.length > 3
      )
      const similarity = commonWords.length / Math.max(queryWords.length, recordWords.length)
      
      return { record, similarity }
    })
    
    return scored
      .filter(s => s.similarity > 0.2)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .map(s => s.record)
  }
  
  async generateInsights(): Promise<void> {
    const metrics = await this.getAllMetrics()
    const history = await this.getQueryHistory()
    const insights: LearningInsight[] = []
    
    if (metrics.length < 5 || history.length < 20) {
      return
    }
    
    const bestPerformers = metrics
      .filter(m => m.totalQueries >= 5)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3)
    
    if (bestPerformers.length > 0 && bestPerformers[0].successRate > 0.85) {
      insights.push({
        id: this.generateId(),
        type: 'strategy_performance',
        title: `High Success Rate: ${bestPerformers[0].strategy} for ${bestPerformers[0].intent}`,
        description: `The ${bestPerformers[0].strategy} strategy achieves ${(bestPerformers[0].successRate * 100).toFixed(1)}% success rate for ${bestPerformers[0].intent} queries with average confidence of ${bestPerformers[0].averageConfidence.toFixed(2)}.`,
        impact: 'high',
        actionable: true,
        suggestedAction: `Prioritize ${bestPerformers[0].strategy} strategy for ${bestPerformers[0].intent} intent queries`,
        supportingData: {
          queriesAnalyzed: bestPerformers[0].totalQueries,
          timeRange: 'All time',
          keyMetrics: {
            successRate: bestPerformers[0].successRate,
            avgConfidence: bestPerformers[0].averageConfidence,
            avgTime: bestPerformers[0].averageRetrievalTime
          }
        },
        timestamp: Date.now()
      })
    }
    
    const poorPerformers = metrics
      .filter(m => m.totalQueries >= 5 && m.successRate < 0.5)
    
    if (poorPerformers.length > 0) {
      poorPerformers.forEach(poor => {
        insights.push({
          id: this.generateId(),
          type: 'failure_mode',
          title: `Low Success Rate: ${poor.strategy} for ${poor.intent}`,
          description: `The ${poor.strategy} strategy only achieves ${(poor.successRate * 100).toFixed(1)}% success rate for ${poor.intent} queries. Consider using alternative strategies.`,
          impact: 'medium',
          actionable: true,
          suggestedAction: `Avoid ${poor.strategy} for ${poor.intent} queries, try ${this.suggestAlternativeStrategy(poor.intent)}`,
          supportingData: {
            queriesAnalyzed: poor.totalQueries,
            timeRange: 'All time',
            keyMetrics: {
              successRate: poor.successRate,
              avgConfidence: poor.averageConfidence,
              avgIterations: poor.averageIterations
            }
          },
          timestamp: Date.now()
        })
      })
    }
    
    const intentDistribution = this.calculateIntentDistribution(history)
    const dominantIntent = Object.entries(intentDistribution)
      .sort(([, a], [, b]) => b - a)[0]
    
    if (dominantIntent && dominantIntent[1] > 0.4) {
      insights.push({
        id: this.generateId(),
        type: 'intent_pattern',
        title: `Dominant Query Pattern: ${dominantIntent[0]}`,
        description: `${(dominantIntent[1] * 100).toFixed(1)}% of queries are ${dominantIntent[0]} type. Consider optimizing the knowledge base structure for this use case.`,
        impact: 'medium',
        actionable: true,
        suggestedAction: `Optimize document structure and chunking strategy for ${dominantIntent[0]} queries`,
        supportingData: {
          queriesAnalyzed: history.length,
          timeRange: 'Recent',
          keyMetrics: {
            dominantIntentPercentage: dominantIntent[1],
            totalQueries: history.length
          }
        },
        timestamp: Date.now()
      })
    }
    
    const recentHistory = history.filter(h => 
      Date.now() - h.timestamp < 7 * 86400000
    )
    
    if (recentHistory.length >= 10) {
      const avgIterationsRecent = recentHistory.reduce((sum, h) => sum + h.iterations, 0) / 
                                   recentHistory.length
      
      if (avgIterationsRecent > 1.5) {
        insights.push({
          id: this.generateId(),
          type: 'optimization_opportunity',
          title: 'High Iteration Count Detected',
          description: `Recent queries average ${avgIterationsRecent.toFixed(1)} iterations, indicating initial strategies often need refinement. This suggests opportunities for better routing decisions.`,
          impact: 'medium',
          actionable: true,
          suggestedAction: 'Review and improve initial query analysis and strategy selection',
          supportingData: {
            queriesAnalyzed: recentHistory.length,
            timeRange: 'Last 7 days',
            keyMetrics: {
              avgIterations: avgIterationsRecent,
              multiIterationQueries: recentHistory.filter(h => h.iterations > 1).length
            }
          },
          timestamp: Date.now()
        })
      }
    }
    
    await window.spark.kv.set(StrategyPerformanceTracker.INSIGHTS_KEY, insights)
  }
  
  private suggestAlternativeStrategy(intent: QueryIntent): RetrievalStrategy {
    const alternatives: Record<QueryIntent, RetrievalStrategy> = {
      factual: 'hybrid',
      analytical: 'multi_query',
      comparative: 'rag_fusion',
      procedural: 'semantic',
      clarification: 'semantic',
      chitchat: 'direct_answer',
      out_of_scope: 'direct_answer'
    }
    
    return alternatives[intent] || 'hybrid'
  }
  
  private calculateIntentDistribution(
    history: QueryPerformanceRecord[]
  ): Record<string, number> {
    const distribution: Record<string, number> = {}
    
    history.forEach(record => {
      distribution[record.intent] = (distribution[record.intent] || 0) + 1
    })
    
    Object.keys(distribution).forEach(key => {
      distribution[key] /= history.length
    })
    
    return distribution
  }
  
  async getAllMetrics(): Promise<StrategyPerformanceMetrics[]> {
    const metrics = await window.spark.kv.get<StrategyPerformanceMetrics[]>(
      StrategyPerformanceTracker.STORAGE_KEY
    )
    return metrics || []
  }
  
  async getQueryHistory(): Promise<QueryPerformanceRecord[]> {
    const history = await window.spark.kv.get<QueryPerformanceRecord[]>(
      StrategyPerformanceTracker.QUERY_HISTORY_KEY
    )
    return history || []
  }
  
  async getInsights(): Promise<LearningInsight[]> {
    const insights = await window.spark.kv.get<LearningInsight[]>(
      StrategyPerformanceTracker.INSIGHTS_KEY
    )
    return insights || []
  }
  
  async getMetricsForIntent(intent: QueryIntent): Promise<StrategyPerformanceMetrics[]> {
    const metrics = await this.getAllMetrics()
    return metrics.filter(m => m.intent === intent)
  }
  
  async getMetricsForStrategy(strategy: RetrievalStrategy): Promise<StrategyPerformanceMetrics[]> {
    const metrics = await this.getAllMetrics()
    return metrics.filter(m => m.strategy === strategy)
  }
  
  async clearAllData(): Promise<void> {
    await window.spark.kv.delete(StrategyPerformanceTracker.STORAGE_KEY)
    await window.spark.kv.delete(StrategyPerformanceTracker.QUERY_HISTORY_KEY)
    await window.spark.kv.delete(StrategyPerformanceTracker.INSIGHTS_KEY)
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
