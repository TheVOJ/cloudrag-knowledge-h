import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { SourceType } from '@/lib/types'
import { getSourceIcon, getSourceLabel } from '@/lib/helpers'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Warning } from '@phosphor-icons/react'

interface AddContentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (sourceType: SourceType, sourceUrl: string) => Promise<void>
  onShowFileUpload: () => void
}

export function AddContentDialog({ open, onOpenChange, onAdd, onShowFileUpload }: AddContentDialogProps) {
  const [sourceType, setSourceType] = useState<SourceType | 'file'>('file')
  const [url, setUrl] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  
  const handleSubmit = async () => {
    if (sourceType === 'file') {
      onOpenChange(false)
      onShowFileUpload()
      return
    }
    
    if (!url.trim()) return
    
    setIsProcessing(true)
    setProgress(10)
    setError(null)
    setStatusMessage('Connecting...')
    
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev < 90) return prev + 10
        return prev
      })
    }, 200)
    
    try {
      if (sourceType === 'web') {
        setStatusMessage('Fetching web content...')
      } else if (sourceType === 'github') {
        setStatusMessage('Fetching repository files...')
      } else {
        setStatusMessage('Processing content...')
      }
      
      await onAdd(sourceType, url)
      clearInterval(progressInterval)
      setUrl('')
      setProgress(100)
      setStatusMessage('Complete!')
      setTimeout(() => {
        onOpenChange(false)
        setIsProcessing(false)
        setProgress(0)
        setStatusMessage('')
      }, 500)
    } catch (err) {
      clearInterval(progressInterval)
      setError(err instanceof Error ? err.message : 'Failed to add content')
      setIsProcessing(false)
      setProgress(0)
      setStatusMessage('')
    }
  }
  
  const getPlaceholder = () => {
    switch (sourceType) {
      case 'file':
        return ''
      case 'web':
        return 'https://example.com/docs'
      case 'github':
        return 'https://github.com/username/repository'
      case 'onedrive':
        return '/Documents/ProjectFiles or shared link'
      case 'dropbox':
        return '/Work/Documentation or shared link'
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Add Content to Knowledge Base</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Choose a source type and provide a URL or upload files to ingest content into this knowledge base.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
          <TabsList className="grid grid-cols-5 w-full">
            {(['file', 'web', 'github', 'onedrive', 'dropbox'] as const).map((type) => (
              <TabsTrigger key={type} value={type} className="gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <span className="text-sm sm:text-base">
                  {type === 'file' ? '📄' : getSourceIcon(type as SourceType)}
                </span>
                <span className="hidden sm:inline">
                  {type === 'file' ? 'Upload' : getSourceLabel(type as SourceType).split(' ')[0]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          
          <TabsContent value="file" className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Upload PDF, Word, or Markdown documents directly from your computer. Multiple files are supported.
              </p>
              <Alert>
                <AlertDescription className="text-xs">
                  💡 Click the "Upload Files" button below to select PDF (.pdf), Word (.doc, .docx), or Markdown (.md) documents
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
          
          {(['web', 'github', 'onedrive', 'dropbox'] as SourceType[]).map((type) => (
            <TabsContent key={type} value={type} className="space-y-3 sm:space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${type}-url`} className="text-sm">Source URL or Path</Label>
                <Input
                  id={`${type}-url`}
                  placeholder={getPlaceholder()}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isProcessing}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                  className="text-sm sm:text-base"
                />
                <p className="text-xs text-muted-foreground">
                  {type === 'web' && 'Enter a URL to crawl and index web content'}
                  {type === 'github' && 'Enter a GitHub repository URL to index source code and documentation'}
                  {type === 'onedrive' && 'Enter a OneDrive folder path (e.g., /Documents/Projects) to index Word docs, PDFs, text files, and more'}
                  {type === 'dropbox' && 'Enter a Dropbox folder path (e.g., /Work/Docs) to index documents, markdown files, and other content'}
                </p>
              </div>
              
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
                    <span className="font-medium flex-shrink-0">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
        
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={(sourceType !== 'file' && !url.trim()) || isProcessing} className="w-full sm:w-auto">
            {sourceType === 'file' ? 'Upload Files' : (isProcessing ? 'Processing...' : 'Add Content')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
