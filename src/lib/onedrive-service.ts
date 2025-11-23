import { Document } from './types'
import { generateId } from './helpers'

export interface OneDriveAuthConfig {
  accessToken: string
}

export interface OneDriveItem {
  id: string
  name: string
  '@microsoft.graph.downloadUrl'?: string
  file?: {
    mimeType: string
  }
  folder?: {
    childCount: number
  }
  size: number
  lastModifiedDateTime: string
  lastModifiedBy?: {
    user?: {
      displayName: string
    }
  }
  webUrl: string
}

export interface OneDriveContentResult {
  items: OneDriveItem[]
  totalSize: number
  fileCount: number
}

export class OneDriveService {
  private accessToken: string
  private baseUrl = 'https://graph.microsoft.com/v1.0'

  constructor(config: OneDriveAuthConfig) {
    this.accessToken = config.accessToken
  }

  async fetchFolderContents(folderId: string = 'root'): Promise<OneDriveContentResult> {
    const items: OneDriveItem[] = []
    let totalSize = 0
    let fileCount = 0

    const url = `${this.baseUrl}/me/drive/items/${folderId}/children`
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`OneDrive API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    for (const item of data.value || []) {
      items.push(item)
      
      if (item.file) {
        totalSize += item.size || 0
        fileCount++
      } else if (item.folder) {
        const childResult = await this.fetchFolderContents(item.id)
        items.push(...childResult.items)
        totalSize += childResult.totalSize
        fileCount += childResult.fileCount
      }
    }

    return { items, totalSize, fileCount }
  }

  async fetchFileContent(item: OneDriveItem): Promise<string> {
    if (!item['@microsoft.graph.downloadUrl']) {
      throw new Error('No download URL available for this item')
    }

    const response = await fetch(item['@microsoft.graph.downloadUrl'])
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`)
    }

    const mimeType = item.file?.mimeType || ''
    
    if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('xml')) {
      return await response.text()
    } else if (mimeType.includes('pdf')) {
      return `[PDF Document: ${item.name}]\n\nThis is a PDF file that would be processed with a PDF parser in production.`
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return `[Document: ${item.name}]\n\nThis is a Word document that would be processed with a document parser in production.`
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      return `[Spreadsheet: ${item.name}]\n\nThis is a spreadsheet that would be processed with a spreadsheet parser in production.`
    } else if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      return `[Presentation: ${item.name}]\n\nThis is a presentation that would be processed with a presentation parser in production.`
    } else {
      return `[Binary File: ${item.name}]\n\nFile type: ${mimeType}\nThis file format requires specialized parsing.`
    }
  }

  async searchFiles(query: string): Promise<OneDriveItem[]> {
    const url = `${this.baseUrl}/me/drive/root/search(q='${encodeURIComponent(query)}')`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`OneDrive search error: ${response.status}`)
    }

    const data = await response.json()
    return data.value || []
  }

  async getItemByPath(path: string): Promise<OneDriveItem> {
    const url = `${this.baseUrl}/me/drive/root:${path}`
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`OneDrive path error: ${response.status}`)
    }

    return await response.json()
  }
}

