import { Document, DocumentChunk } from './types'

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

export interface ChunkSearchDocument {
  id: string
  documentId: string
  title: string
  content: string
  chunkIndex: number
  sourceType: string
  sourceUrl: string
  addedAt: number
  embedding?: number[]
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

  async indexDocuments(documents: Document[], chunks?: DocumentChunk[]) {
    // If chunks provided, index at chunk level for better retrieval
    if (chunks && chunks.length > 0) {
      return await this.indexChunks(chunks)
    }

    // Otherwise, index documents with simple chunking (backward compatibility)
    const searchDocs = documents.map((doc) => ({
      '@search.action': 'mergeOrUpload',
      id: doc.id,
      title: doc.title,
      content: doc.content,
      sourceType: doc.sourceType,
      sourceUrl: doc.sourceUrl,
      addedAt: doc.addedAt,
      chunks: this.simpleChunkDocument(doc.content),
    }))

    return await this.makeRequest(
      `/indexes/${this.config.indexName}/docs/index`,
      'POST',
      { value: searchDocs }
    )
  }

  async indexChunks(chunks: DocumentChunk[]) {
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
      embedding: chunk.embedding,
    }))

    return await this.makeRequest(
      `/indexes/${this.config.indexName}/docs/index`,
      'POST',
      { value: searchDocs }
    )
  }

  async search(
    query: string,
    top: number = 5,
    filter?: string,
    mode: 'semantic' | 'keyword' = 'semantic'
  ): Promise<SearchResult[]> {
    const searchBody: any = {
      search: query,
      top,
      filter,
      select: 'id,title,content',
      highlight: 'content',
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      scoringProfile: 'recentBoost',
    }

    if (mode === 'semantic') {
      searchBody.queryType = 'semantic'
      searchBody.semanticConfiguration = 'default'
    } else {
      searchBody.queryType = 'simple'
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

  // Simple chunking for backward compatibility (when chunks not provided)
  private simpleChunkDocument(content: string, chunkSize: number = 1000): string[] {
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

  async updateDocument(document: Document, chunks?: DocumentChunk[]) {
    // Delete old version
    await this.deleteDocuments([document.id])

    // Delete old chunks if they exist
    if (chunks && chunks.length > 0) {
      const oldChunkIds = chunks.map(c => c.id)
      await this.deleteDocuments(oldChunkIds)
    }

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
