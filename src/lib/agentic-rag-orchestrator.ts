import { Document, AzureSearchSettings } from './types'
import { AgenticQueryRouter, RoutingDecision, QueryIntent } from './agentic-router'
import { RetrievalExecutor, RetrievalResult } from './retrieval-executor'
import { SelfReflectiveRAG, SelfEvaluation, CriticFeedback } from './self-reflective-rag'

export type AgenticRAGResponse = {
  answer: string
  sources: string[]
  routing: RoutingDecision
  retrieval: RetrievalResult
  evaluation: SelfEvaluation
  criticism?: CriticFeedback
  iterations: number
  metadata: {
    totalTimeMs: number
    retrievalMethod: string
    confidence: number
    needsImprovement: boolean
    improvementSuggestions?: string[]
  }
}

export type AgenticRAGConfig = {
  maxIterations?: number
  confidenceThreshold?: number
  enableCriticism?: boolean
  enableAutoRetry?: boolean
  topK?: number
}

export class AgenticRAGOrchestrator {
  private router: AgenticQueryRouter
  private executor: RetrievalExecutor
  private reflector: SelfReflectiveRAG
  private conversationHistory: Array<{ query: string; response: string }> = []
  
  constructor(
    private documents: Document[],
    private knowledgeBaseName: string,
    azureSettings?: AzureSearchSettings,
    azureIndexName?: string
  ) {
    this.router = new AgenticQueryRouter()
    this.executor = new RetrievalExecutor(
      azureSettings?.enabled ? azureSettings.endpoint : undefined,
      azureSettings?.enabled ? azureSettings.apiKey : undefined,
      azureIndexName
    )
    this.reflector = new SelfReflectiveRAG()
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
    let routing: RoutingDecision | null = null
    let retrieval: RetrievalResult | null = null
    let answer = ''
    let evaluation: SelfEvaluation | null = null
    let criticism: CriticFeedback | undefined
    
    while (iteration < maxIterations) {
      iteration++
      
      routing = await this.router.routeQuery(
        currentQuery,
        this.knowledgeBaseName,
        this.documents.length,
        this.conversationHistory
      )
      
      if (routing.intent === 'chitchat' || !routing.needsRetrieval) {
        answer = await this.generateDirectAnswer(currentQuery, routing.intent)
        
        evaluation = {
          relevanceToken: 'RELEVANT',
          supportToken: 'FULLY_SUPPORTED',
          utilityToken: 'USEFUL',
          confidence: 0.9,
          needsRetry: false,
          reasoning: 'Direct answer without retrieval'
        }
        
        break
      }
      
      const clarification = await this.router.shouldClarify(currentQuery, this.documents.length)
      if (clarification.needsClarification && iteration === 1) {
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
      if (routing.strategy === 'multi_query' && routing.subQueries) {
        subQueries = routing.subQueries
      } else if (routing.strategy === 'multi_query') {
        subQueries = await this.router.generateSubQueries(currentQuery)
      }
      
      retrieval = await this.executor.executeRetrieval(
        currentQuery,
        this.documents,
        routing.strategy,
        topK,
        subQueries
      )
      
      const qualityCheck = this.router.evaluateRetrievalQuality(
        retrieval.documents,
        currentQuery,
        topK
      )
      
      if (qualityCheck.needsFallback && routing.fallbackStrategies && iteration < maxIterations) {
        const fallbackStrategy = routing.fallbackStrategies[0]
        
        retrieval = await this.executor.executeRetrieval(
          currentQuery,
          this.documents,
          fallbackStrategy,
          topK
        )
      }
      
      answer = await this.generateAnswer(currentQuery, retrieval)
      
      evaluation = await this.reflector.performSelfEvaluation(
        currentQuery,
        answer,
        retrieval
      )
      
      if (enableCriticism) {
        criticism = await this.reflector.criticResponse(
          currentQuery,
          answer,
          retrieval.documents
        )
      }
      
      if (evaluation.confidence >= confidenceThreshold || !enableAutoRetry) {
        break
      }
      
      if (iteration < maxIterations && evaluation.needsRetry) {
        const improvements = await this.reflector.suggestImprovements(evaluation, criticism)
        
        if (improvements.shouldRetry) {
          currentQuery = await this.reformulateQuery(userQuery, evaluation, improvements.actions)
          continue
        } else {
          break
        }
      } else {
        break
      }
    }
    
    if (!routing || !retrieval || !evaluation) {
      throw new Error('RAG orchestration failed')
    }
    
    this.conversationHistory.push({ query: userQuery, response: answer })
    if (this.conversationHistory.length > 5) {
      this.conversationHistory.shift()
    }
    
    const totalTimeMs = Date.now() - startTime
    
    const improvements = await this.reflector.suggestImprovements(evaluation, criticism)
    
    return {
      answer,
      sources: retrieval.documents.map(d => d.title),
      routing,
      retrieval,
      evaluation,
      criticism,
      iterations: iteration,
      metadata: {
        totalTimeMs,
        retrievalMethod: retrieval.method,
        confidence: evaluation.confidence,
        needsImprovement: improvements.shouldRetry,
        improvementSuggestions: improvements.actions.length > 0 ? improvements.actions : undefined
      }
    }
  }
  
  private async generateDirectAnswer(query: string, intent: QueryIntent): Promise<string> {
    if (intent === 'chitchat') {
      const prompt = `Respond naturally to this casual message: "${query}"

Keep it brief and friendly.`
      
      return await window.spark.llm(prompt, 'gpt-4o-mini')
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

    return await window.spark.llm(prompt, 'gpt-4o')
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
      const reformulated = await window.spark.llm(prompt, 'gpt-4o-mini')
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
