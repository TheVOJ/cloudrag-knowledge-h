import { useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { GitDiff, Info } from '@phosphor-icons/react'

export type QuerySimilarityData = {
  id: string
  query: string
  type: 'original' | 'reformulation' | 'subquery' | 'expansion' | 'simplification'
}

interface QuerySimilarityMatrixProps {
  queries: QuerySimilarityData[]
  calculateSimilarity: (query1: string, query2: string) => number
}

export function QuerySimilarityMatrix({ queries, calculateSimilarity }: QuerySimilarityMatrixProps) {
  const safeQueries = Array.isArray(queries) ? queries : []

  const similarityMatrix = useMemo(() => {
    const matrix: number[][] = []
    for (let i = 0; i < safeQueries.length; i++) {
      matrix[i] = []
      for (let j = 0; j < safeQueries.length; j++) {
        if (i === j) {
          matrix[i][j] = 1
        } else {
          matrix[i][j] = calculateSimilarity(safeQueries[i].query, safeQueries[j].query)
        }
      }
    }
    return matrix
  }, [safeQueries, calculateSimilarity])

  const getColorForSimilarity = (similarity: number): string => {
    if (similarity >= 0.8) return 'bg-green-500'
    if (similarity >= 0.6) return 'bg-lime-500'
    if (similarity >= 0.4) return 'bg-yellow-500'
    if (similarity >= 0.2) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getTextColorForSimilarity = (similarity: number): string => {
    if (similarity >= 0.8) return 'text-green-600'
    if (similarity >= 0.6) return 'text-lime-600'
    if (similarity >= 0.4) return 'text-yellow-600'
    if (similarity >= 0.2) return 'text-orange-600'
    return 'text-red-600'
  }

  if (safeQueries.length < 2) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center text-center space-y-2">
          <GitDiff size={32} weight="duotone" className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Not enough queries to calculate similarity
          </p>
          <p className="text-xs text-muted-foreground">
            At least 2 query reformulations are needed
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitDiff size={20} weight="duotone" className="text-primary" />
          <h3 className="text-sm font-semibold">Query Similarity Matrix</h3>
          <Badge variant="secondary" className="text-xs">
            {safeQueries.length}x{safeQueries.length}
          </Badge>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info size={16} className="text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">
                Shows semantic similarity between all query pairs. Higher values (green) indicate more similar queries, 
                lower values (red) indicate more divergent queries.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Card className="p-4 overflow-x-auto">
        <div className="min-w-max">
            <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(${safeQueries.length}, 60px)` }}>
            <div className="h-20"></div>
            {safeQueries.map((query, idx) => (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className="h-20 flex items-end justify-center pb-2 text-xs font-medium cursor-help"
                      style={{ 
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)'
                      }}
                    >
                      <span className="truncate max-w-[60px]">
                        Q{idx + 1}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    <div className="space-y-1">
                      <Badge variant="outline" className="text-xs">{query.type}</Badge>
                      <p className="text-xs break-words">{query.query}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
            
            {safeQueries.map((rowQuery, rowIdx) => (
              <>
                <TooltipProvider key={`row-${rowIdx}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="h-14 flex items-center text-xs font-medium pr-2 cursor-help">
                        <span className="truncate text-right w-full">Q{rowIdx + 1}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs">{rowQuery.type}</Badge>
                        <p className="text-xs break-words">{rowQuery.query}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {safeQueries.map((colQuery, colIdx) => {
                  const similarity = similarityMatrix[rowIdx][colIdx]
                  const isDiagonal = rowIdx === colIdx
                  
                  return (
                    <TooltipProvider key={`cell-${rowIdx}-${colIdx}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div 
                            className={`h-14 flex items-center justify-center rounded cursor-help transition-all hover:scale-105 ${
                              isDiagonal ? 'bg-muted border-2 border-primary' : getColorForSimilarity(similarity)
                            }`}
                          >
                            <span className={`text-xs font-bold ${isDiagonal ? 'text-foreground' : 'text-white'}`}>
                              {isDiagonal ? '—' : (similarity * 100).toFixed(0)}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold">
                              {isDiagonal ? 'Same Query' : `Similarity: ${(similarity * 100).toFixed(1)}%`}
                            </p>
                            {!isDiagonal && (
                              <>
                                <div className="space-y-1 pt-2 border-t">
                                  <p className="text-xs text-muted-foreground">Query {rowIdx + 1} ({rowQuery.type}):</p>
                                  <p className="text-xs break-words">{rowQuery.query}</p>
                                </div>
                                <div className="space-y-1 pt-2 border-t">
                                  <p className="text-xs text-muted-foreground">Query {colIdx + 1} ({colQuery.type}):</p>
                                  <p className="text-xs break-words">{colQuery.query}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                })}
              </>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-muted/30">
        <div className="space-y-3">
          <h4 className="text-xs font-semibold">Similarity Scale</h4>
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-red-500"></div>
              <span className="text-muted-foreground">Low (0-20%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-orange-500"></div>
              <span className="text-muted-foreground">20-40%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-yellow-500"></div>
              <span className="text-muted-foreground">40-60%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-lime-500"></div>
              <span className="text-muted-foreground">60-80%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-green-500"></div>
              <span className="text-muted-foreground">High (80-100%)</span>
            </div>
          </div>
          
          <div className="pt-2 border-t">
            <h4 className="text-xs font-semibold mb-2">Statistics</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2 rounded bg-background">
                <div className="text-muted-foreground">Avg Similarity</div>
                <div className="font-semibold text-sm mt-0.5">
                  {safeQueries.length > 1
                    ? (
                        similarityMatrix.flat().filter((v, i) => i % (safeQueries.length + 1) !== 0).reduce((a, b) => a + b, 0) /
                        (safeQueries.length * safeQueries.length - safeQueries.length)
                      ).toFixed(1)
                    : '0.0'}%
                </div>
              </div>
              <div className="p-2 rounded bg-background">
                <div className="text-muted-foreground">Max Similarity</div>
                <div className="font-semibold text-sm mt-0.5">
                  {safeQueries.length > 1
                    ? (Math.max(...similarityMatrix.flat().filter((v, i) => i % (safeQueries.length + 1) !== 0)) * 100).toFixed(1)
                    : '0.0'}%
                </div>
              </div>
              <div className="p-2 rounded bg-background">
                <div className="text-muted-foreground">Min Similarity</div>
                <div className="font-semibold text-sm mt-0.5">
                  {safeQueries.length > 1
                    ? (Math.min(...similarityMatrix.flat().filter((v, i) => i % (safeQueries.length + 1) !== 0)) * 100).toFixed(1)
                    : '0.0'}%
                </div>
              </div>
              <div className="p-2 rounded bg-background">
                <div className="text-muted-foreground">Diversity</div>
                <div className="font-semibold text-sm mt-0.5">
                  {safeQueries.length > 1
                    ? (
                        (1 - similarityMatrix.flat().filter((v, i) => i % (safeQueries.length + 1) !== 0).reduce((a, b) => a + b, 0) /
                        (safeQueries.length * safeQueries.length - safeQueries.length)) * 100
                      ).toFixed(1)
                    : '0.0'}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <p className="font-medium mb-1">💡 Understanding the Matrix:</p>
        <ul className="space-y-0.5 ml-4 list-disc">
          <li>Diagonal cells (—) represent the same query compared to itself</li>
          <li>Hover over cells to see detailed query comparisons</li>
          <li>Green cells indicate high semantic overlap between queries</li>
          <li>Red cells indicate more diverse query formulations</li>
          <li>Higher diversity can lead to better coverage of the knowledge base</li>
        </ul>
      </div>
    </div>
  )
}
