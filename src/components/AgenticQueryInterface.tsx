import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { 
  MagnifyingGlass, 
  Sparkle, 
  Lightning, 
  Brain,
  TreeStructure,
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
  Info,
  FlowArrow
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Document, AzureSearchSettings } from '@/lib/types'
import { AgenticRAGOrchestrator, AgenticRAGResponse } from '@/lib/agentic-rag-orchestrator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AgenticFlowDiagram } from '@/components/AgenticFlowDiagram'

interface AgenticQueryInterfaceProps {
  knowledgeBaseName: string
  documents: Document[]
  onQuery: (query: string, response: string, sources: string[], searchMethod: 'simulated' | 'azure' | 'agentic') => void
  azureSettings?: AzureSearchSettings
  indexName?: string
}

export function AgenticQueryInterface({ 
  knowledgeBaseName, 
  documents, 
  onQuery, 
  azureSettings,
  indexName 
}: AgenticQueryInterfaceProps) {
  const [query, setQuery] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<AgenticRAGResponse | null>(null)
  const [displayedText, setDisplayedText] = useState('')
  const [showDetails, setShowDetails] = useState(false)
  
  useEffect(() => {
    if (!response?.answer) {
      setDisplayedText('')
      return
    }
    
    let index = 0
    const text = response.answer
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1))
        index++
      } else {
        clearInterval(interval)
      }
    }, 15)
    
    return () => clearInterval(interval)
  }, [response?.answer])
  
  const handleAgenticSearch = async () => {
    if (!query.trim()) return
    
    setIsLoading(true)
    setResponse(null)
    setDisplayedText('')
    
    try {
      const orchestrator = new AgenticRAGOrchestrator(
        documents,
        knowledgeBaseName,
        azureSettings,
        indexName
      )
      
      const result = await orchestrator.query(query, {
        maxIterations: 3,
        confidenceThreshold: 0.6,
        enableCriticism: true,
        enableAutoRetry: true,
        topK: 5
      })
      
      setResponse(result)
      onQuery(query, result.answer, result.sources, 'agentic')
    } catch (error) {
      console.error('Agentic RAG error:', error)
      setResponse({
        answer: 'Sorry, I encountered an error while processing your query. Please try again.',
        sources: [],
        routing: {
          intent: 'factual',
          strategy: 'hybrid',
          needsRetrieval: true,
          parallelizable: false,
          confidence: 0,
          reasoning: 'Error occurred'
        },
        retrieval: {
          documents: [],
          scores: [],
          method: 'hybrid',
          queryUsed: query
        },
        evaluation: {
          relevanceToken: 'NOT_RELEVANT',
          supportToken: 'NOT_SUPPORTED',
          utilityToken: 'NOT_USEFUL',
          confidence: 0,
          needsRetry: true,
          reasoning: 'Error during processing'
        },
        iterations: 0,
        metadata: {
          totalTimeMs: 0,
          retrievalMethod: 'hybrid',
          confidence: 0,
          needsImprovement: true
        }
      })
    }
    
    setIsLoading(false)
  }
  
  const getIntentIcon = (intent: string) => {
    switch (intent) {
      case 'analytical': return <Brain size={14} weight="duotone" />
      case 'comparative': return <TreeStructure size={14} weight="duotone" />
      case 'procedural': return <ArrowsClockwise size={14} weight="duotone" />
      default: return <Info size={14} weight="duotone" />
    }
  }
  
  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) {
      return <Badge variant="default" className="gap-1"><CheckCircle size={12} weight="fill" /> High Confidence</Badge>
    } else if (confidence >= 0.5) {
      return <Badge variant="secondary" className="gap-1"><Info size={12} /> Moderate Confidence</Badge>
    } else {
      return <Badge variant="destructive" className="gap-1"><WarningCircle size={12} weight="fill" /> Low Confidence</Badge>
    }
  }
  
  const getRelevanceColor = (token: string) => {
    switch (token) {
      case 'RELEVANT': return 'text-green-600'
      case 'PARTIALLY_RELEVANT': return 'text-yellow-600'
      case 'NOT_RELEVANT': return 'text-red-600'
      default: return 'text-muted-foreground'
    }
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
              placeholder={`Ask anything about ${knowledgeBaseName}... (powered by Agentic RAG)`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAgenticSearch()}
              className="pl-10"
              disabled={isLoading}
            />
          </div>
          <Button onClick={handleAgenticSearch} disabled={!query.trim() || isLoading} className="gap-2">
            <Brain size={16} weight="duotone" />
            {isLoading ? 'Thinking...' : 'Ask Agent'}
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Brain size={12} className="text-accent" weight="fill" />
          Agentic RAG: Intelligent routing, multi-strategy retrieval, self-evaluation & auto-correction
        </div>
      </Card>
      
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Brain size={20} className="text-accent animate-pulse" weight="duotone" />
                <span className="font-semibold">Agent Processing</span>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                  Analyzing query intent and complexity...
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                  Selecting optimal retrieval strategy...
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                  Executing multi-stage retrieval...
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                  Generating and evaluating response...
                </div>
              </div>
              <Progress value={undefined} className="h-1" />
            </div>
          </Card>
        </motion.div>
      )}
      
      <AnimatePresence>
        {response && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                    <Sparkle size={16} className="text-accent" weight="duotone" />
                  </div>
                  <h3 className="font-semibold">Agentic Response</h3>
                </div>
                {getConfidenceBadge(response.evaluation.confidence)}
              </div>
              
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                  <FlowArrow size={14} weight="duotone" />
                  <span>Query Flow:</span>
                </div>
                <AgenticFlowDiagram response={response} compact />
              </div>
              
              <div className="prose prose-sm max-w-none mb-4">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{displayedText}</p>
              </div>
              
              {response.sources.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-sm font-medium mb-2">Sources:</p>
                    <div className="flex flex-wrap gap-2">
                      {response.sources.map((source, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          [{index + 1}] {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              <Separator className="my-4" />
              
              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full gap-2">
                    <Info size={14} />
                    {showDetails ? 'Hide' : 'Show'} Agent Details
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <Tabs defaultValue="flow" className="mt-4">
                    <TabsList className="grid w-full grid-cols-5">
                      <TabsTrigger value="flow">Flow</TabsTrigger>
                      <TabsTrigger value="routing">Routing</TabsTrigger>
                      <TabsTrigger value="retrieval">Retrieval</TabsTrigger>
                      <TabsTrigger value="evaluation">Evaluation</TabsTrigger>
                      <TabsTrigger value="meta">Metadata</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="flow" className="mt-4">
                      <AgenticFlowDiagram response={response} />
                    </TabsContent>
                    
                    <TabsContent value="routing" className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Intent:</span>
                          <div className="flex items-center gap-1 mt-1">
                            {getIntentIcon(response.routing.intent)}
                            <Badge variant="outline">{response.routing.intent}</Badge>
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Strategy:</span>
                          <Badge variant="outline" className="mt-1">{response.routing.strategy}</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Needs Retrieval:</span>
                          <Badge variant={response.routing.needsRetrieval ? 'default' : 'secondary'} className="mt-1">
                            {response.routing.needsRetrieval ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Parallelizable:</span>
                          <Badge variant={response.routing.parallelizable ? 'default' : 'secondary'} className="mt-1">
                            {response.routing.parallelizable ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Reasoning:</span>
                        <p className="text-sm mt-1 p-2 bg-muted rounded">{response.routing.reasoning}</p>
                      </div>
                      {response.routing.subQueries && response.routing.subQueries.length > 0 && (
                        <div>
                          <span className="text-sm text-muted-foreground">Sub-queries:</span>
                          <ul className="text-sm mt-1 space-y-1">
                            {response.routing.subQueries.map((sq, i) => (
                              <li key={i} className="p-2 bg-muted rounded">{i + 1}. {sq}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="retrieval" className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Method:</span>
                          <Badge variant="outline" className="mt-1">{response.retrieval.method}</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Documents:</span>
                          <Badge variant="outline" className="mt-1">{response.retrieval.documents.length}</Badge>
                        </div>
                      </div>
                      {response.retrieval.documents.length > 0 && (
                        <div>
                          <span className="text-sm text-muted-foreground">Retrieved Documents:</span>
                          <div className="space-y-2 mt-2">
                            {response.retrieval.documents.slice(0, 3).map((doc, i) => (
                              <div key={i} className="p-2 bg-muted rounded text-xs">
                                <div className="flex justify-between items-start mb-1">
                                  <span className="font-medium">{doc.title}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {response.retrieval.scores[i]?.toFixed(2) || 'N/A'}
                                  </Badge>
                                </div>
                                <p className="text-muted-foreground line-clamp-2">{doc.content.slice(0, 150)}...</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="evaluation" className="space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Relevance:</span>
                          <div className={`font-medium mt-1 ${getRelevanceColor(response.evaluation.relevanceToken)}`}>
                            {response.evaluation.relevanceToken}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Support:</span>
                          <div className={`font-medium mt-1 ${getRelevanceColor(response.evaluation.supportToken)}`}>
                            {response.evaluation.supportToken}
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Utility:</span>
                          <div className={`font-medium mt-1 ${getRelevanceColor(response.evaluation.utilityToken)}`}>
                            {response.evaluation.utilityToken}
                          </div>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Evaluation Reasoning:</span>
                        <p className="text-sm mt-1 p-2 bg-muted rounded">{response.evaluation.reasoning}</p>
                      </div>
                      {response.criticism && (
                        <div className="space-y-2">
                          <span className="text-sm text-muted-foreground">Critic Feedback:</span>
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="p-2 bg-muted rounded">
                              <div>Logic: {(response.criticism.logicalConsistency * 100).toFixed(0)}%</div>
                              <Progress value={response.criticism.logicalConsistency * 100} className="h-1 mt-1" />
                            </div>
                            <div className="p-2 bg-muted rounded">
                              <div>Accuracy: {(response.criticism.factualAccuracy * 100).toFixed(0)}%</div>
                              <Progress value={response.criticism.factualAccuracy * 100} className="h-1 mt-1" />
                            </div>
                            <div className="p-2 bg-muted rounded">
                              <div>Complete: {(response.criticism.completeness * 100).toFixed(0)}%</div>
                              <Progress value={response.criticism.completeness * 100} className="h-1 mt-1" />
                            </div>
                          </div>
                        </div>
                      )}
                      {response.metadata.improvementSuggestions && response.metadata.improvementSuggestions.length > 0 && (
                        <div>
                          <span className="text-sm text-muted-foreground">Improvement Suggestions:</span>
                          <ul className="text-xs mt-1 space-y-1">
                            {response.metadata.improvementSuggestions.slice(0, 3).map((suggestion, i) => (
                              <li key={i} className="p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded flex items-start gap-2">
                                <WarningCircle size={14} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="meta" className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Iterations:</span>
                          <Badge variant="outline" className="mt-1">{response.iterations}</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Time:</span>
                          <Badge variant="outline" className="mt-1">{response.metadata.totalTimeMs}ms</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Confidence:</span>
                          <div className="mt-1">
                            <div className="text-xs mb-1">{(response.metadata.confidence * 100).toFixed(1)}%</div>
                            <Progress value={response.metadata.confidence * 100} className="h-2" />
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Needs Improvement:</span>
                          <Badge variant={response.metadata.needsImprovement ? 'destructive' : 'default'} className="mt-1">
                            {response.metadata.needsImprovement ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
