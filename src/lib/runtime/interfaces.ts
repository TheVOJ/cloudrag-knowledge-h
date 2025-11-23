export interface LLMProvider {
  generate(prompt: string, model?: string, jsonMode?: boolean): Promise<string>
  generateStream(prompt: string, model?: string): AsyncGenerator<string, void, unknown>
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>
}

export interface VectorStore {
  upsert(vectors: Array<{ id: string; values: number[]; metadata?: Record<string, any> }>): Promise<void>
  query(
    vector: number[],
    topK?: number,
    filter?: Record<string, any>
  ): Promise<Array<{ id: string; score: number; metadata?: Record<string, any> }>>
  delete(ids: string[]): Promise<void>
}

export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  has(key: string): Promise<boolean>
  keys(prefix?: string): Promise<string[]>
}

export interface RuntimeAdapter {
  llm: LLMProvider
  kv: KeyValueStore
  embedder?: EmbeddingProvider
  vectorStore?: VectorStore
  name: string
  version: string
}
