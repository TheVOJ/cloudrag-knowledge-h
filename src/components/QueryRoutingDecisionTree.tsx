import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Brain,
  ChatCircle,
  Database,
  Lightning,
  MagnifyingGlass,
  TreeStructure,
  ChartBar,
  Warning,
  CheckCircle,
  Question
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DecisionNode {
  id: string
  type: 'decision' | 'action' | 'terminal'
  label: string
  icon: React.ReactNode
  children?: DecisionNode[]
  condition?: string
  highlighted?: boolean
}

interface QueryRoutingDecisionTreeProps {
  highlightedPath?: string[]
}

export function QueryRoutingDecisionTree({ highlightedPath = [] }: QueryRoutingDecisionTreeProps) {
  const decisionTree: DecisionNode = {
    id: 'root',
    type: 'decision',
    label: 'Query Input',
    icon: <MagnifyingGlass size={16} weight="duotone" />,
    children: [
      {
        id: 'classify',
        type: 'decision',
        label: 'Classify Intent',
        icon: <Brain size={16} weight="duotone" />,
        children: [
          {
            id: 'chitchat',
            type: 'terminal',
            label: 'Chitchat → Direct Answer',
            icon: <ChatCircle size={16} weight="duotone" />,
            condition: 'Is casual conversation?'
          },
          {
            id: 'out-of-scope',
            type: 'terminal',
            label: 'Out of Scope → Polite Decline',
            icon: <Warning size={16} weight="duotone" />,
            condition: 'Unrelated to KB?'
          },
          {
            id: 'analyze',
            type: 'decision',
            label: 'Analyze Query',
            icon: <ChartBar size={16} weight="duotone" />,
            condition: 'Needs retrieval?',
            children: [
              {
                id: 'simple',
                type: 'action',
                label: 'Simple Query',
                icon: <CheckCircle size={16} weight="duotone" />,
                condition: 'Low complexity?',
                children: [
                  {
                    id: 'semantic',
                    type: 'terminal',
                    label: 'Semantic Search',
                    icon: <Database size={16} weight="duotone" />,
                    condition: 'Conceptual query?'
                  },
                  {
                    id: 'keyword',
                    type: 'terminal',
                    label: 'Keyword Search',
                    icon: <MagnifyingGlass size={16} weight="duotone" />,
                    condition: 'Specific terms?'
                  },
                  {
                    id: 'hybrid-simple',
                    type: 'terminal',
                    label: 'Hybrid Search',
                    icon: <Lightning size={16} weight="fill" />,
                    condition: 'Balanced needs?'
                  }
                ]
              },
              {
                id: 'complex',
                type: 'action',
                label: 'Complex Query',
                icon: <TreeStructure size={16} weight="duotone" />,
                condition: 'High complexity?',
                children: [
                  {
                    id: 'multi-query',
                    type: 'terminal',
                    label: 'Multi-Query RAG',
                    icon: <TreeStructure size={16} weight="duotone" />,
                    condition: 'Needs decomposition?'
                  },
                  {
                    id: 'rag-fusion',
                    type: 'terminal',
                    label: 'RAG Fusion',
                    icon: <Lightning size={16} weight="duotone" />,
                    condition: 'Multi-perspective?'
                  }
                ]
              },
              {
                id: 'clarify',
                type: 'terminal',
                label: 'Request Clarification',
                icon: <Question size={16} weight="duotone" />,
                condition: 'Ambiguous?'
              }
            ]
          }
        ]
      }
    ]
  }

  const isHighlighted = (nodeId: string) => highlightedPath.includes(nodeId)

  const renderNode = (node: DecisionNode, depth: number = 0, isLast: boolean = false): React.ReactNode => {
    const hasChildren = node.children && node.children.length > 0
    const highlighted = isHighlighted(node.id)

    const getNodeColor = () => {
      if (highlighted) return 'border-primary bg-primary/10'
      switch (node.type) {
        case 'decision': return 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
        case 'action': return 'border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20'
        case 'terminal': return 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
      }
    }

    return (
      <motion.div
        key={node.id}
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: depth * 0.1 }}
        className={cn(
          "relative",
          depth > 0 && "ml-8"
        )}
      >
        <div className="flex items-start gap-3 mb-3">
          {depth > 0 && (
            <div className="flex flex-col items-center pt-2">
              <div className={cn(
                "w-px h-4 -mt-2",
                highlighted ? "bg-primary" : "bg-border"
              )} />
              <div className={cn(
                "w-2 h-2 rounded-full",
                highlighted ? "bg-primary" : "bg-border"
              )} />
              <div className={cn(
                "w-px flex-1 mt-1",
                highlighted ? "bg-primary" : "bg-border",
                !hasChildren && "h-0"
              )} />
            </div>
          )}
          
          <div className="flex-1">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className={cn(
                "p-3 rounded-lg border-2 cursor-pointer transition-all",
                getNodeColor(),
                highlighted && "shadow-lg"
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  highlighted ? "bg-primary/20" : "bg-background"
                )}>
                  {node.icon}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{node.label}</p>
                  {node.condition && (
                    <p className="text-xs text-muted-foreground mt-0.5">{node.condition}</p>
                  )}
                </div>
                <Badge 
                  variant="outline" 
                  className="text-xs capitalize"
                >
                  {node.type}
                </Badge>
              </div>
            </motion.div>

            {hasChildren && (
              <div className="mt-3 space-y-3">
                {node.children!.map((child, index) => 
                  renderNode(child, depth + 1, index === node.children!.length - 1)
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Query Routing Decision Tree</h3>
        <p className="text-sm text-muted-foreground">
          The agent follows this decision path to determine the optimal retrieval strategy
        </p>
      </div>

      <div className="mb-6 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20" />
          <span>Decision Point</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-purple-300 bg-purple-50 dark:border-purple-700 dark:bg-purple-900/20" />
          <span>Action Node</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border-2 border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20" />
          <span>Terminal (Strategy)</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        {renderNode(decisionTree, 0, false)}
      </div>

      <div className="mt-6 p-4 bg-muted rounded-lg">
        <div className="flex items-start gap-2">
          <Brain size={20} weight="duotone" className="text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">Dynamic Routing</p>
            <p className="text-muted-foreground">
              The agent evaluates each decision point in real-time, considering query characteristics, 
              conversation context, and available resources. It can also implement fallback strategies 
              and retry mechanisms if initial routing doesn't meet confidence thresholds.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
