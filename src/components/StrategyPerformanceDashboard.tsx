import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Brain,
  ChartLine,
  Lightbulb,
  TrendUp,
  TrendDown,
  Target,
  Clock,
  CheckCircle,
  Warning,
  Info,
  ArrowsClockwise,
  Cloud,
  ListChecks,
  ChartBar
} from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import {
  StrategyPerformanceTracker,
  StrategyPerformanceMetrics,
  QueryPerformanceRecord,
  LearningInsight
} from '@/lib/strategy-performance-tracker'
import { QueryIntent, RetrievalStrategy } from '@/lib/agentic-router'

export function StrategyPerformanceDashboard() {
  const [tracker] = useState(() => new StrategyPerformanceTracker())
  const [metrics, setMetrics] = useState<StrategyPerformanceMetrics[]>([])
  const [insights, setInsights] = useState<LearningInsight[]>([])
  const [queryHistory, setQueryHistory] = useState<QueryPerformanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedIntent, setSelectedIntent] = useState<QueryIntent | 'all'>('all')
  
  useEffect(() => {
    loadData()
  }, [])
  
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [metricsData, insightsData, historyData] = await Promise.all([
        tracker.getAllMetrics(),
        tracker.getInsights(),
        tracker.getQueryHistory()
      ])
      
      setMetrics(metricsData)
      setInsights(insightsData)
      setQueryHistory(historyData)
    } catch (error) {
      console.error('Failed to load performance data:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const getIntentLabel = (intent: QueryIntent): string => {
    const labels: Record<QueryIntent, string> = {
      factual: 'Factual',
      analytical: 'Analytical',
      comparative: 'Comparative',
      procedural: 'Procedural',
      clarification: 'Clarification',
      chitchat: 'Chitchat',
      out_of_scope: 'Out of Scope'
    }
    return labels[intent]
  }
  
  const getStrategyLabel = (strategy: RetrievalStrategy): string => {
    const labels: Record<RetrievalStrategy, string> = {
      semantic: 'Semantic',
      keyword: 'Keyword',
      hybrid: 'Hybrid',
      multi_query: 'Multi-Query',
      rag_fusion: 'RAG Fusion',
      direct_answer: 'Direct Answer'
    }
    return labels[strategy]
  }
  
  const getIntentColor = (intent: QueryIntent): string => {
    const colors: Record<QueryIntent, string> = {
      factual: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
      analytical: 'bg-purple-500/10 text-purple-700 border-purple-500/20',
      comparative: 'bg-orange-500/10 text-orange-700 border-orange-500/20',
      procedural: 'bg-green-500/10 text-green-700 border-green-500/20',
      clarification: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
      chitchat: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
      out_of_scope: 'bg-red-500/10 text-red-700 border-red-500/20'
    }
    return colors[intent]
  }
  
  const getImpactIcon = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high':
        return <Cloud size={16} weight="fill" className="text-accent" />
      case 'medium':
        return <Info size={16} weight="fill" className="text-blue-500" />
      case 'low':
        return <Info size={16} className="text-muted-foreground" />
    }
  }
  
  const filteredMetrics = selectedIntent === 'all' 
    ? metrics 
    : metrics.filter(m => m.intent === selectedIntent)
  
  const topPerformers = [...metrics]
    .filter(m => m.totalQueries >= 3)
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5)
  
  const recentQueries = [...queryHistory]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20)
  
  const overallStats = {
    totalQueries: queryHistory.length,
    avgConfidence: queryHistory.length > 0
      ? queryHistory.reduce((sum, q) => sum + q.confidence, 0) / queryHistory.length
      : 0,
    successfulQueries: queryHistory.filter(q => 
      q.confidence >= 0.7 && q.userFeedback !== 'negative'
    ).length,
    avgIterations: queryHistory.length > 0
      ? queryHistory.reduce((sum, q) => sum + q.iterations, 0) / queryHistory.length
      : 0
  }
  
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <ArrowsClockwise size={48} className="animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading performance data...</p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  if (metrics.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <Brain size={48} className="text-muted-foreground" weight="duotone" />
            <div className="text-center">
              <h3 className="font-semibold mb-2">No Performance Data Yet</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Strategy performance tracking will begin once you start querying your knowledge base. 
                The system learns from each query to optimize future routing decisions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight mb-1">Strategy Performance & Learning</h2>
          <p className="text-sm text-muted-foreground">
            Track routing effectiveness and discover optimization opportunities
          </p>
        </div>
        <Button variant="outline" onClick={loadData} className="gap-2">
          <ArrowsClockwise size={16} />
          Refresh
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <ListChecks size={16} />
              Total Queries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{overallStats.totalQueries}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all strategies
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <Target size={16} />
              Avg Confidence
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {(overallStats.avgConfidence * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all queries
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle size={16} />
              Success Rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {overallStats.totalQueries > 0 
                ? ((overallStats.successfulQueries / overallStats.totalQueries) * 100).toFixed(0)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overallStats.successfulQueries} successful
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <ArrowsClockwise size={16} />
              Avg Iterations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {overallStats.avgIterations.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Per query
            </p>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="strategies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="strategies" className="gap-2">
            <ChartBar size={16} />
            Strategy Performance
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <Lightbulb size={16} />
            Learning Insights
            {insights.length > 0 && (
              <Badge variant="secondary" className="ml-1">{insights.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock size={16} />
            Query History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="strategies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendUp size={20} />
                Top Performing Strategies
              </CardTitle>
              <CardDescription>
                Strategies with the highest success rates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {topPerformers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Not enough data yet. Keep querying to see top performers.
                </p>
              ) : (
                topPerformers.map((metric, index) => (
                  <motion.div
                    key={metric.strategyId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="border-2">
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className={getIntentColor(metric.intent)}>
                                {getIntentLabel(metric.intent)}
                              </Badge>
                              <Badge variant="secondary">
                                {getStrategyLabel(metric.strategy)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {metric.totalQueries} queries
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-accent">
                              {(metric.successRate * 100).toFixed(0)}%
                            </div>
                            <p className="text-xs text-muted-foreground">success</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Confidence</span>
                            <span className="font-medium">{metric.averageConfidence.toFixed(2)}</span>
                          </div>
                          <Progress value={metric.averageConfidence * 100} className="h-1.5" />
                          
                          <div className="grid grid-cols-2 gap-4 pt-2">
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Time</p>
                              <p className="text-sm font-medium">{metric.averageRetrievalTime.toFixed(0)}ms</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Avg Iterations</p>
                              <p className="text-sm font-medium">{metric.averageIterations.toFixed(1)}</p>
                            </div>
                          </div>
                          
                          {metric.improvementTrend !== 0 && (
                            <div className="flex items-center gap-1 pt-2">
                              {metric.improvementTrend > 0 ? (
                                <TrendUp size={14} className="text-green-600" weight="bold" />
                              ) : (
                                <TrendDown size={14} className="text-red-600" weight="bold" />
                              )}
                              <span className={`text-xs font-medium ${
                                metric.improvementTrend > 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {Math.abs(metric.improvementTrend * 100).toFixed(1)}% trend
                              </span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ChartLine size={20} />
                All Strategy Metrics
              </CardTitle>
              <CardDescription>
                Complete performance breakdown by intent and strategy
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-4">
                <Button
                  variant={selectedIntent === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedIntent('all')}
                >
                  All
                </Button>
                {(['factual', 'analytical', 'comparative', 'procedural'] as QueryIntent[]).map(intent => (
                  <Button
                    key={intent}
                    variant={selectedIntent === intent ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedIntent(intent)}
                  >
                    {getIntentLabel(intent)}
                  </Button>
                ))}
              </div>
              
              <ScrollArea className="h-[400px]">
                <div className="space-y-2 pr-4">
                  {filteredMetrics.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No metrics for selected filter
                    </p>
                  ) : (
                    filteredMetrics.map(metric => (
                      <Card key={metric.strategyId} className="p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className={getIntentColor(metric.intent)}>
                                {getIntentLabel(metric.intent)}
                              </Badge>
                              <Badge variant="secondary">
                                {getStrategyLabel(metric.strategy)}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-4 gap-3 text-xs">
                              <div>
                                <p className="text-muted-foreground">Success</p>
                                <p className="font-semibold">{(metric.successRate * 100).toFixed(0)}%</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Confidence</p>
                                <p className="font-semibold">{metric.averageConfidence.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Queries</p>
                                <p className="font-semibold">{metric.totalQueries}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Iterations</p>
                                <p className="font-semibold">{metric.averageIterations.toFixed(1)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="insights" className="space-y-4">
          {insights.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center gap-4">
                  <Lightbulb size={48} className="text-muted-foreground" weight="duotone" />
                  <div className="text-center">
                    <h3 className="font-semibold mb-2">No Insights Yet</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                      The system needs more query data to generate learning insights. 
                      Continue querying to discover patterns and optimization opportunities.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            insights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`border-l-4 ${
                  insight.impact === 'high' 
                    ? 'border-l-accent' 
                    : insight.impact === 'medium' 
                    ? 'border-l-blue-500' 
                    : 'border-l-muted'
                }`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getImpactIcon(insight.impact)}
                          <CardTitle className="text-base">{insight.title}</CardTitle>
                        </div>
                        <CardDescription>{insight.description}</CardDescription>
                      </div>
                      <Badge variant={insight.impact === 'high' ? 'default' : 'secondary'}>
                        {insight.impact} impact
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {insight.actionable && insight.suggestedAction && (
                      <div className="bg-muted/50 rounded-lg p-3 mb-3">
                        <p className="text-sm font-medium mb-1">Suggested Action:</p>
                        <p className="text-sm text-muted-foreground">{insight.suggestedAction}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>📊 {insight.supportingData.queriesAnalyzed} queries analyzed</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span>📅 {insight.supportingData.timeRange}</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>
        
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Query Performance</CardTitle>
              <CardDescription>
                Last 20 queries with performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-2 pr-4">
                  {recentQueries.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No query history yet
                    </p>
                  ) : (
                    recentQueries.map((record, index) => (
                      <motion.div
                        key={record.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        <Card className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between">
                              <p className="text-sm font-medium flex-1 pr-4">{record.query}</p>
                              <div className="text-right shrink-0">
                                <div className={`text-lg font-bold ${
                                  record.confidence >= 0.8 
                                    ? 'text-green-600' 
                                    : record.confidence >= 0.6 
                                    ? 'text-yellow-600' 
                                    : 'text-red-600'
                                }`}>
                                  {(record.confidence * 100).toFixed(0)}%
                                </div>
                                <p className="text-xs text-muted-foreground">confidence</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={getIntentColor(record.intent)}>
                                {getIntentLabel(record.intent)}
                              </Badge>
                              <Badge variant="secondary">
                                {getStrategyLabel(record.strategy)}
                              </Badge>
                              {record.needsImprovement && (
                                <Badge variant="destructive" className="gap-1">
                                  <Warning size={12} />
                                  Needs improvement
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3 text-xs pt-1">
                              <div>
                                <p className="text-muted-foreground">Time</p>
                                <p className="font-medium">{record.timeMs}ms</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Iterations</p>
                                <p className="font-medium">{record.iterations}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Documents</p>
                                <p className="font-medium">{record.documentsRetrieved}</p>
                              </div>
                            </div>
                            
                            <div className="text-xs text-muted-foreground">
                              {new Date(record.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </Card>
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
