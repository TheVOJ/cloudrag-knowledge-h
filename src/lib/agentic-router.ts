import { Document } from './types'
import { runtime } from './runtime/manager'

export type QueryIntent = 
  | 'factual'
  | 'analytical' 
  | 'comparative'
  | 'procedural'
  | 'clarification'
  | 'chitchat'
  | 'out_of_scope'

export type RetrievalStrategy = 
  | 'semantic'
  | 'keyword'
  | 'hybrid'
  | 'multi_query'
  | 'rag_fusion'
  | 'direct_answer'

export type RoutingDecision = {
  intent: QueryIntent
  strategy: RetrievalStrategy
  needsRetrieval: boolean
  parallelizable: boolean
  confidence: number
  reasoning: string
  subQueries?: string[]
  fallbackStrategies?: RetrievalStrategy[]
}

export type QueryAnalysis = {
  complexity: 'simple' | 'moderate' | 'complex'
  specificity: 'vague' | 'specific' | 'precise'
  temporality: 'timeless' | 'recent' | 'time_specific'
  scope: 'narrow' | 'broad' | 'multi_domain'
  requiresMultiHop: boolean
}

export class AgenticQueryRouter {
  private conversationHistory: Array<{ query: string; response: string }> = []
  
  async classifyIntent(query: string): Promise<QueryIntent> {
    const prompt = `You are a query intent classifier. Analyze the user's query and classify it into one of these categories:
- factual: Looking for specific facts, definitions, or data points
- analytical: Requires analysis, synthesis, or reasoning across information
- comparative: Comparing multiple items, concepts, or approaches
- procedural: How-to questions or step-by-step instructions
- clarification: Follow-up questions or requests for more detail
- chitchat: Casual conversation or greetings
- out_of_scope: Questions unrelated to the knowledge base

Query: "${query}"

Respond with ONLY the category name (lowercase, no explanation).`

    const result = await runtime.llm.generate(prompt, '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
    const intent = result.trim().toLowerCase()
    
    const validIntents: QueryIntent[] = ['factual', 'analytical', 'comparative', 'procedural', 'clarification', 'chitchat', 'out_of_scope']
    return validIntents.includes(intent as QueryIntent) ? (intent as QueryIntent) : 'factual'
  }
  
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    const prompt = `Analyze this query and provide a JSON analysis with these fields:
- complexity: "simple" (single fact), "moderate" (multiple facts), or "complex" (reasoning required)
- specificity: "vague" (unclear), "specific" (clear), or "precise" (very detailed)
- temporality: "timeless" (general knowledge), "recent" (last year), or "time_specific" (exact dates)
- scope: "narrow" (single topic), "broad" (multiple topics), or "multi_domain" (cross-domain)
- requiresMultiHop: true if needs multiple retrieval steps, false otherwise

Query: "${query}"

Respond with ONLY valid JSON, no markdown formatting.`

    try {
      const result = await runtime.llm.generate(prompt, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', true)
      const analysis = JSON.parse(result)
      return analysis
    } catch {
      return {
        complexity: 'moderate',
        specificity: 'specific',
        temporality: 'timeless',
        scope: 'narrow',
        requiresMultiHop: false
      }
    }
  }
  
  async routeQuery(
    query: string, 
    knowledgeBaseName: string,
    documentCount: number,
    conversationContext?: Array<{ query: string; response: string }>
  ): Promise<RoutingDecision> {
    if (conversationContext) {
      this.conversationHistory = conversationContext
    }
    
    const intent = await this.classifyIntent(query)
    
    if (intent === 'chitchat') {
      return {
        intent,
        strategy: 'direct_answer',
        needsRetrieval: false,
        parallelizable: false,
        confidence: 0.95,
        reasoning: 'Casual conversation does not require knowledge base retrieval'
      }
    }
    
    if (intent === 'out_of_scope') {
      return {
        intent,
        strategy: 'direct_answer',
        needsRetrieval: false,
        parallelizable: false,
        confidence: 0.8,
        reasoning: 'Query appears outside knowledge base scope'
      }
    }
    
    const analysis = await this.analyzeQuery(query)
    
    const routingPrompt = `You are an intelligent query routing agent for a RAG system.

Knowledge Base: "${knowledgeBaseName}"
Document Count: ${documentCount}
Query Intent: ${intent}
Query Complexity: ${analysis.complexity}
Requires Multi-Hop: ${analysis.requiresMultiHop}

Query: "${query}"

${this.conversationHistory.length > 0 ? `Conversation History:\n${this.conversationHistory.map(h => `Q: ${h.query}\nA: ${h.response}`).join('\n\n')}` : ''}

Choose the best retrieval strategy:
- semantic: Use for conceptual queries requiring meaning-based matching
- keyword: Use for specific terms, IDs, proper nouns  
- hybrid: Combine semantic and keyword for balanced retrieval
- multi_query: Break query into sub-questions for complex needs
- rag_fusion: Multiple query variations + rank fusion for thorough coverage
- direct_answer: No retrieval needed, answer from model knowledge

Provide a routing plan as JSON with:
{
  "strategy": "chosen_strategy",
  "needsRetrieval": true/false,
  "parallelizable": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "subQueries": ["query1", "query2"] (only if multi_query),
  "fallbackStrategies": ["strategy1", "strategy2"] (optional fallbacks)
}

Respond with ONLY valid JSON.`

    try {
      const result = await runtime.llm.generate(routingPrompt, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', true)
      const decision = JSON.parse(result)
      
      return {
        intent,
        strategy: decision.strategy || 'hybrid',
        needsRetrieval: decision.needsRetrieval !== false,
        parallelizable: decision.parallelizable || false,
        confidence: decision.confidence || 0.7,
        reasoning: decision.reasoning || 'Automatic routing based on query analysis',
        subQueries: decision.subQueries,
        fallbackStrategies: decision.fallbackStrategies || ['hybrid', 'semantic']
      }
    } catch {
      return this.getFallbackRouting(intent, analysis)
    }
  }
  
  private getFallbackRouting(intent: QueryIntent, analysis: QueryAnalysis): RoutingDecision {
    if (analysis.complexity === 'complex' || analysis.requiresMultiHop) {
      return {
        intent,
        strategy: 'multi_query',
        needsRetrieval: true,
        parallelizable: true,
        confidence: 0.6,
        reasoning: 'Complex query detected, using multi-query strategy as fallback',
        fallbackStrategies: ['rag_fusion', 'hybrid']
      }
    }
    
    if (analysis.specificity === 'precise') {
      return {
        intent,
        strategy: 'keyword',
        needsRetrieval: true,
        parallelizable: false,
        confidence: 0.7,
        reasoning: 'Precise query detected, using keyword search',
        fallbackStrategies: ['hybrid', 'semantic']
      }
    }
    
    return {
      intent,
      strategy: 'hybrid',
      needsRetrieval: true,
      parallelizable: false,
      confidence: 0.75,
      reasoning: 'Default hybrid strategy for balanced retrieval',
      fallbackStrategies: ['semantic', 'keyword']
    }
  }
  
  async generateSubQueries(originalQuery: string, count: number = 3): Promise<string[]> {
    const prompt = `Generate ${count} different sub-queries that break down this complex query into simpler parts:

Original Query: "${originalQuery}"

Provide a JSON array of sub-queries that together would answer the original question.
Each sub-query should be standalone and focus on one aspect.

Example format: ["sub-query 1", "sub-query 2", "sub-query 3"]

Respond with ONLY valid JSON array.`

    try {
      const result = await runtime.llm.generate(prompt, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', true)
      const parsed = JSON.parse(result)
      return Array.isArray(parsed) ? parsed : [originalQuery]
    } catch {
      return [originalQuery]
    }
  }
  
  async expandQuery(query: string, variations: number = 3): Promise<string[]> {
    const prompt = `Generate ${variations} semantically similar query variations for RAG fusion:

Original: "${query}"

Create variations that:
1. Use synonyms and alternative phrasings
2. Expand abbreviations or add context
3. Rephrase from different angles

Provide JSON array: ["variation 1", "variation 2", "variation 3"]

Respond with ONLY valid JSON array.`

    try {
      const result = await runtime.llm.generate(prompt, '@cf/meta/llama-3.3-70b-instruct-fp8-fast', true)
      const parsed = JSON.parse(result)
      return Array.isArray(parsed) ? [query, ...parsed] : [query]
    } catch {
      return [query]
    }
  }
  
  evaluateRetrievalQuality(
    documents: Document[],
    query: string,
    topK: number = 5
  ): { quality: number; coverage: number; needsFallback: boolean } {
    if (documents.length === 0) {
      return { quality: 0, coverage: 0, needsFallback: true }
    }
    
    const queryTerms = query.toLowerCase().split(/\s+/)
    const relevantDocs = documents.slice(0, topK)
    
    let matchCount = 0
    relevantDocs.forEach(doc => {
      const docText = (doc.title + ' ' + doc.content).toLowerCase()
      queryTerms.forEach(term => {
        if (term.length > 3 && docText.includes(term)) {
          matchCount++
        }
      })
    })
    
    const coverage = Math.min(relevantDocs.length / topK, 1.0)
    const quality = Math.min(matchCount / (queryTerms.length * topK), 1.0)
    const needsFallback = quality < 0.3 || coverage < 0.6
    
    return { quality, coverage, needsFallback }
  }
  
  async shouldClarify(query: string, documentCount: number): Promise<{ 
    needsClarification: boolean; 
    clarificationQuestion?: string 
  }> {
    if (documentCount === 0) {
      return { needsClarification: false }
    }
    
    const analysis = await this.analyzeQuery(query)
    
    if (analysis.specificity === 'vague' && analysis.scope === 'broad') {
      const prompt = `This query is vague and broad: "${query}"

Generate a helpful clarification question to narrow the scope.
Make it specific and actionable.

Respond with just the clarification question, no explanation.`

      try {
        const question = await runtime.llm.generate(prompt, '@cf/meta/llama-3.3-70b-instruct-fp8-fast')
        return {
          needsClarification: true,
          clarificationQuestion: question.trim()
        }
      } catch {
        return { needsClarification: false }
      }
    }
    
    return { needsClarification: false }
  }
}
