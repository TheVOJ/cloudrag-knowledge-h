# Agentic Workflow Implementation Plan

## Overview

This document provides a detailed, step-by-step implementation plan to address the 10 critical gaps identified in the agentic RAG workflow. Each phase includes specific tasks, code examples, file modifications, testing strategies, and success criteria.

**Target Timeline**: 14-20 weeks total
- Phase 1 (Critical Foundation): 2-3 weeks
- Phase 2 (Quality & Integration): 4-6 weeks  
- Phase 3 (Advanced Features): 8-12 weeks

---

# Phase 1: Critical Foundation (Weeks 1-3)

## 1.1 Conversation Memory & State Management (Week 1)

### Objective
Replace ephemeral conversation history with persistent session management that survives page refreshes and enables true multi-turn conversations.

### Step 1.1.1: Create ConversationManager Service

**Create new file**: `src/lib/conversation-manager.ts`

```typescript
import { QueryIntent } from './agentic-router'

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
  private static MAX_CONVERSATIONS = 100
  private static MAX_MESSAGES_PER_CONVERSATION = 50

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

    await window.spark.kv.set(ConversationManager.STORAGE_KEY, conversations)
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

    const message: Message = {
      id: this.generateId(),
      role,
      content,
      timestamp: Date.now(),
      metadata
    }

    conversation.messages.push(message)
    conversation.updatedAt = Date.now()

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

    await window.spark.kv.set(ConversationManager.STORAGE_KEY, conversations)
    return conversation
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const conversations = await this.getAllConversations()
    return conversations.find(c => c.id === conversationId) || null
  }

  async getAllConversations(): Promise<Conversation[]> {
    return await window.spark.kv.get<Conversation[]>(ConversationManager.STORAGE_KEY) || []
  }

  async getConversationsByKB(knowledgeBaseId: string): Promise<Conversation[]> {
    const conversations = await this.getAllConversations()
    return conversations.filter(c => c.knowledgeBaseId === knowledgeBaseId)
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const conversations = await this.getAllConversations()
    const filtered = conversations.filter(c => c.id !== conversationId)
    await window.spark.kv.set(ConversationManager.STORAGE_KEY, filtered)
  }

  async updateConversationTitle(conversationId: string, title: string): Promise<void> {
    const conversations = await this.getAllConversations()
    const conversation = conversations.find(c => c.id === conversationId)
    
    if (conversation) {
      conversation.title = title
      await window.spark.kv.set(ConversationManager.STORAGE_KEY, conversations)
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
```

### Step 1.1.2: Modify AgenticRAGOrchestrator to Accept Conversation History

**Modify**: `src/lib/agentic-rag-orchestrator.ts`

```typescript
// Add constructor parameter
constructor(
  private documents: Document[],
  private knowledgeBaseName: string,
  azureSettings?: AzureSearchSettings,
  azureIndexName?: string,
  initialConversationHistory?: Array<{ query: string; response: string }> // NEW
) {
  this.router = new AgenticQueryRouter()
  this.executor = new RetrievalExecutor(
    azureSettings?.enabled ? azureSettings.endpoint : undefined,
    azureSettings?.enabled ? azureSettings.apiKey : undefined,
    azureIndexName
  )
  this.reflector = new SelfReflectiveRAG()
  this.tracker = new StrategyPerformanceTracker()
  
  // Initialize with existing history
  if (initialConversationHistory) {
    this.conversationHistory = initialConversationHistory
  }
}

// Increase history limit
if (this.conversationHistory.length > 20) { // Changed from 5 to 20
  this.conversationHistory.shift()
}

// Add method to get full history
getFullConversationHistory(): Array<{ query: string; response: string }> {
  return [...this.conversationHistory]
}
```

### Step 1.1.3: Update AgenticQueryInterface to Use ConversationManager

**Modify**: `src/components/AgenticQueryInterface.tsx`

```typescript
import { ConversationManager, Conversation } from '@/lib/conversation-manager'

// Add state
const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
const [conversationManager] = useState(() => new ConversationManager())
const [orchestrator, setOrchestrator] = useState<AgenticRAGOrchestrator | null>(null)

// Initialize conversation on mount
useEffect(() => {
  const initConversation = async () => {
    // Try to get existing conversation from URL or create new one
    const conversation = await conversationManager.createConversation(knowledgeBaseName)
    setCurrentConversation(conversation)
    
    // Create orchestrator with conversation history
    const history = conversationManager.getConversationHistory(conversation)
    const newOrchestrator = new AgenticRAGOrchestrator(
      documents,
      knowledgeBaseName,
      azureSettings,
      indexName,
      history
    )
    setOrchestrator(newOrchestrator)
  }
  
  initConversation()
}, []) // Only on mount

// Update handleAgenticSearch
const handleAgenticSearch = async () => {
  if (!query.trim() || !orchestrator || !currentConversation) return

  setIsLoading(true)
  setProgressSteps([])
  setCurrentProgress(0)

  try {
    // Add user message to conversation
    await conversationManager.addMessage(
      currentConversation.id,
      'user',
      query
    )

    const result = await orchestrator.query(query, {
      maxIterations: 3,
      confidenceThreshold: 0.6,
      enableCriticism: true,
      enableAutoRetry: true,
      topK: 5,
      onProgress: (step: ProgressStep) => {
        setProgressSteps(prev => [...prev, step])
        if (step.progress !== undefined) {
          setCurrentProgress(step.progress)
        }
      }
    })

    // Add assistant response to conversation
    const updatedConversation = await conversationManager.addMessage(
      currentConversation.id,
      'assistant',
      result.answer,
      {
        intent: result.routing.intent,
        confidence: result.evaluation.confidence,
        sources: result.sources,
        iterations: result.iterations
      }
    )
    
    setCurrentConversation(updatedConversation)
    setResponse(result)

    const history = await tracker.getQueryHistory()
    const latestQuery = history[history.length - 1]
    if (latestQuery) {
      setQueryId(latestQuery.id)
    }

    onQuery(query, result.answer, result.sources, 'agentic')
  } catch (error) {
    console.error('Agentic RAG error:', error)
    // Handle error...
  }

  setIsLoading(false)
  setQuery('') // Clear input for next query
}
```

### Step 1.1.4: Add Conversation List UI

**Create new file**: `src/components/ConversationList.tsx`

```typescript
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatsCircle, Trash, Plus } from '@phosphor-icons/react'
import { ConversationManager, Conversation } from '@/lib/conversation-manager'
import { motion } from 'framer-motion'

interface ConversationListProps {
  knowledgeBaseId: string
  currentConversationId?: string
  onSelectConversation: (conversationId: string) => void
  onNewConversation: () => void
}

export function ConversationList({
  knowledgeBaseId,
  currentConversationId,
  onSelectConversation,
  onNewConversation
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [manager] = useState(() => new ConversationManager())

  useEffect(() => {
    loadConversations()
  }, [knowledgeBaseId])

  const loadConversations = async () => {
    const convs = await manager.getConversationsByKB(knowledgeBaseId)
    setConversations(convs)
  }

  const handleDelete = async (conversationId: string) => {
    await manager.deleteConversation(conversationId)
    loadConversations()
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ChatsCircle size={20} weight="duotone" />
          <h3 className="font-semibold">Conversations</h3>
        </div>
        <Button size="sm" onClick={onNewConversation} className="gap-2">
          <Plus size={16} />
          New
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {conversations.map((conversation) => (
            <motion.div
              key={conversation.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                currentConversationId === conversation.id
                  ? 'bg-primary/10 border-primary'
                  : 'hover:bg-muted'
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {conversation.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {conversation.messages.length / 2} exchanges
                    </Badge>
                    {conversation.metadata.averageConfidence > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {(conversation.metadata.averageConfidence * 100).toFixed(0)}% conf
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(conversation.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(conversation.id)
                  }}
                  className="flex-shrink-0"
                >
                  <Trash size={14} />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
}
```

### Step 1.1.5: Testing Strategy

**Create test file**: `src/lib/__tests__/conversation-manager.test.ts`

```typescript
import { ConversationManager } from '../conversation-manager'

describe('ConversationManager', () => {
  let manager: ConversationManager
  
  beforeEach(() => {
    manager = new ConversationManager()
    // Mock window.spark.kv
    global.window = {
      spark: {
        kv: {
          get: jest.fn().mockResolvedValue([]),
          set: jest.fn().mockResolvedValue(undefined)
        }
      }
    } as any
  })

  test('creates new conversation', async () => {
    const conversation = await manager.createConversation('kb1', 'test query')
    expect(conversation.id).toBeDefined()
    expect(conversation.knowledgeBaseId).toBe('kb1')
    expect(conversation.title).toBe('test query')
  })

  test('adds messages to conversation', async () => {
    const conversation = await manager.createConversation('kb1')
    const updated = await manager.addMessage(
      conversation.id,
      'user',
      'Hello'
    )
    expect(updated.messages).toHaveLength(1)
    expect(updated.messages[0].content).toBe('Hello')
  })

  test('maintains conversation history', async () => {
    const conversation = await manager.createConversation('kb1')
    await manager.addMessage(conversation.id, 'user', 'Q1')
    await manager.addMessage(conversation.id, 'assistant', 'A1')
    const updated = await manager.getConversation(conversation.id)
    
    const history = manager.getConversationHistory(updated!)
    expect(history).toHaveLength(1)
    expect(history[0].query).toBe('Q1')
    expect(history[0].response).toBe('A1')
  })

  test('limits conversation count', async () => {
    // Create 101 conversations
    for (let i = 0; i < 101; i++) {
      await manager.createConversation('kb1', `query ${i}`)
    }
    
    const conversations = await manager.getAllConversations()
    expect(conversations.length).toBe(100)
  })

  test('limits messages per conversation', async () => {
    const conversation = await manager.createConversation('kb1')
    
    // Add 51 messages
    for (let i = 0; i < 51; i++) {
      await manager.addMessage(conversation.id, 'user', `message ${i}`)
    }
    
    const updated = await manager.getConversation(conversation.id)
    expect(updated!.messages.length).toBe(50)
  })
})
```

