import { Document } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Trash, Link, Eye, Pencil, ChartScatter } from '@phosphor-icons/react'
import { formatDate, getSourceIcon, getSourceLabel, extractDomain } from '@/lib/helpers'

interface DocumentListItemProps {
  document: Document
  onDelete: (id: string) => Promise<void> | void
  onView: (document: Document) => void
  onEdit: (document: Document) => void
  onViewChunks?: (document: Document) => void
}

export function DocumentListItem({ document, onDelete, onView, onEdit, onViewChunks }: DocumentListItemProps) {
  const hasThumbnail = document.metadata.thumbnail && document.sourceType === 'pdf'
  
  return (
    <Card className="p-3 sm:p-4 hover:bg-accent/5 transition-colors">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
          {hasThumbnail ? (
            <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-lg border border-border overflow-hidden flex-shrink-0 bg-muted">
              <img 
                src={document.metadata.thumbnail} 
                alt={`${document.title} preview`}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="sm:w-5 sm:h-5 text-accent" weight="duotone" />
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-1">
              <h4 className="font-medium text-sm sm:text-base truncate">{document.title}</h4>
              <Badge variant="secondary" className="text-xs flex items-center gap-1 flex-shrink-0">
                <span className="text-xs">{getSourceIcon(document.sourceType)}</span>
                <span className="hidden sm:inline">{getSourceLabel(document.sourceType)}</span>
              </Badge>
            </div>
            
            <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 mb-2">
              {document.content}
            </p>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1 min-w-0">
                <Link size={12} className="flex-shrink-0" />
                <span className="truncate max-w-[120px] sm:max-w-[200px]">{extractDomain(document.sourceUrl)}</span>
              </div>
              <span className="hidden sm:inline">•</span>
              <span className="truncate">{formatDate(document.addedAt)}</span>
              {document.metadata.size && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{(document.metadata.size / 1024).toFixed(1)} KB</span>
                </>
              )}
              {document.metadata.pageCount && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">{document.metadata.pageCount} pages</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex sm:gap-1 flex-shrink-0">
          <div className="flex gap-0.5 sm:gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-accent/10 h-8 w-8 sm:h-10 sm:w-10"
              onClick={() => onView(document)}
            >
              <Eye size={14} className="sm:w-4 sm:h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-primary/10 h-8 w-8 sm:h-10 sm:w-10 hidden sm:flex"
              onClick={() => onEdit(document)}
            >
              <Pencil size={14} className="sm:w-4 sm:h-4" />
            </Button>
            {onViewChunks && (
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-secondary/10 h-8 w-8 sm:h-10 sm:w-10 hidden sm:flex"
                onClick={() => onViewChunks(document)}
                title="View chunks & embeddings"
              >
                <ChartScatter size={14} className="sm:w-4 sm:h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-destructive/10 hover:text-destructive h-8 w-8 sm:h-10 sm:w-10"
              onClick={() => onDelete(document.id)}
            >
              <Trash size={14} className="sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
