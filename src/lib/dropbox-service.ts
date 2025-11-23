import { Document } from './types'
import { generateId } from './helpers'

export interface DropboxAuthConfig {
  accessToken: string
}

export interface DropboxFile {
  '.tag': 'file' | 'folder'
  name: string
  path_lower: string
  path_display: string
  id: string
  client_modified?: string
  server_modified?: string
  size?: number
  content_hash?: string
}

export interface DropboxContentResult {
  files: DropboxFile[]
  totalSize: number
  fileCount: number
}

export class DropboxService {
  private accessToken: string
  private apiUrl = 'https://api.dropboxapi.com/2'
  private contentUrl = 'https://content.dropboxapi.com/2'

  constructor(config: DropboxAuthConfig) {
    this.accessToken = config.accessToken
  }

  async listFolder(path: string = ''): Promise<DropboxContentResult> {
    const files: DropboxFile[] = []
    let totalSize = 0
    let fileCount = 0
    let cursor: string | null = null
    let hasMore = true

    while (hasMore) {
      const url = cursor 
        ? `${this.apiUrl}/files/list_folder/continue`
        : `${this.apiUrl}/files/list_folder`
      
      const body = cursor 
        ? JSON.stringify({ cursor })
        : JSON.stringify({ 
            path: path || '',
            recursive: true,
            include_deleted: false,
            include_has_explicit_shared_members: false,
            include_mounted_folders: true
          })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(`Dropbox API error: ${response.status} ${error.error_summary || response.statusText}`)
      }

      const data = await response.json()
      
      for (const entry of data.entries || []) {
        if (entry['.tag'] === 'file') {
          files.push(entry)
          totalSize += entry.size || 0
          fileCount++
        }
      }

      hasMore = data.has_more
      cursor = data.cursor
    }

    return { files, totalSize, fileCount }
  }

  async downloadFile(path: string): Promise<ArrayBuffer> {
    const response = await fetch(`${this.contentUrl}/files/download`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Dropbox-API-Arg': JSON.stringify({ path })
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`)
    }

    return await response.arrayBuffer()
  }

  async getFileContent(file: DropboxFile): Promise<string> {
    const buffer = await this.downloadFile(file.path_lower)
    const fileName = file.name.toLowerCase()
    
    if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileName.endsWith('.json') || 
        fileName.endsWith('.csv') || fileName.endsWith('.xml') || fileName.endsWith('.html') ||
        fileName.endsWith('.js') || fileName.endsWith('.ts') || fileName.endsWith('.py') ||
        fileName.endsWith('.java') || fileName.endsWith('.cpp') || fileName.endsWith('.c')) {
      const decoder = new TextDecoder('utf-8')
      return decoder.decode(buffer)
    } else if (fileName.endsWith('.pdf')) {
      return `[PDF Document: ${file.name}]\n\nPath: ${file.path_display}\nSize: ${file.size} bytes\n\nThis is a PDF file that would be processed with a PDF parser in production.`
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      return `[Word Document: ${file.name}]\n\nPath: ${file.path_display}\nSize: ${file.size} bytes\n\nThis is a Word document that would be processed with a document parser in production.`
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      return `[Excel Spreadsheet: ${file.name}]\n\nPath: ${file.path_display}\nSize: ${file.size} bytes\n\nThis is a spreadsheet that would be processed with a spreadsheet parser in production.`
    } else if (fileName.endsWith('.pptx') || fileName.endsWith('.ppt')) {
      return `[PowerPoint Presentation: ${file.name}]\n\nPath: ${file.path_display}\nSize: ${file.size} bytes\n\nThis is a presentation that would be processed with a presentation parser in production.`
    } else {
      return `[Binary File: ${file.name}]\n\nPath: ${file.path_display}\nSize: ${file.size} bytes\nType: ${this.getFileExtension(file.name)}\n\nThis file format requires specialized parsing.`
    }
  }

  async searchFiles(query: string): Promise<DropboxFile[]> {
    const response = await fetch(`${this.apiUrl}/files/search_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        options: {
          path: '',
          max_results: 100,
          file_status: 'active',
          filename_only: false
        }
      })
    })

    if (!response.ok) {
      throw new Error(`Dropbox search error: ${response.status}`)
    }

    const data = await response.json()
    return (data.matches || [])
      .map((match: any) => match.metadata.metadata)
      .filter((item: any) => item['.tag'] === 'file')
  }

  async getMetadata(path: string): Promise<DropboxFile> {
    const response = await fetch(`${this.apiUrl}/files/get_metadata`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path })
    })

    if (!response.ok) {
      throw new Error(`Dropbox metadata error: ${response.status}`)
    }

    return await response.json()
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts[parts.length - 1] : 'unknown'
  }
}

