import { describe, expect, beforeEach, test } from 'vitest'
import { ConversationManager } from '../conversation-manager'
import { MockRuntimeAdapter } from '../runtime/mock-adapter'
import { runtime } from '../runtime/manager'

// Ensure runtime uses mock KV/LLM for deterministic tests
runtime.setRuntime(MockRuntimeAdapter.create())

describe('ConversationManager', () => {
  let manager: ConversationManager

  beforeEach(() => {
    manager = new ConversationManager()
    // Clear mock storage between tests
    const mock = (runtime as any).kv as MockRuntimeAdapter['kv']
    if (mock.clear) {
      mock.clear()
    }
  })

  test('creates and retrieves a conversation', async () => {
    const convo = await manager.createConversation('kb-1', 'hello world')
    const fetched = await manager.getConversation(convo.id)

    expect(fetched?.knowledgeBaseId).toBe('kb-1')
    expect(fetched?.title).toContain('hello')
  })

  test('adds messages and builds history', async () => {
    const convo = await manager.createConversation('kb-1')
    await manager.addMessage(convo.id, 'user', 'Q1')
    await manager.addMessage(convo.id, 'assistant', 'A1')

    const updated = await manager.getConversation(convo.id)
    expect(updated?.messages.length).toBe(2)

    const history = manager.getConversationHistory(updated!)
    expect(history).toEqual([{ query: 'Q1', response: 'A1' }])
  })

  test('enforces max messages per conversation', async () => {
    const convo = await manager.createConversation('kb-1')
    for (let i = 0; i < 55; i++) {
      await manager.addMessage(convo.id, 'user', `msg-${i}`)
    }

    const updated = await manager.getConversation(convo.id)
    expect(updated?.messages.length).toBeLessThanOrEqual(50)
  })

  test('enforces max conversations cap and drops oldest', async () => {
    const limit = ConversationManager.MAX_CONVERSATIONS

    for (let i = 0; i < limit + 5; i++) {
      await manager.createConversation('kb-1', `conversation ${i}`)
    }

    const convos = await manager.getConversationsByKB('kb-1')
    expect(convos.length).toBeLessThanOrEqual(limit)
    expect(convos.find(c => c.title.includes('conversation 0'))).toBeUndefined()
  })
})
