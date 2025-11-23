import { EMBEDDING_DIMENSION, MAX_EMBEDDING_TEXT_LENGTH } from './embedding-constants'
import { runtime } from './runtime/manager'

export interface Chunk {
  id: string
  text: string
  startIndex: number
  endIndex: number
  tokens: number
  embedding?: number[]
}

export interface ChunkingStrategy {
  name: string
  description: string
  chunk: (text: string) => Chunk[]
}

export const CHUNKING_STRATEGIES: Record<string, ChunkingStrategy> = {
  fixed: {
    name: 'Fixed Size',
    description: 'Split text into equal-sized chunks with overlap',
    chunk: (text: string) => chunkByFixedSize(text, 500, 50),
  },
  sentence: {
    name: 'Sentence Boundary',
    description: 'Split on sentence boundaries for semantic coherence',
    chunk: (text: string) => chunkBySentence(text, 3),
  },
  paragraph: {
    name: 'Paragraph',
    description: 'Split on paragraph boundaries',
    chunk: (text: string) => chunkByParagraph(text),
  },
  semantic: {
    name: 'Semantic',
    description: 'Split based on topic changes and semantic similarity',
    chunk: (text: string) => chunkBySemantic(text),
  },
}

function chunkByFixedSize(text: string, chunkSize: number, overlap: number): Chunk[] {
  const chunks: Chunk[] = []
  let startIndex = 0
  let id = 0

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length)
    const chunkText = text.substring(startIndex, endIndex)

    chunks.push({
      id: `chunk-${id++}`,
      text: chunkText,
      startIndex,
      endIndex,
      tokens: estimateTokens(chunkText),
    })

    startIndex += chunkSize - overlap
  }

  return chunks
}

function chunkBySentence(text: string, sentencesPerChunk: number): Chunk[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]
  const chunks: Chunk[] = []
  let id = 0

  for (let i = 0; i < sentences.length; i += sentencesPerChunk) {
    const chunkSentences = sentences.slice(i, i + sentencesPerChunk)
    const chunkText = chunkSentences.join(' ').trim()
    const startIndex = text.indexOf(chunkSentences[0])

    chunks.push({
      id: `chunk-${id++}`,
      text: chunkText,
      startIndex,
      endIndex: startIndex + chunkText.length,
      tokens: estimateTokens(chunkText),
    })
  }

  return chunks
}

function chunkByParagraph(text: string): Chunk[] {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0)
  const chunks: Chunk[] = []
  let currentIndex = 0
  let id = 0

  for (const paragraph of paragraphs) {
    const startIndex = text.indexOf(paragraph, currentIndex)
    const trimmedParagraph = paragraph.trim()

    chunks.push({
      id: `chunk-${id++}`,
      text: trimmedParagraph,
      startIndex,
      endIndex: startIndex + trimmedParagraph.length,
      tokens: estimateTokens(trimmedParagraph),
    })

    currentIndex = startIndex + trimmedParagraph.length
  }

  return chunks
}

function chunkBySemantic(text: string): Chunk[] {
  const sections = text.split(/\n#{1,3}\s+/).filter((s) => s.trim().length > 0)
  const chunks: Chunk[] = []
  let currentIndex = 0
  let id = 0

  for (const section of sections) {
    const startIndex = text.indexOf(section, currentIndex)
    const trimmedSection = section.trim()

    if (trimmedSection.length > 1000) {
      const subChunks = chunkByParagraph(trimmedSection)
      chunks.push(...subChunks.map((sc) => ({ ...sc, id: `chunk-${id++}` })))
    } else {
      chunks.push({
        id: `chunk-${id++}`,
        text: trimmedSection,
        startIndex,
        endIndex: startIndex + trimmedSection.length,
        tokens: estimateTokens(trimmedSection),
      })
    }

    currentIndex = startIndex + trimmedSection.length
  }

  return chunks.length > 0 ? chunks : chunkByParagraph(text)
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export async function generateEmbedding(text: string): Promise<number[]> {
  // Prefer native embedding provider (Workers AI) when available
  if (runtime.embedder) {
    try {
      const [vec] = await runtime.embedder.embed([text.substring(0, MAX_EMBEDDING_TEXT_LENGTH)])
      if (Array.isArray(vec) && vec.length > 0) return vec
    } catch (e) {
      console.warn('Embedding provider failed, falling back to simulated embedding', e)
    }
  }

  // Fallback to simulated embeddings if no provider available
  return generateSimulatedEmbedding(text)
}

function generateSimulatedEmbedding(text: string): number[] {
  const hash = simpleHash(text)
  const embedding: number[] = []

  // Use EMBEDDING_DIMENSION dimensions to match the configured Vectorize index
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const value = Math.sin(hash * (i + 1)) * Math.cos(hash * (i + 1) * 0.5)
    embedding.push(value)
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
  return embedding.map((val) => val / magnitude)
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return hash
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function reduceDimensionsFor2D(embeddings: number[][]): Array<{ x: number; y: number }> {
  if (embeddings.length === 0) return []

  const dimensions = embeddings[0].length
  const reduced: Array<{ x: number; y: number }> = []

  for (const embedding of embeddings) {
    let x = 0
    let y = 0

    for (let i = 0; i < dimensions; i++) {
      x += embedding[i] * Math.cos((i * Math.PI * 2) / dimensions)
      y += embedding[i] * Math.sin((i * Math.PI * 2) / dimensions)
    }

    reduced.push({ x, y })
  }

  const minX = Math.min(...reduced.map((p) => p.x))
  const maxX = Math.max(...reduced.map((p) => p.x))
  const minY = Math.min(...reduced.map((p) => p.y))
  const maxY = Math.max(...reduced.map((p) => p.y))

  return reduced.map((p) => ({
    x: ((p.x - minX) / (maxX - minX)) * 100,
    y: ((p.y - minY) / (maxY - minY)) * 100,
  }))
}

export async function chunkAndEmbed(
  text: string,
  strategy: keyof typeof CHUNKING_STRATEGIES = 'semantic'
): Promise<Chunk[]> {
  const chunker = CHUNKING_STRATEGIES[strategy]
  const chunks = chunker.chunk(text)

  const chunksWithEmbeddings = await Promise.all(
    chunks.map(async (chunk) => ({
      ...chunk,
      embedding: await generateEmbedding(chunk.text),
    }))
  )

  return chunksWithEmbeddings
}
