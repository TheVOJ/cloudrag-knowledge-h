import { useState, useMemo } from 'react'
import { Query } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatCircle, Sparkle, ChartBar, TrendUp, Clock, Lightning, MagnifyingGlass } from '@phosphor-icons/react'

interface QueryHistoryProps {
  queries: Query[]
  knowledgeBases: Array<{ id: string; name: string }>
}

type TimeRange = 'all' | 'today' | 'week' | 'month'
type GroupBy = 'none' | 'kb' | 'method'

export function QueryHistory({ queries, knowledgeBases }: QueryHistoryProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('all')
  const [selectedKB, setSelectedKB] = useState<string>('all')
  const [groupBy, setGroupBy] = useState<GroupBy>('none')

  const getKnowledgeBaseName = (kbId: string) => {
    const kb = knowledgeBases.find(k => k.id === kbId)
    return kb?.name || 'Unknown'
  }

  const filteredQueries = useMemo(() => {
    let filtered = [...queries]

    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000

    if (timeRange === 'today') {
      filtered = filtered.filter(q => now - q.timestamp < dayMs)
    } else if (timeRange === 'week') {
      filtered = filtered.filter(q => now - q.timestamp < 7 * dayMs)
    } else if (timeRange === 'month') {
      filtered = filtered.filter(q => now - q.timestamp < 30 * dayMs)
    }

    if (selectedKB !== 'all') {
      filtered = filtered.filter(q => q.knowledgeBaseId === selectedKB)
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp)
  }, [queries, timeRange, selectedKB])

  const analytics = useMemo(() => {
    const total = filteredQueries.length
    const azureCount = filteredQueries.filter(q => q.searchMethod === 'azure').length
    const totalSources = filteredQueries.reduce((sum, q) => sum + q.sources.length, 0)
    const avgSourcesPerQuery = total > 0 
      ? (totalSources / total).toFixed(1)
      : 0

    const kbDistribution = filteredQueries.reduce((acc, query) => {
      const kbName = getKnowledgeBaseName(query.knowledgeBaseId)
      acc[kbName] = (acc[kbName] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const methodDistribution = filteredQueries.reduce((acc, query) => {
      const method = query.searchMethod === 'azure' ? 'Azure AI Search' : 'Simulated Search'
      acc[method] = (acc[method] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const timeDistribution = filteredQueries.reduce((acc, query) => {
      const date = new Date(query.timestamp)
      const dayKey = date.toLocaleDateString()
      acc[dayKey] = (acc[dayKey] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const topKBs = Object.entries(kbDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)

    const recentTrend = (() => {
      const last7Days = filteredQueries.filter(q => 
        Date.now() - q.timestamp < 7 * 24 * 60 * 60 * 1000
      ).length
      const prev7Days = filteredQueries.filter(q => {
        const age = Date.now() - q.timestamp
        return age >= 7 * 24 * 60 * 60 * 1000 && age < 14 * 24 * 60 * 60 * 1000
      }).length

      if (prev7Days === 0) return 0
      return ((last7Days - prev7Days) / prev7Days) * 100
    })()

    return {
      total,
      azureCount,
      azurePercentage: total > 0 ? (azureCount / total) * 100 : 0,
      avgSourcesPerQuery,
      kbDistribution,
      methodDistribution,
      timeDistribution,
      topKBs,
      recentTrend
    }
  }, [filteredQueries, getKnowledgeBaseName])

  const groupedQueries = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Queries': filteredQueries }
    }

    return filteredQueries.reduce((acc, query) => {
      let key: string
      if (groupBy === 'kb') {
        key = getKnowledgeBaseName(query.knowledgeBaseId)
      } else {
        key = query.searchMethod === 'azure' ? 'Azure AI Search' : 'Simulated Search'
      }

      if (!acc[key]) acc[key] = []
      acc[key].push(query)
      return acc
    }, {} as Record<string, Query[]>)
  }, [filteredQueries, groupBy])

  if (queries.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
          <ChatCircle size={32} className="text-muted-foreground" weight="duotone" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No queries yet</h3>
        <p className="text-sm text-muted-foreground">
          Query history will appear here once you start searching your knowledge bases
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedKB} onValueChange={setSelectedKB}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Knowledge Bases</SelectItem>
            {knowledgeBases.map(kb => (
              <SelectItem key={kb.id} value={kb.id}>{kb.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Grouping</SelectItem>
            <SelectItem value="kb">Group by KB</SelectItem>
            <SelectItem value="method">Group by Method</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" className="gap-2">
            <ChatCircle size={16} />
            Query List
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <ChartBar size={16} />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          {Object.entries(groupedQueries).map(([groupName, groupQueries]) => (
            <div key={groupName}>
              {groupBy !== 'none' && (
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground">
                  {groupName} ({groupQueries.length})
                </h3>
              )}
              <div className="space-y-3">
                {groupQueries.map((query) => (
                  <Card key={query.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <MagnifyingGlass size={16} className="text-muted-foreground" />
                          <span className="font-medium">{query.query}</span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {query.response}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant={query.searchMethod === 'azure' ? 'default' : 'secondary'}>
                          {query.searchMethod === 'azure' ? (
                            <Lightning size={12} weight="fill" className="mr-1" />
                          ) : (
                            <Sparkle size={12} weight="fill" className="mr-1" />
                          )}
                          {query.searchMethod === 'azure' ? 'Azure' : 'Simulated'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(query.timestamp).toLocaleString()}
                      </span>
                      <span>{query.sources.length} sources</span>
                      {groupBy !== 'kb' && (
                        <span className="text-primary">
                          {getKnowledgeBaseName(query.knowledgeBaseId)}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ChatCircle size={20} className="text-primary" weight="duotone" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Queries</p>
                  <p className="text-2xl font-bold">{analytics.total}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Lightning size={20} className="text-accent" weight="duotone" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Azure Searches</p>
                  <p className="text-2xl font-bold">{analytics.azurePercentage.toFixed(0)}%</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <Sparkle size={20} className="text-secondary-foreground" weight="duotone" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Sources</p>
                  <p className="text-2xl font-bold">{analytics.avgSourcesPerQuery}</p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <TrendUp size={20} className="text-primary" weight="duotone" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">7-Day Trend</p>
                  <p className="text-2xl font-bold">
                    {analytics.recentTrend > 0 ? '+' : ''}{analytics.recentTrend.toFixed(0)}%
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ChartBar size={18} weight="duotone" />
              Top Knowledge Bases
            </h3>
            <div className="space-y-3">
              {analytics.topKBs.length > 0 ? (
                analytics.topKBs.map(([kb, count]) => {
                  const percentage = (count / analytics.total) * 100
                  return (
                    <div key={kb} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{kb}</span>
                        <span className="text-muted-foreground">{count} queries</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Lightning size={18} weight="duotone" />
              Search Method Distribution
            </h3>
            <div className="space-y-3">
              {Object.entries(analytics.methodDistribution).map(([method, count]) => {
                const percentage = (count / analytics.total) * 100
                const displayName = method
                return (
                  <div key={method} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{displayName}</span>
                      <span className="text-muted-foreground">{count} queries</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-accent transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock size={18} weight="duotone" />
              Query Timeline
            </h3>
            <ScrollArea className="w-full">
              <div className="flex gap-2 pb-4 min-w-max">
                {Object.entries(analytics.timeDistribution)
                  .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                  .slice(-14)
                  .map(([date, count]) => {
                    const maxCount = Math.max(...Object.values(analytics.timeDistribution))
                    const heightPercentage = (count / maxCount) * 100
                    return (
                      <div key={date} className="flex flex-col items-center gap-2">
                        <div className="w-12 h-32 bg-muted rounded flex items-end p-1">
                          <div 
                            className="w-full bg-primary rounded transition-all"
                            style={{ height: `${heightPercentage}%`, minHeight: '4px' }}
                          >
                            <div className="text-xs text-primary-foreground text-center pt-1 font-medium">
                              {count}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