export async function fetchDropboxContent(
  accessToken: string, 
  path: string = ''
): Promise<DropboxContentResult> {
  const service = new DropboxService({ accessToken })
  
  try {
    return await service.listFolder(path)
  } catch (error) {
    throw new Error(`Failed to fetch Dropbox content: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function convertDropboxToDocuments(
  accessToken: string,
  path: string,
  sourceUrl: string
): Promise<Omit<Document, 'id' | 'addedAt' | 'knowledgeBaseId'>[]> {
  if (!accessToken || accessToken.trim() === '') {
    return await simulateDropboxFetch(path)
  }
  
  const service = new DropboxService({ accessToken })
  const result = await fetchDropboxContent(accessToken, path)
  
  const documents: Omit<Document, 'id' | 'addedAt' | 'knowledgeBaseId'>[] = []
  
  for (const file of result.files) {
    try {
      const content = await service.getFileContent(file)
      
      documents.push({
        title: file.name,
        content: content,
        sourceType: 'dropbox',
        sourceUrl: `https://www.dropbox.com/home${file.path_display}`,
        metadata: {
          size: file.size || 0,
          lastModified: file.server_modified ? new Date(file.server_modified).getTime() : Date.now(),
          author: 'Dropbox User'
        }
      })
    } catch (error) {
      console.error(`Failed to fetch content for ${file.name}:`, error)
    }
  }
  
  if (documents.length === 0) {
    throw new Error('No readable documents found in the specified location')
  }
  
  return documents
}

export function parseDropboxUrl(url: string): { type: 'share' | 'path', value: string } {
  if (url.includes('dropbox.com')) {
    const match = url.match(/dropbox\.com\/(?:home|s|scl\/fi|sh)\/(.+)/)
    if (match) {
      return { type: 'share', value: `/${decodeURIComponent(match[1])}` }
    }
  }
  
  return { type: 'path', value: url.startsWith('/') ? url : `/${url}` }
}

