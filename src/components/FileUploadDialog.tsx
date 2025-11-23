import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { parseDocument, getSupportedFileTypes } from '@/lib/document-parser'
import { FilePdf, FileDoc, UploadSimple, Warning, CheckCircle } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'

interface FileUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpload: (files: Array<{ title: string; content: string; metadata: any; fileName: string }>) => Promise<void>
}

export function FileUploadDialog({ open, onOpenChange, onUpload }: FileUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [processedFiles, setProcessedFiles] = useState<Set<string>>(new Set())
  const [fileThumbnails, setFileThumbnails] = useState<Map<string, string>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles(prev => [...prev, ...files])
    setError(null)
  }
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    setSelectedFiles(prev => [...prev, ...files])
    setError(null)
  }
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }
  
  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }
  
  const handleSubmit = async () => {
    if (selectedFiles.length === 0) return
    
    setIsProcessing(true)
    setProgress(0)
    setError(null)
    setProcessedFiles(new Set())
    
    try {
      const parsedDocuments: Array<{ title: string; content: string; metadata: any; fileName: string }> = []
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]
        setStatusMessage(`Processing ${file.name}...`)
        setProgress(((i) / selectedFiles.length) * 100)
        
        try {
          const parsed = await parseDocument(file)
          parsedDocuments.push({
            title: parsed.title,
            content: parsed.content,
            metadata: parsed.metadata,
            fileName: file.name
          })
          
          if (parsed.metadata.thumbnail) {
            setFileThumbnails(prev => new Map(prev).set(file.name, parsed.metadata.thumbnail!))
          }
          
          setProcessedFiles(prev => new Set([...prev, file.name]))
        } catch (fileError) {
          console.error(`Error parsing ${file.name}:`, fileError)
          throw new Error(`Failed to parse ${file.name}: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`)
        }
      }
      
      setStatusMessage('Uploading to knowledge base...')
      setProgress(95)
      
      await onUpload(parsedDocuments)
      
      setProgress(100)
      setStatusMessage('Complete!')
      
      setTimeout(() => {
        onOpenChange(false)
        setSelectedFiles([])
        setIsProcessing(false)
        setProgress(0)
        setStatusMessage('')
        setProcessedFiles(new Set())
        setFileThumbnails(new Map())
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process files')
      setIsProcessing(false)
      setProgress(0)
      setStatusMessage('')
    }
  }
  
  const getFileIcon = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf') {
      return <FilePdf size={24} className="text-destructive" weight="duotone" />
    }
    return <FileDoc size={24} className="text-primary" weight="duotone" />
  }
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Upload Documents</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Drag and drop or select supported documents (PDF, Word, Markdown) to add them to your knowledge base.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={getSupportedFileTypes()}
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={isProcessing}
            />
            <UploadSimple size={48} className="mx-auto mb-4 text-muted-foreground" weight="duotone" />
            <p className="text-sm font-medium mb-1">Click to upload or drag and drop</p>
            <p className="text-xs text-muted-foreground">PDF or Word documents (Multiple files supported)</p>
          </div>
          
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Selected Files ({selectedFiles.length})</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {selectedFiles.map((file, index) => {
                  const thumbnail = fileThumbnails.get(file.name)
                  const isPDF = file.name.toLowerCase().endsWith('.pdf')
                  
                  return (
                    <Card key={`${file.name}-${index}`} className="p-3">
                      <div className="flex items-center gap-3">
                        {thumbnail ? (
                          <div className="w-12 h-16 rounded border border-border overflow-hidden flex-shrink-0 bg-muted">
                            <img 
                              src={thumbnail} 
                              alt={`${file.name} preview`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          getFileIcon(file)
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            {processedFiles.has(file.name) && (
                              <CheckCircle size={16} weight="fill" className="text-green-600 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                        </div>
                        {!isProcessing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFile(index)
                            }}
                            className="flex-shrink-0"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
          
          {error && (
            <Alert variant="destructive">
              <Warning size={16} className="flex-shrink-0" />
              <AlertDescription className="text-sm break-words">{error}</AlertDescription>
            </Alert>
          )}
          
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs sm:text-sm">
                <span className="text-muted-foreground truncate flex-1 mr-2">{statusMessage}</span>
                <span className="font-medium flex-shrink-0">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedFiles.length === 0 || isProcessing}
            className="w-full sm:w-auto gap-2"
          >
            {isProcessing ? (
              <>Processing {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...</>
            ) : (
              <>
                <UploadSimple size={16} />
                Upload {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
