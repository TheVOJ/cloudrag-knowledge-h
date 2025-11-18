import { KnowledgeBase } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Database, Trash, FileText, Lightning } from '@phosphor-icons/react'
import { formatDate, getSourceIcon } from '@/lib/helpers'

interface KnowledgeBaseCardProps {
  knowledgeBase: KnowledgeBase
  onSelect: (kb: KnowledgeBase) => void
  onDelete: (id: string) => void
}

export function KnowledgeBaseCard({ knowledgeBase, onSelect, onDelete }: KnowledgeBaseCardProps) {
  return (
    <Card 
      className="p-3 sm:p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50 active:scale-[0.98]"
      onClick={() => onSelect(knowledgeBase)}
    >
      <div className="flex items-start justify-between mb-2 sm:mb-3 gap-2">
        <div className="flex items-start gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Database size={18} className="sm:w-5 sm:h-5 text-primary" weight="duotone" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-0.5">
              <h3 className="font-semibold text-base sm:text-lg tracking-tight break-words">{knowledgeBase.name}</h3>
              {knowledgeBase.azureSearchEnabled && (
                <Badge variant="secondary" className="text-xs gap-1 flex-shrink-0">
                  <Lightning size={10} weight="fill" className="sm:w-3 sm:h-3" />
                  <span className="hidden sm:inline">Azure</span>
                  <span className="sm:hidden">Az</span>
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(knowledgeBase.createdAt)}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/10 hover:text-destructive flex-shrink-0 h-8 w-8 sm:h-10 sm:w-10"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(knowledgeBase.id)
          }}
        >
          <Trash size={14} className="sm:w-4 sm:h-4" />
        </Button>
      </div>
      
      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 line-clamp-2 break-words">{knowledgeBase.description}</p>
      
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
          <FileText size={14} className="sm:w-4 sm:h-4 flex-shrink-0" />
          <span className="truncate">{knowledgeBase.documentCount} doc{knowledgeBase.documentCount !== 1 ? 's' : ''}</span>
        </div>
        
        <div className="flex gap-1 flex-shrink-0">
          {knowledgeBase.sources.map((source) => (
            <span key={source} className="text-base sm:text-lg" title={source}>
              {getSourceIcon(source)}
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}
