export type SourceType = 'web' | 'github' | 'onedrive' | 'dropbox' | 'pdf' | 'docx'

export interface Document {
  id: string
  title: string
  content: string
  sourceType: SourceType
  sourceUrl: string
  addedAt: number
  metadata: {
    size?: number
    lastModified?: number
    author?: string
    thumbnail?: string
    pageCount?: number
  }
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
  searchMethod?: 'simulated' | 'azure'
}

export interface AzureSearchSettings {
  endpoint: string
  apiKey: string
  enabled: boolean
}