export async function simulateDropboxFetch(pathOrUrl: string): Promise<Omit<Document, 'id' | 'addedAt' | 'knowledgeBaseId'>[]> {
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  const mockFiles = [
    {
      name: 'Technical Specification.md',
      content: `# Technical Specification: RAG Knowledge Base System

## System Architecture

### Overview
The system is built on a microservices architecture with the following key components:

\`\`\`
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│   API Layer  │────▶│   Storage   │
│   (React)   │     │  (REST API)  │     │  (Vector DB)│
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Azure AI    │
                    │   Search     │
                    └──────────────┘
\`\`\`

## Data Flow

### Document Ingestion Pipeline

1. **Source Connection**
   - OneDrive API integration
   - Dropbox API integration
   - GitHub API integration
   - Web scraping engine

2. **Content Extraction**
   - Text extraction from various formats
   - Metadata preservation
   - Content normalization

3. **Chunking Strategy**
   - Semantic chunking with overlap
   - Maximum chunk size: 1000 tokens
   - Overlap: 200 tokens
   - Preserves paragraph boundaries

4. **Embedding Generation**
   - OpenAI text-embedding-ada-002
   - Dimension: 1536
   - Batch processing for efficiency

5. **Index Storage**
   - Azure AI Search indexing
   - Local vector storage fallback
   - Metadata indexing for filters

### Query Processing Pipeline

1. **Query Understanding**
   \`\`\`typescript
   interface QueryContext {
     intent: 'factual' | 'analytical' | 'procedural'
     complexity: number
     entities: string[]
     temporalContext?: string
   }
   \`\`\`

2. **Routing Decision**
   - Intent classification
   - Strategy selection
   - Resource allocation

3. **Retrieval Execution**
   - Vector similarity search
   - Hybrid search (BM25 + semantic)
   - Re-ranking by relevance

4. **Answer Generation**
   - Context assembly
   - LLM prompting
   - Response synthesis

## API Endpoints

### Document Management

\`\`\`
POST   /api/documents/ingest
GET    /api/documents/:id
DELETE /api/documents/:id
PATCH  /api/documents/:id
\`\`\`

### Query Interface

\`\`\`
POST   /api/query
POST   /api/query/agentic
GET    /api/query/history
\`\`\`

### Knowledge Base

\`\`\`
POST   /api/kb/create
GET    /api/kb/:id
DELETE /api/kb/:id
GET    /api/kb/list
\`\`\`

## Security Considerations

### Authentication
- OAuth 2.0 for cloud services
- JWT tokens for API access
- Role-based access control (RBAC)

### Data Protection
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- PII detection and masking

### Compliance
- GDPR compliance
- SOC 2 Type II certification
- Data residency options

## Performance Requirements

| Metric | Target | Notes |
|--------|--------|-------|
| Query latency | < 2s | 95th percentile |
| Ingestion rate | 100 docs/min | Sustained throughput |
| Concurrent users | 1000+ | With auto-scaling |
| Availability | 99.9% | Excluding maintenance |

## Technology Stack

### Frontend
- React 19
- TypeScript
- Tailwind CSS
- Framer Motion

### Backend
- Node.js runtime
- Spark SDK for LLM
- Azure SDK

### Storage
- Azure AI Search
- Local KV store
- Browser persistence

## Monitoring & Observability

### Metrics
- Query response times
- Retrieval accuracy
- Error rates
- Token usage

### Logging
- Structured logging (JSON)
- Log aggregation
- Query audit trail

## Future Enhancements

1. Real-time collaboration
2. Custom model fine-tuning
3. Multi-tenancy support
4. Advanced analytics dashboard`,
      mimeType: 'text/markdown'
    },
    {
      name: 'API Documentation.txt',
      content: `RAG Knowledge Base API Documentation
=====================================

Base URL: https://api.example.com/v1

Authentication
--------------
All API requests require authentication using Bearer tokens.

Headers:
  Authorization: Bearer <your_api_token>
  Content-Type: application/json

Rate Limiting
-------------
- 100 requests per minute for authenticated users
- 10 requests per minute for anonymous users
- Rate limit headers included in all responses:
  X-RateLimit-Limit: 100
  X-RateLimit-Remaining: 95
  X-RateLimit-Reset: 1234567890

Error Responses
---------------
All errors follow this format:

{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}

Common error codes:
- UNAUTHORIZED (401): Invalid or missing authentication
- FORBIDDEN (403): Insufficient permissions
- NOT_FOUND (404): Resource not found
- RATE_LIMITED (429): Rate limit exceeded
- INTERNAL_ERROR (500): Server error

Knowledge Base Endpoints
------------------------

1. Create Knowledge Base
   POST /kb

   Request:
   {
     "name": "Product Documentation",
     "description": "Customer-facing product docs",
     "azureSearchEnabled": true
   }

   Response (201):
   {
     "id": "kb_abc123",
     "name": "Product Documentation",
     "createdAt": "2025-01-15T10:30:00Z"
   }

2. List Knowledge Bases
   GET /kb?limit=20&offset=0

   Response (200):
   {
     "data": [...],
     "pagination": {
       "total": 45,
       "limit": 20,
       "offset": 0
     }
   }

3. Get Knowledge Base
   GET /kb/:id

   Response (200):
   {
     "id": "kb_abc123",
     "name": "Product Documentation",
     "documentCount": 125,
     "sources": ["web", "github", "onedrive"]
   }

Document Endpoints
------------------

1. Ingest Document
   POST /kb/:id/documents

   Request:
   {
     "sourceType": "web",
     "sourceUrl": "https://example.com/doc",
     "metadata": {
       "author": "John Doe"
     }
   }

   Response (202):
   {
     "jobId": "job_xyz789",
     "status": "processing"
   }

2. List Documents
   GET /kb/:id/documents?limit=50

3. Get Document
   GET /documents/:id

4. Delete Document
   DELETE /documents/:id

Query Endpoints
---------------

1. Standard Query
   POST /kb/:id/query

   Request:
   {
     "query": "How do I reset my password?",
     "topK": 5
   }

   Response (200):
   {
     "answer": "To reset your password...",
     "sources": [
       {
         "documentId": "doc_123",
         "title": "Account Management",
         "relevance": 0.95
       }
     ],
     "confidence": 0.87
   }

2. Agentic Query
   POST /kb/:id/query/agentic

   Request:
   {
     "query": "Compare our pricing with competitors"
   }

   Response (200):
   {
     "answer": "...",
     "reasoning": {
       "strategy": "multi_hop",
       "steps": [...]
     },
     "sources": [...]
   }

Webhooks
--------

Configure webhooks to receive notifications:

POST /webhooks

{
  "url": "https://your-app.com/webhook",
  "events": ["document.ingested", "query.completed"]
}

Webhook payload example:
{
  "event": "document.ingested",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "documentId": "doc_123",
    "knowledgeBaseId": "kb_abc123"
  }
}

SDK Examples
------------

JavaScript/TypeScript:
const kb = await client.knowledgeBases.create({
  name: "My KB",
  description: "..."
});

const result = await client.query(kb.id, {
  query: "What is RAG?",
  topK: 3
});

Python:
kb = client.knowledge_bases.create(
  name="My KB",
  description="..."
)

result = client.query(
  kb_id=kb.id,
  query="What is RAG?",
  top_k=3
)

Support
-------
For API support, contact: api-support@example.com
Documentation: https://docs.example.com
Status page: https://status.example.com`,
      mimeType: 'text/plain'
    },
    {
      name: 'Data Schema.json',
      content: `{
  "version": "1.0",
  "schemas": {
    "KnowledgeBase": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "format": "uuid",
          "description": "Unique identifier for the knowledge base"
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 100,
          "description": "Human-readable name"
        },
        "description": {
          "type": "string",
          "maxLength": 500,
          "description": "Detailed description of the knowledge base purpose"
        },
        "createdAt": {
          "type": "number",
          "description": "Unix timestamp of creation"
        },
        "updatedAt": {
          "type": "number",
          "description": "Unix timestamp of last update"
        },
        "documentCount": {
          "type": "number",
          "minimum": 0,
          "description": "Total number of documents"
        },
        "sources": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["web", "github", "onedrive", "dropbox"]
          },
          "description": "Active source types"
        },
        "azureSearchEnabled": {
          "type": "boolean",
          "default": false,
          "description": "Whether Azure AI Search integration is active"
        },
        "azureIndexName": {
          "type": "string",
          "pattern": "^[a-z0-9-]+$",
          "description": "Azure Search index name (lowercase, alphanumeric and hyphens)"
        }
      },
      "required": ["id", "name", "createdAt", "documentCount", "sources"]
    },
    "Document": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique document identifier"
        },
        "title": {
          "type": "string",
          "minLength": 1,
          "description": "Document title"
        },
        "content": {
          "type": "string",
          "description": "Full document content"
        },
        "sourceType": {
          "type": "string",
          "enum": ["web", "github", "onedrive", "dropbox"],
          "description": "Origin of the document"
        },
        "sourceUrl": {
          "type": "string",
          "format": "uri",
          "description": "Original location URL"
        },
        "addedAt": {
          "type": "number",
          "description": "Unix timestamp when added"
        },
        "metadata": {
          "type": "object",
          "properties": {
            "size": {
              "type": "number",
              "minimum": 0,
              "description": "Size in bytes"
            },
            "lastModified": {
              "type": "number",
              "description": "Unix timestamp of last modification"
            },
            "author": {
              "type": "string",
              "description": "Document author name"
            },
            "tags": {
              "type": "array",
              "items": {
                "type": "string"
              },
              "description": "Custom tags for categorization"
            }
          }
        }
      },
      "required": ["id", "title", "content", "sourceType", "sourceUrl", "addedAt"]
    },
    "Query": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique query identifier"
        },
        "knowledgeBaseId": {
          "type": "string",
          "description": "Reference to the knowledge base"
        },
        "query": {
          "type": "string",
          "minLength": 1,
          "description": "User's search query"
        },
        "response": {
          "type": "string",
          "description": "Generated answer"
        },
        "sources": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "List of source document IDs used"
        },
        "timestamp": {
          "type": "number",
          "description": "Unix timestamp of query execution"
        },
        "searchMethod": {
          "type": "string",
          "enum": ["simulated", "azure"],
          "description": "Search method used"
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1,
          "description": "Confidence score of the answer"
        }
      },
      "required": ["id", "knowledgeBaseId", "query", "response", "timestamp"]
    },
    "ChunkMetadata": {
      "type": "object",
      "properties": {
        "chunkId": {
          "type": "string",
          "description": "Unique chunk identifier"
        },
        "documentId": {
          "type": "string",
          "description": "Parent document reference"
        },
        "startIndex": {
          "type": "number",
          "minimum": 0,
          "description": "Start position in original document"
        },
        "endIndex": {
          "type": "number",
          "minimum": 0,
          "description": "End position in original document"
        },
        "tokenCount": {
          "type": "number",
          "minimum": 0,
          "description": "Number of tokens in chunk"
        },
        "embedding": {
          "type": "array",
          "items": {
            "type": "number"
          },
          "description": "Vector embedding of the chunk"
        }
      },
      "required": ["chunkId", "documentId", "startIndex", "endIndex"]
    }
  },
  "relationships": {
    "KnowledgeBase_to_Documents": {
      "type": "one-to-many",
      "description": "A knowledge base contains multiple documents"
    },
    "Document_to_Chunks": {
      "type": "one-to-many",
      "description": "A document is split into multiple chunks"
    },
    "Query_to_KnowledgeBase": {
      "type": "many-to-one",
      "description": "Multiple queries can target the same knowledge base"
    }
  },
  "indexes": {
    "documents": {
      "fields": ["sourceType", "addedAt", "metadata.size"],
      "description": "Optimize document filtering and sorting"
    },
    "queries": {
      "fields": ["knowledgeBaseId", "timestamp"],
      "description": "Optimize query history lookups"
    }
  }
}`,
      mimeType: 'application/json'
    }
  ]
  
  return mockFiles.map(file => ({
    title: file.name,
    content: file.content,
    sourceType: 'dropbox' as const,
    sourceUrl: pathOrUrl,
    metadata: {
      size: file.content.length,
      lastModified: Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000),
      author: 'Demo User'
    }
  }))
}