### Success Criteria for Step 1.1
- [ ] ConversationManager service created and tested
- [ ] Conversations persist across page refreshes
- [ ] AgenticRAGOrchestrator uses conversation history
- [ ] UI shows conversation list
- [ ] Can switch between conversations
- [ ] Can create new conversations
- [ ] Can delete conversations
- [ ] Unit tests pass with 80%+ coverage

---

## 1.2 Chunking Integration (Week 2)

### Objective
Transform document ingestion to create and index chunks instead of monolithic documents, enabling precise retrieval.

### Step 1.2.1: Create Chunk Storage Schema

**Modify**: `src/lib/types.ts`

```typescript
export interface DocumentChunk {
  id: string
  documentId: string
  knowledgeBaseId: string
  chunkIndex: number
  text: string
  startIndex: number
  endIndex: number
  tokens: number
  embedding?: number[]
  metadata: {
    strategy: 'fixed' | 'sentence' | 'paragraph' | 'semantic'
    parentDocument: {
      title: string
      sourceType: SourceType
      sourceUrl: string
    }
  }
  createdAt: number
}

// Extend Document type
export interface Document {
  id: string
  title: string
  content: string
  sourceType: SourceType
  sourceUrl: string
  addedAt: number
  knowledgeBaseId: string
  metadata: Record<string, any>
  chunkCount?: number // NEW
  chunkStrategy?: 'fixed' | 'sentence' | 'paragraph' | 'semantic' // NEW
}
```

### Step 1.2.2: Create Chunk Management Service

**Create new file**: `src/lib/chunk-manager.ts`

```typescript
import { DocumentChunk } from './types'
import { chunkAndEmbed, CHUNKING_STRATEGIES } from './chunking'
import { generateId } from './helpers'

export class ChunkManager {
  private static STORAGE_KEY_PREFIX = 'chunks'

  async chunkDocument(
    documentId: string,
    knowledgeBaseId: string,
    title: string,
    content: string,
    sourceType: string,
    sourceUrl: string,
    strategy: 'fixed' | 'sentence' | 'paragraph' | 'semantic' = 'semantic'
  ): Promise<DocumentChunk[]> {
    // Use chunking.ts implementation
    const chunks = await chunkAndEmbed(content, strategy)

    const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
      id: generateId(),
      documentId,
      knowledgeBaseId,
      chunkIndex: index,
      text: chunk.text,
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex,
      tokens: chunk.tokens,
      embedding: chunk.embedding,
      metadata: {
        strategy,
        parentDocument: {
          title,
          sourceType,
          sourceUrl
        }
      },
      createdAt: Date.now()
    }))

    // Store chunks
    await this.saveChunks(knowledgeBaseId, documentChunks)

    return documentChunks
  }

  async saveChunks(knowledgeBaseId: string, chunks: DocumentChunk[]): Promise<void> {
    const storageKey = `${ChunkManager.STORAGE_KEY_PREFIX}-${knowledgeBaseId}`
    const existing = await this.getChunksByKB(knowledgeBaseId)
    const updated = [...existing, ...chunks]
    await window.spark.kv.set(storageKey, updated)
  }

  async getChunksByKB(knowledgeBaseId: string): Promise<DocumentChunk[]> {
    const storageKey = `${ChunkManager.STORAGE_KEY_PREFIX}-${knowledgeBaseId}`
    return await window.spark.kv.get<DocumentChunk[]>(storageKey) || []
  }

  async getChunksByDocument(documentId: string, knowledgeBaseId: string): Promise<DocumentChunk[]> {
    const chunks = await this.getChunksByKB(knowledgeBaseId)
    return chunks.filter(c => c.documentId === documentId)
  }

  async deleteChunksByDocument(documentId: string, knowledgeBaseId: string): Promise<void> {
    const storageKey = `${ChunkManager.STORAGE_KEY_PREFIX}-${knowledgeBaseId}`
    const chunks = await this.getChunksByKB(knowledgeBaseId)
    const filtered = chunks.filter(c => c.documentId !== documentId)
    await window.spark.kv.set(storageKey, filtered)
  }

  async deleteChunksByKB(knowledgeBaseId: string): Promise<void> {
    const storageKey = `${ChunkManager.STORAGE_KEY_PREFIX}-${knowledgeBaseId}`
    await window.spark.kv.delete(storageKey)
  }

  async searchChunks(
    query: string,
    knowledgeBaseId: string,
    topK: number = 5
  ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
    const chunks = await this.getChunksByKB(knowledgeBaseId)
    
    // Simple keyword-based scoring for now
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    
    const scored = chunks.map(chunk => {
      const text = chunk.text.toLowerCase()
      let score = 0
      
      queryTerms.forEach(term => {
        const count = (text.match(new RegExp(term, 'g')) || []).length
        score += count * (term.length / 10)
      })
      
      if (text.includes(query.toLowerCase())) {
        score += 5
      }
      
      return { chunk, score: Math.min(score / 10, 1) }
    })
    
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  async searchChunksWithEmbedding(
    queryEmbedding: number[],
    knowledgeBaseId: string,
    topK: number = 5
  ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
    const chunks = await this.getChunksByKB(knowledgeBaseId)
    
    const scored = chunks
      .filter(c => c.embedding)
      .map(chunk => ({
        chunk,
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding!)
      }))
    
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, topK)
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
}
```

### Step 1.2.3: Integrate Chunking into Document Ingestion

**Modify**: `src/App.tsx`

```typescript
import { ChunkManager } from '@/lib/chunk-manager'

// Add state
const [chunkManager] = useState(() => new ChunkManager())

// Update handleAddContent
const handleAddContent = async (sourceType: SourceType, sourceUrl: string) => {
  if (!selectedKB) return
  
  toast.info('Processing content...')
  
  try {
    let documentsToAdd: Omit<Document, 'id' | 'addedAt'>[] = []
    
    // ... existing document extraction logic ...
    
    const newDocs: Document[] = documentsToAdd.map(doc => ({
      ...doc,
      id: generateId(),
      addedAt: Date.now(),
      knowledgeBaseId: selectedKB.id,
      chunkStrategy: 'semantic' // NEW
    }))
    
    setDocuments((current) => [...(current || []), ...newDocs])
    
    // NEW: Chunk documents
    toast.info('Creating chunks for precise retrieval...')
    for (const doc of newDocs) {
      const chunks = await chunkManager.chunkDocument(
        doc.id,
        doc.knowledgeBaseId,
        doc.title,
        doc.content,
        doc.sourceType,
        doc.sourceUrl,
        doc.chunkStrategy || 'semantic'
      )
      
      // Update document with chunk count
      setDocuments((current) =>
        (current || []).map(d =>
          d.id === doc.id ? { ...d, chunkCount: chunks.length } : d
        )
      )
    }
    
    // Index in Azure (if enabled)
    if (selectedKB.azureSearchEnabled && selectedKB.azureIndexName && azureSettings?.enabled) {
      try {
        const service = new AzureSearchService({
          endpoint: azureSettings.endpoint,
          apiKey: azureSettings.apiKey,
          indexName: selectedKB.azureIndexName,
        })
        await service.indexDocuments(newDocs)
        toast.success(`${newDocs.length} document(s) indexed in Azure AI Search`)
      } catch (error) {
        toast.error('Failed to index in Azure: ' + (error instanceof Error ? error.message : 'Unknown error'))
      }
    }
    
    // ... rest of existing logic ...
    
    toast.success(`${newDocs.length} document(s) added with ${newDocs.reduce((sum, d) => sum + (d.chunkCount || 0), 0)} chunks`)
  } catch (error) {
    toast.error('Failed to add content: ' + (error instanceof Error ? error.message : 'Unknown error'))
    throw error
  }
}
```

### Step 1.2.4: Update RetrievalExecutor to Use Chunks

**Modify**: `src/lib/retrieval-executor.ts`

