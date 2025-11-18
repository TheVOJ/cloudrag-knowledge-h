import { Document, SourceType } from './types'

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInMs = now.getTime() - date.getTime()
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))
  
  if (diffInDays === 0) {
    return 'Today'
  } else if (diffInDays === 1) {
    return 'Yesterday'
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`
  } else {
    return date.toLocaleDateString()
  }
}

export function getSourceIcon(sourceType: SourceType): string {
  const icons = {
    web: '🌐',
    github: '📁',
    onedrive: '☁️',
    dropbox: '📦'
  }
  return icons[sourceType]
}

export function getSourceLabel(sourceType: SourceType): string {
  const labels = {
    web: 'Web Content',
    github: 'GitHub Repository',
    onedrive: 'OneDrive',
    dropbox: 'Dropbox'
  }
  return labels[sourceType]
}

export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname
  } catch {
    return url
  }
}

export function simulateDocumentExtraction(sourceType: SourceType, sourceUrl: string): Partial<Document> {
  const titles = {
    web: `Content from ${extractDomain(sourceUrl)}`,
    github: `Repository: ${sourceUrl.split('/').pop()}`,
    onedrive: `Document from OneDrive`,
    dropbox: `File from Dropbox`
  }
  
  const markdownContent = `# ${titles[sourceType]}

## Overview

This is **simulated content** extracted from a *${sourceType}* source. In a real implementation, this would contain the actual indexed content from:

\`\`\`
${sourceUrl}
\`\`\`

## Key Features

- Supports markdown rendering
- View in **Markdown** or **Raw** mode
- Edit documents inline
- Persistent storage

## Content Details

The document extraction process would:

1. Fetch content from the source
2. Parse and clean the data
3. Extract metadata
4. Index for vector search

### Technical Implementation

This RAG system uses \`spark.llm\` for intelligent query processing and retrieval augmented generation.

> This is a demonstration of how documents would appear when ingested into the knowledge base.

For more information, visit the [source](${sourceUrl}).`
  
  return {
    title: titles[sourceType],
    content: markdownContent,
    metadata: {
      size: Math.floor(Math.random() * 50000) + 1000,
      lastModified: Date.now(),
      author: 'System'
    }
  }
}
