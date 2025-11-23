import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { MagnifyingGlass, Brain, Lightning } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { AzureSearchService, SearchResult } from '@/lib/azure-search'
import { AzureSearchSettings } from '@/lib/types'
import { runtime } from '@/lib/runtime/manager'

interface QueryInterfaceProps {
  knowledgeBaseName: string
  documents: Array<{ id: string; title: string; content: string }>
  onQuery: (query: string, response: string, sources: string[], searchMethod: 'simulated' | 'azure') => void
  azureSettings?: AzureSearchSettings
  indexName?: string
}

export function QueryInterface({ knowledgeBaseName, documents, onQuery, azureSettings, indexName }: QueryInterfaceProps) {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [displayedText, setDisplayedText] = useState('')
  const [searchMethod, setSearchMethod] = useState<'simulated' | 'azure'>('simulated')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  
  const isAzureEnabled = azureSettings?.enabled && azureSettings.endpoint && azureSettings.apiKey && indexName
  
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
  
  const handleAzureSearch = async () => {
    if (!isAzureEnabled || !query.trim()) return
    
    setIsLoading(true)
    setResponse('')
    setSources([])
    setDisplayedText('')
    setSearchResults([])
    
    try {
      const service = new AzureSearchService({
        endpoint: azureSettings.endpoint,
        apiKey: azureSettings.apiKey,
        indexName: indexName!,
      })
      
      const results = await service.search(query, 5)
      setSearchResults(results)
      
      const context = results
        .map((result) => `${result.title} (relevance: ${result.score.toFixed(2)}): ${result.content.slice(0, 500)}`)
        .join('\n\n')
      
      const prompt = `You are a helpful AI assistant with access to a knowledge base called "${knowledgeBaseName}". 

Based on the following context from Azure AI Search results, answer the user's question. Be concise, accurate, and cite which documents you're referencing.

Context:
${context}

User Question: ${query}

Provide a helpful answer based on the context above. If the context doesn't contain relevant information, say so.`
      
      const aiResponse = await runtime.llm.generate(prompt, 'gpt-4o-mini')
      setResponse(aiResponse)
      setSources(results.map((r) => r.title))
      onQuery(query, aiResponse, results.map((r) => r.title), 'azure')
    } catch (error) {
      setResponse('Error with Azure Search: ' + (error instanceof Error ? error.message : 'Unknown error'))
      setSources([])
    }
    
    setIsLoading(false)
  }
  
  const handleSimulatedSearch = async () => {
    if (!query.trim()) return
    
    setIsLoading(true)
    setResponse('')
    setSources([])
    setDisplayedText('')
    setSearchResults([])
    
    await new Promise(resolve => setTimeout(resolve, 800))
    
    const relevantDocs = documents.slice(0, 3)
    const context = relevantDocs.map(doc => `${doc.title}: ${doc.content}`).join('\n\n')
    
    const prompt = `You are a helpful AI assistant with access to a knowledge base called "${knowledgeBaseName}". 

Based on the following context from the knowledge base, answer the user's question. Be concise, accurate, and cite which documents you're referencing.

Context:
${context}

User Question: ${query}

Provide a helpful answer based on the context above. If the context doesn't contain relevant information, say so.`
    
    try {
      const aiResponse = await runtime.llm.generate(prompt, 'gpt-4o-mini')
      setResponse(aiResponse)
      setSources(relevantDocs.map(doc => doc.title))
      onQuery(query, aiResponse, relevantDocs.map(doc => doc.title), 'simulated')
    } catch (error) {
      setResponse('Sorry, I encountered an error while processing your query. Please try again.')
      setSources([])
    }
    
    setIsLoading(false)
  }
  
  const handleSearch = async () => {
    if (isAzureEnabled) {
      setSearchMethod('azure')
      await handleAzureSearch()
    } else {
      setSearchMethod('simulated')
      await handleSimulatedSearch()
    }
  }
  
  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass 
              size={18} 
              className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
            />
            <Input
              placeholder={`Ask about ${knowledgeBaseName}...`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9 sm:pl-10 text-sm sm:text-base h-10 sm:h-11"
              disabled={isLoading}
            />
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={!query.trim() || isLoading} 
            className="gap-2 w-full sm:w-auto flex-shrink-0 h-10 sm:h-11"
            size="default"
          >
            {isAzureEnabled ? (
              <Lightning size={16} weight="duotone" />
            ) : (
              <Brain size={16} weight="duotone" />
            )}
            <span>{isLoading ? 'Searching...' : (isAzureEnabled ? 'Azure Search' : 'Ask AI')}</span>
          </Button>
        </div>
        {isAzureEnabled && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
            <Lightning size={12} className="text-accent flex-shrink-0" weight="fill" />
            <span className="hidden sm:inline">Using Azure AI Search for enhanced semantic search</span>
            <span className="sm:hidden">Azure AI Search enabled</span>
          </p>
        )}
      </Card>
      
      {(displayedText || isLoading) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Brain size={14} className="sm:w-4 sm:h-4 text-accent" weight="duotone" />
              </div>
              <h3 className="font-semibold text-sm sm:text-base">AI Response</h3>
              {searchMethod === 'azure' && !isLoading && (
                <Badge variant="secondary" className="ml-auto text-xs gap-1 flex-shrink-0">
                  <Lightning size={10} weight="fill" className="sm:w-3 sm:h-3" />
                  <span className="hidden sm:inline">Azure AI Search</span>
                  <span className="sm:hidden">Azure</span>
                </Badge>
              )}
            </div>
            
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-3 sm:h-4 bg-muted rounded animate-pulse w-full"></div>
                <div className="h-3 sm:h-4 bg-muted rounded animate-pulse w-5/6"></div>
                <div className="h-3 sm:h-4 bg-muted rounded animate-pulse w-4/6"></div>
              </div>
            ) : (
              <>
                <div className="prose prose-sm max-w-none mb-3 sm:mb-4">
                  <p className="text-sm sm:text-base text-foreground leading-relaxed whitespace-pre-wrap">{displayedText}</p>
                </div>
                
                {sources.length > 0 && (
                  <>
                    <Separator className="my-3 sm:my-4" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium mb-2">Sources:</p>
                      <div className="flex flex-wrap gap-1.5 sm:gap-2">
                        {sources.map((source, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {source}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}
                
                {searchResults.length > 0 && (
                  <>
                    <Separator className="my-3 sm:my-4" />
                    <div>
                      <p className="text-xs sm:text-sm font-medium mb-2 sm:mb-3">Search Results (Relevance Scores):</p>
                      <div className="space-y-2">
                        {searchResults.map((result, index) => (
                          <div key={index} className="text-xs p-2 bg-muted/50 rounded-md">
                            <div className="flex items-start sm:items-center justify-between gap-2 mb-1">
                              <span className="font-medium text-xs sm:text-sm break-words flex-1">{result.title}</span>
                              <Badge variant="outline" className="text-xs flex-shrink-0">
                                {result.score.toFixed(2)}
                              </Badge>
                            </div>
                            {result.highlights && result.highlights.length > 0 && (
                              <div 
                                className="text-xs text-muted-foreground break-words"
                                dangerouslySetInnerHTML={{ __html: result.highlights[0] }}
                              />
                            )}
                          </div>
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
