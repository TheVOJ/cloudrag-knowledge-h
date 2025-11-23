import { RuntimeAdapter, LLMProvider, KeyValueStore } from './interfaces'

class SparkLLMProvider implements LLMProvider {
  async generate(prompt: string, model: string = 'gpt-4o', jsonMode: boolean = false): Promise<string> {
    if (typeof window === 'undefined' || !window.spark?.llm) {
      throw new Error('Spark LLM not available')
    }
    return await window.spark.llm(prompt, model, jsonMode)
  }

  async *generateStream(prompt: string, model: string = 'gpt-4o'): AsyncGenerator<string, void, unknown> {
    // Spark doesn't support streaming yet, simulate it
    const result = await this.generate(prompt, model)
    const words = result.split(' ')

    for (const word of words) {
      yield word + ' '
      await new Promise(resolve => setTimeout(resolve, 50))
    }
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
  name = 'spark'
  version = '1.0.0'

  static isAvailable(): boolean {
    return typeof window !== 'undefined' &&
           window.spark !== undefined &&
           window.spark.llm !== undefined &&
           window.spark.kv !== undefined
  }
}