```typescript
import { ChunkManager } from './chunk-manager'
import { DocumentChunk } from './types'

export class RetrievalExecutor {
  private azureService?: AzureSearchService
  private chunkManager: ChunkManager

  constructor(
    azureEndpoint?: string,
    azureApiKey?: string,
    azureIndexName?: string,
    private knowledgeBaseId?: string // NEW
  ) {
    if (azureEndpoint && azureApiKey && azureIndexName) {
      this.azureService = new AzureSearchService({
        endpoint: azureEndpoint,
        apiKey: azureApiKey,
        indexName: azureIndexName,
      })
    }
    this.chunkManager = new ChunkManager()
  }

  async executeRetrieval(
    query: string,
    documents: Document[],
    strategy: RetrievalStrategy,
    topK: number = 5,
    subQueries?: string[]
  ): Promise<RetrievalResult> {
    // Delegate to chunk-based retrieval if KB ID is available
    if (this.knowledgeBaseId && strategy !== 'direct_answer') {
      return this.chunkBasedRetrieval(query, documents, strategy, topK, subQueries)
    }
    
    // Fall back to existing document-based retrieval
    // ... existing code ...
  }

  private async chunkBasedRetrieval(
    query: string,
    documents: Document[],
    strategy: RetrievalStrategy,
    topK: number,
    subQueries?: string[]
  ): Promise<RetrievalResult> {
    // Search chunks instead of documents
    const chunkResults = await this.chunkManager.searchChunks(
      query,
      this.knowledgeBaseId!,
      topK * 3 // Get more chunks, then deduplicate by document
    )

    // Map chunks back to documents with context
    const documentMap = new Map<string, {
      doc: Document
      chunks: Array<{ chunk: DocumentChunk; score: number }>
      maxScore: number
    }>()

    for (const result of chunkResults) {
      const doc = documents.find(d => d.id === result.chunk.documentId)
      if (!doc) continue

      if (!documentMap.has(doc.id)) {
        documentMap.set(doc.id, {
          doc,
          chunks: [],
          maxScore: 0
        })
      }

      const entry = documentMap.get(doc.id)!
      entry.chunks.push(result)
      entry.maxScore = Math.max(entry.maxScore, result.score)
    }

    // Sort by max chunk score and take topK documents
    const sortedDocs = Array.from(documentMap.values())
      .sort((a, b) => b.maxScore - a.maxScore)
      .slice(0, topK)

    // Create enhanced documents with chunk context
    const retrievedDocs = sortedDocs.map(entry => {
      // Combine top 3 chunks for this document
      const topChunks = entry.chunks
        .slice(0, 3)
        .map(c => c.chunk.text)
        .join('\n\n---\n\n')

      return {
        ...entry.doc,
        content: topChunks // Use chunk content instead of full document
      }
    })

    return {
      documents: retrievedDocs,
      scores: sortedDocs.map(e => e.maxScore),
      method: strategy,
      queryUsed: query,
      metadata: {
        chunkBased: true,
        totalChunks: chunkResults.length,
        uniqueDocuments: documentMap.size
      }
    }
  }
}
```

### Step 1.2.5: Update Azure Search to Index Chunks

**Modify**: `src/lib/azure-search.ts`

```typescript
// Update indexDocuments to send chunks
async indexDocuments(documents: Document[], chunks?: DocumentChunk[]) {
  if (chunks && chunks.length > 0) {
    // Index chunk-level data
    const searchDocs = chunks.map((chunk) => ({
      '@search.action': 'mergeOrUpload',
      id: chunk.id,
      documentId: chunk.documentId,
      title: chunk.metadata.parentDocument.title,
      content: chunk.text,
      chunkIndex: chunk.chunkIndex,
      sourceType: chunk.metadata.parentDocument.sourceType,
      sourceUrl: chunk.metadata.parentDocument.sourceUrl,
      addedAt: chunk.createdAt,
      embedding: chunk.embedding
    }))

    return await this.makeRequest(
      `/indexes/${this.config.indexName}/docs/index`,
      'POST',
      { value: searchDocs }
    )
  }

  // Fall back to document-level indexing
  // ... existing code ...
}
```

### Step 1.2.6: Testing Strategy

```typescript
describe('Chunk-based Retrieval', () => {
  test('chunks documents on ingestion', async () => {
    const manager = new ChunkManager()
    const chunks = await manager.chunkDocument(
      'doc1',
      'kb1',
      'Test Doc',
      'This is a test. It has multiple sentences. Each should be a chunk.',
      'text',
      'test.txt',
      'sentence'
    )
    
    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].text).toBeDefined()
    expect(chunks[0].embedding).toBeDefined()
  })

  test('retrieves relevant chunks', async () => {
    const manager = new ChunkManager()
    
    // Create test chunks
    await manager.chunkDocument(...)
    
    const results = await manager.searchChunks('test query', 'kb1', 5)
    expect(results.length).toBeLessThanOrEqual(5)
    expect(results[0].score).toBeGreaterThanOrEqual(results[1]?.score || 0)
  })

  test('maps chunks to documents', async () => {
    const executor = new RetrievalExecutor(undefined, undefined, undefined, 'kb1')
    const result = await executor.executeRetrieval(
      'test query',
      documents,
      'semantic',
      3
    )
    
    expect(result.documents.length).toBeLessThanOrEqual(3)
    expect(result.metadata?.chunkBased).toBe(true)
  })
})
```

### Success Criteria for Step 1.2
- [ ] Documents are automatically chunked on ingestion
- [ ] Chunks stored with embeddings
- [ ] Retrieval queries chunks first, then maps to documents
- [ ] Document details show chunk count
- [ ] Azure search indexes chunks
- [ ] Performance improvement: faster, more precise results
- [ ] Unit tests pass with 80%+ coverage

---

## 1.3 Azure Bidirectional Sync (Week 3)

### Objective
Ensure all document operations (create, update, delete) sync bidirectionally with Azure Search.

### Step 1.3.1: Extend Azure Search Service with CRUD Operations

**Modify**: `src/lib/azure-search.ts`

```typescript
export class AzureSearchService {
  // ... existing code ...

  async updateDocument(document: Document, chunks?: DocumentChunk[]) {
    // Delete old version
    await this.deleteDocuments([document.id])
    
    // Index new version
    return await this.indexDocuments([document], chunks)
  }

  async syncCheck(): Promise<{
    localCount: number
    azureCount: number
    inSync: boolean
    missingInAzure: string[]
    extraInAzure: string[]
  }> {
    const azureCount = await this.getDocumentCount()
    
    // Get all document IDs from Azure
    const azureDocsResponse = await this.makeRequest(
      `/indexes/${this.config.indexName}/docs/search`,
      'POST',
      {
        search: '*',
        select: 'id',
        top: 10000
      }
    )
    
    const azureIds = new Set(azureDocsResponse.value.map((d: any) => d.id))
    
    return {
      localCount: 0, // To be filled by caller
      azureCount,
      inSync: false, // To be determined by caller
      missingInAzure: [], // To be filled by caller
      extraInAzure: Array.from(azureIds)
    }
  }

  async reconcile(
    documentsToAdd: Document[],
    documentIdsToDelete: string[],
    chunks?: DocumentChunk[]
  ): Promise<{ added: number; deleted: number }> {
    let added = 0
    let deleted = 0

    // Add missing documents
    if (documentsToAdd.length > 0) {
      await this.indexDocuments(documentsToAdd, chunks)
      added = documentsToAdd.length
    }

    // Remove extra documents
    if (documentIdsToDelete.length > 0) {
      await this.deleteDocuments(documentIdsToDelete)
      deleted = documentIdsToDelete.length
    }

    return { added, deleted }
  }
}
```

### Step 1.3.2: Add Sync Hooks to Document Operations

**Modify**: `src/App.tsx`

```typescript
// Track sync state
const [azureSyncStatus, setAzureSyncStatus] = useState<{
  inSync: boolean
  lastCheck: number | null
  drift: { missing: number; extra: number }
}>({
  inSync: true,
  lastCheck: null,
  drift: { missing: 0, extra: 0 }
})

// Helper function to sync with Azure
const syncToAzure = async (
  operation: 'create' | 'update' | 'delete',
  docs: Document[],
  docIds?: string[]
) => {
  if (!selectedKB?.azureSearchEnabled || !selectedKB.azureIndexName || !azureSettings?.enabled) {
    return
  }

  try {
    const service = new AzureSearchService({
      endpoint: azureSettings.endpoint,
      apiKey: azureSettings.apiKey,
      indexName: selectedKB.azureIndexName,
    })

    // Get chunks if needed
    let chunks: DocumentChunk[] = []
    if (operation !== 'delete') {
      for (const doc of docs) {
        const docChunks = await chunkManager.getChunksByDocument(doc.id, doc.knowledgeBaseId)
        chunks.push(...docChunks)
      }
    }

    switch (operation) {
      case 'create':
        await service.indexDocuments(docs, chunks)
        break
      case 'update':
        for (const doc of docs) {
          const docChunks = chunks.filter(c => c.documentId === doc.id)
          await service.updateDocument(doc, docChunks)
        }
        break
      case 'delete':
        if (docIds) {
          // Also delete chunks
          const chunkIds = chunks.map(c => c.id)
          await service.deleteDocuments([...docIds, ...chunkIds])
        }
        break
    }

    toast.success(`Azure sync: ${operation} successful`)
  } catch (error) {
    toast.error(`Azure sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    setAzureSyncStatus(prev => ({ ...prev, inSync: false }))
  }
}

// Update handleDeleteDocument
const handleDeleteDocument = async (id: string) => {
  const doc = docs.find(d => d.id === id)
  if (!doc) return

  // Delete locally
  setDocuments((current) => (current || []).filter(d => d.id !== id))
  
  // Delete chunks
  await chunkManager.deleteChunksByDocument(id, selectedKB!.id)

  // Sync to Azure
  await syncToAzure('delete', [doc], [id])
  
  // Update KB metadata
  if (selectedKB && doc) {
    setKnowledgeBases((current) =>
      (current || []).map(kb => 
        kb.id === selectedKB.id 
          ? { ...kb, documentCount: Math.max(0, kb.documentCount - 1), updatedAt: Date.now() }
          : kb
      )
    )
    
    setSelectedKB((current) => 
      current 
        ? { ...current, documentCount: Math.max(0, current.documentCount - 1), updatedAt: Date.now() }
        : null
    )
  }
  
  toast.success('Document removed')
}

