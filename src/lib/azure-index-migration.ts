import { AzureSearchService } from './azure-search'
import { ChunkManager } from './chunk-manager'
import { Document, DocumentChunk } from './types'

/**
 * Azure Search Index Migration Utility
 *
 * This utility helps migrate from old Azure Search indexes (without vector fields)
 * to new indexes with proper vector and semantic configurations.
 *
 * Migration Process:
 * 1. Create new index with vector + semantic configuration (2024-11-01-preview API)
 * 2. Read documents from old index
 * 3. Generate embeddings for documents/chunks
 * 4. Index documents in new index
 * 5. Verify migration success
 * 6. (Optional) Delete old index
 */
export class AzureIndexMigration {
  private oldService: AzureSearchService
  private newService: AzureSearchService
  private chunkManager: ChunkManager

  constructor(
    azureEndpoint: string,
    azureApiKey: string,
    oldIndexName: string,
    newIndexName: string
  ) {
    this.oldService = new AzureSearchService({
      endpoint: azureEndpoint,
      apiKey: azureApiKey,
      indexName: oldIndexName
    })

    this.newService = new AzureSearchService({
      endpoint: azureEndpoint,
      apiKey: azureApiKey,
      indexName: newIndexName
    })

    this.chunkManager = new ChunkManager()
  }

  /**
   * Step 1: Create the new index with vector and semantic configuration
   */
  async createNewIndex(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('Creating new index with vector + semantic configuration...')
      const result = await this.newService.createIndex()

      if (result.message === 'Index already exists') {
        return {
          success: false,
          message: 'New index already exists. Delete it first or use a different name.'
        }
      }

      return { success: true, message: 'New index created successfully' }
    } catch (error) {
      return {
        success: false,
        message: `Failed to create new index: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Step 2: Export documents from old index
   * Note: Azure Search doesn't have a direct "list all documents" API,
   * so this is a workaround using search with "*" query
   */
  async exportDocumentsFromOldIndex(maxDocuments: number = 1000): Promise<{
    success: boolean
    documents: any[]
    message: string
  }> {
    try {
      console.log('Exporting documents from old index...')

      // Search for all documents using wildcard
      const results = await this.oldService.search('*', maxDocuments, undefined, 'keyword')

      console.log(`Exported ${results.length} documents from old index`)

      return {
        success: true,
        documents: results,
        message: `Exported ${results.length} documents`
      }
    } catch (error) {
      return {
        success: false,
        documents: [],
        message: `Failed to export documents: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Step 3: Migrate documents to new index with embeddings
   */
  async migrateDocuments(
    documents: Document[],
    knowledgeBaseId: string,
    onProgress?: (current: number, total: number, message: string) => void
  ): Promise<{ success: boolean; migrated: number; failed: number; errors: string[] }> {
    let migrated = 0
    let failed = 0
    const errors: string[] = []

    console.log(`Starting migration of ${documents.length} documents...`)

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]
      onProgress?.(i + 1, documents.length, `Processing: ${doc.title}`)

      try {
        // Generate chunks with embeddings
        const chunks = await this.chunkManager.chunkDocument(
          doc.id,
          knowledgeBaseId,
          doc.title,
          doc.content,
          doc.sourceType,
          doc.sourceUrl,
          doc.chunkStrategy || 'semantic'
        )

        // Index document with chunks in new index
        await this.newService.indexDocuments([doc], chunks)
        migrated++

        console.log(`✓ Migrated: ${doc.title} (${chunks.length} chunks)`)
      } catch (error) {
        failed++
        const errorMsg = `Failed to migrate "${doc.title}": ${error instanceof Error ? error.message : 'Unknown error'}`
        errors.push(errorMsg)
        console.error(`✗ ${errorMsg}`)
      }
    }

    return { success: failed === 0, migrated, failed, errors }
  }

  /**
   * Step 4: Verify migration success
   */
  async verifyMigration(): Promise<{
    success: boolean
    oldCount: number
    newCount: number
    message: string
  }> {
    try {
      console.log('Verifying migration...')

      // Get document counts from both indexes
      const oldResults = await this.oldService.search('*', 1000, undefined, 'keyword')
      const newResults = await this.newService.search('*', 1000, undefined, 'keyword')

      const oldCount = oldResults.length
      const newCount = newResults.length

      if (newCount >= oldCount) {
        return {
          success: true,
          oldCount,
          newCount,
          message: `Migration verified: ${newCount} documents in new index (${oldCount} in old index)`
        }
      } else {
        return {
          success: false,
          oldCount,
          newCount,
          message: `Migration incomplete: Only ${newCount}/${oldCount} documents migrated`
        }
      }
    } catch (error) {
      return {
        success: false,
        oldCount: 0,
        newCount: 0,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Complete migration workflow
   */
  async runFullMigration(
    documents: Document[],
    knowledgeBaseId: string,
    onProgress?: (step: string, progress?: { current: number; total: number }) => void
  ): Promise<{
    success: boolean
    steps: Array<{ step: string; success: boolean; message: string }>
  }> {
    const steps: Array<{ step: string; success: boolean; message: string }> = []

    // Step 1: Create new index
    onProgress?.('Creating new index...')
    const createResult = await this.createNewIndex()
    steps.push({ step: 'Create new index', ...createResult })

    if (!createResult.success) {
      return { success: false, steps }
    }

    // Step 2: Migrate documents
    onProgress?.('Migrating documents...')
    const migrateResult = await this.migrateDocuments(
      documents,
      knowledgeBaseId,
      (current, total, message) => {
        onProgress?.(`Migrating documents... (${current}/${total})`, { current, total })
      }
    )

    steps.push({
      step: 'Migrate documents',
      success: migrateResult.success,
      message: `Migrated ${migrateResult.migrated} documents, ${migrateResult.failed} failed`
    })

    if (migrateResult.failed > 0) {
      console.warn('Migration errors:', migrateResult.errors)
    }

    // Step 3: Verify migration
    onProgress?.('Verifying migration...')
    const verifyResult = await this.verifyMigration()
    steps.push({ step: 'Verify migration', ...verifyResult })

    return {
      success: steps.every(s => s.success),
      steps
    }
  }
}

/**
 * Helper function to run migration from the UI
 */
export async function migrateAzureIndex(
  azureEndpoint: string,
  azureApiKey: string,
  oldIndexName: string,
  newIndexName: string,
  documents: Document[],
  knowledgeBaseId: string,
  onProgress?: (message: string, progress?: { current: number; total: number }) => void
): Promise<{ success: boolean; message: string; details: any }> {
  const migration = new AzureIndexMigration(
    azureEndpoint,
    azureApiKey,
    oldIndexName,
    newIndexName
  )

  try {
    const result = await migration.runFullMigration(documents, knowledgeBaseId, onProgress)

    if (result.success) {
      return {
        success: true,
        message: `Migration completed successfully! ${documents.length} documents migrated.`,
        details: result.steps
      }
    } else {
      const failedSteps = result.steps.filter(s => !s.success)
      return {
        success: false,
        message: `Migration failed at: ${failedSteps.map(s => s.step).join(', ')}`,
        details: result.steps
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      details: null
    }
  }
}
