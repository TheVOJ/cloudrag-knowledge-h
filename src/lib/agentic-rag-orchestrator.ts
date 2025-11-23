import { Document, AzureSearchSettings } from './types'
import { AgenticQueryRouter, RoutingDecision, QueryIntent } from './agentic-router'
import { RetrievalExecutor, RetrievalResult } from './retrieval-executor'
import { SelfReflectiveRAG, SelfEvaluation, CriticFeedback } from './self-reflective-rag'
import { StrategyPerformanceTracker } from './strategy-performance-tracker'
import { runtime } from './runtime/manager'
import { generateEmbedding } from './chunking'
import { SemanticCache } from './semantic-cache'

export type QueryReformulation = {
  id: string
  query: string
  type: 'original' | 'reformulation' | 'subquery' | 'expansion' | 'simplification'
  iteration: number
  confidence?: number
  reasoning?: string
  timestamp: number
  parentId?: string
  linkType?: 'decomposed' | 'expanded' | 'simplified' | 'refined' | 'fallback'
  similarity?: number
}

export type ProgressStep = {
  phase: 'routing' | 'retrieval' | 'generation' | 'evaluation' | 'criticism' | 'retry' | 'complete'
  status: 'pending' | 'in_progress' | 'complete' | 'error'
  message: string
  details?: string
  progress?: number
  timestamp: number
  metadata?: Record<string, any>
}

export type AgenticRAGResponse = {
  answer: string
  sources: string[]
  routing: RoutingDecision
  retrieval: RetrievalResult
  evaluation: SelfEvaluation
  criticism?: CriticFeedback
  iterations: number
  reformulations: QueryReformulation[]
  metadata: {
    totalTimeMs: number
    retrievalMethod: string
    retrievalBackend: 'azure' | 'local'
    confidence: number
    needsImprovement: boolean
    improvementSuggestions?: string[]
    cacheHit?: boolean
  }
}

export type AgenticRAGConfig = {
  maxIterations?: number
  confidenceThreshold?: number
  enableCriticism?: boolean
  enableAutoRetry?: boolean
  topK?: number
  onProgress?: (step: ProgressStep) => void
  enableSemanticCache?: boolean
  cacheTtlMs?: number
  cacheConfidenceThreshold?: number
}

/**
 * Coordinates the entire Agentic RAG process.
 *
 * This class acts as the main controller for the RAG pipeline, managing the flow of data
 * between the Router, Retrieval Executor, and Self-Reflection components.
 *
 * Key responsibilities:
 * - Orchestrates the multi-step query process (Routing -> Retrieval -> Generation -> Evaluation)
 * - Manages the feedback loop for query reformulation and retries
 * - Maintains conversation history
 * - Emits real-time progress events for UI visualization
 */
export class AgenticRAGOrchestrator {
  private router: AgenticQueryRouter
  private executor: RetrievalExecutor
  private reflector: SelfReflectiveRAG
  private tracker: StrategyPerformanceTracker
  private conversationHistory: Array<{ query: string; response: string }> = []
  private cache: SemanticCache
  private knowledgeBaseId?: string

  constructor(
    private documents: Document[],
    private knowledgeBaseName: string,
    azureSettings?: AzureSearchSettings,
    azureIndexName?: string,
    initialConversationHistory?: Array<{ query: string; response: string }> // NEW
  ) {
    this.router = new AgenticQueryRouter()

    // Extract knowledgeBaseId from documents for chunk-based retrieval
    const knowledgeBaseId = documents.length > 0 ? documents[0].knowledgeBaseId : undefined

    this.executor = new RetrievalExecutor(
      azureSettings?.enabled ? azureSettings.endpoint : undefined,
      azureSettings?.enabled ? azureSettings.apiKey : undefined,
      azureIndexName,
      knowledgeBaseId // NEW: Enable chunk-based retrieval
    )
    this.reflector = new SelfReflectiveRAG()
    this.tracker = new StrategyPerformanceTracker()

    // Initialize with existing history
    if (initialConversationHistory) {
      this.conversationHistory = initialConversationHistory
    }

    this.knowledgeBaseId = knowledgeBaseId
    this.cache = new SemanticCache()
  }