// Update handleSaveDocument
const handleSaveDocument = async (id: string, title: string, content: string) => {
  const doc = docs.find(d => d.id === id)
  if (!doc) return

  const updatedDoc = {
    ...doc,
    title,
    content,
    metadata: { ...doc.metadata, lastModified: Date.now() }
  }

  // Update locally
  setDocuments((current) =>
    (current || []).map(d => d.id === id ? updatedDoc : d)
  )

  // Re-chunk document
  await chunkManager.deleteChunksByDocument(id, doc.knowledgeBaseId)
  await chunkManager.chunkDocument(
    id,
    doc.knowledgeBaseId,
    title,
    content,
    doc.sourceType,
    doc.sourceUrl,
    doc.chunkStrategy || 'semantic'
  )

  // Sync to Azure
  await syncToAzure('update', [updatedDoc])
  
  setViewingDocument(updatedDoc)
  toast.success('Document updated successfully')
}
```

### Step 1.3.3: Add Sync Health Monitor UI

**Create new file**: `src/components/AzureSyncMonitor.tsx`

```typescript
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Lightning, Warning, CheckCircle, ArrowsClockwise } from '@phosphor-icons/react'
import { AzureSearchService } from '@/lib/azure-search'
import { toast } from 'sonner'

interface AzureSyncMonitorProps {
  azureSettings: AzureSearchSettings
  indexName: string
  localDocumentCount: number
  onReconcile: () => Promise<void>
}

export function AzureSyncMonitor({
  azureSettings,
  indexName,
  localDocumentCount,
  onReconcile
}: AzureSyncMonitorProps) {
  const [syncStatus, setSyncStatus] = useState<{
    checking: boolean
    inSync: boolean
    azureCount: number
    drift: { missing: number; extra: number }
  }>({
    checking: false,
    inSync: true,
    azureCount: 0,
    drift: { missing: 0, extra: 0 }
  })

  const checkSync = async () => {
    setSyncStatus(prev => ({ ...prev, checking: true }))

    try {
      const service = new AzureSearchService({
        endpoint: azureSettings.endpoint,
        apiKey: azureSettings.apiKey,
        indexName
      })

      const result = await service.syncCheck()
      const inSync = localDocumentCount === result.azureCount

      setSyncStatus({
        checking: false,
        inSync,
        azureCount: result.azureCount,
        drift: {
          missing: result.missingInAzure.length,
          extra: result.extraInAzure.length
        }
      })
    } catch (error) {
      toast.error('Sync check failed')
      setSyncStatus(prev => ({ ...prev, checking: false }))
    }
  }

  useEffect(() => {
    checkSync()
  }, [localDocumentCount])

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightning size={18} weight="duotone" className="text-accent" />
          <h3 className="font-semibold text-sm">Azure Sync Status</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={checkSync}
          disabled={syncStatus.checking}
          className="gap-2"
        >
          <ArrowsClockwise size={14} className={syncStatus.checking ? 'animate-spin' : ''} />
          Check
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Status:</span>
          {syncStatus.inSync ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle size={12} weight="fill" />
              In Sync
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <Warning size={12} weight="fill" />
              Out of Sync
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 rounded bg-muted/50">
            <div className="text-xs text-muted-foreground">Local Docs</div>
            <div className="font-semibold">{localDocumentCount}</div>
          </div>
          <div className="p-2 rounded bg-muted/50">
            <div className="text-xs text-muted-foreground">Azure Docs</div>
            <div className="font-semibold">{syncStatus.azureCount}</div>
          </div>
        </div>

        {!syncStatus.inSync && (
          <>
            <div className="text-xs space-y-1">
              {syncStatus.drift.missing > 0 && (
                <div className="text-yellow-600">
                  {syncStatus.drift.missing} document(s) missing in Azure
                </div>
              )}
              {syncStatus.drift.extra > 0 && (
                <div className="text-orange-600">
                  {syncStatus.drift.extra} extra document(s) in Azure
                </div>
              )}
            </div>

            <Button
              size="sm"
              onClick={onReconcile}
              className="w-full gap-2"
            >
              <ArrowsClockwise size={14} />
              Reconcile Now
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
```

### Step 1.3.4: Testing Strategy

```typescript
describe('Azure Bidirectional Sync', () => {
  test('deletes propagate to Azure', async () => {
    const service = new AzureSearchService(config)
    await service.indexDocuments([testDoc])
    
    // Verify indexed
    let count = await service.getDocumentCount()
    expect(count).toBe(1)
    
    // Delete
    await service.deleteDocuments([testDoc.id])
    
    // Verify deleted
    count = await service.getDocumentCount()
    expect(count).toBe(0)
  })

  test('updates propagate to Azure', async () => {
    const service = new AzureSearchService(config)
    await service.indexDocuments([testDoc])
    
    // Update
    const updated = { ...testDoc, content: 'Updated content' }
    await service.updateDocument(updated)
    
    // Verify updated
    const results = await service.search(testDoc.id, 1)
    expect(results[0].content).toBe('Updated content')
  })

  test('sync check detects drift', async () => {
    const service = new AzureSearchService(config)
    
    // Add to Azure but not locally
    await service.indexDocuments([testDoc])
    
    const status = await service.syncCheck()
    expect(status.inSync).toBe(false)
    expect(status.extraInAzure).toContain(testDoc.id)
  })

  test('reconciliation syncs state', async () => {
    const service = new AzureSearchService(config)
    
    // Create drift
    await service.indexDocuments([testDoc])
    
    // Reconcile
    await service.reconcile([], [testDoc.id])
    
    // Verify synced
    const count = await service.getDocumentCount()
    expect(count).toBe(0)
  })
})
```

### Success Criteria for Step 1.3
- [ ] Document deletes sync to Azure immediately
- [ ] Document updates sync to Azure immediately
- [ ] Sync monitor shows real-time status
- [ ] Drift detection works accurately
- [ ] One-click reconciliation resolves drift
- [ ] Error handling with user feedback
- [ ] Unit and integration tests pass

---

## 1.4 Runtime Abstraction (Week 3)

### Objective
Decouple from Spark runtime to enable testing, alternative deployments, and multi-provider support.

### Step 1.4.1: Define Runtime Interfaces

**Create new file**: `src/lib/runtime/interfaces.ts`

```typescript
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
```

### Step 1.4.2: Implement Spark Runtime Adapter

**Create new file**: `src/lib/runtime/spark-adapter.ts`

```typescript
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
```

### Step 1.4.3: Implement Mock Runtime Adapter (for testing)

**Create new file**: `src/lib/runtime/mock-adapter.ts`

```typescript
import { RuntimeAdapter, LLMProvider, KeyValueStore } from './interfaces'

class MockLLMProvider implements LLMProvider {
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
}

class MockKeyValueStore implements KeyValueStore {
  private store: Map<string, any> = new Map()

  async get<T>(key: string): Promise<T | null> {
    return this.store.get(key) || null
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key)
  }

  async keys(prefix?: string): Promise<string[]> {
    const allKeys = Array.from(this.store.keys())
    return prefix 
      ? allKeys.filter(k => k.startsWith(prefix))
      : allKeys
  }

  clear() {
    this.store.clear()
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
```

### Step 1.4.4: Create Runtime Manager

**Create new file**: `src/lib/runtime/manager.ts`

```typescript
import { RuntimeAdapter } from './interfaces'
import { SparkRuntimeAdapter } from './spark-adapter'
import { MockRuntimeAdapter } from './mock-adapter'

class RuntimeManager {
  private static instance: RuntimeManager
  private adapter: RuntimeAdapter

  private constructor() {
    // Auto-detect best available runtime
    if (SparkRuntimeAdapter.isAvailable()) {
      this.adapter = new SparkRuntimeAdapter()
      console.log('Using Spark Runtime')
    } else {
      console.warn('Spark not available, using Mock Runtime')
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
    console.log(`Switched to ${adapter.name} runtime`)
  }

  // Convenience methods
  get llm() {
    return this.adapter.llm
  }

  get kv() {
    return this.adapter.kv
  }
}

// Export singleton
export const runtime = RuntimeManager.getInstance()
```

### Step 1.4.5: Replace Direct window.spark Calls

**Example migration** in `src/lib/agentic-router.ts`:

```typescript
// OLD:
// const result = await window.spark.llm(prompt, 'gpt-4o-mini')

// NEW:
import { runtime } from './runtime/manager'

const result = await runtime.llm.generate(prompt, 'gpt-4o-mini')
```

**Apply this pattern to all files**:
- `src/lib/agentic-router.ts` (12 occurrences)
- `src/lib/agentic-rag-orchestrator.ts` (3 occurrences)
- `src/lib/self-reflective-rag.ts` (5 occurrences)
- `src/lib/retrieval-executor.ts` (1 occurrence)
- `src/lib/strategy-performance-tracker.ts` (9 occurrences)
- `src/lib/conversation-manager.ts` (4 occurrences)
- `src/lib/chunk-manager.ts` (2 occurrences)

### Step 1.4.6: Update Tests to Use Mock Runtime

```typescript
import { MockRuntimeAdapter } from '@/lib/runtime/mock-adapter'
import { runtime } from '@/lib/runtime/manager'

describe('AgenticQueryRouter', () => {
  let mockRuntime: MockRuntimeAdapter

  beforeEach(() => {
    mockRuntime = MockRuntimeAdapter.create()
    runtime.setRuntime(mockRuntime)
  })

  test('classifies intent', async () => {
    // Set mock LLM response
    mockRuntime.llm.setMockResponse(
      expect.stringContaining('query intent classifier'),
      'factual'
    )

    const router = new AgenticQueryRouter()
    const intent = await router.classifyIntent('What is X?')
    
    expect(intent).toBe('factual')
  })
})
```

### Success Criteria for Step 1.4
- [ ] All direct `window.spark` calls replaced
- [ ] RuntimeAdapter interface defined
- [ ] Spark, Mock, and LocalStorage adapters implemented
- [ ] Tests use Mock adapter (no Spark dependency)
- [ ] Application works in Spark environment
- [ ] Application works with Mock runtime (for demos)
- [ ] 100% test coverage for runtime adapters

---

# Phase 2: Quality & Integration (Weeks 4-9)

## 2.1 True Semantic Search (Weeks 4-5)

### Objective
Implement genuine vector-based semantic search using embeddings and cosine similarity.

### Step 2.1.1: Enhance Embedding Generation

**Modify**: `src/lib/chunking.ts`

```typescript
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    // Use runtime adapter instead of window.spark
    import { runtime } from './runtime/manager'
    
    const truncatedText = text.substring(0, 1000)
    const prompt = `Generate a semantic embedding representation for the following text. Return only a JSON object with a single property "embedding" containing an array of 384 floating point numbers between -1 and 1: ${truncatedText}`
    
    const result = await runtime.llm.generate(prompt, 'gpt-4o-mini', true)
    const parsed = JSON.parse(result)
    
    if (parsed.embedding && Array.isArray(parsed.embedding) && parsed.embedding.length === 384) {
      return parsed.embedding
    }
    
    // Fall back to simulated
    return generateSimulatedEmbedding(text)
  } catch {
    return generateSimulatedEmbedding(text)
  }
}

// Improve simulated embeddings
function generateSimulatedEmbedding(text: string): number[] {
  const words = text.toLowerCase().split(/\s+/)
  const embedding: number[] = []
  
  // Use TF-IDF-inspired approach
  const wordFreq = new Map<string, number>()
  words.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1)
  })
  
  const totalWords = words.length
  const hash = simpleHash(text)
  
  for (let i = 0; i < 384; i++) {
    let value = Math.sin(hash * (i + 1)) * Math.cos(hash * (i + 1) * 0.5)
    
    // Add word frequency influence
    words.slice(0, 10).forEach((word, idx) => {
      const freq = wordFreq.get(word) || 0
      const tf = freq / totalWords
      value += (Math.sin((simpleHash(word) + i) * 0.1) * tf * 0.3)
    })
    
    embedding.push(value)
  }
  
  // Normalize
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return embedding.map((val) => val / magnitude)
}
```

### Step 2.1.2: Create Vector Search Index

**Create new file**: `src/lib/vector-index.ts`

```typescript
import { DocumentChunk } from './types'
import { cosineSimilarity } from './chunking'

export interface VectorSearchResult {
  chunk: DocumentChunk
  score: number
}

/**
 * Simple in-memory vector index using brute-force cosine similarity
 * For production, consider using HNSW, FAISS, or similar
 */
export class VectorIndex {
  private chunks: DocumentChunk[] = []

  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    this.chunks.push(...chunks.filter(c => c.embedding))
  }

  async search(
    queryEmbedding: number[],
    topK: number = 5,
    filter?: (chunk: DocumentChunk) => boolean
  ): Promise<VectorSearchResult[]> {
    let candidates = this.chunks

    // Apply filter if provided
    if (filter) {
      candidates = candidates.filter(filter)
    }

    // Calculate cosine similarity for all chunks
    const results = candidates.map(chunk => ({
      chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding!)
    }))

    // Sort by score and return top K
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, topK)
  }

  async remove(documentId: string): Promise<void> {
    this.chunks = this.chunks.filter(c => c.documentId !== documentId)
  }

  async clear(): Promise<void> {
    this.chunks = []
  }

  getSize(): number {
    return this.chunks.length
  }
}
```

### Step 2.1.3: Integrate Vector Search into ChunkManager

**Modify**: `src/lib/chunk-manager.ts`

```typescript
import { VectorIndex } from './vector-index'
import { generateEmbedding } from './chunking'

