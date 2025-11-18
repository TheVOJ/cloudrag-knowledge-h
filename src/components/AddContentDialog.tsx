import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
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
}

export function AddContentDialog({ open, onOpenChange, onAdd }: AddContentDialogProps) {
  const [sourceType, setSourceType] = useState<SourceType>('web')
  const [url, setUrl] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string>('')
  
  const handleSubmit = async () => {
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
      case 'web':
        return 'https://example.com/docs'
      case 'github':
        return 'https://github.com/username/repository'
      case 'onedrive':
        return 'OneDrive folder path or file URL'
      case 'dropbox':
        return 'Dropbox folder path or file URL'
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Content to Knowledge Base</DialogTitle>
        </DialogHeader>
        
        <Tabs value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
          <TabsList className="grid grid-cols-4 w-full">
            {(['web', 'github', 'onedrive', 'dropbox'] as SourceType[]).map((type) => (
              <TabsTrigger key={type} value={type} className="gap-2">
                <span>{getSourceIcon(type)}</span>
                <span className="hidden sm:inline">{getSourceLabel(type).split(' ')[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          
          {(['web', 'github', 'onedrive', 'dropbox'] as SourceType[]).map((type) => (
            <TabsContent key={type} value={type} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${type}-url`}>Source URL or Path</Label>
                <Input
                  id={`${type}-url`}
                  placeholder={getPlaceholder()}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isProcessing}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
                <p className="text-xs text-muted-foreground">
                  {type === 'web' && 'Enter a URL to crawl and index web content'}
                  {type === 'github' && 'Enter a GitHub repository URL to index source code and documentation'}
                  {type === 'onedrive' && 'Enter a OneDrive path to index documents (simulated)'}
                  {type === 'dropbox' && 'Enter a Dropbox path to index files (simulated)'}
                </p>
              </div>
              
              {error && (
                <Alert variant="destructive">
                  <Warning size={16} />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{statusMessage}</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!url.trim() || isProcessing}>
            {isProcessing ? 'Processing...' : 'Add Content'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
