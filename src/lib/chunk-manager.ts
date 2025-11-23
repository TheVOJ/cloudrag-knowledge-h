import { DocumentChunk, SourceType } from './types'
import { chunkAndEmbed, CHUNKING_STRATEGIES, cosineSimilarity } from './chunking'
import { generateId } from './helpers'
import { runtime } from './runtime/manager'

export class ChunkManager {
  private static STORAGE_KEY_PREFIX = 'chunks'

  async chunkDocument(
    documentId: string,
    knowledgeBaseId: string,
    title: string,
    content: string,
    sourceType: SourceType,
    sourceUrl: string,
    strategy: 'fixed' | 'sentence' | 'paragraph' | 'semantic' = 'semantic'
  ): Promise<DocumentChunk[]> {
    // Use chunking.ts implementation
    const chunks = await chunkAndEmbed(content, strategy)

    const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
      id: generateId(),
      documentId,
      knowledgeBaseId,
      chunkIndex: index,
      text: chunk.text,
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex,
      tokens: chunk.tokens,
      embedding: chunk.embedding,
      metadata: {
        strategy,
        parentDocument: {
          title,
          sourceType,
          sourceUrl
        }
      },
      createdAt: Date.now()
    }))

    // Store chunks
    await this.saveChunks(knowledgeBaseId, documentChunks)

    // Upsert into vector store when available
    if (runtime.vectorStore) {
      try {
        await runtime.vectorStore.upsert(
          documentChunks
            .filter(c => c.embedding && c.embedding.length > 0)
            .map(c => ({
              id: c.id,
              values: c.embedding!,
              metadata: {
                kbId: knowledgeBaseId,
                docId: documentId,
                chunkIndex: c.chunkIndex,
              }
            }))
        )
      } catch (error) {
        console.warn('Vector upsert failed; continuing without vector index', error)
      }
    }

    return documentChunks
  }

  async saveChunks(knowledgeBaseId: string, chunks: DocumentChunk[]): Promise<void> {
    const storageKey = `${ChunkManager.STORAGE_KEY_PREFIX}-${knowledgeBaseId}`
    const existing = await this.getChunksByKB(knowledgeBaseId)
    const updated = [...existing, ...chunks]
    await runtime.kv.set(storageKey, updated)
  }

  async getChunksByKB(knowledgeBaseId: string): Promise<DocumentChunk[]> {
    const storageKey = `${ChunkManager.STORAGE_KEY_PREFIX}-${knowledgeBaseId}`
    return await runtime.kv.get<DocumentChunk[]>(storageKey) || []
  }

  async getChunksByDocument(documentId: string, knowledgeBaseId: string): Promise<DocumentChunk[]> {
    const chunks = await this.getChunksByKB(knowledgeBaseId)
    return chunks.filter(c => c.documentId === documentId)
  }

  async deleteChunksByDocument(documentId: string, knowledgeBaseId: string): Promise<void> {
    const storageKey = `${ChunkManager.STORAGE_KEY_PREFIX}-${knowledgeBaseId}`
    const chunks = await this.getChunksByKB(knowledgeBaseId)
    const filtered = chunks.filter(c => c.documentId !== documentId)
    await runtime.kv.set(storageKey, filtered)

    if (runtime.vectorStore) {
      const idsToDelete = chunks.filter(c => c.documentId === documentId).map(c => c.id)
      try {
        await runtime.vectorStore.delete(idsToDelete)
      } catch (error) {
        console.warn('Vector delete failed; chunks removed from KV only', error)
      }
    }
  }

  async deleteChunksByKB(knowledgeBaseId: string): Promise<void> {
    const storageKey = `${ChunkManager.STORAGE_KEY_PREFIX}-${knowledgeBaseId}`
    await runtime.kv.delete(storageKey)

    if (runtime.vectorStore) {
      const chunks = await this.getChunksByKB(knowledgeBaseId)
      const idsToDelete = chunks.map(c => c.id)
      try {
        await runtime.vectorStore.delete(idsToDelete)
      } catch (error) {
        console.warn('Vector delete failed during KB purge', error)
      }
    }
  }

  async searchChunks(
    query: string,
    knowledgeBaseId: string,
    topK: number = 5
  ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
    const chunks = await this.getChunksByKB(knowledgeBaseId)

    // Simple keyword-based scoring
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)

    const scored = chunks.map(chunk => {
      const text = chunk.text.toLowerCase()
      let score = 0

      queryTerms.forEach(term => {
        const count = (text.match(new RegExp(term, 'g')) || []).length
        score += count * (term.length / 10)
      })

      if (text.includes(query.toLowerCase())) {
        score += 5
      }

      return { chunk, score: Math.min(score / 10, 1) }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  async searchChunksWithEmbedding(
    queryEmbedding: number[],
    knowledgeBaseId: string,
    topK: number = 5
  ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
    const chunks = await this.getChunksByKB(knowledgeBaseId)

    const scored = chunks
      .filter(c => c.embedding)
      .map(chunk => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding!)
      }))

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }
}
