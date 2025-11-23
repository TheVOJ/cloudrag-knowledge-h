import { Document, DocumentChunk } from './types'
import { RetrievalStrategy } from './agentic-router'
import { AzureSearchService, SearchResult } from './azure-search'
import { ChunkManager } from './chunk-manager'
import { generateEmbedding } from './chunking'
import { runtime } from './runtime/manager'

export type RetrievalResult = {
  documents: Document[]
  scores: number[]
  method: RetrievalStrategy
  queryUsed: string
  metadata?: {
    azureResults?: SearchResult[]
    subQueryResults?: Map<string, RetrievalResult>
    ragFusionVariations?: string[]
    chunkBased?: boolean
    totalChunks?: number
    uniqueDocuments?: number
    fallbackReason?: string
    retrievalBackend?: 'azure' | 'local'
    cacheHit?: boolean
  }
}

/**
 * Executes document retrieval using various search strategies.
 *
 * This class abstracts the complexity of different retrieval methods and search backends
 * (Azure AI Search vs. Simulated Local Search).
 *
 * Supported Strategies:
 * - Semantic: Embedding-based vector search
 * - Keyword: Token-matching (BM25-style)
 * - Hybrid: Weighted combination of Semantic and Keyword
 * - Multi-Query: Parallel execution of decomposed sub-queries
 * - RAG Fusion: Query expansion with Reciprocal Rank Fusion (RRF)
 */
export class RetrievalExecutor {
  private azureService?: AzureSearchService
  private chunkManager: ChunkManager
  private knowledgeBaseId?: string
  private chunkSearchCache = new Map<string, { timestamp: number; results: Array<{ chunk: DocumentChunk; score: number }> }>()
  private chunkCacheTtlMs = 20000
  private azureTimeoutMs = 5000

  constructor(
    azureEndpoint?: string,
    azureApiKey?: string,
    azureIndexName?: string,
    knowledgeBaseId?: string
  ) {
    if (azureEndpoint && azureApiKey && azureIndexName) {
      this.azureService = new AzureSearchService({
        endpoint: azureEndpoint,
        apiKey: azureApiKey,
        indexName: azureIndexName,
      })
    }
    this.chunkManager = new ChunkManager()
    this.knowledgeBaseId = knowledgeBaseId
  }

  async executeRetrieval(
    query: string,
    documents: Document[],
    strategy: RetrievalStrategy,
    topK: number = 5,
    subQueries?: string[]
  ): Promise<RetrievalResult> {
    switch (strategy) {
      case 'semantic':
        return this.semanticRetrieval(query, documents, topK)

      case 'keyword':
        return this.keywordRetrieval(query, documents, topK)

      case 'hybrid':
        return this.hybridRetrieval(query, documents, topK)

      case 'multi_query':
        return this.multiQueryRetrieval(query, documents, topK, subQueries)

      case 'rag_fusion':
        return this.ragFusionRetrieval(query, documents, topK)

      case 'direct_answer':
        return {
          documents: [],
          scores: [],
          method: 'direct_answer',
          queryUsed: query
        }

      default:
        return this.hybridRetrieval(query, documents, topK)
    }
  }

  private async semanticRetrieval(
    query: string,
    documents: Document[],
    topK: number
  ): Promise<RetrievalResult> {
    // Azure vector search first when configured
    let fallbackReason: string | undefined
    if (this.azureService) {
      try {
        // Generate query embedding for vector search
        const queryEmbedding = await generateEmbedding(query)

        // Use Azure's native vector search with embeddings aligned to the configured dimension
        const results = await this.azureService.vectorSearch(
          queryEmbedding,
          topK,
          undefined,
          { timeoutMs: this.azureTimeoutMs }
        )

        const docMap = new Map(documents.map(d => [d.id, d]))

        const retrievedDocs = results
          .map(r => docMap.get(r.id) || (r.documentId ? docMap.get(r.documentId) : undefined))
          .filter((d): d is Document => d !== undefined)

        if (retrievedDocs.length > 0) {
          return {
            documents: retrievedDocs,
            scores: results.slice(0, retrievedDocs.length).map(r => r.score),
            method: 'semantic',
            queryUsed: query,
            metadata: { azureResults: results, retrievalBackend: 'azure' }
          }
        }
        fallbackReason = 'Azure vector search returned no mapped documents'
        console.warn('Azure vector search returned no mappable documents, falling back to chunks/local')
      } catch (error) {
        fallbackReason = error instanceof Error ? error.message : 'Azure vector search failed'
        console.error('Azure vector search failed, falling back to local', error)
      }
    }

    if (this.knowledgeBaseId) {
      const fallback = await this.chunkBasedRetrieval(query, documents, 'semantic', topK)
      return {
        ...fallback,
        metadata: { ...fallback.metadata, fallbackReason }
      }
    }

    const simulated = await this.simulatedSemanticSearch(query, documents, topK)
    return {
      ...simulated,
      metadata: { ...simulated.metadata, fallbackReason }
    }
  }

