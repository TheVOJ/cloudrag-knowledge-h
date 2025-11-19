import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

export interface ParsedDocument {
  title: string
  content: string
  metadata: {
    pageCount?: number
    size: number
    lastModified?: number
    author?: string
    fileType: 'pdf' | 'docx'
    thumbnail?: string
  }
}

async function generatePDFThumbnail(pdf: pdfjsLib.PDFDocumentProxy): Promise<string> {
  try {
    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 0.5 })
    
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not get canvas context')
    
    canvas.height = viewport.height
    canvas.width = viewport.width
    
    const renderContext = {
      canvasContext: context,
      viewport: viewport
    }
    
    await page.render(renderContext).promise
    
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch (error) {
    console.error('Error generating PDF thumbnail:', error)
    return ''
  }
}

export async function parsePDF(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer()
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
  const pdf = await loadingTask.promise
  
  const numPages = pdf.numPages
  const textContent: string[] = []
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items
      .map((item: any) => item.str)
      .join(' ')
    textContent.push(pageText)
  }
  
  const fullText = textContent.join('\n\n')
  
  const metadata = await pdf.getMetadata()
  const info = metadata.info as any
  
  const thumbnail = await generatePDFThumbnail(pdf)
  
  return {
    title: file.name.replace(/\.pdf$/i, ''),
    content: fullText,
    metadata: {
      pageCount: numPages,
      size: file.size,
      lastModified: file.lastModified,
      author: info?.Author || undefined,
      fileType: 'pdf',
      thumbnail: thumbnail || undefined
    }
  }
}

export async function parseWord(file: File): Promise<ParsedDocument> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer })
  
  return {
    title: file.name.replace(/\.docx?$/i, ''),
    content: result.value,
    metadata: {
      size: file.size,
      lastModified: file.lastModified,
      fileType: 'docx'
    }
  }
}

export async function parseDocument(file: File): Promise<ParsedDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase()
  
  if (extension === 'pdf') {
    return parsePDF(file)
  } else if (extension === 'docx' || extension === 'doc') {
    return parseWord(file)
  } else {
    throw new Error(`Unsupported file type: ${extension}. Only PDF and Word documents are supported.`)
  }
}

export function getSupportedFileTypes(): string {
  return '.pdf,.doc,.docx'
}

export function isSupportedFileType(filename: string): boolean {
  const extension = filename.split('.').pop()?.toLowerCase()
  return extension === 'pdf' || extension === 'doc' || extension === 'docx'
}
