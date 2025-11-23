import { RuntimeAdapter, LLMProvider, KeyValueStore } from './interfaces'

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

  async get<T>(key: string): Promise<T | null> {
    const stored = localStorage.getItem(this.storagePrefix + key)
    return stored ? JSON.parse(stored) : null
  }

  async set<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(this.storagePrefix + key, JSON.stringify(value))
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.storagePrefix + key)
  }

  async has(key: string): Promise<boolean> {
    return localStorage.getItem(this.storagePrefix + key) !== null
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys: string[] = []
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
  name = 'mock'
  version = '1.0.0'

  static create(): MockRuntimeAdapter {
    return new MockRuntimeAdapter()
  }
}