  private async chunkBasedRetrieval(
    query: string,
    documents: Document[],
    strategy: RetrievalStrategy,
    topK: number
  ): Promise<RetrievalResult> {
    if (!this.knowledgeBaseId) {
      return this.simulatedSemanticSearch(query, documents, topK)
    }
    // Generate query embedding for semantic search
    const queryEmbedding = strategy === 'semantic' ? await generateEmbedding(query) : null

    const cacheKey = `${this.knowledgeBaseId}:${strategy}:${query}:${topK}`
    const cached = this.chunkSearchCache.get(cacheKey)
    const now = Date.now()

    let chunkResults: Array<{ chunk: DocumentChunk; score: number }> = []

    if (cached && now - cached.timestamp < this.chunkCacheTtlMs) {
      chunkResults = cached.results
    } else {
      if (queryEmbedding && runtime.vectorStore) {
        try {
          const matches = await runtime.vectorStore.query(queryEmbedding, topK * 3, { kbId: this.knowledgeBaseId })
          const allChunks = await this.chunkManager.getChunksByKB(this.knowledgeBaseId)
          const chunkMap = new Map(allChunks.map(c => [c.id, c]))
          chunkResults = matches
            .map(m => {
              const chunk = chunkMap.get(m.id)
              return chunk ? { chunk, score: m.score } : null
            })
            .filter((v): v is { chunk: DocumentChunk; score: number } => Boolean(v))
        } catch (error) {
          console.warn('Vector query failed; falling back to KV chunk search', error)
        }
      }

      if (chunkResults.length === 0) {
        // Fallback to KV-based search
        chunkResults = queryEmbedding
          ? await this.chunkManager.searchChunksWithEmbedding(queryEmbedding, this.knowledgeBaseId!, topK * 3)
          : await this.chunkManager.searchChunks(query, this.knowledgeBaseId!, topK * 3)
      }

      this.chunkSearchCache.set(cacheKey, { timestamp: now, results: chunkResults })
    }

    // Map chunks back to documents with context
    const documentMap = new Map<string, {
      doc: Document
      chunks: Array<{ chunk: DocumentChunk; score: number }>
      maxScore: number
    }>()

    for (const result of chunkResults) {
      const doc = documents.find(d => d.id === result.chunk.documentId)
      if (!doc) continue

      if (!documentMap.has(doc.id)) {
        documentMap.set(doc.id, {
          doc,
          chunks: [],
          maxScore: 0
        })
      }

      const entry = documentMap.get(doc.id)!
      entry.chunks.push(result)
      entry.maxScore = Math.max(entry.maxScore, result.score)
    }

    // Sort by max chunk score and take topK documents
    const sortedDocs = Array.from(documentMap.values())
      .sort((a, b) => b.maxScore - a.maxScore)
      .slice(0, topK)

    // Create enhanced documents with chunk context
    const retrievedDocs = sortedDocs.map(entry => {
      // Combine top 3 chunks for this document
      const topChunks = entry.chunks
        .slice(0, 3)
        .map(c => c.chunk.text)
        .join('\n\n---\n\n')

      return {
        ...entry.doc,
        content: topChunks // Use chunk content instead of full document
      }
    })

    return {
      documents: retrievedDocs,
      scores: sortedDocs.map(e => e.maxScore),
      method: strategy,
      queryUsed: query,
      metadata: {
        chunkBased: true,
        totalChunks: chunkResults.length,
        uniqueDocuments: documentMap.size,
        retrievalBackend: 'local',
        cacheHit: Boolean(cached)
      }
    }
  }

  private async simulatedSemanticSearch(
    query: string,
    documents: Document[],
    topK: number
  ): Promise<RetrievalResult> {
    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(/\s+/)

    const scored = documents.map(doc => {
      const text = (doc.title + ' ' + doc.content).toLowerCase()
      let score = 0

      queryTerms.forEach(term => {
        if (term.length > 2) {
          const termCount = (text.match(new RegExp(term, 'g')) || []).length
          score += termCount * (term.length / 10)
        }
      })

      if (text.includes(queryLower)) {
        score += 5
      }

      return { doc, score: Math.min(score / 10, 1) }
    })

    scored.sort((a, b) => b.score - a.score)
    const topResults = scored.slice(0, topK)

    return {
      documents: topResults.map(r => r.doc),
      scores: topResults.map(r => r.score),
      method: 'semantic',
      queryUsed: query
    }
  }

