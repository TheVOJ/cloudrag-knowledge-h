import { Query } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDate } from '@/lib/helpers'
import { ChatCircle, Sparkle } from '@phosphor-icons/react'

interface QueryHistoryProps {
  queries: Query[]
  knowledgeBases: Array<{ id: string; name: string }>
}

export function QueryHistory({ queries, knowledgeBases }: QueryHistoryProps) {
  const sortedQueries = [...queries].sort((a, b) => b.timestamp - a.timestamp)
  
  const getKnowledgeBaseName = (kbId: string) => {
    const kb = knowledgeBases.find(k => k.id === kbId)
    return kb?.name || 'Unknown'
  }
  
  if (queries.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
          <ChatCircle size={32} className="text-muted-foreground" weight="duotone" />
        </div>
        <h3 className="font-semibold text-lg mb-2">No queries yet</h3>
        <p className="text-sm text-muted-foreground">
          Your query history will appear here once you start asking questions
        </p>
      </Card>
    )
  }
  
  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-3">
        {sortedQueries.map((query) => (
          <Card key={query.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkle size={16} className="text-primary" weight="duotone" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    {getKnowledgeBaseName(query.knowledgeBaseId)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(query.timestamp)}
                  </span>
                </div>
                
                <div className="mb-2">
                  <p className="font-medium text-sm mb-1">{query.query}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{query.response}</p>
                </div>
                
                {query.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {query.sources.slice(0, 3).map((source, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {source}
                      </Badge>
                    ))}
                    {query.sources.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{query.sources.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  )
}
