import { RuntimeAdapter, LLMProvider, KeyValueStore, EmbeddingProvider, VectorStore } from './interfaces'
import { DEFAULT_CF_EMBEDDING_MODEL, MAX_EMBEDDING_TEXT_LENGTH } from '../embedding-constants'

/**
 * Cloudflare Workers Runtime Adapter
 * Communicates with Cloudflare Worker backend via HTTP API
 */

class CloudflareLLMProvider implements LLMProvider {
  constructor(private apiBase: string) {}

  async generate(prompt: string, model: string = '@cf/meta/llama-3.3-70b-instruct-fp8-fast', jsonMode: boolean = false): Promise<string> {
    const response = await fetch(`${this.apiBase}/api/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model, jsonMode })
    })

    if (!response.ok) {
      throw new Error(`Cloudflare Workers AI error: ${response.statusText}`)
    }

    const data = await response.json() as { response: string }
    return data.response
  }

  async *generateStream(prompt: string, model: string = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'): AsyncGenerator<string, void, unknown> {
    const response = await fetch(`${this.apiBase}/api/llm/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model })
    })

    if (!response.ok) {
      throw new Error(`Cloudflare Workers AI stream error: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No readable stream available')
    }

    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        yield chunk
      }
    } finally {
      reader.releaseLock()
    }
  }
}

class CloudflareKeyValueStore implements KeyValueStore {
  constructor(private apiBase: string) {}

  async get<T>(key: string): Promise<T | null> {
    const response = await fetch(`${this.apiBase}/api/kv/${encodeURIComponent(key)}`)

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Cloudflare KV error: ${response.statusText}`)
    }

    const data = await response.json() as { value: T | null }
    return data.value
  }

  async set<T>(key: string, value: T): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/kv/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value })
    })

    if (!response.ok) {
      throw new Error(`Cloudflare KV error: ${response.statusText}`)
    }
  }

  async delete(key: string): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/kv/${encodeURIComponent(key)}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error(`Cloudflare KV error: ${response.statusText}`)
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  async keys(prefix?: string): Promise<string[]> {
    const url = prefix
      ? `${this.apiBase}/api/kv?prefix=${encodeURIComponent(prefix)}`
      : `${this.apiBase}/api/kv`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Cloudflare KV error: ${response.statusText}`)
    }

    const data = await response.json() as { keys: string[] }
    return data.keys
  }
}

class CloudflareEmbeddingProvider implements EmbeddingProvider {
  constructor(private apiBase: string) {}

  async embed(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.apiBase}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: texts.map(text => text.substring(0, MAX_EMBEDDING_TEXT_LENGTH)),
        model: DEFAULT_CF_EMBEDDING_MODEL
      })
    })

    if (!response.ok) {
      throw new Error(`Cloudflare AI embedding error: ${response.statusText}`)
    }

    const data = await response.json() as { embeddings: number[][] }
    return data.embeddings
  }
}

class CloudflareVectorStore implements VectorStore {
  constructor(private apiBase: string) {}

  async upsert(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, any> }>): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/vector/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vectors })
    })

    if (!response.ok) {
      throw new Error(`Vector upsert failed: ${response.statusText}`)
    }
  }

  async query(
    vector: number[],
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<Array<{ id: string; score: number; metadata?: Record<string, any> }>> {
    const response = await fetch(`${this.apiBase}/api/vector/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vector, topK, filter })
    })

    if (!response.ok) {
      throw new Error(`Vector query failed: ${response.statusText}`)
    }

    const data = await response.json() as { matches: Array<{ id: string; score: number; metadata?: Record<string, any> }> }
    return data.matches || []
  }

  async delete(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    const response = await fetch(`${this.apiBase}/api/vector/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })

    if (!response.ok) {
      throw new Error(`Vector delete failed: ${response.statusText}`)
    }
  }
}

export class CloudflareRuntimeAdapter implements RuntimeAdapter {
  llm: LLMProvider
  kv: KeyValueStore
  embedder?: EmbeddingProvider
  vectorStore?: VectorStore
  name = 'cloudflare'
  version = '1.0.0'
  private apiBase: string

  constructor(apiBase?: string) {
    // Use same origin by default (Worker serves the app)
    this.apiBase = apiBase || (typeof window !== 'undefined' ? window.location.origin : '')
    this.llm = new CloudflareLLMProvider(this.apiBase)
    this.kv = new CloudflareKeyValueStore(this.apiBase)
    this.embedder = new CloudflareEmbeddingProvider(this.apiBase)
    this.vectorStore = new CloudflareVectorStore(this.apiBase)
  }

  static isAvailable(): boolean {
    // Check if we're in a browser environment (not SSR)
    // The Worker API will be available at runtime
    return typeof window !== 'undefined' && typeof fetch !== 'undefined'
  }
}
