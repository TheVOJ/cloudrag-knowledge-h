import { Document as DocType } from './types'
import { generateId } from './helpers'

export interface ScrapedContent {
  title: string
  content: string
  metadata: {
    description?: string
    author?: string
    publishedDate?: string
    wordCount: number
    links: string[]
  }
}

export async function scrapeWebContent(url: string): Promise<ScrapedContent> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RAG-KnowledgeBase/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  return parseHTML(html, url)
}

function parseHTML(html: string, sourceUrl: string): ScrapedContent {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const title = extractTitle(doc)
  const content = extractMainContent(doc)
  const metadata = extractMetadata(doc, content)

  return {
    title,
    content,
    metadata,
  }
}

function extractTitle(doc: globalThis.Document): string {
  const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
  if (ogTitle) return ogTitle

  const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content')
  if (twitterTitle) return twitterTitle

  const titleElement = doc.querySelector('title')
  if (titleElement?.textContent) return titleElement.textContent.trim()

  const h1 = doc.querySelector('h1')
  if (h1?.textContent) return h1.textContent.trim()

  return 'Untitled Document'
}

function extractMainContent(doc: globalThis.Document): string {
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.main-content',
    '.content',
    '#content',
    '.post-content',
    '.entry-content',
    '.article-content',
  ]

  for (const selector of selectors) {
    const element = doc.querySelector(selector)
    if (element) {
      return cleanText(element)
    }
  }

  const body = doc.querySelector('body')
  if (body) {
    removeUnwantedElements(body)
    return cleanText(body)
  }

  return doc.body?.textContent || ''
}

function removeUnwantedElements(element: Element): void {
  const unwantedSelectors = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    '.advertisement',
    '.ad',
    '.sidebar',
    '.menu',
    '.navigation',
    '.social-share',
    '.comments',
  ]

  unwantedSelectors.forEach((selector) => {
    element.querySelectorAll(selector).forEach((el) => el.remove())
  })
}

function cleanText(element: Element): string {
  const clone = element.cloneNode(true) as Element
  removeUnwantedElements(clone)

  const headings = Array.from(clone.querySelectorAll('h1, h2, h3, h4, h5, h6'))
  const paragraphs = Array.from(clone.querySelectorAll('p'))
  const lists = Array.from(clone.querySelectorAll('ul, ol'))
  const codeBlocks = Array.from(clone.querySelectorAll('pre, code'))

  const parts: string[] = []

  const allElements = [...headings, ...paragraphs, ...lists, ...codeBlocks].sort((a, b) => {
    const aPos = a.compareDocumentPosition(b)
    return aPos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  })

  for (const el of allElements) {
    const text = el.textContent?.trim()
    if (text && text.length > 10) {
      if (el.tagName.match(/^H[1-6]$/)) {
        parts.push(`\n## ${text}\n`)
      } else if (el.tagName === 'PRE' || el.tagName === 'CODE') {
        parts.push(`\n\`\`\`\n${text}\n\`\`\`\n`)
      } else if (el.tagName === 'UL' || el.tagName === 'OL') {
        const items = Array.from(el.querySelectorAll('li'))
          .map((li) => `- ${li.textContent?.trim()}`)
          .join('\n')
        parts.push(`\n${items}\n`)
      } else {
        parts.push(text)
      }
    }
  }

  return parts.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
}

function extractMetadata(doc: globalThis.Document, content: string): ScrapedContent['metadata'] {
  const description =
    doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
    ''

  const author =
    doc.querySelector('meta[name="author"]')?.getAttribute('content') ||
    doc.querySelector('[rel="author"]')?.textContent?.trim() ||
    ''

  const publishedDate =
    doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
    doc.querySelector('meta[name="date"]')?.getAttribute('content') ||
    ''

  const links = Array.from(doc.querySelectorAll('a[href]'))
    .map((a) => (a as HTMLAnchorElement).getAttribute('href') || '')
    .filter((href) => href.startsWith('http'))
    .slice(0, 50)

  const wordCount = content.split(/\s+/).length

  return {
    description,
    author,
    publishedDate,
    wordCount,
    links,
  }
}

export function convertToDocument(
  scraped: ScrapedContent,
  sourceUrl: string
): Omit<DocType, 'id' | 'addedAt'> {
  return {
    title: scraped.title,
    content: scraped.content,
    sourceType: 'web',
    sourceUrl,
    metadata: {
      size: scraped.content.length,
      lastModified: Date.now(),
      author: scraped.metadata.author,
    },
  }
}
