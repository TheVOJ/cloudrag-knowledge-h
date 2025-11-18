import { useState, useMemo } from 'react'
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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Pencil, FloppyDisk, X, Eye, Link, Code } from '@phosphor-icons/react'
import { getSourceIcon, getSourceLabel, formatDate, extractDomain } from '@/lib/helpers'
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
  const [viewMode, setViewMode] = useState<'markdown' | 'raw'>('markdown')

  const renderedMarkdown = useMemo(() => {
    if (!document || viewMode === 'raw') return null
    try {
      return marked.parse(document.content, { async: false }) as string
    } catch {
      return null
    }
  }, [document?.content, viewMode])

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && document) {
      setEditedTitle(document.title)
      setEditedContent(document.content)
      setIsEditing(false)
      setViewMode('markdown')
    }
    onOpenChange(isOpen)
  }

  const handleSave = () => {
    if (!document) return
    onSave(document.id, editedTitle, editedContent)
    setIsEditing(false)
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
                <Pencil size={16} />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="view" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="view" className="gap-2">
              <Eye size={16} />
              Preview
            </TabsTrigger>
            <TabsTrigger value="metadata" className="gap-2">
              Metadata
            </TabsTrigger>
          </TabsList>

          <TabsContent value="view" className="flex-1 mt-4 min-h-0 space-y-3">
            {!isEditing && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant={viewMode === 'markdown' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('markdown')}
                  className="gap-2"
                >
                  <Eye size={14} />
                  Markdown
                </Button>
                <Button
                  variant={viewMode === 'raw' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('raw')}
                  className="gap-2"
                >
                  <Code size={14} />
                  Raw
                </Button>
              </div>
            )}
            
            {isEditing ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="h-full min-h-[400px] font-mono text-sm resize-none"
                placeholder="Document content"
              />
            ) : (
              <ScrollArea className="h-[400px] rounded-lg border">
                {viewMode === 'markdown' && renderedMarkdown ? (
                  <div 
                    className="prose prose-sm max-w-none p-6 prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:text-foreground prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground prose-pre:bg-muted prose-li:text-foreground"
                    dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
                  />
                ) : (
                  <div className="p-6 font-mono text-sm whitespace-pre-wrap text-foreground">
                    {document.content}
                  </div>
                )}
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="metadata" className="flex-1 mt-4">
            <ScrollArea className="h-[400px]">
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">
                    Source URL
                  </Label>
                  <p className="mt-1 text-sm break-all bg-muted p-2 rounded">
                    {document.sourceUrl}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-muted-foreground">
                    Document ID
                  </Label>
                  <p className="mt-1 text-sm font-mono bg-muted p-2 rounded">
                    {document.id}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
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
                </div>

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