  private async keywordRetrieval(
    query: string,
    documents: Document[],
    topK: number
  ): Promise<RetrievalResult> {
    if (this.azureService) {
      let fallbackReason: string | undefined
      try {
        const results = await this.azureService.search(query, topK, undefined, 'keyword', {
          timeoutMs: this.azureTimeoutMs
        })
        const docMap = new Map(documents.map(d => [d.id, d]))

        const retrievedDocs = results
          .map(r => docMap.get(r.id) || (r.documentId ? docMap.get(r.documentId) : undefined))
          .filter((d): d is Document => d !== undefined)

        const unmappedCount = results.length - retrievedDocs.length
        if (unmappedCount > 0) {
          console.warn(`Azure returned ${unmappedCount} document(s) that couldn't be found in local documents. This may indicate a sync issue.`)
        }

        if (retrievedDocs.length > 0) {
          return {
            documents: retrievedDocs,
            scores: results.slice(0, retrievedDocs.length).map(r => r.score),
            method: 'keyword',
            queryUsed: query,
            metadata: { azureResults: results, retrievalBackend: 'azure' }
          }
        }
        fallbackReason = 'Azure keyword search returned no mapped documents'
        console.warn('Azure keyword search returned no mappable documents, falling back to local search')
      } catch (error) {
        fallbackReason = error instanceof Error ? error.message : 'Azure keyword search failed'
        console.error('Azure keyword search failed, falling back to simulated', error)
      }
      if (this.knowledgeBaseId) {
        const fallback = await this.chunkBasedRetrieval(query, documents, 'keyword', topK)
        return {
          ...fallback,
          metadata: { ...fallback.metadata, fallbackReason }
        }
      }

      const simulatedFallback = await this.simulatedKeywordRetrieval(query, documents, topK)
      return {
        ...simulatedFallback,
        metadata: { ...simulatedFallback.metadata, fallbackReason }
      }
    }

    if (this.knowledgeBaseId) {
      return this.chunkBasedRetrieval(query, documents, 'keyword', topK)
    }

    return this.simulatedKeywordRetrieval(query, documents, topK)
  }

  private async simulatedKeywordRetrieval(
    query: string,
    documents: Document[],
    topK: number
  ): Promise<RetrievalResult> {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)

    const scored = documents.map(doc => {
      const text = (doc.title + ' ' + doc.content).toLowerCase()
      const words = text.split(/\s+/)

      let exactMatches = 0
      queryTerms.forEach(term => {
        exactMatches += words.filter(w => w === term).length
      })

      const score = exactMatches / (queryTerms.length * 5)
      return { doc, score: Math.min(score, 1) }
    })

    scored.sort((a, b) => b.score - a.score)
    const topResults = scored.slice(0, topK)

