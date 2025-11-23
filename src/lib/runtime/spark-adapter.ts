import { RuntimeAdapter, LLMProvider, KeyValueStore, EmbeddingProvider } from './interfaces'
import { DEFAULT_CF_EMBEDDING_MODEL, EMBEDDING_DIMENSION, MAX_EMBEDDING_TEXT_LENGTH } from '../embedding-constants'

class SparkLLMProvider implements LLMProvider {
  async generate(prompt: string, model: string = '@cf/meta/llama-3.3-70b-instruct-fp8-fast', jsonMode: boolean = false): Promise<string> {
    if (typeof window === 'undefined' || !window.spark?.llm) {
      throw new Error('Spark LLM not available')
    }
    return await window.spark.llm(prompt, model, jsonMode)
  }

  async *generateStream(prompt: string, model: string = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'): AsyncGenerator<string, void, unknown> {
    // Spark doesn't support streaming yet, simulate it
    const result = await this.generate(prompt, model)
    const words = result.split(' ')

    for (const word of words) {
      yield word + ' '
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}

class SparkEmbeddingProvider implements EmbeddingProvider {
  async embed(texts: string[]): Promise<number[][]> {
    if (typeof window === 'undefined' || !window.spark?.ai) {
      throw new Error('Spark AI not available for embeddings')
    }

    // Use Cloudflare's DEFAULT_CF_EMBEDDING_MODEL embedding (aligned with Vectorize dimensions)
    const embeddings: number[][] = []

    for (const text of texts) {
      try {
        const response = await window.spark.ai.run(DEFAULT_CF_EMBEDDING_MODEL, {
          text: text.substring(0, MAX_EMBEDDING_TEXT_LENGTH) // Limit to model's token limit
        })

        // Response format: { shape: [1, EMBEDDING_DIMENSION], data: [[...embedding...]] }
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          embeddings.push(response.data[0])
        } else {
          // Fallback to simulated embedding
          embeddings.push(this.generateFallbackEmbedding(text))
        }
      } catch (error) {
        console.warn(`Failed to generate embedding for text, using fallback:`, error)
        embeddings.push(this.generateFallbackEmbedding(text))
      }
    }

    return embeddings
  }

  private generateFallbackEmbedding(text: string): number[] {
    // Simple hash-based embedding aligned with EMBEDDING_DIMENSION
    const hash = this.simpleHash(text)
    const embedding: number[] = []

    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      const value = Math.sin(hash * (i + 1)) * Math.cos(hash * (i + 1) * 0.5)
      embedding.push(value)
    }

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map((val) => val / magnitude)
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash
    }
    return hash
  }
}

class SparkKeyValueStore implements KeyValueStore {
  async get<T>(key: string): Promise<T | null> {
    if (typeof window === 'undefined' || !window.spark?.kv) {
      throw new Error('Spark KV not available')
    }
    return await window.spark.kv.get<T>(key)
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (typeof window === 'undefined' || !window.spark?.kv) {
      throw new Error('Spark KV not available')
    }
    await window.spark.kv.set(key, value)
  }

  async delete(key: string): Promise<void> {
    if (typeof window === 'undefined' || !window.spark?.kv) {
      throw new Error('Spark KV not available')
    }
    await window.spark.kv.delete(key)
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key)
    return value !== null
  }

  async keys(prefix?: string): Promise<string[]> {
    // Spark KV doesn't support key listing, return empty array
    console.warn('Spark KV does not support key listing')
    return []
  }
}

export class SparkRuntimeAdapter implements RuntimeAdapter {
  llm: LLMProvider = new SparkLLMProvider()
  kv: KeyValueStore = new SparkKeyValueStore()
  embedder?: EmbeddingProvider = new SparkEmbeddingProvider()
  name = 'spark'
  version = '1.0.0'

  static isAvailable(): boolean {
    return typeof window !== 'undefined' &&
           window.spark !== undefined &&
           window.spark.llm !== undefined &&
           window.spark.kv !== undefined
  }
}
