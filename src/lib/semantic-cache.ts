import { runtime } from './runtime/manager'
import type { AgenticRAGResponse } from './agentic-rag-orchestrator'

export interface CachedRAGEntry {
  response: AgenticRAGResponse
  createdAt: number
  ttlMs: number
}

const CACHE_PREFIX = 'semantic-cache'
const DEFAULT_TTL_MS = 60 * 60 * 1000 // 1 hour

function hashEmbedding(values: number[]): string {
  // Simple, deterministic hash: take first 8 components
  const slice = values.slice(0, 8)
  return slice.map(v => Math.round(v * 1e4)).join(':')
}

export class SemanticCache {
  constructor(private ttlMs: number = DEFAULT_TTL_MS) {}

  private key(embedding: number[], knowledgeBaseId: string) {
    return `${CACHE_PREFIX}:${knowledgeBaseId}:${hashEmbedding(embedding)}`
  }

  async get(embedding: number[], knowledgeBaseId: string): Promise<AgenticRAGResponse | null> {
    if (!runtime.kv) return null
    const entry = await runtime.kv.get<CachedRAGEntry>(this.key(embedding, knowledgeBaseId))
    if (!entry) return null
    if (Date.now() - entry.createdAt > entry.ttlMs) {
      await runtime.kv.delete(this.key(embedding, knowledgeBaseId))
      return null
    }
    return entry.response
  }

  async set(embedding: number[], knowledgeBaseId: string, response: AgenticRAGResponse, ttlMs?: number) {
    if (!runtime.kv) return
    const record: CachedRAGEntry = {
      response,
      createdAt: Date.now(),
      ttlMs: ttlMs ?? this.ttlMs
    }
    await runtime.kv.set(this.key(embedding, knowledgeBaseId), record)
  }
}