export async function fetchOneDriveContent(
  accessToken: string, 
  pathOrId: string = 'root'
): Promise<OneDriveContentResult> {
  const service = new OneDriveService({ accessToken })
  
  try {
    if (pathOrId.startsWith('/')) {
      const item = await service.getItemByPath(pathOrId)
      if (item.folder) {
        return await service.fetchFolderContents(item.id)
      } else {
        return { items: [item], totalSize: item.size, fileCount: 1 }
      }
    } else {
      return await service.fetchFolderContents(pathOrId)
    }
  } catch (error) {
    throw new Error(`Failed to fetch OneDrive content: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function convertOneDriveToDocuments(
  accessToken: string,
  pathOrId: string,
  sourceUrl: string
): Promise<Omit<Document, 'id' | 'addedAt' | 'knowledgeBaseId'>[]> {
  if (!accessToken || accessToken.trim() === '') {
    return await simulateOneDriveFetch(pathOrId)
  }
  
  const service = new OneDriveService({ accessToken })
  const result = await fetchOneDriveContent(accessToken, pathOrId)
  
  const documents: Omit<Document, 'id' | 'addedAt' | 'knowledgeBaseId'>[] = []
  
  for (const item of result.items) {
    if (item.file) {
      try {
        const content = await service.fetchFileContent(item)
        
        documents.push({
          title: item.name,
          content: content,
          sourceType: 'onedrive',
          sourceUrl: item.webUrl || sourceUrl,
          metadata: {
            size: item.size,
            lastModified: new Date(item.lastModifiedDateTime).getTime(),
            author: item.lastModifiedBy?.user?.displayName || 'Unknown'
          }
        })
      } catch (error) {
        console.error(`Failed to fetch content for ${item.name}:`, error)
      }
    }
  }
  
  if (documents.length === 0) {
    throw new Error('No readable documents found in the specified location')
  }
  
  return documents
}

export function parseOneDriveUrl(url: string): { type: 'share' | 'path' | 'id', value: string } {
  if (url.includes('1drv.ms') || url.includes('sharepoint.com')) {
    return { type: 'share', value: url }
  }
  
  if (url.startsWith('/')) {
    return { type: 'path', value: url }
  }
  
  return { type: 'id', value: url }
}

export async function simulateOneDriveFetch(pathOrUrl: string): Promise<Omit<Document, 'id' | 'addedAt' | 'knowledgeBaseId'>[]> {
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  const mockFiles = [
    {
      name: 'Project Proposal.docx',
      content: `# Project Proposal

## Executive Summary

This document outlines the strategic initiative for implementing a comprehensive knowledge management system using RAG technology.

## Objectives

1. **Centralize Knowledge**: Consolidate information from multiple sources
2. **Improve Accessibility**: Enable natural language querying
3. **Enhance Productivity**: Reduce time spent searching for information

## Technical Architecture

The proposed system will use:

- **Vector Database**: For semantic search capabilities
- **Azure AI Search**: For enterprise-grade indexing
- **LLM Integration**: For natural language understanding

## Implementation Timeline

### Phase 1 (Q1)
- Requirements gathering
- Technology evaluation
- Proof of concept development

### Phase 2 (Q2)
- Full system implementation
- User training
- Pilot deployment

### Phase 3 (Q3)
- Organization-wide rollout
- Performance optimization
- Feedback integration

## Budget Considerations

The estimated budget for this initiative is $500,000, covering:
- Software licenses
- Cloud infrastructure
- Development resources
- Training and support

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Data security | High | Implement encryption and access controls |
| User adoption | Medium | Comprehensive training program |
| Technical complexity | Medium | Phased rollout approach |

## Conclusion

This initiative will transform how our organization manages and accesses knowledge, leading to improved efficiency and decision-making.`,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    },
    {
      name: 'Meeting Notes.txt',
      content: `Meeting Notes - Q1 Planning Session
Date: ${new Date().toLocaleDateString()}

Attendees:
- Sarah Johnson (VP of Engineering)
- Mike Chen (Product Manager)
- Lisa Rodriguez (Data Scientist)
- James Park (Tech Lead)

Agenda:
1. Review Q4 achievements
2. Set Q1 priorities
3. Resource allocation
4. Risk discussion

Key Decisions:
- Prioritize RAG system implementation
- Allocate 2 engineers to knowledge base project
- Weekly sync meetings every Monday
- Target launch date: End of Q1

Action Items:
- Sarah: Approve budget by next week
- Mike: Draft technical requirements document
- Lisa: Research vector database options
- James: Create implementation timeline

Notes:
The team is excited about the potential of AI-powered search. We discussed the importance of data quality and the need for comprehensive documentation. Security and privacy considerations were highlighted as critical success factors.

Next Meeting: Next Monday at 10 AM`,
      mimeType: 'text/plain'
    },
    {
      name: 'Product Roadmap.md',
      content: `# Product Roadmap 2025

## Vision
Become the leading AI-powered knowledge management platform for enterprises.

## Q1 2025

### Core Features
- ✅ Document ingestion from multiple sources
- ✅ Semantic search with Azure AI
- 🔄 Advanced query routing
- 🔄 Multi-agent RAG orchestration

### Integrations
- ✅ OneDrive integration
- ✅ Dropbox integration
- ✅ GitHub integration
- 🔄 Confluence integration
- 📅 Notion integration (planned)

## Q2 2025

### Intelligence Features
- Self-reflective RAG
- Query performance analytics
- Automatic knowledge graph generation
- Smart document recommendations

### Enterprise Features
- SSO/SAML integration
- Advanced role-based access control
- Audit logging
- Custom deployment options

## Q3 2025

### Scale & Performance
- Multi-region deployment
- Improved caching strategies
- Real-time collaboration
- Mobile applications

### AI Enhancements
- Custom model fine-tuning
- Domain-specific agents
- Multilingual support
- Voice query interface

## Q4 2025

### Innovation
- Predictive knowledge needs
- Automated content curation
- Cross-organizational knowledge sharing
- Advanced analytics dashboard

## Success Metrics
- 10,000+ active users
- 95% query satisfaction rate
- <2 second average response time
- 99.9% uptime

## Competitive Advantages
1. **Agentic AI**: Advanced multi-strategy routing
2. **Enterprise-Ready**: Security and compliance built-in
3. **Flexible Integration**: Connect any data source
4. **Performance**: Industry-leading response times`,
      mimeType: 'text/markdown'
    }
  ]
  
  return mockFiles.map(file => ({
    title: file.name,
    content: file.content,
    sourceType: 'onedrive' as const,
    sourceUrl: pathOrUrl,
    metadata: {
      size: file.content.length,
      lastModified: Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
      author: 'Demo User'
    }
  }))
}
