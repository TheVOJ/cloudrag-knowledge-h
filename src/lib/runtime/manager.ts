import { RuntimeAdapter } from './interfaces'
import { CloudflareRuntimeAdapter } from './cloudflare-adapter'
import { MockRuntimeAdapter } from './mock-adapter'

class RuntimeManager {
  private static instance: RuntimeManager
  private adapter: RuntimeAdapter

  private constructor() {
    // Auto-detect best available runtime
    if (CloudflareRuntimeAdapter.isAvailable()) {
      this.adapter = new CloudflareRuntimeAdapter()
      console.log('✓ Using Cloudflare Workers Runtime')
    } else {
      console.warn('⚠ Cloudflare Workers not available, using Mock Runtime')
      this.adapter = new MockRuntimeAdapter()
    }
  }

  static getInstance(): RuntimeManager {
    if (!RuntimeManager.instance) {
      RuntimeManager.instance = new RuntimeManager()
    }
    return RuntimeManager.instance
  }

  getRuntime(): RuntimeAdapter {
    return this.adapter
  }

  setRuntime(adapter: RuntimeAdapter) {
    this.adapter = adapter
    console.log(`✓ Switched to ${adapter.name} runtime`)
  }

  // Convenience methods
  get llm() {
    return this.adapter.llm
  }

  get kv() {
    return this.adapter.kv
  }
}

// Export singleton instance
export const runtime = RuntimeManager.getInstance()

// Also export the class for testing
export { RuntimeManager }
