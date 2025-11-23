import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  MagnifyingGlass,
  Database,
  Lightning,
  TreeStructure,
  ArrowsClockwise,
  Cloud,
  GitBranch,
  TextAa,
  Brain
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'

type StrategyType = 'semantic' | 'keyword' | 'hybrid' | 'multi_query' | 'rag_fusion'

interface StrategyNode {
  id: string
  label: string
  icon: React.ReactNode
  description: string
}

interface StrategyPath {
  strategy: StrategyType
  label: string
  color: string
  nodes: StrategyNode[]
  bestFor: string[]
  complexity: 'low' | 'medium' | 'high'
}

export function StrategyComparisonDiagram() {
  const strategies: StrategyPath[] = [
    {
      strategy: 'semantic',
      label: 'Semantic Search',
      color: 'bg-blue-500',
      complexity: 'low',
      bestFor: ['Conceptual queries', 'Meaning-based matching', 'Natural language'],
      nodes: [
        { 
          id: 'embed', 
          label: 'Embed Query', 
          icon: <Brain size={16} weight="duotone" />,
          description: 'Convert to vector'
        },
        { 
          id: 'vector', 
          label: 'Vector Search', 
          icon: <Database size={16} weight="duotone" />,
          description: 'Similarity matching'
        },
        { 
          id: 'rank', 
          label: 'Rank Results', 
          icon: <ArrowsClockwise size={16} weight="duotone" />,
          description: 'By cosine similarity'
        }
      ]
    },
    {
      strategy: 'keyword',
      label: 'Keyword Search',
      color: 'bg-green-500',
      complexity: 'low',
      bestFor: ['Specific terms', 'IDs & codes', 'Proper nouns'],
      nodes: [
        { 
          id: 'tokenize', 
          label: 'Tokenize', 
          icon: <TextAa size={16} weight="duotone" />,
          description: 'Extract keywords'
        },
        { 
          id: 'bm25', 
          label: 'BM25 Search', 
          icon: <MagnifyingGlass size={16} weight="duotone" />,
          description: 'Lexical matching'
        },
        { 
          id: 'rank', 
          label: 'Rank Results', 
          icon: <ArrowsClockwise size={16} weight="duotone" />,
          description: 'By term frequency'
        }
      ]
    },
    {
      strategy: 'hybrid',
      label: 'Hybrid Retrieval',
      color: 'bg-purple-500',
      complexity: 'medium',
      bestFor: ['Balanced queries', 'Complex needs', 'Production systems'],
      nodes: [
        { 
          id: 'parallel', 
          label: 'Parallel Execution', 
          icon: <GitBranch size={16} weight="duotone" />,
          description: 'Semantic + Keyword'
        },
        { 
          id: 'rrf', 
          label: 'RRF Merge', 
          icon: <ArrowsClockwise size={16} weight="duotone" />,
          description: 'Reciprocal rank fusion'
        },
        { 
          id: 'rerank', 
          label: 'Re-rank', 
          icon: <Lightning size={16} weight="fill" />,
          description: 'Final scoring'
        }
      ]
    },
    {
      strategy: 'multi_query',
      label: 'Multi-Query RAG',
      color: 'bg-orange-500',
      complexity: 'high',
      bestFor: ['Complex questions', 'Ambiguous queries', 'Comprehensive results'],
      nodes: [
        { 
          id: 'expand', 
          label: 'Query Expansion', 
          icon: <TreeStructure size={16} weight="duotone" />,
          description: 'Generate variants'
        },
        { 
          id: 'parallel', 
          label: 'Parallel Retrieval', 
          icon: <GitBranch size={16} weight="duotone" />,
          description: 'Multiple searches'
        },
        { 
          id: 'aggregate', 
          label: 'Aggregate', 
          icon: <ArrowsClockwise size={16} weight="duotone" />,
          description: 'Merge & deduplicate'
        }
      ]
    },
    {
      strategy: 'rag_fusion',
      label: 'RAG Fusion',
      color: 'bg-pink-500',
      complexity: 'high',
      bestFor: ['Research queries', 'Multi-perspective', 'Deep analysis'],
      nodes: [
        {
          id: 'generate',
          label: 'Generate Queries',
          icon: <Cloud size={16} weight="duotone" />,
          description: 'LLM-generated variants'
        },
        { 
          id: 'retrieve', 
          label: 'Retrieve All', 
          icon: <Database size={16} weight="duotone" />,
          description: 'From multiple angles'
        },
        { 
          id: 'fusion', 
          label: 'Fusion Rank', 
          icon: <Lightning size={16} weight="fill" />,
          description: 'Cross-query scoring'
        }
      ]
    }
  ]

  const getComplexityBadge = (complexity: 'low' | 'medium' | 'high') => {
    const variants = {
      low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
      medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
      high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    }
    return variants[complexity]
  }

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Agentic Routing Strategies</h3>
        <p className="text-sm text-muted-foreground">
          Different retrieval patterns selected by the agent based on query characteristics
        </p>
      </div>

      <div className="space-y-6">
        {strategies.map((strategy, index) => (
          <motion.div
            key={strategy.strategy}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${strategy.color}`} />
                <div>
                  <h4 className="font-semibold">{strategy.label}</h4>
                  <Badge 
                    className={`mt-1 text-xs ${getComplexityBadge(strategy.complexity)}`}
                    variant="secondary"
                  >
                    {strategy.complexity} complexity
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-4">
              {strategy.nodes.map((node, nodeIndex) => (
                <div key={node.id} className="flex items-center gap-2">
                  <div className="flex flex-col items-center min-w-[80px]">
                    <div className="w-10 h-10 rounded-lg bg-muted border flex items-center justify-center mb-1">
                      {node.icon}
                    </div>
                    <span className="text-xs font-medium text-center">{node.label}</span>
                    <span className="text-xs text-muted-foreground text-center">
                      {node.description}
                    </span>
                  </div>
                  {nodeIndex < strategy.nodes.length - 1 && (
                    <div className="flex-shrink-0 text-muted-foreground">→</div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Best for:</p>
              <div className="flex flex-wrap gap-1">
                {strategy.bestFor.map((use, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {use}
                  </Badge>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-accent/10 rounded-lg border border-accent/20">
        <div className="flex items-start gap-2">
          <Brain size={20} weight="duotone" className="text-accent flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">Agentic Selection</p>
            <p className="text-muted-foreground">
              The agent analyzes query intent, complexity, and requirements to automatically select 
              the optimal strategy. It can also chain strategies or fall back to alternatives if 
              confidence is low.
            </p>
          </div>
        </div>
      </div>
    </Card>
  )
}
