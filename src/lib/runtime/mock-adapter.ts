import { RuntimeAdapter, LLMProvider, KeyValueStore, EmbeddingProvider, VectorStore } from './interfaces'

export class MockLLMProvider implements LLMProvider {
  private responses: Map<string, string> = new Map()

  async generate(prompt: string, model?: string, jsonMode?: boolean): Promise<string> {
    // Return canned responses for testing
    if (jsonMode) {
      return JSON.stringify({ mock: true, prompt: prompt.slice(0, 50) })
    }

    return this.responses.get(prompt) ||
           `Mock response for: ${prompt.slice(0, 100)}`
  }

  async *generateStream(prompt: string): AsyncGenerator<string, void, unknown> {
    const response = await this.generate(prompt)
    const words = response.split(' ')

    for (const word of words) {
      yield word + ' '
    }
  }

  setMockResponse(prompt: string, response: string) {
    this.responses.set(prompt, response)
  }

  clearMockResponses() {
    this.responses.clear()
  }
}

export class MockKeyValueStore implements KeyValueStore {
  private storagePrefix = 'mock-kv:'
  private memoryStore: Map<string, string> | null = typeof localStorage === 'undefined' ? new Map() : null

  async get<T>(key: string): Promise<T | null> {
    if (this.memoryStore) {
      const stored = this.memoryStore.get(this.storagePrefix + key)
      return stored ? JSON.parse(stored) : null
    }
    const stored = localStorage.getItem(this.storagePrefix + key)
    return stored ? JSON.parse(stored) : null
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.memoryStore) {
      this.memoryStore.set(this.storagePrefix + key, JSON.stringify(value))
      return
    }
    localStorage.setItem(this.storagePrefix + key, JSON.stringify(value))
  }

  async delete(key: string): Promise<void> {
    if (this.memoryStore) {
      this.memoryStore.delete(this.storagePrefix + key)
      return
    }
    localStorage.removeItem(this.storagePrefix + key)
  }

  async has(key: string): Promise<boolean> {
    if (this.memoryStore) {
      return this.memoryStore.has(this.storagePrefix + key)
    }
    return localStorage.getItem(this.storagePrefix + key) !== null
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys: string[] = []
    if (this.memoryStore) {
      for (const key of this.memoryStore.keys()) {
        if (key.startsWith(this.storagePrefix)) {
          const cleanKey = key.substring(this.storagePrefix.length)
          if (!prefix || cleanKey.startsWith(prefix)) {
            allKeys.push(cleanKey)
          }
        }
      }
      return allKeys
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.storagePrefix)) {
        const cleanKey = key.substring(this.storagePrefix.length)
        if (!prefix || cleanKey.startsWith(prefix)) {
          allKeys.push(cleanKey)
        }
      }
    }
    return allKeys
  }

  clear() {
    if (this.memoryStore) {
      this.memoryStore.clear()
      return
    }

    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.storagePrefix)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
  }
}

export class MockRuntimeAdapter implements RuntimeAdapter {
  llm: MockLLMProvider = new MockLLMProvider()
  kv: MockKeyValueStore = new MockKeyValueStore()
  embedder: EmbeddingProvider = {
    embed: async (texts: string[]) => texts.map(t => generateDeterministicEmbedding(t))
  }
  vectorStore: VectorStore = new InMemoryVectorStore()
  name = 'mock'
  version = '1.0.0'

  static create(): MockRuntimeAdapter {
    return new MockRuntimeAdapter()
  }
}

// Simple deterministic embedding for tests
function generateDeterministicEmbedding(text: string): number[] {
  const hash = simpleHash(text)
  const embedding: number[] = []
  for (let i = 0; i < 384; i++) {
    const value = Math.sin(hash * (i + 1)) * Math.cos(hash * (i + 1) * 0.5)
    embedding.push(value)
  }
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return embedding.map((val) => val / magnitude)
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) + 1
}

class InMemoryVectorStore implements VectorStore {
  private store = new Map<string, { values: number[]; metadata?: Record<string, any> }>()

  async upsert(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, any> }>): Promise<void> {
    vectors.forEach(v => this.store.set(v.id, { values: v.values, metadata: v.metadata }))
  }

  async query(vector: number[], topK: number = 5, filter?: Record<string, any>): Promise<Array<{ id: string; score: number; metadata?: Record<string, any> }>> {
    const results: Array<{ id: string; score: number; metadata?: Record<string, any> }> = []
    for (const [id, entry] of this.store.entries()) {
      if (filter && filter.kbId && entry.metadata?.kbId !== filter.kbId) continue
      const score = cosineSimilarity(vector, entry.values)
      results.push({ id, score, metadata: entry.metadata })
    }
    return results.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  async delete(ids: string[]): Promise<void> {
    ids.forEach(id => this.store.delete(id))
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}