    return Promise.resolve({
      documents: topResults.map(r => r.doc),
      scores: topResults.map(r => r.score),
      method: 'keyword',
      queryUsed: query
    })
  }

  private async hybridRetrieval(
    query: string,
    documents: Document[],
    topK: number
  ): Promise<RetrievalResult> {
    // Azure hybrid search with semantic reranking first when configured
    let fallbackReason: string | undefined
    if (this.azureService) {
      try {
        // Generate query embedding for hybrid search
        const queryEmbedding = await generateEmbedding(query)

        // Use Azure's native hybrid search with vector + keyword + L2 semantic reranking
        const results = await this.azureService.hybridSearch(
          query,
          queryEmbedding,
          topK,
          true,  // Enable semantic reranking
          undefined,
          { timeoutMs: this.azureTimeoutMs }
        )

        const docMap = new Map(documents.map(d => [d.id, d]))

        const retrievedDocs = results
          .map(r => docMap.get(r.id) || (r.documentId ? docMap.get(r.documentId) : undefined))
          .filter((d): d is Document => d !== undefined)

        if (retrievedDocs.length > 0) {
          return {
            documents: retrievedDocs,
            scores: results.slice(0, retrievedDocs.length).map(r => r.rerankerScore || r.score),
            method: 'hybrid',
            queryUsed: query,
            metadata: { azureResults: results, retrievalBackend: 'azure' }
          }
        }
        fallbackReason = 'Azure hybrid search returned no mapped documents'
        console.warn('Azure hybrid search returned no mappable documents, falling back to manual hybrid')
      } catch (error) {
        fallbackReason = error instanceof Error ? error.message : 'Azure hybrid search failed'
        console.error('Azure hybrid search failed, falling back to manual hybrid', error)
      }
    }

    // Fallback to manual hybrid retrieval (semantic + keyword fusion)
    const [semanticResult, keywordResult] = await Promise.all([
      this.semanticRetrieval(query, documents, topK * 2),
      this.keywordRetrieval(query, documents, topK * 2)
    ])

    const scoreMap = new Map<string, { doc: Document; semanticScore: number; keywordScore: number }>()

    semanticResult.documents.forEach((doc, i) => {
      scoreMap.set(doc.id, {
        doc,
        semanticScore: semanticResult.scores[i] || 0,
        keywordScore: 0
      })
    })

    keywordResult.documents.forEach((doc, i) => {
      const existing = scoreMap.get(doc.id)
      if (existing) {
        existing.keywordScore = keywordResult.scores[i] || 0
      } else {
        scoreMap.set(doc.id, {
          doc,
          semanticScore: 0,
          keywordScore: keywordResult.scores[i] || 0
        })
      }
    })

    const hybridScored = Array.from(scoreMap.values()).map(item => ({
      doc: item.doc,
      score: (item.semanticScore * 0.6) + (item.keywordScore * 0.4)
    }))

    hybridScored.sort((a, b) => b.score - a.score)
    const topResults = hybridScored.slice(0, topK)

    const combinedFallbackReason = fallbackReason || semanticResult.metadata?.fallbackReason || keywordResult.metadata?.fallbackReason
    const chunkBased = semanticResult.metadata?.chunkBased || keywordResult.metadata?.chunkBased

    return {
      documents: topResults.map(r => r.doc),
      scores: topResults.map(r => r.score),
      method: 'hybrid',
      queryUsed: query,
      metadata: combinedFallbackReason || chunkBased ? {
        fallbackReason: combinedFallbackReason,
        chunkBased,
        retrievalBackend: semanticResult.metadata?.retrievalBackend || keywordResult.metadata?.retrievalBackend || 'local'
      } : undefined
    }
  }

  private async multiQueryRetrieval(
    query: string,
    documents: Document[],
    topK: number,
    subQueries?: string[]
  ): Promise<RetrievalResult> {
    if (!subQueries || subQueries.length === 0) {
      return this.hybridRetrieval(query, documents, topK)
    }

    const results = await Promise.all(
      subQueries.map(sq => this.hybridRetrieval(sq, documents, topK))
    )

    const scoreMap = new Map<string, { doc: Document; totalScore: number; appearances: number }>()

    results.forEach(result => {
      result.documents.forEach((doc, i) => {
        const score = result.scores[i] || 0
        const existing = scoreMap.get(doc.id)

        if (existing) {
          existing.totalScore += score
          existing.appearances++
        } else {
          scoreMap.set(doc.id, {
            doc,
            totalScore: score,
            appearances: 1
          })
        }
      })
    })

    const aggregated = Array.from(scoreMap.values()).map(item => ({
      doc: item.doc,
      score: (item.totalScore / item.appearances) * (1 + (item.appearances * 0.1))
    }))

    aggregated.sort((a, b) => b.score - a.score)
    const topResults = aggregated.slice(0, topK)

    const subQueryResultsMap = new Map<string, RetrievalResult>()
    subQueries.forEach((sq, i) => {
      subQueryResultsMap.set(sq, results[i])
    })

    return {
      documents: topResults.map(r => r.doc),
      scores: topResults.map(r => r.score),
      method: 'multi_query',
      queryUsed: query,
      metadata: { subQueryResults: subQueryResultsMap }
    }
  }

  private async ragFusionRetrieval(
    query: string,
    documents: Document[],
    topK: number
  ): Promise<RetrievalResult> {
    const variations = await this.generateQueryVariations(query)

    const results = await Promise.all(
      variations.map(v => this.hybridRetrieval(v, documents, topK * 2))
    )

    const rrfScores = this.reciprocalRankFusion(results, topK)

    return {
      documents: rrfScores.map(r => r.doc),
      scores: rrfScores.map(r => r.score),
      method: 'rag_fusion',
      queryUsed: query,
      metadata: { ragFusionVariations: variations }
    }
  }

  private async generateQueryVariations(query: string): Promise<string[]> {
    const prompt = `Generate 3 semantically similar query variations:

Original: "${query}"

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

  private reciprocalRankFusion(
    results: RetrievalResult[],
    topK: number,
    k: number = 60
  ): Array<{ doc: Document; score: number }> {
    const rrfScores = new Map<string, { doc: Document; score: number }>()

    results.forEach(result => {
      result.documents.forEach((doc, rank) => {
        const rrfScore = 1 / (k + rank + 1)
        const existing = rrfScores.get(doc.id)

        if (existing) {
          existing.score += rrfScore
        } else {
          rrfScores.set(doc.id, { doc, score: rrfScore })
        }
      })
    })

    const sorted = Array.from(rrfScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    const maxScore = sorted[0]?.score || 1
    return sorted.map(item => ({
      doc: item.doc,
      score: item.score / maxScore
    }))
  }
}
