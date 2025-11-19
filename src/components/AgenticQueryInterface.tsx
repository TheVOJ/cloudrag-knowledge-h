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
  FlowArrow,
  ThumbsUp,
  ThumbsDown,
  Minus,
  Circle,
  CircleNotch,
  Check
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { Document, AzureSearchSettings } from '@/lib/types'
import { AgenticRAGOrchestrator, AgenticRAGResponse, ProgressStep } from '@/lib/agentic-rag-orchestrator'
import { StrategyPerformanceTracker } from '@/lib/strategy-performance-tracker'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AgenticFlowDiagram } from '@/components/AgenticFlowDiagram'
import { QueryReformulationGraph, QueryReformulationData } from '@/components/QueryReformulationGraph'
import { QuerySimilarityMatrix } from '@/components/QuerySimilarityMatrix'
import { toast } from 'sonner'

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
  const [queryId, setQueryId] = useState<string>('')
  const [userFeedback, setUserFeedback] = useState<'positive' | 'negative' | 'neutral' | null>(null)
  const [tracker] = useState(() => new StrategyPerformanceTracker())
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([])
  const [currentProgress, setCurrentProgress] = useState(0)

  const calculateSemanticSimilarity = (query1: string, query2: string): number => {
    const words1 = query1.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const words2 = query2.toLowerCase().split(/\s+/).filter(w => w.length > 3)

    if (words1.length === 0 || words2.length === 0) return 0

    const set1 = new Set(words1)
    const set2 = new Set(words2)
    const intersection = new Set([...set1].filter(x => set2.has(x)))
    const union = new Set([...set1, ...set2])

    const jaccardSimilarity = intersection.size / union.size

    const longerLength = Math.max(query1.length, query2.length)
    const shorterLength = Math.min(query1.length, query2.length)
    const lengthSimilarity = shorterLength / longerLength

    const commonStarts = query1.toLowerCase().startsWith(query2.toLowerCase().substring(0, 5)) ||
      query2.toLowerCase().startsWith(query1.toLowerCase().substring(0, 5))
    const positionBonus = commonStarts ? 0.15 : 0

    return Math.min(1, jaccardSimilarity * 0.7 + lengthSimilarity * 0.3 + positionBonus)
  }

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
    setUserFeedback(null)
    setProgressSteps([])
    setCurrentProgress(0)

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
        topK: 5,
        onProgress: (step: ProgressStep) => {
          setProgressSteps(prev => [...prev, step])
          if (step.progress !== undefined) {
            setCurrentProgress(step.progress)
          }
        }
      })

      setResponse(result)

      const history = await tracker.getQueryHistory()
      const latestQuery = history[history.length - 1]
      if (latestQuery) {
        setQueryId(latestQuery.id)
      }

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
        reformulations: [],
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

  const handleFeedback = async (feedback: 'positive' | 'negative' | 'neutral') => {
    if (!queryId) return

    setUserFeedback(feedback)
    await tracker.recordUserFeedback(queryId, feedback)

    const feedbackMessages = {
      positive: 'Thank you for the positive feedback! The system will prioritize similar strategies.',
      negative: 'Thank you for the feedback. The system will learn from this to improve future responses.',
      neutral: 'Feedback recorded.'
    }

    toast.success(feedbackMessages[feedback])
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

  const getPhaseIcon = (phase: ProgressStep['phase'], status: ProgressStep['status']) => {
    const iconProps = { size: 16, className: 'flex-shrink-0' }

    if (status === 'complete') {
      return <CheckCircle {...iconProps} weight="fill" className="text-green-600 flex-shrink-0" />
    } else if (status === 'in_progress') {
      return <CircleNotch {...iconProps} className="animate-spin text-accent flex-shrink-0" />
    } else if (status === 'error') {
      return <WarningCircle {...iconProps} weight="fill" className="text-destructive flex-shrink-0" />
    }

    switch (phase) {
      case 'routing':
        return <TreeStructure {...iconProps} weight="duotone" className="text-muted-foreground flex-shrink-0" />
      case 'retrieval':
        return <MagnifyingGlass {...iconProps} weight="duotone" className="text-muted-foreground flex-shrink-0" />
      case 'generation':
        return <Sparkle {...iconProps} weight="duotone" className="text-muted-foreground flex-shrink-0" />
      case 'evaluation':
        return <CheckCircle {...iconProps} weight="duotone" className="text-muted-foreground flex-shrink-0" />
      case 'criticism':
        return <Brain {...iconProps} weight="duotone" className="text-muted-foreground flex-shrink-0" />
      case 'retry':
        return <ArrowsClockwise {...iconProps} weight="duotone" className="text-muted-foreground flex-shrink-0" />
      default:
        return <Circle {...iconProps} className="text-muted-foreground flex-shrink-0" />
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
    <div className="space-y-3 sm:space-y-4">
      <Card className="p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={18}
              className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder={`Ask ${knowledgeBaseName}... (Agentic RAG)`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAgenticSearch()}
              className="pl-9 sm:pl-10 text-sm sm:text-base h-10 sm:h-11"
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleAgenticSearch}
            disabled={!query.trim() || isLoading}
            className="gap-2 w-full sm:w-auto flex-shrink-0 h-10 sm:h-11"
            size="default"
          >
            <Brain size={16} weight="duotone" />
            <span>{isLoading ? 'Thinking...' : 'Ask Agent'}</span>
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Brain size={12} className="text-accent flex-shrink-0" weight="fill" />
          <span className="hidden sm:inline">Agentic RAG: Intelligent routing, multi-strategy retrieval, self-evaluation & auto-correction</span>
          <span className="sm:hidden">Intelligent multi-strategy AI agent</span>
        </div>
      </Card>

      {isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-4 sm:p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Brain size={18} className="sm:w-5 sm:h-5 text-accent" weight="duotone" />
                  <span className="font-semibold text-sm sm:text-base">Agent Processing</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {currentProgress}%
                </Badge>
              </div>

              <Progress value={currentProgress} className="h-2" />

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {[
                  { phase: 'routing', label: 'Routing', icon: TreeStructure },
                  { phase: 'retrieval', label: 'Retrieval', icon: MagnifyingGlass },
                  { phase: 'generation', label: 'Generation', icon: Sparkle },
                  { phase: 'evaluation', label: 'Evaluation', icon: CheckCircle },
                  { phase: 'complete', label: 'Complete', icon: Check }
                ].map(({ phase, label, icon: Icon }) => {
                  const phaseSteps = progressSteps.filter(s => s.phase === phase)
                  const hasCompleted = phaseSteps.some(s => s.status === 'complete')
                  const isInProgress = phaseSteps.some(s => s.status === 'in_progress')

                  return (
                    <div
                      key={phase}
                      className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${hasCompleted
                          ? 'bg-green-500/10 border border-green-500/30'
                          : isInProgress
                            ? 'bg-accent/10 border border-accent/30'
                            : 'bg-muted/30 border border-transparent'
                        }`}
                    >
                      <Icon
                        size={16}
                        weight={hasCompleted ? 'fill' : 'regular'}
                        className={`${hasCompleted
                            ? 'text-green-600'
                            : isInProgress
                              ? 'text-accent animate-pulse'
                              : 'text-muted-foreground'
                          }`}
                      />
                      <div className="capitalize font-medium text-center">{label}</div>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                <AnimatePresence mode="popLayout">
                  {progressSteps.map((step, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-1 p-2 rounded-lg bg-muted/30"
                    >
                      <div className="flex items-start gap-2">
                        {getPhaseIcon(step.phase, step.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-medium">
                              {step.message}
                            </span>
                            {step.metadata && Object.keys(step.metadata).length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {step.phase}
                              </Badge>
                            )}
                          </div>
                          {step.details && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {step.details}
                            </p>
                          )}
                          {step.metadata?.subQueries && (
                            <div className="mt-1 space-y-0.5">
                              {(step.metadata.subQueries as string[]).slice(0, 3).map((sq, i) => (
                                <div key={i} className="text-xs text-muted-foreground pl-4 border-l-2 border-accent/30">
                                  {i + 1}. {sq}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {progressSteps.length === 0 && (
                <div className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0"></div>
                    <span>Initializing agentic workflow...</span>
                  </div>
                </div>
              )}
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
            <Card className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Sparkle size={14} className="sm:w-4 sm:h-4 text-accent" weight="duotone" />
                  </div>
                  <h3 className="font-semibold text-sm sm:text-base">Agentic Response</h3>
                </div>
                {getConfidenceBadge(response.evaluation.confidence)}
              </div>

              <div className="mb-3 sm:mb-4">
                <div className="flex items-center gap-2 mb-2 sm:mb-3 text-xs text-muted-foreground">
                  <FlowArrow size={14} weight="duotone" className="flex-shrink-0" />
                  <span>Query Flow:</span>
                </div>
                <AgenticFlowDiagram response={response} compact />
              </div>

              <div className="prose prose-sm max-w-none mb-3 sm:mb-4">
                <p className="text-sm sm:text-base text-foreground leading-relaxed whitespace-pre-wrap">{displayedText}</p>
              </div>

              <Separator className="my-3 sm:my-4" />

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm text-muted-foreground">Was this response helpful?</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={userFeedback === 'positive' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFeedback('positive')}
                    className="gap-1 h-8 text-xs"
                  >
                    <ThumbsUp size={14} weight={userFeedback === 'positive' ? 'fill' : 'regular'} />
                    Helpful
                  </Button>
                  <Button
                    variant={userFeedback === 'neutral' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleFeedback('neutral')}
                    className="gap-1 h-8 text-xs"
                  >
                    <Minus size={14} />
                    <span className="hidden sm:inline">Neutral</span>
                  </Button>
                  <Button
                    variant={userFeedback === 'negative' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => handleFeedback('negative')}
                    className="gap-1 h-8 text-xs"
                  >
                    <ThumbsDown size={14} weight={userFeedback === 'negative' ? 'fill' : 'regular'} />
                    <span className="hidden sm:inline">Not Helpful</span>
                  </Button>
                </div>
              </div>

              {response.sources.length > 0 && (
                <>
                  <Separator className="my-3 sm:my-4" />
                  <div>
                    <p className="text-xs sm:text-sm font-medium mb-2">Sources:</p>
                    <div className="flex flex-wrap gap-1.5 sm:gap-2">
                      {response.sources.map((source, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          [{index + 1}] {source}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <Separator className="my-3 sm:my-4" />

              <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full gap-2 h-9 text-xs sm:text-sm">
                    <Info size={14} />
                    {showDetails ? 'Hide' : 'Show'} Agent Details
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <Tabs defaultValue="progress" className="mt-3 sm:mt-4">
                    <TabsList className="grid w-full grid-cols-3 sm:grid-cols-8 text-xs">
                      <TabsTrigger value="progress" className="text-xs">Progress</TabsTrigger>
                      <TabsTrigger value="reformulations" className="text-xs">Graph</TabsTrigger>
                      <TabsTrigger value="similarity" className="text-xs">Similarity</TabsTrigger>
                      <TabsTrigger value="flow" className="text-xs">Flow</TabsTrigger>
                      <TabsTrigger value="routing" className="text-xs hidden sm:flex">Routing</TabsTrigger>
                      <TabsTrigger value="retrieval" className="text-xs">Retrieval</TabsTrigger>
                      <TabsTrigger value="evaluation" className="text-xs hidden sm:flex">Evaluation</TabsTrigger>
                      <TabsTrigger value="meta" className="text-xs">Meta</TabsTrigger>
                    </TabsList>

                    <TabsContent value="progress" className="mt-4 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-muted/50 text-center">
                          <div className="text-xs text-muted-foreground">Total Steps</div>
                          <div className="text-lg font-semibold">{progressSteps.length}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50 text-center">
                          <div className="text-xs text-muted-foreground">Iterations</div>
                          <div className="text-lg font-semibold">{response.iterations}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50 text-center">
                          <div className="text-xs text-muted-foreground">Time</div>
                          <div className="text-lg font-semibold">{response.metadata.totalTimeMs}ms</div>
                        </div>
                        <div className="p-2 rounded-lg bg-muted/50 text-center">
                          <div className="text-xs text-muted-foreground">Success Rate</div>
                          <div className="text-lg font-semibold">{(response.evaluation.confidence * 100).toFixed(0)}%</div>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground mb-2">
                        Detailed execution timeline:
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                        {progressSteps.map((step, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex flex-col gap-1 p-3 rounded-lg border bg-card"
                          >
                            <div className="flex items-start gap-2">
                              {getPhaseIcon(step.phase, step.status)}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap justify-between">
                                  <span className="text-xs sm:text-sm font-medium">
                                    {step.message}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    {step.progress !== undefined && (
                                      <Badge variant="outline" className="text-xs">
                                        {step.progress}%
                                      </Badge>
                                    )}
                                    <Badge variant="secondary" className="text-xs capitalize">
                                      {step.phase}
                                    </Badge>
                                  </div>
                                </div>
                                {step.details && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {step.details}
                                  </p>
                                )}
                                {step.metadata && Object.keys(step.metadata).length > 0 && (
                                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                                    {step.metadata.intent && (
                                      <div><span className="font-medium">Intent:</span> {step.metadata.intent as string}</div>
                                    )}
                                    {step.metadata.strategy && (
                                      <div><span className="font-medium">Strategy:</span> {step.metadata.strategy as string}</div>
                                    )}
                                    {step.metadata.documentsFound !== undefined && (
                                      <div><span className="font-medium">Documents Found:</span> {step.metadata.documentsFound as number}</div>
                                    )}
                                    {step.metadata.confidence !== undefined && (
                                      <div><span className="font-medium">Confidence:</span> {((step.metadata.confidence as number) * 100).toFixed(0)}%</div>
                                    )}
                                    {step.metadata.subQueries && (
                                      <div>
                                        <div className="font-medium mb-1">Sub-queries:</div>
                                        <div className="space-y-0.5 pl-2">
                                          {(step.metadata.subQueries as string[]).map((sq, i) => (
                                            <div key={i} className="border-l-2 border-accent/30 pl-2">
                                              {i + 1}. {sq}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {step.metadata.improvements && (
                                      <div>
                                        <div className="font-medium mb-1">Improvements:</div>
                                        <div className="space-y-0.5 pl-2">
                                          {(step.metadata.improvements as string[]).map((imp, i) => (
                                            <div key={i} className="border-l-2 border-yellow-500/30 pl-2">
                                              • {imp}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                      {progressSteps.length === 0 && (
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          No progress data available
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="reformulations" className="mt-4">
                      <QueryReformulationGraph
                        data={{
                          nodes: response.reformulations,
                          links: response.reformulations
                            .filter(r => r.parentId)
                            .map(r => ({
                              source: r.parentId!,
                              target: r.id,
                              type: r.linkType!,
                              reasoning: r.reasoning,
                              similarity: r.similarity
                            }))
                        }}
                      />
                    </TabsContent>

                    <TabsContent value="similarity" className="mt-4">
                      <QuerySimilarityMatrix
                        queries={response.reformulations.map(r => ({
                          id: r.id,
                          query: r.query,
                          type: r.type
                        }))}
                        calculateSimilarity={calculateSemanticSimilarity}
                      />
                    </TabsContent>

                    <TabsContent value="flow" className="mt-4">
                      <AgenticFlowDiagram response={response} />
                    </TabsContent>

                    <TabsContent value="routing" className="space-y-2 sm:space-y-3 mt-3 sm:mt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs sm:text-sm">Intent:</span>
                          <div className="flex items-center gap-1 mt-1">
                            {getIntentIcon(response.routing.intent)}
                            <Badge variant="outline" className="text-xs">{response.routing.intent}</Badge>
                          </div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs sm:text-sm">Strategy:</span>
                          <Badge variant="outline" className="mt-1 text-xs">{response.routing.strategy}</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs sm:text-sm">Needs Retrieval:</span>
                          <Badge variant={response.routing.needsRetrieval ? 'default' : 'secondary'} className="mt-1 text-xs">
                            {response.routing.needsRetrieval ? 'Yes' : 'No'}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs sm:text-sm">Parallelizable:</span>
                          <Badge variant={response.routing.parallelizable ? 'default' : 'secondary'} className="mt-1 text-xs">
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
                      {response.retrieval.metadata?.ragFusionVariations && (
                        <div>
                          <span className="text-sm text-muted-foreground">RAG Fusion Variations:</span>
                          <ul className="text-sm mt-1 space-y-1">
                            {response.retrieval.metadata.ragFusionVariations.map((v, i) => (
                              <li key={i} className="p-2 bg-muted rounded">{i + 1}. {v}</li>
                            ))}
                          </ul>
                        </div>
                      )}
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