export class ChunkManager {
  private vectorIndex: VectorIndex = new VectorIndex()
  
  async chunkDocument(...): Promise<DocumentChunk[]> {
    // ... existing chunking code ...
    
    // Add to vector index
    await this.vectorIndex.addChunks(documentChunks)
    
    return documentChunks
  }

  async searchChunksWithEmbedding(
    query: string,
    knowledgeBaseId: string,
    topK: number = 5
  ): Promise<Array<{ chunk: DocumentChunk; score: number }>> {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query)
    
    // Search vector index
    return await this.vectorIndex.search(
      queryEmbedding,
      topK,
      chunk => chunk.knowledgeBaseId === knowledgeBaseId
    )
  }

  async deleteChunksByDocument(documentId: string, knowledgeBaseId: string): Promise<void> {
    // ... existing deletion code ...
    
    // Remove from vector index
    await this.vectorIndex.remove(documentId)
  }
}
```

### Step 2.1.4: Update Retrieval Executor

**Modify**: `src/lib/retrieval-executor.ts`

```typescript
private async chunkBasedRetrieval(
  query: string,
  documents: Document[],
  strategy: RetrievalStrategy,
  topK: number,
  subQueries?: string[]
): Promise<RetrievalResult> {
  let chunkResults: Array<{ chunk: DocumentChunk; score: number }>

  // Use vector search for semantic strategies
  if (strategy === 'semantic' || strategy === 'hybrid' || strategy === 'rag_fusion') {
    chunkResults = await this.chunkManager.searchChunksWithEmbedding(
      query,
      this.knowledgeBaseId!,
      topK * 3
    )
  } else {
    // Fall back to keyword search for keyword strategy
    chunkResults = await this.chunkManager.searchChunks(
      query,
      this.knowledgeBaseId!,
      topK * 3
    )
  }

  // ... rest of existing mapping logic ...
}
```

### Step 2.1.5: Rename Misleading Methods

**Modify**: `src/lib/retrieval-executor.ts`

```typescript
// Rename simulatedSemanticSearch to simulatedKeywordSearch
private async simulatedKeywordSearch(
  query: string,
  documents: Document[],
  topK: number
): Promise<RetrievalResult> {
  // ... existing keyword matching logic ...
  
  return {
    documents: topResults.map(r => r.doc),
    scores: topResults.map(r => r.score),
    method: 'keyword', // Changed from 'semantic'
    queryUsed: query
  }
}

// Add true semantic search
private async semanticRetrieval(
  query: string,
  documents: Document[],
  topK: number
): Promise<RetrievalResult> {
  if (this.azureService) {
    try {
      const results = await this.azureService.search(query, topK, undefined, 'semantic')
      // ... existing Azure logic ...
    } catch (error) {
      console.error('Azure semantic search failed, falling back to vector search', error)
    }
  }

  // Use chunk-based vector search if KB ID available
  if (this.knowledgeBaseId) {
    return this.chunkBasedRetrieval(query, documents, 'semantic', topK)
  }

  // Fall back to keyword search if no chunks
  return this.simulatedKeywordSearch(query, documents, topK)
}
```

### Step 2.1.6: Update UI Labels

**Modify**: `src/components/QueryInterface.tsx` and `src/components/AgenticQueryInterface.tsx`

```typescript
// Update any UI text that says "Semantic Search"
<Badge>
  {azureSettings?.enabled ? 'Azure Semantic' : 'Vector Search'}
</Badge>

// Add tooltip explaining search type
<Tooltip>
  <TooltipTrigger>
    <Info size={14} />
  </TooltipTrigger>
  <TooltipContent>
    {azureSettings?.enabled 
      ? 'Using Azure AI Search with semantic ranking'
      : 'Using local vector embeddings with cosine similarity'}
  </TooltipContent>
