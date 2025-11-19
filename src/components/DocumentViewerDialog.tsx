import { useState, useMemo, useEffect } from 'react'
import { Document } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Link, X, FloppyDisk, PencilSimple } from '@phosphor-icons/react'
import { formatDate, getSourceIcon, getSourceLabel, extractDomain } from '@/lib/helpers'
import { marked } from 'marked'

interface DocumentViewerDialogProps {
  document: Document | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, title: string, content: string) => void
}

export function DocumentViewerDialog({
  document,
  open,
  onOpenChange,
  onSave,
}: DocumentViewerDialogProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedContent, setEditedContent] = useState('')

  useEffect(() => {
    if (document) {
      setEditedTitle(document.title)
      setEditedContent(document.content)
    }
  }, [document])

  const renderedMarkdown = useMemo(() => {
    if (!document) return ''
    try {
      return marked(document.content) as string
    } catch {
      return document.content
    }
  }, [document?.content])

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) {
      setIsEditing(false)
    }
    onOpenChange(isOpen)
  }

  const handleSave = () => {
    if (document) {
      onSave(document.id, editedTitle, editedContent)
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    if (document) {
      setEditedTitle(document.title)
      setEditedContent(document.content)
    }
    setIsEditing(false)
  }

  if (!document) return null

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-lg font-semibold mb-2"
                  placeholder="Document title"
                />
              ) : (
                <DialogTitle className="text-xl mb-2">{document.title}</DialogTitle>
              )}
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <span>{getSourceIcon(document.sourceType)}</span>
                  <span>{getSourceLabel(document.sourceType)}</span>
                </Badge>
                <span className="text-xs">•</span>
                <span className="text-xs flex items-center gap-1">
                  <Link size={12} />
                  {extractDomain(document.sourceUrl)}
                </span>
                <span className="text-xs">•</span>
                <span className="text-xs">{formatDate(document.addedAt)}</span>
              </DialogDescription>
            </div>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="gap-2"
              >
                <PencilSimple size={16} />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
          <TabsList>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="raw">Raw</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              {isEditing ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Document content..."
                />
              ) : (
                <div className="p-4 space-y-4">
                  {document.metadata.thumbnail && document.sourceType === 'pdf' && (
                    <div className="border border-border rounded-lg overflow-hidden bg-muted inline-block">
                      <img 
                        src={document.metadata.thumbnail} 
                        alt={`${document.title} first page preview`}
                        className="max-w-full h-auto"
                        style={{ maxHeight: '400px' }}
                      />
                      <div className="px-3 py-2 bg-background border-t border-border text-xs text-muted-foreground">
                        Page 1 of {document.metadata.pageCount || 1}
                      </div>
                    </div>
                  )}
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
                  />
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="raw" className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <pre className="bg-muted p-4 rounded-lg text-xs font-mono whitespace-pre-wrap break-words">
                {document.content}
              </pre>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="metadata" className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 p-4">
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">
                    Source URL
                  </Label>
                  <p className="mt-1 text-sm bg-muted p-2 rounded break-all">
                    {document.sourceUrl}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">
                    Added At
                  </Label>
                  <p className="mt-1 text-sm bg-muted p-2 rounded">
                    {new Date(document.addedAt).toLocaleString()}
                  </p>
                </div>

                {document.metadata.size && (
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">
                      Size
                    </Label>
                    <p className="mt-1 text-sm bg-muted p-2 rounded">
                      {(document.metadata.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                )}

                {document.metadata.lastModified && (
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">
                      Last Modified
                    </Label>
                    <p className="mt-1 text-sm bg-muted p-2 rounded">
                      {new Date(document.metadata.lastModified).toLocaleString()}
                    </p>
                  </div>
                )}

                {document.metadata.author && (
                  <div>
                    <Label className="text-sm font-semibold text-muted-foreground">
                      Author
                    </Label>
                    <p className="mt-1 text-sm bg-muted p-2 rounded">
                      {document.metadata.author}
                    </p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">
                    Content Length
                  </Label>
                  <p className="mt-1 text-sm bg-muted p-2 rounded">
                    {document.content.length.toLocaleString()} characters
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          {isEditing ? (
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={handleCancel} className="gap-2">
                <X size={16} />
                Cancel
              </Button>
              <Button onClick={handleSave} className="gap-2">
                <FloppyDisk size={16} weight="bold" />
                Save Changes
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => handleOpen(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
