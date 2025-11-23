export interface LLMProvider {
  generate(prompt: string, model?: string, jsonMode?: boolean): Promise<string>
  generateStream(prompt: string, model?: string): AsyncGenerator<string, void, unknown>
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
  name: string
  version: string
}
