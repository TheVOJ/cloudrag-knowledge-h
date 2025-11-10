import { KnowledgeBase } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Database, Trash, FileText } from '@phosphor-icons/react'
import { formatDate, getSourceIcon } from '@/lib/helpers'

interface KnowledgeBaseCardProps {
  knowledgeBase: KnowledgeBase
  onSelect: (kb: KnowledgeBase) => void
  onDelete: (id: string) => void
}

export function KnowledgeBaseCard({ knowledgeBase, onSelect, onDelete }: KnowledgeBaseCardProps) {
  return (
    <Card 
      className="p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50"
      onClick={() => onSelect(knowledgeBase)}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Database size={20} className="text-primary" weight="duotone" />
          </div>
          <div>
            <h3 className="font-semibold text-lg tracking-tight">{knowledgeBase.name}</h3>
            <p className="text-xs text-muted-foreground">{formatDate(knowledgeBase.createdAt)}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/10 hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(knowledgeBase.id)
          }}
        >
          <Trash size={16} />
        </Button>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{knowledgeBase.description}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText size={16} />
          <span>{knowledgeBase.documentCount} documents</span>
        </div>
        
        <div className="flex gap-1">
          {knowledgeBase.sources.map((source) => (
            <span key={source} className="text-lg" title={source}>
              {getSourceIcon(source)}
            </span>
          ))}
        </div>
      </div>
    </Card>
  )
}
