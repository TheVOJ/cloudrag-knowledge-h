import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MagnifyingGlass, Sparkle } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

interface QueryInterfaceProps {
  knowledgeBaseName: string
  documents: Array<{ id: string; title: string; content: string }>
  onQuery: (query: string, response: string, sources: string[]) => void
}

export function QueryInterface({ knowledgeBaseName, documents, onQuery }: QueryInterfaceProps) {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [displayedText, setDisplayedText] = useState('')
  
  useEffect(() => {
    if (!response) {
      setDisplayedText('')
      return
    }
    
    let index = 0
    const interval = setInterval(() => {
      if (index < response.length) {
        setDisplayedText(response.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
      }
    }, 20)
    
    return () => clearInterval(interval)
  }, [response])
  
  const handleSearch = async () => {
    if (!query.trim()) return
    
    setIsLoading(true)
    setResponse('')
    setSources([])
    setDisplayedText('')
    
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const relevantDocs = documents.slice(0, 3)
    const context = relevantDocs.map(doc => `${doc.title}: ${doc.content}`).join('\n\n')
    
    const promptText = `You are a helpful AI assistant with access to a knowledge base called "${knowledgeBaseName}". 

Based on the following context from the knowledge base, answer the user's question. Be concise, accurate, and cite which documents you're referencing.

Context:
${context}

User Question: ${query}

Provide a helpful answer based on the context above. If the context doesn't contain relevant information, say so.`
    
    try {
      const aiResponse = await window.spark.llm(promptText, 'gpt-4o-mini')
      setResponse(aiResponse)
      setSources(relevantDocs.map(doc => doc.title))
      onQuery(query, aiResponse, relevantDocs.map(doc => doc.title))
    } catch (error) {
      setResponse('Sorry, I encountered an error while processing your query. Please try again.')
      setSources([])
    }
    
    setIsLoading(false)
  }
  
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass 
              size={20} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
            />
            <Input
              placeholder={`Ask anything about ${knowledgeBaseName}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          <Button onClick={handleSearch} disabled={!query.trim() || isLoading}>
            <Sparkle size={16} weight="duotone" />
            {isLoading ? 'Searching...' : 'Ask AI'}
          </Button>
        </div>
      </Card>
      
      {(displayedText || isLoading) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <Sparkle size={16} className="text-accent" weight="duotone" />
              </div>
              <h3 className="font-semibold">AI Response</h3>
            </div>
            
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-full"></div>
                <div className="h-4 bg-muted rounded animate-pulse w-5/6"></div>
                <div className="h-4 bg-muted rounded animate-pulse w-4/6"></div>
              </div>
            ) : (
              <>
                <div className="prose prose-sm max-w-none mb-4">
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{displayedText}</p>
                </div>
                
                {sources.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div>
                      <p className="text-sm font-medium mb-2">Sources:</p>
                      <div className="flex flex-wrap gap-2">
                        {sources.map((source, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </Card>
        </motion.div>
      )}
    </div>
  )
}