</Tooltip>
```

### Step 2.1.7: Testing Strategy

```typescript
describe('True Semantic Search', () => {
  test('generates embeddings', async () => {
    const embedding = await generateEmbedding('test text')
    expect(embedding).toHaveLength(384)
    expect(embedding.every(v => v >= -1 && v <= 1)).toBe(true)
  })

  test('similar text has high similarity', async () => {
    const emb1 = await generateEmbedding('machine learning')
    const emb2 = await generateEmbedding('artificial intelligence')
    const similarity = cosineSimilarity(emb1, emb2)
    expect(similarity).toBeGreaterThan(0.5) // Should be relatively similar
  })

  test('dissimilar text has low similarity', async () => {
    const emb1 = await generateEmbedding('machine learning')
    const emb2 = await generateEmbedding('cooking recipes')
    const similarity = cosineSimilarity(emb1, emb2)
    expect(similarity).toBeLessThan(0.3) // Should be dissimilar
  })

  test('vector search returns relevant chunks', async () => {
    const manager = new ChunkManager()
    
    // Add test chunks
    await manager.chunkDocument(
      'doc1',
      'kb1',
      'ML Doc',
      'Machine learning is a subset of artificial intelligence...',
      'text',
      'ml.txt',
      'semantic'
    )
    
    // Search
    const results = await manager.searchChunksWithEmbedding(
      'AI and ML',
      'kb1',
      5
    )
    
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].score).toBeGreaterThan(0.5)
  })
})
```

### Success Criteria for Step 2.1
- [ ] Embedding generation working (LLM or simulated)
- [ ] Vector index created and populated
- [ ] Semantic search uses cosine similarity
- [ ] "Semantic" label accurate
- [ ] Similar queries return similar results
- [ ] Performance acceptable (<500ms for 10K chunks)
- [ ] Tests validate semantic understanding

---

## 2.2 Per-File GitHub Ingestion (Week 6)

### Objective
Ingest GitHub repositories at file granularity instead of directory aggregation.

### Step 2.2.1: Modify GitHub Service

**Modify**: `src/lib/github-service.ts`

```typescript
export function convertRepoToDocuments(
  repoContent: RepoContent,
  repoUrl: string,
  options: {
    perFile?: boolean // NEW: default true
    maxFileSize?: number // NEW: default 100KB
    prioritize?: boolean // NEW: prioritize important files
  } = {}
): Omit<DocType, 'id' | 'addedAt' | 'knowledgeBaseId'>[] {
  const {
    perFile = true,
    maxFileSize = 100000,
    prioritize = true
  } = options

  const documents: Omit<DocType, 'id' | 'addedAt' | 'knowledgeBaseId'>[] = []

  // Always add README
  if (repoContent.readme) {
    documents.push({
      title: 'README',
      content: repoContent.readme,
      sourceType: 'github',
      sourceUrl: repoUrl,
      metadata: {
        size: repoContent.readme.length,
        lastModified: Date.now(),
        priority: 1 // Highest priority
      },
    })
  }

  if (perFile) {
    // ONE DOCUMENT PER FILE
    let files = repoContent.files

    // Prioritize important files
    if (prioritize) {
      files = prioritizeFiles(files)
    }

    for (const file of files) {
      // Skip if file too large
      if (file.size > maxFileSize) {
        console.warn(`Skipping ${file.path}: too large (${file.size} bytes)`)
        continue
      }

      documents.push({
        title: file.path,
        content: file.content,
        sourceType: 'github',
        sourceUrl: `${repoUrl}/blob/main/${file.path}`,
        metadata: {
          size: file.size,
          sha: file.sha,
          lastModified: Date.now(),
          language: detectLanguage(file.path),
          priority: calculateFilePriority(file.path)
        },
      })
    }
  } else {
    // LEGACY: Group by directory
    const filesByDir = groupFilesByDirectory(repoContent.files)

    for (const [dir, files] of Object.entries(filesByDir)) {
      const combinedContent = files
        .map((file) => {
          const extension = file.path.substring(file.path.lastIndexOf('.'))
          return `## ${file.path}\n\n\`\`\`${extension.substring(1)}\n${file.content}\n\`\`\``
        })
        .join('\n\n')

      documents.push({
        title: dir === '.' ? 'Root Files' : dir,
        content: combinedContent,
        sourceType: 'github',
        sourceUrl: repoUrl,
        metadata: {
          size: combinedContent.length,
          lastModified: Date.now(),
        },
      })
    }
  }

  return documents
}

function prioritizeFiles(files: GitHubFile[]): GitHubFile[] {
  return files.sort((a, b) => {
    const priorityA = calculateFilePriority(a.path)
    const priorityB = calculateFilePriority(b.path)
    return priorityB - priorityB
  })
}

function calculateFilePriority(path: string): number {
  const filename = path.toLowerCase()
  
  // Priority 1: Documentation
  if (filename.includes('readme') || filename.includes('doc')) return 10
  
  // Priority 2: Configuration
  if (filename.includes('config') || filename.includes('.json') || filename.includes('.yaml')) return 8
  
  // Priority 3: Main source files
  if (filename.includes('main') || filename.includes('index') || filename.includes('app')) return 7
  
  // Priority 4: Source code
  if (filename.match(/\.(ts|js|py|java|go|rs|cpp)$/)) return 5
  
  // Priority 5: Tests
  if (filename.includes('test') || filename.includes('spec')) return 3
  
  // Default
  return 1
}

function detectLanguage(path: string): string {
  const ext = path.substring(path.lastIndexOf('.')).toLowerCase()
  const languageMap: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.cpp': 'cpp',
    '.c': 'c',
    '.rb': 'ruby',
    '.php': 'php',
    '.md': 'markdown',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml'
  }
  return languageMap[ext] || 'text'
}
```

### Step 2.2.2: Increase File Limit with Pagination

**Modify**: `src/lib/github-service.ts`

```typescript
export async function fetchRepoContent(
  repoUrl: string,
  options: {
    maxFiles?: number // Default 200
    filePatterns?: string[] // e.g., ['*.ts', '*.md']
    excludePatterns?: string[] // e.g., ['node_modules/**', 'dist/**']
  } = {}
): Promise<RepoContent> {
  const repo = parseGitHubUrl(repoUrl)
  if (!repo) {
    throw new Error('Invalid GitHub URL')
  }

  const {
    maxFiles = 200,
    filePatterns = [],
    excludePatterns = ['node_modules/**', 'dist/**', 'build/**', '.git/**']
  } = options

  const apiBase = `https://api.github.com/repos/${repo.owner}/${repo.repo}`

  const tree = await fetchRepoTree(apiBase, repo.branch || 'main')
  
  // Filter files
  let filteredTree = tree.filter((item) => 
    item.type === 'blob' && shouldIncludeFile(item.path)
  )

  // Apply exclude patterns
  filteredTree = filteredTree.filter(item => 
    !excludePatterns.some(pattern => matchesPattern(item.path, pattern))
  )

  // Apply include patterns if specified
  if (filePatterns.length > 0) {
    filteredTree = filteredTree.filter(item =>
      filePatterns.some(pattern => matchesPattern(item.path, pattern))
    )
  }

  // Limit to maxFiles
  filteredTree = filteredTree.slice(0, maxFiles)

  // Fetch files in batches of 10 for rate limiting
  const files: GitHubFile[] = []
  for (let i = 0; i < filteredTree.length; i += 10) {
    const batch = filteredTree.slice(i, i + 10)
    const batchFiles = await Promise.all(
      batch.map((item) => fetchFileContent(apiBase, item.path, item.sha))
    )
    files.push(...batchFiles.filter(f => f.content.length > 0))
  }

  // ... rest of existing code ...
}

function matchesPattern(path: string, pattern: string): boolean {
  // Simple glob matching
  const regex = pattern
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
  return new RegExp(`^${regex}$`).test(path)
}
```

### Step 2.2.3: Add GitHub Ingestion Options UI

**Create new component**: `src/components/GitHubIngestionOptions.tsx`

```typescript
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

interface GitHubIngestionOptionsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (url: string, options: any) => void
}

