import { Document } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, Trash, Link, Eye, Pencil, ChartScatter } from '@phosphor-icons/react'
import { formatDate, getSourceIcon, getSourceLabel, extractDomain } from '@/lib/helpers'

interface DocumentListItemProps {
  document: Document
  onDelete: (id: string) => void
  onView: (document: Document) => void
  onEdit: (document: Document) => void
  onViewChunks?: (document: Document) => void
}

export function DocumentListItem({ document, onDelete, onView, onEdit, onViewChunks }: DocumentListItemProps) {
  return (
    <Card className="p-4 hover:bg-accent/5 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <FileText size={20} className="text-accent" weight="duotone" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate">{document.title}</h4>
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <span>{getSourceIcon(document.sourceType)}</span>
                <span>{getSourceLabel(document.sourceType)}</span>
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {document.content}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Link size={12} />
                <span className="truncate max-w-[200px]">{extractDomain(document.sourceUrl)}</span>
              </div>
              <span>•</span>
              <span>{formatDate(document.addedAt)}</span>
              {document.metadata.size && (
                <>
                  <span>•</span>
                  <span>{(document.metadata.size / 1024).toFixed(1)} KB</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-accent/10"
            onClick={() => onView(document)}
          >
            <Eye size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-primary/10"
            onClick={() => onEdit(document)}
          >
            <Pencil size={16} />
          </Button>
          {onViewChunks && (
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-secondary/10"
              onClick={() => onViewChunks(document)}
              title="View chunks & embeddings"
            >
              <ChartScatter size={16} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(document.id)}
          >
            <Trash size={16} />
          </Button>
        </div>
      </div>
    </Card>
  )
}
