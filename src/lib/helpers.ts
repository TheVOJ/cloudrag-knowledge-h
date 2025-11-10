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
  
  return {
    title: titles[sourceType],
    content: `Simulated content extracted from ${sourceType} source: ${sourceUrl}. This would contain the actual indexed content in a real implementation.`,
    metadata: {
      size: Math.floor(Math.random() * 50000) + 1000,
      lastModified: Date.now(),
      author: 'System'
    }
  }
}
