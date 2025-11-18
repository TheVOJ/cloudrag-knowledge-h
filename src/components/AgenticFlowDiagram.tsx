import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  ArrowRight,
  Brain,
  MagnifyingGlass,
  TreeStructure,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  Lightning,
  FlowArrow,
  GitBranch,
  Database,
  CloudArrowDown,
  ChartBar,
  Eye,
  Sparkle
} from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { AgenticRAGResponse } from '@/lib/agentic-rag-orchestrator'
import { cn } from '@/lib/utils'

interface AgenticFlowDiagramProps {
  response: AgenticRAGResponse
  compact?: boolean
}

type FlowStep = {
  id: string
  label: string
  icon: React.ReactNode
  status: 'completed' | 'active' | 'pending' | 'skipped'
  detail?: string
  branches?: FlowBranch[]
}

type FlowBranch = {
  condition: string
  taken: boolean
  destination: string
}

export function AgenticFlowDiagram({ response, compact = false }: AgenticFlowDiagramProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [showBranches, setShowBranches] = useState(true)

  const buildFlowSteps = (): FlowStep[] => {
    const steps: FlowStep[] = []

    steps.push({
      id: 'input',
      label: 'Query Input',
      icon: <MagnifyingGlass size={20} weight="duotone" />,
      status: 'completed',
      detail: 'User query received and normalized'
    })

    steps.push({
      id: 'intent',
      label: 'Intent Classification',
      icon: <Brain size={20} weight="duotone" />,
      status: 'completed',
      detail: `Classified as: ${response.routing.intent}`,
      branches: [
        { condition: 'chitchat', taken: response.routing.intent === 'chitchat', destination: 'direct' },
        { condition: 'needs retrieval', taken: response.routing.needsRetrieval, destination: 'analysis' },
        { condition: 'out of scope', taken: response.routing.intent === 'out_of_scope', destination: 'direct' }
      ]
    })

    if (response.routing.intent === 'chitchat' || !response.routing.needsRetrieval) {
      steps.push({
        id: 'direct',
        label: 'Direct Answer',
        icon: <Sparkle size={20} weight="duotone" />,
        status: 'completed',
        detail: 'Answer generated without retrieval'
      })
    } else {
      steps.push({
        id: 'analysis',
        label: 'Query Analysis',
        icon: <ChartBar size={20} weight="duotone" />,
        status: 'completed',
        detail: 'Analyzing complexity, scope, and requirements'
      })

      steps.push({
        id: 'routing',
        label: 'Strategy Selection',
        icon: <GitBranch size={20} weight="duotone" />,
        status: 'completed',
        detail: `Selected: ${response.routing.strategy}`,
        branches: [
          { condition: 'semantic', taken: response.routing.strategy === 'semantic', destination: 'retrieval' },
          { condition: 'keyword', taken: response.routing.strategy === 'keyword', destination: 'retrieval' },
          { condition: 'hybrid', taken: response.routing.strategy === 'hybrid', destination: 'retrieval' },
          { condition: 'multi-query', taken: response.routing.strategy === 'multi_query', destination: 'expansion' }
        ]
      })

      if (response.routing.strategy === 'multi_query' || response.routing.subQueries) {
        steps.push({
          id: 'expansion',
          label: 'Query Expansion',
          icon: <TreeStructure size={20} weight="duotone" />,
          status: 'completed',
          detail: `Generated ${response.routing.subQueries?.length || 0} sub-queries`
        })
      }

      const usedAzure = response.metadata.retrievalMethod === 'azure'
      steps.push({
        id: 'retrieval',
        label: usedAzure ? 'Azure AI Search' : 'Local Retrieval',
        icon: usedAzure ? <Lightning size={20} weight="fill" /> : <Database size={20} weight="duotone" />,
        status: 'completed',
        detail: `Retrieved ${response.retrieval.documents.length} documents`,
        branches: response.routing.parallelizable ? [
          { condition: 'parallel execution', taken: true, destination: 'rerank' }
        ] : undefined
      })

      steps.push({
        id: 'rerank',
        label: 'Re-ranking',
        icon: <ArrowsClockwise size={20} weight="duotone" />,
        status: 'completed',
        detail: 'Scoring and prioritizing results'
      })

      steps.push({
        id: 'generation',
        label: 'Answer Generation',
        icon: <Sparkle size={20} weight="duotone" />,
        status: 'completed',
        detail: 'Synthesizing response from context'
      })

      steps.push({
        id: 'evaluation',
        label: 'Self-Evaluation',
        icon: <Eye size={20} weight="duotone" />,
        status: 'completed',
        detail: `Confidence: ${(response.evaluation.confidence * 100).toFixed(0)}%`,
        branches: [
          { condition: 'high confidence', taken: response.evaluation.confidence >= 0.8, destination: 'output' },
          { condition: 'needs retry', taken: response.evaluation.needsRetry, destination: 'retry' },
          { condition: 'moderate', taken: response.evaluation.confidence >= 0.5 && response.evaluation.confidence < 0.8, destination: 'criticism' }
        ]
      })

      if (response.criticism) {
        steps.push({
          id: 'criticism',
          label: 'Critic Feedback',
          icon: <Brain size={20} weight="duotone" />,
          status: 'completed',
          detail: `Logic: ${(response.criticism.logicalConsistency * 100).toFixed(0)}%, Accuracy: ${(response.criticism.factualAccuracy * 100).toFixed(0)}%`
        })
      }

      if (response.evaluation.needsRetry && response.iterations > 1) {
        steps.push({
          id: 'retry',
          label: `Retry (Iteration ${response.iterations})`,
          icon: <ArrowsClockwise size={20} weight="fill" />,
          status: 'completed',
          detail: 'Refining query and re-executing'
        })
      }
    }

    steps.push({
      id: 'output',
      label: 'Final Response',
      icon: response.evaluation.confidence >= 0.8 
        ? <CheckCircle size={20} weight="fill" /> 
        : <CheckCircle size={20} weight="duotone" />,
      status: 'completed',
      detail: `Delivered in ${response.metadata.totalTimeMs}ms`
    })

    return steps
  }

  const steps = buildFlowSteps()

  const getStatusColor = (status: FlowStep['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500'
      case 'active': return 'bg-blue-500 animate-pulse'
      case 'pending': return 'bg-gray-300'
      case 'skipped': return 'bg-gray-200'
    }
  }

  const getStatusBorderColor = (status: FlowStep['status']) => {
    switch (status) {
      case 'completed': return 'border-green-500'
      case 'active': return 'border-blue-500'
      case 'pending': return 'border-gray-300'
      case 'skipped': return 'border-gray-200'
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2 flex-shrink-0">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center border-2",
              getStatusBorderColor(step.status)
            )}>
              <div className="text-foreground">
                {step.icon}
              </div>
            </div>
            {index < steps.length - 1 && (
              <ArrowRight size={16} className="text-muted-foreground" />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FlowArrow size={24} weight="duotone" className="text-primary" />
          <h3 className="font-semibold text-lg">Agentic Query Flow</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBranches(!showBranches)}
            className="gap-2"
          >
            <GitBranch size={14} />
            {showBranches ? 'Hide' : 'Show'} Branches
          </Button>
          <Badge variant="secondary" className="gap-1">
            <ArrowsClockwise size={12} />
            {response.iterations} iteration{response.iterations !== 1 ? 's' : ''}
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="relative">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center flex-shrink-0">
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center border-2 cursor-pointer transition-colors",
                      getStatusBorderColor(step.status),
                      expandedStep === step.id ? 'bg-primary/10' : 'bg-background'
                    )}
                    onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                  >
                    <div className={cn(
                      step.status === 'completed' ? 'text-foreground' : 'text-muted-foreground'
                    )}>
                      {step.icon}
                    </div>
                  </motion.div>
                  
                  {index < steps.length - 1 && (
                    <div className="w-0.5 h-12 bg-border my-2" />
                  )}
                </div>

                <div className="flex-1 pt-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{step.label}</h4>
                      <p className="text-sm text-muted-foreground">{step.detail}</p>
                    </div>
                    <Badge 
                      variant={step.status === 'completed' ? 'default' : 'secondary'}
                      className="capitalize"
                    >
                      {step.status}
                    </Badge>
                  </div>

                  <AnimatePresence>
                    {expandedStep === step.id && step.branches && showBranches && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-3 space-y-2"
                      >
                        <p className="text-xs font-medium text-muted-foreground uppercase">Decision Branches:</p>
                        {step.branches.map((branch, branchIndex) => (
                          <div
                            key={branchIndex}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded border",
                              branch.taken 
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
                                : 'bg-muted border-border opacity-50'
                            )}
                          >
                            {branch.taken ? (
                              <CheckCircle size={16} weight="fill" className="text-green-600 dark:text-green-400 flex-shrink-0" />
                            ) : (
                              <XCircle size={16} weight="duotone" className="text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="text-xs flex-1">{branch.condition}</span>
                            {branch.taken && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <ArrowRight size={12} />
                                <span>{branch.destination}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Total Time</p>
            <p className="font-semibold">{response.metadata.totalTimeMs}ms</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Strategy</p>
            <p className="font-semibold capitalize">{response.routing.strategy}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Documents</p>
            <p className="font-semibold">{response.retrieval.documents.length}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Confidence</p>
            <p className="font-semibold">{(response.metadata.confidence * 100).toFixed(0)}%</p>
          </div>
        </div>
      </div>
    </Card>
  )
}
