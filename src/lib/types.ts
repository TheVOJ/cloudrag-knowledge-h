export type SourceType = 'web' | 'github' | 'onedrive' | 'dropbox' | 'pdf' | 'docx' | 'markdown'

export interface Document {
  id: string
  title: string
  content: string
  sourceType: SourceType
  sourceUrl: string
  addedAt: number
  knowledgeBaseId: string
  metadata: {
    size?: number
    lastModified?: number
    author?: string
    thumbnail?: string
    pageCount?: number
  }
  chunkCount?: number
  chunkStrategy?: 'fixed' | 'sentence' | 'paragraph' | 'semantic'
}

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

export interface KnowledgeBase {
  id: string
  name: string
  description: string
  createdAt: number
  updatedAt: number
  documentCount: number
  sources: SourceType[]
  azureSearchEnabled?: boolean
  azureIndexName?: string
}

export interface Query {
  id: string
  knowledgeBaseId: string
  query: string
  response: string
  sources: string[]
  timestamp: number
  searchMethod?: 'simulated' | 'azure' | 'agentic'
}

export interface AzureSearchSettings {
  endpoint: string
  apiKey: string
  enabled: boolean
}