export function GitHubIngestionOptions({
  open,
  onOpenChange,
  onSubmit
}: GitHubIngestionOptionsProps) {
  const [url, setUrl] = useState('')
  const [perFile, setPerFile] = useState(true)
  const [maxFiles, setMaxFiles] = useState(200)
  const [prioritize, setPrioritize] = useState(true)
  const [filePatterns, setFilePatterns] = useState('')
  const [excludePatterns, setExcludePatterns] = useState('node_modules/**,dist/**')

  const handleSubmit = () => {
    onSubmit(url, {
      perFile,
      maxFiles,
      prioritize,
      filePatterns: filePatterns ? filePatterns.split(',').map(p => p.trim()) : [],
      excludePatterns: excludePatterns.split(',').map(p => p.trim())
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>GitHub Repository Options</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="gh-url">Repository URL</Label>
            <Input
              id="gh-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="per-file">One document per file</Label>
            <Switch
              id="per-file"
              checked={perFile}
              onCheckedChange={setPerFile}
            />
          </div>

          <div>
            <Label htmlFor="max-files">Maximum files: {maxFiles}</Label>
            <Slider
              id="max-files"
              value={[maxFiles]}
              onValueChange={(v) => setMaxFiles(v[0])}
              min={50}
              max={500}
              step={50}
              className="mt-2"
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="prioritize">Prioritize important files</Label>
            <Switch
              id="prioritize"
              checked={prioritize}
              onCheckedChange={setPrioritize}
            />
          </div>

          <div>
            <Label htmlFor="include">Include patterns (comma-separated)</Label>
            <Input
              id="include"
              value={filePatterns}
              onChange={(e) => setFilePatterns(e.target.value)}
              placeholder="*.ts,*.md (leave empty for all)"
            />
          </div>

          <div>
            <Label htmlFor="exclude">Exclude patterns (comma-separated)</Label>
            <Input
              id="exclude"
              value={excludePatterns}
              onChange={(e) => setExcludePatterns(e.target.value)}
              placeholder="node_modules/**,dist/**"
            />
          </div>

          <Button onClick={handleSubmit} className="w-full">
            Import Repository
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 2.2.4: Testing Strategy

```typescript
describe('Per-File GitHub Ingestion', () => {
  test('creates one document per file', async () => {
    const repoContent: RepoContent = {
      files: [
        { path: 'src/index.ts', content: 'export {}', ... },
        { path: 'src/utils.ts', content: 'export const x = 1', ... }
      ],
      readme: 'README content',
      totalSize: 1000
    }

    const docs = convertRepoToDocuments(repoContent, 'https://github.com/test/repo', {
      perFile: true
    })

    expect(docs.length).toBe(3) // README + 2 files
    expect(docs.find(d => d.title === 'src/index.ts')).toBeDefined()
    expect(docs.find(d => d.title === 'src/utils.ts')).toBeDefined()
  })

  test('prioritizes important files', async () => {
    const files = [
      { path: 'test.spec.ts', content: '...', size: 100, type: 'file', sha: '1' },
      { path: 'README.md', content: '...', size: 100, type: 'file', sha: '2' },
      { path: 'index.ts', content: '...', size: 100, type: 'file', sha: '3' }
    ]

    const prioritized = prioritizeFiles(files)
    
    expect(prioritized[0].path).toBe('README.md')
    expect(prioritized[1].path).toBe('index.ts')
    expect(prioritized[2].path).toBe('test.spec.ts')
  })

  test('respects file size limits', async () => {
    const repoContent: RepoContent = {
      files: [
        { path: 'small.ts', content: 'x'.repeat(1000), size: 1000, type: 'file', sha: '1' },
        { path: 'large.ts', content: 'x'.repeat(200000), size: 200000, type: 'file', sha: '2' }
      ],
      readme: undefined,
      totalSize: 201000
    }

    const docs = convertRepoToDocuments(repoContent, 'url', {
      perFile: true,
      maxFileSize: 100000
    })

    expect(docs.length).toBe(1)
    expect(docs[0].title).toBe('small.ts')
  })
})
```

### Success Criteria for Step 2.2
- [ ] Per-file ingestion by default
- [ ] File prioritization working
- [ ] Configurable file limits and patterns
- [ ] Exclude patterns respect (node_modules, etc.)
- [ ] UI for ingestion options
- [ ] Large repos handled gracefully
- [ ] Tests validate file-level granularity

---

## 2.3 Unified Query Analytics (Week 7-8)

### Objective
Merge fragmented query tracking into a single, comprehensive analytics system.

### Step 2.3.1: Define Unified Query Model

**Create new file**: `src/lib/unified-query-model.ts`

```typescript
import { QueryIntent, RetrievalStrategy } from './agentic-router'

export type QueryMethod = 'standard' | 'azure' | 'agentic'

export interface UnifiedQueryRecord {
  // Core identification
  id: string
  timestamp: number
  knowledgeBaseId: string
  conversationId?: string

  // Query details
  query: string
  method: QueryMethod
  
  // Response
  response: string
  sources: string[]

  // Performance metrics (may be undefined for standard queries)
  intent?: QueryIntent
  strategy?: RetrievalStrategy
  confidence?: number
  iterations?: number
  timeMs?: number
  needsImprovement?: boolean
  userFeedback?: 'positive' | 'negative' | 'neutral'

  // Retrieval details
  retrievalMethod?: string
  documentsRetrieved?: number
  retrievalBackend?: 'azure' | 'local'

  // Metadata
  metadata?: Record<string, any>
}

export class UnifiedQueryTracker {
  private static STORAGE_KEY = 'unified-query-history'
  private static MAX_RECORDS = 2000

  async recordQuery(record: UnifiedQueryRecord): Promise<void> {
    const history = await this.getHistory()
    history.unshift(record)

    // Keep only last MAX_RECORDS
    if (history.length > UnifiedQueryTracker.MAX_RECORDS) {
      history.splice(UnifiedQueryTracker.MAX_RECORDS)
    }

    await window.spark.kv.set(UnifiedQueryTracker.STORAGE_KEY, history)
  }

  async getHistory(filters?: {
    knowledgeBaseId?: string
    method?: QueryMethod
    minConfidence?: number
    startDate?: number
    endDate?: number
  }): Promise<UnifiedQueryRecord[]> {
    let history = await window.spark.kv.get<UnifiedQueryRecord[]>(
      UnifiedQueryTracker.STORAGE_KEY
    ) || []

    // Apply filters
    if (filters) {
      if (filters.knowledgeBaseId) {
        history = history.filter(q => q.knowledgeBaseId === filters.knowledgeBaseId)
      }
      if (filters.method) {
        history = history.filter(q => q.method === filters.method)
      }
      if (filters.minConfidence !== undefined) {
        history = history.filter(q => 
          q.confidence !== undefined && q.confidence >= filters.minConfidence
        )
      }
      if (filters.startDate) {
        history = history.filter(q => q.timestamp >= filters.startDate!)
      }
      if (filters.endDate) {
        history = history.filter(q => q.timestamp <= filters.endDate!)
      }
    }

    return history
  }

  async getAnalytics(knowledgeBaseId?: string) {
    const history = await this.getHistory(
      knowledgeBaseId ? { knowledgeBaseId } : undefined
    )

    const methodBreakdown = {
      standard: history.filter(q => q.method === 'standard').length,
      azure: history.filter(q => q.method === 'azure').length,
      agentic: history.filter(q => q.method === 'agentic').length
    }

    const agenticQueries = history.filter(q => q.method === 'agentic')
    const avgConfidence = agenticQueries.length > 0
      ? agenticQueries.reduce((sum, q) => sum + (q.confidence || 0), 0) / agenticQueries.length
      : 0

    const avgIterations = agenticQueries.length > 0
      ? agenticQueries.reduce((sum, q) => sum + (q.iterations || 0), 0) / agenticQueries.length
      : 0

    const avgTimeMs = agenticQueries.length > 0
      ? agenticQueries.reduce((sum, q) => sum + (q.timeMs || 0), 0) / agenticQueries.length
      : 0

    const feedbackBreakdown = {
      positive: history.filter(q => q.userFeedback === 'positive').length,
      neutral: history.filter(q => q.userFeedback === 'neutral').length,
      negative: history.filter(q => q.userFeedback === 'negative').length
    }

    return {
      totalQueries: history.length,
      methodBreakdown,
      agenticMetrics: {
        averageConfidence: avgConfidence,
        averageIterations: avgIterations,
        averageTimeMs: avgTimeMs
      },
      feedbackBreakdown,
      successRate: history.length > 0
        ? (feedbackBreakdown.positive / history.length) * 100
        : 0
    }
  }

  async recordUserFeedback(
    queryId: string,
    feedback: 'positive' | 'negative' | 'neutral'
  ): Promise<void> {
    const history = await this.getHistory()
    const query = history.find(q => q.id === queryId)

    if (query) {
      query.userFeedback = feedback
      await window.spark.kv.set(UnifiedQueryTracker.STORAGE_KEY, history)
    }
  }

  async clearHistory(): Promise<void> {
    await window.spark.kv.delete(UnifiedQueryTracker.STORAGE_KEY)
  }
}
```

### Step 2.3.2: Migrate Existing Tracking

**Modify**: `src/App.tsx`

```typescript
import { UnifiedQueryTracker, UnifiedQueryRecord } from '@/lib/unified-query-model'

// Replace existing query tracking
const [unifiedTracker] = useState(() => new UnifiedQueryTracker())

const handleQuery = async (
  query: string,
  response: string,
  sources: string[],
  searchMethod: 'simulated' | 'azure' | 'agentic',
  agenticMetadata?: {
    intent: QueryIntent
    strategy: RetrievalStrategy
    confidence: number
    iterations: number
    timeMs: number
    needsImprovement: boolean
    retrievalMethod: string
    documentsRetrieved: number
    retrievalBackend: 'azure' | 'local'
  }
) => {
  if (!selectedKB) return

  const record: UnifiedQueryRecord = {
    id: generateId(),
    timestamp: Date.now(),
    knowledgeBaseId: selectedKB.id,
    conversationId: currentConversation?.id,
    query,
    response,
    sources,
    method: searchMethod === 'simulated' ? 'standard' : searchMethod,
    
    // Include agentic metadata if available
    ...(agenticMetadata || {})
  }

  await unifiedTracker.recordQuery(record)

  // Also maintain backward compatibility with old queries array
  // for components that haven't migrated yet
  const legacyQuery: Query = {
    id: record.id,
    knowledgeBaseId: selectedKB.id,
    query,
    response,
    sources,
    timestamp: Date.now(),
    searchMethod
  }
  
  setQueries((current) => [...(current || []), legacyQuery])
}
```

### Step 2.3.3: Create Unified Analytics Dashboard

**Create new file**: `src/components/UnifiedAnalyticsDashboard.tsx`

```typescript
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { ChartBar, Download, Filter } from '@phosphor-icons/react'
import { UnifiedQueryTracker, UnifiedQueryRecord } from '@/lib/unified-query-model'
import { Line, Bar } from 'recharts'

export function UnifiedAnalyticsDashboard({ knowledgeBaseId }: { knowledgeBaseId?: string }) {
  const [tracker] = useState(() => new UnifiedQueryTracker())
  const [analytics, setAnalytics] = useState<any>(null)
  const [history, setHistory] = useState<UnifiedQueryRecord[]>([])
  const [filter, setFilter] = useState<{
    method?: 'standard' | 'azure' | 'agentic'
    timeRange?: '1d' | '7d' | '30d' | 'all'
  }>({})

  useEffect(() => {
    loadData()
  }, [knowledgeBaseId, filter])

  const loadData = async () => {
    const timeRangeMs = filter.timeRange === '1d' ? 86400000 :
                        filter.timeRange === '7d' ? 604800000 :
                        filter.timeRange === '30d' ? 2592000000 :
                        undefined

    const startDate = timeRangeMs ? Date.now() - timeRangeMs : undefined

    const historyData = await tracker.getHistory({
      knowledgeBaseId,
      method: filter.method,
      startDate
    })

    const analyticsData = await tracker.getAnalytics(knowledgeBaseId)

    setHistory(historyData)
    setAnalytics(analyticsData)
  }

  if (!analytics) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Query Analytics</h2>
          <p className="text-muted-foreground">
            Comprehensive insights across all query methods
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={filter.timeRange || 'all'}
            onValueChange={(v) => setFilter(prev => ({ ...prev, timeRange: v as any }))}
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </Select>
          <Select
            value={filter.method || 'all'}
            onValueChange={(v) => setFilter(prev => ({ ...prev, method: v === 'all' ? undefined : v as any }))}
          >
            <option value="all">All Methods</option>
            <option value="standard">Standard</option>
            <option value="azure">Azure</option>
            <option value="agentic">Agentic</option>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Queries</div>
          <div className="text-2xl font-bold">{analytics.totalQueries}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Success Rate</div>
          <div className="text-2xl font-bold">{analytics.successRate.toFixed(1)}%</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Avg Confidence</div>
          <div className="text-2xl font-bold">
            {(analytics.agenticMetrics.averageConfidence * 100).toFixed(0)}%
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Avg Time</div>
          <div className="text-2xl font-bold">
            {analytics.agenticMetrics.averageTimeMs.toFixed(0)}ms
          </div>
        </Card>
      </div>

      {/* Method Comparison */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Method Comparison</h3>
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(analytics.methodBreakdown).map(([method, count]) => (
            <div key={method} className="p-4 border rounded-lg">
              <div className="text-sm text-muted-foreground capitalize">{method}</div>
              <div className="text-3xl font-bold">{count as number}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {((count as number / analytics.totalQueries) * 100).toFixed(1)}% of total
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Queries */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Queries</h3>
        <div className="space-y-2">
          {history.slice(0, 20).map((query) => (
            <div key={query.id} className="p-3 border rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-medium">{query.query}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {query.method}
                    </Badge>
                    {query.confidence && (
                      <Badge variant="secondary" className="text-xs">
                        {(query.confidence * 100).toFixed(0)}% conf
                      </Badge>
                    )}
                    {query.userFeedback && (
                      <Badge className="text-xs">
                        {query.userFeedback}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(query.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
```

### Success Criteria for Step 2.3
- [ ] Unified query model created
- [ ] All query types tracked in single store
- [ ] Analytics dashboard shows combined metrics
- [ ] Method comparison available
- [ ] Historical data migrated
- [ ] Backward compatibility maintained
- [ ] Export functionality added

---

# Phase 3: Advanced Features (Weeks 10-20)

## 3.1 Multi-Provider LLM Support (Weeks 10-12)

### Objective
Support multiple LLM providers beyond Spark runtime.

### Step 3.1.1: Create Provider Interfaces

**Create new file**: `src/lib/runtime/llm-providers/types.ts`

```typescript
export interface LLMModel {
  id: string
  name: string
  provider: string
  contextWindow: number
  costPer1kTokens: number
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMRequest {
  messages?: LLMMessage[]
  prompt?: string
  model?: string
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean
  stream?: boolean
}

export interface LLMResponse {
  content: string
  model: string
  tokensUsed: {
    prompt: number
    completion: number
    total: number
  }
  finishReason: 'stop' | 'length' | 'error'
}

export interface ILLMProvider {
  name: string
  models: LLMModel[]
  
  generate(request: LLMRequest): Promise<LLMResponse>
  generateStream(request: LLMRequest): AsyncGenerator<string, void, unknown>
  isAvailable(): Promise<boolean>
}
```

### Step 3.1.2: Implement OpenAI Provider

**Create new file**: `src/lib/runtime/llm-providers/openai.ts`

```typescript
import { ILLMProvider, LLMModel, LLMRequest, LLMResponse } from './types'

export class OpenAIProvider implements ILLMProvider {
  name = 'openai'
  
  models: LLMModel[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4 Optimized',
      provider: 'openai',
      contextWindow: 128000,
      costPer1kTokens: 0.005
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4 Mini',
      provider: 'openai',
      contextWindow: 128000,
      costPer1kTokens: 0.0015
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      contextWindow: 16000,
      costPer1kTokens: 0.001
    }
  ]

  constructor(private apiKey: string) {}

  async generate(request: LLMRequest): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: request.model || 'gpt-4o',
        messages: request.messages || [{ role: 'user', content: request.prompt || '' }],
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2000,
        response_format: request.jsonMode ? { type: 'json_object' } : undefined
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    
    return {
      content: data.choices[0].message.content,
      model: data.model,
      tokensUsed: {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens
      },
      finishReason: data.choices[0].finish_reason === 'stop' ? 'stop' : 'length'
    }
  }

  async *generateStream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: request.model || 'gpt-4o',
        messages: request.messages || [{ role: 'user', content: request.prompt || '' }],
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens || 2000,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    if (!reader) {
      throw new Error('No response body')
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.trim() !== '')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue

          try {
            const json = JSON.parse(data)
            const content = json.choices[0]?.delta?.content
            if (content) {
              yield content
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      })
      return response.ok
    } catch {
      return false
    }
  }
}
```

### Step 3.1.3: Create Provider Manager

**Create new file**: `src/lib/runtime/llm-providers/manager.ts`

```typescript
import { ILLMProvider } from './types'
import { SparkLLMProvider } from '../spark-adapter'
import { OpenAIProvider } from './openai'

export class LLMProviderManager {
  private providers: Map<string, ILLMProvider> = new Map()
  private activeProvider: string = 'spark'

  constructor() {
    // Register Spark provider by default
    this.registerProvider('spark', new SparkLLMProvider())
  }

  registerProvider(name: string, provider: ILLMProvider) {
    this.providers.set(name, provider)
  }

  getProvider(name?: string): ILLMProvider {
    const providerName = name || this.activeProvider
    const provider = this.providers.get(providerName)
    
    if (!provider) {
      throw new Error(`Provider ${providerName} not found`)
    }
    
    return provider
  }

  setActiveProvider(name: string) {
    if (!this.providers.has(name)) {
      throw new Error(`Provider ${name} not registered`)
    }
    this.activeProvider = name
  }

  getActiveProviderName(): string {
    return this.activeProvider
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys())
  }

  async testProvider(name: string): Promise<boolean> {
    const provider = this.getProvider(name)
    return await provider.isAvailable()
  }
}

// Export singleton
export const llmProviders = new LLMProviderManager()
```

### Step 3.1.4: Add Provider Configuration UI

**Create new file**: `src/components/LLMProviderSettings.tsx`

```typescript
import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { llmProviders } from '@/lib/runtime/llm-providers/manager'
import { OpenAIProvider } from '@/lib/runtime/llm-providers/openai'

export function LLMProviderSettings() {
  const [providers, setProviders] = useState<string[]>([])
  const [activeProvider, setActiveProvider] = useState('')
  const [openAIKey, setOpenAIKey] = useState('')

  useEffect(() => {
    setProviders(llmProviders.listProviders())
    setActiveProvider(llmProviders.getActiveProviderName())
  }, [])

  const handleAddOpenAI = async () => {
    if (!openAIKey.trim()) {
      toast.error('Please enter an API key')
      return
    }

    const provider = new OpenAIProvider(openAIKey)
    
    // Test connection
    const available = await provider.isAvailable()
    if (!available) {
      toast.error('Invalid API key or OpenAI unavailable')
      return
    }

    llmProviders.registerProvider('openai', provider)
    setProviders(llmProviders.listProviders())
    toast.success('OpenAI provider added successfully')
  }

  const handleSetActive = (provider: string) => {
    llmProviders.setActiveProvider(provider)
    setActiveProvider(provider)
    toast.success(`Switched to ${provider} provider`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Active Provider</h3>
        <Select
          value={activeProvider}
          onValueChange={handleSetActive}
        >
          {providers.map(provider => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Add OpenAI Provider</h3>
        <div className="space-y-2">
          <Label htmlFor="openai-key">API Key</Label>
          <Input
            id="openai-key"
            type="password"
            value={openAIKey}
            onChange={(e) => setOpenAIKey(e.target.value)}
            placeholder="sk-..."
          />
          <Button onClick={handleAddOpenAI}>Add OpenAI</Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Available Providers</h3>
        <div className="space-y-2">
          {providers.map(provider => (
            <div key={provider} className="flex items-center justify-between p-2 border rounded">
              <span className="capitalize">{provider}</span>
              {provider === activeProvider && (
                <Badge variant="default">Active</Badge>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Success Criteria for Step 3.1
- [ ] Multiple LLM providers supported
- [ ] OpenAI provider implemented
- [ ] Provider switching works seamlessly
- [ ] API key management secure
- [ ] Cost tracking per provider
- [ ] Provider health checks
- [ ] UI for provider management

---

## Summary

This implementation plan provides detailed, step-by-step instructions for addressing all 10 gaps identified in the agentic workflow. Each phase is broken down into actionable tasks with:

- **Clear objectives** for each step
- **Code examples** showing exact implementations
- **File-by-file modifications** with line numbers
- **Testing strategies** to validate each feature
- **Success criteria** to measure completion

The plan prioritizes critical foundation fixes in Phase 1 (3 weeks), followed by quality improvements in Phase 2 (6 weeks), and advanced features in Phase 3 (12 weeks), for a total timeline of approximately 20 weeks.

Each step includes backward compatibility considerations, error handling, and user feedback mechanisms to ensure a smooth migration path from the current implementation to a production-grade agentic RAG system.