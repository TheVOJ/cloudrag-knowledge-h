export type SourceType = 'web' | 'github' | 'onedrive' | 'dropbox'

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
}

export interface Query {
  id: string
  knowledgeBaseId: string
  query: string
  response: string
  sources: string[]
  timestamp: number
}
