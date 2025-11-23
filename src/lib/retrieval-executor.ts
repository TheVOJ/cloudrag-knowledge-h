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
    // Use chunk-based retrieval if knowledge base ID is available
    if (this.knowledgeBaseId) {
      return this.chunkBasedRetrieval(query, documents, 'semantic', topK)
    }

    if (this.azureService) {
      try {
        const results = await this.azureService.search(query, topK)
        const docMap = new Map(documents.map(d => [d.id, d]))

        const retrievedDocs = results
          .map(r => docMap.get(r.id))
          .filter((d): d is Document => d !== undefined)

        // Log warning if Azure returned results that couldn't be mapped to local documents
        const unmappedCount = results.length - retrievedDocs.length
        if (unmappedCount > 0) {
          console.warn(`Azure returned ${unmappedCount} document(s) that couldn't be found in local documents. This may indicate a sync issue.`)
        }

        return {
          documents: retrievedDocs,
          scores: results.slice(0, retrievedDocs.length).map(r => r.score),
          method: 'semantic',
          queryUsed: query,
          metadata: { azureResults: results }
        }
      } catch (error) {
        console.error('Azure semantic search failed, falling back to simulated', error)
      }
    }

    return this.simulatedSemanticSearch(query, documents, topK)
  }

  private async chunkBasedRetrieval(
    query: string,
    documents: Document[],
    strategy: RetrievalStrategy,
    topK: number
  ): Promise<RetrievalResult> {
    // Generate query embedding for semantic search
    const queryEmbedding = strategy === 'semantic' ? await generateEmbedding(query) : null

    // Search chunks based on strategy
    const chunkResults = queryEmbedding
      ? await this.chunkManager.searchChunksWithEmbedding(queryEmbedding, this.knowledgeBaseId!, topK * 3)
      : await this.chunkManager.searchChunks(query, this.knowledgeBaseId!, topK * 3)

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
        uniqueDocuments: documentMap.size
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
      try {
        const results = await this.azureService.search(query, topK, undefined, 'keyword')
        const docMap = new Map(documents.map(d => [d.id, d]))

        const retrievedDocs = results
          .map(r => docMap.get(r.id))
          .filter((d): d is Document => d !== undefined)

        // Log warning if Azure returned results that couldn't be mapped to local documents
        const unmappedCount = results.length - retrievedDocs.length
        if (unmappedCount > 0) {
          console.warn(`Azure returned ${unmappedCount} document(s) that couldn't be found in local documents. This may indicate a sync issue.`)
        }

        return {
          documents: retrievedDocs,
          scores: results.slice(0, retrievedDocs.length).map(r => r.score),
          method: 'keyword',
          queryUsed: query,
          metadata: { azureResults: results }
        }
      } catch (error) {
        console.error('Azure keyword search failed, falling back to simulated', error)
      }
    }

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

    return {
      documents: topResults.map(r => r.doc),
      scores: topResults.map(r => r.score),
      method: 'hybrid',
      queryUsed: query
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
      const result = await runtime.llm.generate(prompt, 'gpt-4o-mini', true)
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