  private emitProgress(config: AgenticRAGConfig, step: Omit<ProgressStep, 'timestamp'>) {
    if (config.onProgress) {
      config.onProgress({
        ...step,
        timestamp: Date.now()
      })
    }
  }

  private generateId(): string {
    return `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private calculateSemanticSimilarity(query1: string, query2: string): number {
    const words1 = query1.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const words2 = query2.toLowerCase().split(/\s+/).filter(w => w.length > 3)

    if (words1.length === 0 || words2.length === 0) return 0

    const set1 = new Set(words1)
    const set2 = new Set(words2)
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    const jaccardSimilarity = intersection.size / union.size

    const longerLength = Math.max(query1.length, query2.length)
    const shorterLength = Math.min(query1.length, query2.length)
    const lengthSimilarity = shorterLength / longerLength

    const commonStarts = query1.toLowerCase().startsWith(query2.toLowerCase().substring(0, 5)) ||
      query2.toLowerCase().startsWith(query1.toLowerCase().substring(0, 5))
    const positionBonus = commonStarts ? 0.15 : 0

    return Math.min(1, jaccardSimilarity * 0.7 + lengthSimilarity * 0.3 + positionBonus)
  }

  async query(
    userQuery: string,
    config: AgenticRAGConfig = {}
  ): Promise<AgenticRAGResponse> {
    const startTime = Date.now()
    const maxIterations = config.maxIterations || 3
    const confidenceThreshold = config.confidenceThreshold || 0.6
    const enableCriticism = config.enableCriticism !== false
    const enableAutoRetry = config.enableAutoRetry !== false
    const topK = config.topK || 5

    let iteration = 0
    let currentQuery = userQuery
    const reformulations: QueryReformulation[] = []
    const originalId = this.generateId()

    reformulations.push({
      id: originalId,
      query: userQuery,
      type: 'original',
      iteration: 0,
      timestamp: Date.now()
    })
    let routing: RoutingDecision | null = null
    let retrieval: RetrievalResult | null = null
    let answer = ''
    let evaluation: SelfEvaluation | null = null
    let criticism: CriticFeedback | undefined

    // Try semantic cache first (best-effort)
    let queryEmbedding: number[] | null = null
    if (config.enableSemanticCache !== false) {
      try {
        queryEmbedding = await generateEmbedding(userQuery)
        const cached = this.knowledgeBaseId && queryEmbedding
          ? await this.cache.get(queryEmbedding, this.knowledgeBaseId)
          : null
        if (cached) {
          return {
            ...cached,
            metadata: {
              ...cached.metadata,
              cacheHit: true,
              totalTimeMs: Date.now() - startTime
            }
          }
        }
      } catch (error) {
        console.warn('Semantic cache lookup failed; continuing', error)
      }
    }

    while (iteration < maxIterations) {
      iteration++

      this.emitProgress(config, {
        phase: 'routing',
        status: 'in_progress',
        message: `Analyzing query (Iteration ${iteration}/${maxIterations})`,
        details: 'Understanding query intent, complexity, and optimal strategy...',
        progress: 10
      })

      routing = await this.router.routeQuery(
        currentQuery,
        this.knowledgeBaseName,
        this.documents.length,
        this.conversationHistory
      )

      this.emitProgress(config, {
        phase: 'routing',
        status: 'complete',
        message: 'Query analysis complete',
        details: `Intent: ${routing.intent}, Strategy: ${routing.strategy}`,
        progress: 20,
        metadata: {
          intent: routing.intent,
          strategy: routing.strategy,
          needsRetrieval: routing.needsRetrieval
        }
      })

      if (iteration === 1) {
        this.emitProgress(config, {
          phase: 'routing',
          status: 'in_progress',
          message: 'Checking historical performance',
          details: 'Analyzing past queries to optimize strategy selection...',
          progress: 25
        })

        const recommendation = await this.tracker.getStrategyRecommendation(
          currentQuery,
          routing.intent,
          this.documents.length
        )

        if (recommendation.basedOnHistoricalData && recommendation.confidence > 0.7) {
          routing.strategy = recommendation.recommendedStrategy
          routing.reasoning = `${routing.reasoning} (Using learned strategy: ${recommendation.reasoning})`

          this.emitProgress(config, {
            phase: 'routing',
            status: 'complete',
            message: 'Strategy optimized from learning',
            details: `Using ${recommendation.recommendedStrategy} based on ${recommendation.confidence.toFixed(0)}% confidence from historical data`,
            progress: 30,
            metadata: { learned: true, strategy: recommendation.recommendedStrategy }
          })
        }
      }

      if (routing.intent === 'chitchat' || !routing.needsRetrieval) {
        this.emitProgress(config, {
          phase: 'generation',
          status: 'in_progress',
          message: 'Generating direct response',
          details: 'No retrieval needed for this query type',
          progress: 60
        })

        answer = await this.generateDirectAnswer(currentQuery, routing.intent)

        evaluation = {
          relevanceToken: 'RELEVANT',
          supportToken: 'FULLY_SUPPORTED',
          utilityToken: 'USEFUL',
          confidence: 0.9,
          needsRetry: false,
          reasoning: 'Direct answer without retrieval'
        }

        this.emitProgress(config, {
          phase: 'complete',
          status: 'complete',
          message: 'Response generated',
          progress: 100
        })

        break
      }

      this.emitProgress(config, {
        phase: 'routing',
        status: 'in_progress',
        message: 'Checking if clarification needed',
        details: 'Evaluating query clarity and specificity...',
        progress: 32
      })

      const clarification = await this.router.shouldClarify(currentQuery, this.documents.length)
      if (clarification.needsClarification && iteration === 1) {
        this.emitProgress(config, {
          phase: 'routing',
          status: 'complete',
          message: 'Clarification needed',
          details: 'Query is too vague or ambiguous',
          progress: 100,
          metadata: { needsClarification: true }
        })

        answer = clarification.clarificationQuestion || 'Could you please provide more details about your question?'

        evaluation = {
          relevanceToken: 'PARTIALLY_RELEVANT',
          supportToken: 'NOT_SUPPORTED',
          utilityToken: 'SOMEWHAT_USEFUL',
          confidence: 0.4,
          needsRetry: false,
          reasoning: 'Query too vague, requesting clarification'
        }

        routing.reasoning = 'Query requires clarification'
        retrieval = {
          documents: [],
          scores: [],
          method: 'direct_answer',
          queryUsed: currentQuery
        }

        break
      }

      let subQueries: string[] | undefined
      let currentParentId = reformulations[reformulations.length - 1].id

      if (routing && routing.strategy === 'multi_query' && routing.subQueries) {
        subQueries = routing.subQueries

        subQueries.forEach((subQuery, index) => {
          const subQueryId = this.generateId()
          const similarity = this.calculateSemanticSimilarity(currentQuery, subQuery)
          reformulations.push({
            id: subQueryId,
            query: subQuery,
            type: 'subquery',
            iteration,
            confidence: routing!.confidence,
            reasoning: `Decomposed from parent query (${index + 1}/${subQueries!.length})`,
            timestamp: Date.now(),
            parentId: currentParentId,
            linkType: 'decomposed',
            similarity
          })
        })

        this.emitProgress(config, {
          phase: 'retrieval',
          status: 'in_progress',
          message: 'Breaking down complex query',
          details: `Generated ${subQueries.length} sub-queries for comprehensive retrieval`,
          progress: 35,
          metadata: { subQueries }
        })
      } else if (routing && routing.strategy === 'multi_query') {
        this.emitProgress(config, {
          phase: 'retrieval',
          status: 'in_progress',
          message: 'Generating sub-queries',
          details: 'Breaking complex query into simpler components...',
          progress: 35
        })

        subQueries = await this.router.generateSubQueries(currentQuery)

        subQueries.forEach((subQuery, index) => {
          const subQueryId = this.generateId()
          const similarity = this.calculateSemanticSimilarity(currentQuery, subQuery)
          reformulations.push({
            id: subQueryId,
            query: subQuery,
            type: 'subquery',
            iteration,
            confidence: routing!.confidence,
            reasoning: `Decomposed from parent query (${index + 1}/${subQueries!.length})`,
            timestamp: Date.now(),
            parentId: currentParentId,
            linkType: 'decomposed',
            similarity
          })
        })

        this.emitProgress(config, {
          phase: 'retrieval',
          status: 'complete',
          message: 'Sub-queries generated',
          details: `Created ${subQueries.length} targeted queries`,
          progress: 40,
          metadata: { subQueries }
        })
      }

      this.emitProgress(config, {
        phase: 'retrieval',
        status: 'in_progress',
        message: `Executing ${routing.strategy} retrieval`,
        details: `Searching ${this.documents.length} documents with top-${topK} results...`,
        progress: 45
      })

      retrieval = await this.executor.executeRetrieval(
        currentQuery,
        this.documents,
        routing.strategy,
        topK,
        subQueries
      )

      if (retrieval.method === 'rag_fusion' && retrieval.metadata?.ragFusionVariations) {
        this.emitProgress(config, {
          phase: 'retrieval',
          status: 'complete',
          message: 'RAG Fusion variations generated',
          details: `Generated ${retrieval.metadata.ragFusionVariations.length} variations for broader coverage`,
          progress: 50,
          metadata: { subQueries: retrieval.metadata.ragFusionVariations }
        })
      }

      this.emitProgress(config, {
        phase: 'retrieval',
        status: 'complete',
        message: `Retrieved ${retrieval.documents.length} documents`,
        details: `${routing.strategy} strategy found ${retrieval.documents.length} relevant documents`,
        progress: 55,
        metadata: {
          documentsFound: retrieval.documents.length,
          method: retrieval.method
        }
      })

      this.emitProgress(config, {
        phase: 'retrieval',
        status: 'in_progress',
        message: 'Evaluating retrieval quality',
        details: 'Checking document relevance and coverage...',
        progress: 58
      })

      const qualityCheck = this.router.evaluateRetrievalQuality(
        retrieval.documents,
        currentQuery,
        topK
      )

      if (qualityCheck.needsFallback && routing.fallbackStrategies && iteration < maxIterations) {
        this.emitProgress(config, {
          phase: 'retrieval',
          status: 'in_progress',
          message: 'Trying fallback strategy',
          details: `Initial results insufficient, using ${routing.fallbackStrategies[0]} strategy...`,
          progress: 62,
          metadata: { fallbackStrategy: routing.fallbackStrategies[0] }
        })

        const fallbackStrategy = routing.fallbackStrategies[0]

        retrieval = await this.executor.executeRetrieval(
          currentQuery,
          this.documents,
          fallbackStrategy,
          topK
        )

        this.emitProgress(config, {
          phase: 'retrieval',
          status: 'complete',
          message: 'Fallback retrieval complete',
          details: `Found ${retrieval.documents.length} documents using fallback strategy`,
          progress: 65,
          metadata: { documentsFound: retrieval.documents.length }
        })
      }

      this.emitProgress(config, {
        phase: 'generation',
        status: 'in_progress',
        message: 'Generating response',
        details: 'Synthesizing information from retrieved documents...',
        progress: 70
      })

      answer = await this.generateAnswer(currentQuery, retrieval)

      this.emitProgress(config, {
        phase: 'generation',
        status: 'complete',
        message: 'Response generated',
        details: `Generated ${answer.length} character response`,
        progress: 78,
        metadata: { responseLength: answer.length }
      })

      this.emitProgress(config, {
        phase: 'evaluation',
        status: 'in_progress',
        message: 'Self-evaluating response quality',
        details: 'Checking relevance, support, and utility...',
        progress: 80
      })

      evaluation = await this.reflector.performSelfEvaluation(
        currentQuery,
        answer,
        retrieval
      )

      this.emitProgress(config, {
        phase: 'evaluation',
        status: 'complete',
        message: `Quality assessment: ${(evaluation.confidence * 100).toFixed(0)}% confidence`,
        details: `Relevance: ${evaluation.relevanceToken}, Support: ${evaluation.supportToken}`,
        progress: 85,
        metadata: {
          confidence: evaluation.confidence,
          relevance: evaluation.relevanceToken,
          support: evaluation.supportToken
        }
      })

      if (enableCriticism) {
        this.emitProgress(config, {
          phase: 'criticism',
          status: 'in_progress',
          message: 'Running critic analysis',
          details: 'Checking logical consistency, accuracy, and completeness...',
          progress: 88
        })

        criticism = await this.reflector.criticResponse(
          currentQuery,
          answer,
          retrieval.documents
        )

        this.emitProgress(config, {
          phase: 'criticism',
          status: 'complete',
          message: 'Critic analysis complete',
          details: `Logic: ${(criticism.logicalConsistency * 100).toFixed(0)}%, Accuracy: ${(criticism.factualAccuracy * 100).toFixed(0)}%`,
          progress: 92,
          metadata: {
            logicalConsistency: criticism.logicalConsistency,
            factualAccuracy: criticism.factualAccuracy,
            completeness: criticism.completeness
          }
        })
      }

      if (evaluation.confidence >= confidenceThreshold || !enableAutoRetry) {
        this.emitProgress(config, {
          phase: 'complete',
          status: 'complete',
          message: 'Response meets quality threshold',
          details: `Completed in ${iteration} iteration(s)`,
          progress: 100,
          metadata: { iterations: iteration }
        })
        break
      }

      if (iteration < maxIterations && evaluation.needsRetry) {
        this.emitProgress(config, {
          phase: 'retry',
          status: 'in_progress',
          message: 'Quality below threshold, analyzing improvements',
          details: 'Determining if retry can improve response...',
          progress: 94
        })

        const improvements = await this.reflector.suggestImprovements(evaluation, criticism)

        if (improvements.shouldRetry) {
          this.emitProgress(config, {
            phase: 'retry',
            status: 'in_progress',
            message: `Retrying with improved query (${iteration + 1}/${maxIterations})`,
            details: `Improvements: ${improvements.actions.slice(0, 2).join(', ')}`,
            progress: 96,
            metadata: { improvements: improvements.actions }
          })

          const previousQueryId = reformulations[reformulations.length - 1].id
          currentQuery = await this.reformulateQuery(userQuery, evaluation, improvements.actions)

          const reformulationId = this.generateId()
          const reformulationType = improvements.actions.some(a => a.includes('expand')) ? 'expansion' :
            improvements.actions.some(a => a.includes('simplif')) ? 'simplification' :
              'reformulation'

          const previousQuery = reformulations[reformulations.length - 1].query
          const similarity = this.calculateSemanticSimilarity(previousQuery, currentQuery)

          reformulations.push({
            id: reformulationId,
            query: currentQuery,
            type: reformulationType,
            iteration: iteration + 1,
            confidence: evaluation.confidence,
            reasoning: improvements.actions.join('; '),
            timestamp: Date.now(),
            parentId: previousQueryId,
            linkType: 'refined',
            similarity
          })

          this.emitProgress(config, {
            phase: 'retry',
            status: 'complete',
            message: 'Query reformulated',
            details: 'Starting new iteration with improved query...',
            progress: 5
          })

          continue
        } else {
          this.emitProgress(config, {
            phase: 'complete',
            status: 'complete',
            message: 'Response finalized',
            details: 'No further improvements possible',
            progress: 100
          })
          break
        }
      } else {
        this.emitProgress(config, {
          phase: 'complete',
          status: 'complete',
          message: 'Maximum iterations reached',
          details: `Completed after ${iteration} iteration(s)`,
          progress: 100,
          metadata: { iterations: iteration }
        })
        break
      }
    }

    if (!routing || !retrieval || !evaluation) {
      throw new Error('RAG orchestration failed')
    }

    this.conversationHistory.push({ query: userQuery, response: answer })
    if (this.conversationHistory.length > 20) { // Changed from 5 to 20
      this.conversationHistory.shift()
    }

    const totalTimeMs = Date.now() - startTime

    const improvements = await this.reflector.suggestImprovements(evaluation, criticism)

    const response: AgenticRAGResponse = {
      answer,
      sources: retrieval.documents.map(d => d.title),
      routing,
      retrieval,
      evaluation,
      criticism,
      iterations: iteration,
      reformulations,
      metadata: {
        totalTimeMs,
        retrievalMethod: retrieval.method,
        retrievalBackend: retrieval.metadata?.azureResults ? 'azure' : 'local',
        confidence: evaluation.confidence,
        needsImprovement: improvements.shouldRetry,
        improvementSuggestions: improvements.actions.length > 0 ? improvements.actions : undefined
      }
    }

    // Write-through semantic cache when enabled and confident enough
    const cacheConfidence = config.cacheConfidenceThreshold ?? 0.55
    if (config.enableSemanticCache !== false && queryEmbedding && this.knowledgeBaseId && evaluation.confidence >= cacheConfidence) {
      try {
        await this.cache.set(queryEmbedding, this.knowledgeBaseId, response, config.cacheTtlMs)
      } catch (error) {
        console.warn('Semantic cache set failed', error)
      }
    }

    await this.tracker.recordQueryPerformance(userQuery, response)

    return response
  }

  private async generateDirectAnswer(query: string, intent: QueryIntent): Promise<string> {
    if (intent === 'chitchat') {
      const prompt = `Respond naturally to this casual message: "${query}"

Keep it brief and friendly.`

      return await runtime.llm.generate(prompt, '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
    }

    if (intent === 'out_of_scope') {
      return `I'm a specialized assistant for the "${this.knowledgeBaseName}" knowledge base. Your question appears to be outside my area of expertise. Could you ask something related to the available documents?`
    }

