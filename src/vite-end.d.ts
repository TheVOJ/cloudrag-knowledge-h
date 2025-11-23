/// <reference types="vite/client" />
declare const GITHUB_RUNTIME_PERMANENT_NAME: string
declare const BASE_KV_SERVICE_URL: string

// Cloudflare Spark Runtime Types
declare global {
  interface Window {
    spark?: {
      llm: (prompt: string, model?: string, jsonMode?: boolean) => Promise<string>
      kv: {
        get: <T>(key: string) => Promise<T | null>
        set: <T>(key: string, value: T) => Promise<void>
        delete: (key: string) => Promise<void>
      }
      ai: {
        run: (model: string, input: any) => Promise<any>
      }
    }
  }
}