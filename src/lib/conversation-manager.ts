import { QueryIntent } from './agentic-router'
import { runtime } from './runtime/manager'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  metadata?: {
    intent?: QueryIntent
    confidence?: number
    sources?: string[]
    iterations?: number
  }
}

export interface Conversation {
  id: string
  knowledgeBaseId: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  metadata: {
    totalQueries: number
    averageConfidence: number
    lastIntent?: QueryIntent
  }
}

export class ConversationManager {
  private static STORAGE_KEY = 'conversations'
  static readonly MAX_CONVERSATIONS = 100
  static readonly MAX_MESSAGES_PER_CONVERSATION = 50

  async createConversation(knowledgeBaseId: string, initialQuery?: string): Promise<Conversation> {
    const conversation: Conversation = {
      id: this.generateId(),
      knowledgeBaseId,
      title: initialQuery?.slice(0, 50) || 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        totalQueries: 0,
        averageConfidence: 0
      }
    }

    const conversations = await this.getAllConversations()
    conversations.unshift(conversation)

    // Keep only last MAX_CONVERSATIONS
    if (conversations.length > ConversationManager.MAX_CONVERSATIONS) {
      conversations.splice(ConversationManager.MAX_CONVERSATIONS)
    }

    await runtime.kv.set(ConversationManager.STORAGE_KEY, conversations)
    return conversation
  }

  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: Message['metadata']
  ): Promise<Conversation> {
    const conversations = await this.getAllConversations()
    const conversation = conversations.find(c => c.id === conversationId)

    if (!conversation) {
      throw new Error('Conversation not found')
    }

    const isFirstUserMessage = role === 'user' && conversation.metadata.totalQueries === 0

    const message: Message = {
      id: this.generateId(),
      role,
      content,
      timestamp: Date.now(),
      metadata
    }

    conversation.messages.push(message)
    conversation.updatedAt = Date.now()

    if (isFirstUserMessage) {
      // Rename untitled conversations using the first user message
      const suggestedTitle = content.trim().slice(0, 60)
      if (suggestedTitle) {
        conversation.title = suggestedTitle
      }
    }

    // Update metadata
    if (role === 'user') {
      conversation.metadata.totalQueries++
    }
    if (metadata?.confidence) {
      const { totalQueries, averageConfidence } = conversation.metadata
      conversation.metadata.averageConfidence =
        (averageConfidence * (totalQueries - 1) + metadata.confidence) / totalQueries
    }
    if (metadata?.intent) {
      conversation.metadata.lastIntent = metadata.intent
    }

    // Keep only last MAX_MESSAGES
    if (conversation.messages.length > ConversationManager.MAX_MESSAGES_PER_CONVERSATION) {
      conversation.messages = conversation.messages.slice(-ConversationManager.MAX_MESSAGES_PER_CONVERSATION)
    }

    await runtime.kv.set(ConversationManager.STORAGE_KEY, conversations)
    return conversation
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const conversations = await this.getAllConversations()
    return conversations.find(c => c.id === conversationId) || null
  }

  async getAllConversations(): Promise<Conversation[]> {
    return await runtime.kv.get<Conversation[]>(ConversationManager.STORAGE_KEY) || []
  }

  async getConversationsByKB(knowledgeBaseId: string): Promise<Conversation[]> {
    const conversations = await this.getAllConversations()
    return conversations.filter(c => c.knowledgeBaseId === knowledgeBaseId)
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const conversations = await this.getAllConversations()
    const filtered = conversations.filter(c => c.id !== conversationId)
    await runtime.kv.set(ConversationManager.STORAGE_KEY, filtered)
  }

  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const conversations = await this.getAllConversations()
    const conversation = conversations.find(c => c.id === conversationId)

    if (conversation) {
      conversation.title = title
      conversation.updatedAt = Date.now()
      await runtime.kv.set(ConversationManager.STORAGE_KEY, conversations)
    }
  }

  getConversationHistory(conversation: Conversation): Array<{ query: string; response: string }> {
    const history: Array<{ query: string; response: string }> = []

    for (let i = 0; i < conversation.messages.length - 1; i += 2) {
      if (conversation.messages[i].role === 'user' &&
          conversation.messages[i + 1]?.role === 'assistant') {
        history.push({
          query: conversation.messages[i].content,
          response: conversation.messages[i + 1].content
        })
      }
    }

    return history
  }

  private generateId(): string {
    return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