    return `I don't have enough information to answer that question based on the current knowledge base.`
  }

  private async generateAnswer(query: string, retrieval: RetrievalResult): Promise<string> {
    if (retrieval.documents.length === 0) {
      return `I couldn't find relevant information in the knowledge base to answer your question about: "${query}". The knowledge base may not contain documents on this topic.`
    }

    const context = retrieval.documents
      .map((doc, i) => {
        const score = retrieval.scores[i]
        return `[${i + 1}] ${doc.title} (relevance: ${score.toFixed(2)})\n${doc.content.slice(0, 800)}`
      })
      .join('\n\n---\n\n')

    const prompt = `You are a helpful AI assistant with access to the "${this.knowledgeBaseName}" knowledge base.

Answer the user's question based ONLY on the provided context. Be accurate and cite sources by number.

Context from ${retrieval.method} retrieval:
${context}

User Question: ${query}

Instructions:
1. Answer directly and concisely
2. Cite sources using [1], [2], etc.
3. If context doesn't fully answer the question, say so
4. Do not make up information beyond what's in the context

Answer:`

    return await runtime.llm.generate(prompt, '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
  }

  private async reformulateQuery(
    originalQuery: string,
    evaluation: SelfEvaluation,
    improvements: string[]
  ): Promise<string> {
    const prompt = `Reformulate this query to improve retrieval quality.

Original Query: "${originalQuery}"

Issues Identified:
- Relevance: ${evaluation.relevanceToken}
- Support: ${evaluation.supportToken}
- Utility: ${evaluation.utilityToken}
- Confidence: ${evaluation.confidence.toFixed(2)}

Suggested Improvements:
${improvements.map(imp => `- ${imp}`).join('\n')}

Generate a reformulated query that addresses these issues. Make it more specific, add context, or break it down as needed.

Respond with ONLY the reformulated query, no explanation.`

    try {
      const reformulated = await runtime.llm.generate(prompt, '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
      return reformulated.trim()
    } catch {
      return originalQuery
    }
  }

  getConversationHistory(): Array<{ query: string; response: string }> {
    return [...this.conversationHistory]
  }

  clearHistory(): void {
    this.conversationHistory = []
  }
}
