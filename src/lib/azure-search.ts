import { Document } from './types'

export interface AzureSearchConfig {
  endpoint: string
  apiKey: string
  indexName: string
}

export interface SearchDocument {
  id: string
  title: string
  content: string
  sourceType: string
  sourceUrl: string
  addedAt: number
  chunks: string[]
  embeddings?: number[][]
}

export interface SearchResult {
  id: string
  title: string
  content: string
  score: number
  highlights?: string[]
}

export class AzureSearchService {
  private config: AzureSearchConfig
  private apiVersion = '2023-11-01'

  constructor(config: AzureSearchConfig) {
    this.config = config
  }

  private async makeRequest(path: string, method: string, body?: unknown) {
    const url = `${this.config.endpoint}${path}?api-version=${this.apiVersion}`
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'api-key': this.config.apiKey,
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Azure Search API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async createIndex() {
    const indexSchema = {
      name: this.config.indexName,
      fields: [
        { name: 'id', type: 'Edm.String', key: true, filterable: true },
        { name: 'title', type: 'Edm.String', searchable: true, filterable: true },
        { name: 'content', type: 'Edm.String', searchable: true },
        { name: 'sourceType', type: 'Edm.String', filterable: true, facetable: true },
        { name: 'sourceUrl', type: 'Edm.String', filterable: true },
        { name: 'addedAt', type: 'Edm.Int64', filterable: true, sortable: true },
        { name: 'chunks', type: 'Collection(Edm.String)', searchable: true },
      ],
      scoringProfiles: [
        {
          name: 'recentBoost',
          text: {
            weights: {
              title: 2,
              content: 1,
              chunks: 1.5,
            },
          },
          functions: [
            {
              type: 'freshness',
              fieldName: 'addedAt',
              boost: 2,
              interpolation: 'linear',
              freshness: {
                boostingDuration: 'P30D',
              },
            },
          ],
        },
      ],
      suggesters: [
        {
          name: 'sg',
          searchMode: 'analyzingInfixMatching',
          sourceFields: ['title', 'content'],
        },
      ],
    }

    try {
      return await this.makeRequest(`/indexes`, 'POST', indexSchema)
    } catch (error) {
      if (error instanceof Error && error.message.includes('409')) {
        return { message: 'Index already exists' }
      }
      throw error
    }
  }

  async indexDocuments(documents: Document[]) {
    const searchDocs = documents.map((doc) => ({
      '@search.action': 'mergeOrUpload',
      id: doc.id,
      title: doc.title,
      content: doc.content,
      sourceType: doc.sourceType,
      sourceUrl: doc.sourceUrl,
      addedAt: doc.addedAt,
      chunks: this.chunkDocument(doc.content),
    }))

    return await this.makeRequest(
      `/indexes/${this.config.indexName}/docs/index`,
      'POST',
      { value: searchDocs }
    )
  }

  async search(query: string, top: number = 5, filter?: string): Promise<SearchResult[]> {
    const searchBody = {
      search: query,
      top,
      filter,
      queryType: 'semantic',
      semanticConfiguration: 'default',
      select: 'id,title,content',
      highlight: 'content',
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      scoringProfile: 'recentBoost',
    }

    const response = await this.makeRequest(
      `/indexes/${this.config.indexName}/docs/search`,
      'POST',
      searchBody
    )

    return response.value.map((result: any) => ({
      id: result.id,
      title: result.title,
      content: result.content,
      score: result['@search.score'],
      highlights: result['@search.highlights']?.content,
    }))
  }

  async deleteDocuments(documentIds: string[]) {
    const deleteDocs = documentIds.map((id) => ({
      '@search.action': 'delete',
      id,
    }))

    return await this.makeRequest(
      `/indexes/${this.config.indexName}/docs/index`,
      'POST',
      { value: deleteDocs }
    )
  }

  async getDocumentCount(): Promise<number> {
    const response = await this.makeRequest(
      `/indexes/${this.config.indexName}/docs/$count`,
      'GET'
    )
    return response
  }

  private chunkDocument(content: string, chunkSize: number = 1000): string[] {
    const chunks: string[] = []
    const paragraphs = content.split(/\n\n+/)
    
    let currentChunk = ''
    
    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim())
        currentChunk = paragraph
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim())
    }
    
    return chunks
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/indexes', 'GET')
      return true
    } catch {
      return false
    }
  }
}

export function validateAzureConfig(config: Partial<AzureSearchConfig>): string | null {
  if (!config.endpoint) {
    return 'Azure Search endpoint is required'
  }
  
  if (!config.endpoint.startsWith('https://')) {
    return 'Endpoint must start with https://'
  }
  
  if (!config.apiKey) {
    return 'API key is required'
  }
  
  if (!config.indexName) {
    return 'Index name is required'
  }
  
  if (!/^[a-z0-9-]+$/.test(config.indexName)) {
    return 'Index name must contain only lowercase letters, numbers, and hyphens'
  }
  
  return null
}
