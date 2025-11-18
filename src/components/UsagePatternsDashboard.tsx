import { useMemo } from 'react'
import { Query } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatDate } from '@/lib/helpers'
import { 
  TrendUp, 
  Clock, 
  ChartLine, 
  Brain,
  Target,
  Lightbulb,
  Warning,
  CheckCircle,
  Calendar
} from '@phosphor-icons/react'

interface UsagePatternsDashboardProps {
  queries: Query[]
  knowledgeBases: Array<{ id: string; name: string }>
}

interface Pattern {
  id: string
  type: 'trend' | 'peak' | 'anomaly' | 'insight'
  title: string
  description: string
  impact: 'high' | 'medium' | 'low'
  data: Record<string, any>
}

export function UsagePatternsDashboard({ queries, knowledgeBases }: UsagePatternsDashboardProps) {
  const patterns = useMemo((): Pattern[] => {
    if (queries.length < 5) {
      return []
    }
    
    const detected: Pattern[] = []
    
    const hourDistribution = queries.reduce((acc, q) => {
      const hour = new Date(q.timestamp).getHours()
      acc[hour] = (acc[hour] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    
    const peakHours = Object.entries(hourDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
    
    if (peakHours.length > 0 && peakHours[0][1] > queries.length * 0.15) {
      const topHour = parseInt(peakHours[0][0])
      const timeLabel = topHour === 0 ? '12 AM' : 
                       topHour < 12 ? `${topHour} AM` : 
                       topHour === 12 ? '12 PM' : 
                       `${topHour - 12} PM`
      
      detected.push({
        id: 'peak-hours',
        type: 'peak',
        title: `Peak Usage: ${timeLabel}`,
        description: `${((peakHours[0][1] / queries.length) * 100).toFixed(0)}% of queries occur around ${timeLabel}. Consider optimizing system resources during this time.`,
        impact: 'high',
        data: {
          hour: topHour,
          count: peakHours[0][1],
          percentage: (peakHours[0][1] / queries.length) * 100,
          distribution: hourDistribution
        }
      })
    }
    
    const dayDistribution = queries.reduce((acc, q) => {
      const day = new Date(q.timestamp).getDay()
      acc[day] = (acc[day] || 0) + 1
      return acc
    }, {} as Record<number, number>)
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const peakDays = Object.entries(dayDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
    
    if (peakDays.length > 0) {
      detected.push({
        id: 'peak-days',
        type: 'trend',
        title: `Most Active: ${dayNames[parseInt(peakDays[0][0])]}`,
        description: `${dayNames[parseInt(peakDays[0][0])]} sees the highest query volume with ${peakDays[0][1]} queries. ${peakDays.length > 1 ? `${dayNames[parseInt(peakDays[1][0])]} is second with ${peakDays[1][1]} queries.` : ''}`,
        impact: 'medium',
        data: {
          topDay: parseInt(peakDays[0][0]),
          topDayName: dayNames[parseInt(peakDays[0][0])],
          count: peakDays[0][1],
          distribution: dayDistribution
        }
      })
    }
    
    const kbUsage = queries.reduce((acc, q) => {
      acc[q.knowledgeBaseId] = (acc[q.knowledgeBaseId] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const topKB = Object.entries(kbUsage).sort(([, a], [, b]) => b - a)[0]
    if (topKB && topKB[1] > queries.length * 0.5) {
      const kbName = knowledgeBases.find(kb => kb.id === topKB[0])?.name || 'Unknown'
      detected.push({
        id: 'dominant-kb',
        type: 'insight',
        title: `Dominant Knowledge Base: ${kbName}`,
        description: `${((topKB[1] / queries.length) * 100).toFixed(0)}% of all queries target "${kbName}". Consider creating specialized query templates or quick actions for common questions.`,
        impact: 'high',
        data: {
          kbId: topKB[0],
          kbName,
          count: topKB[1],
          percentage: (topKB[1] / queries.length) * 100
        }
      })
    }
    
    const azureQueries = queries.filter(q => q.searchMethod === 'azure')
    if (azureQueries.length > 0 && azureQueries.length < queries.length * 0.3) {
      detected.push({
        id: 'underutilized-azure',
        type: 'insight',
        title: 'Azure AI Search Underutilized',
        description: `Only ${((azureQueries.length / queries.length) * 100).toFixed(0)}% of queries use Azure AI Search. Consider enabling it for more knowledge bases to improve search quality.`,
        impact: 'medium',
        data: {
          azureCount: azureQueries.length,
          totalCount: queries.length,
          percentage: (azureQueries.length / queries.length) * 100
        }
      })
    }
    
    const avgSourcesPerQuery = queries.reduce((sum, q) => sum + q.sources.length, 0) / queries.length
    if (avgSourcesPerQuery < 2) {
      detected.push({
        id: 'low-sources',
        type: 'anomaly',
        title: 'Low Source Diversity',
        description: `Queries average only ${avgSourcesPerQuery.toFixed(1)} sources. This may indicate narrow retrieval or insufficient document diversity in your knowledge bases.`,
        impact: 'medium',
        data: {
          avgSources: avgSourcesPerQuery,
          queriesWithNoSources: queries.filter(q => q.sources.length === 0).length
        }
      })
    }
    
    const recentQueries = queries.filter(q => Date.now() - q.timestamp < 7 * 24 * 60 * 60 * 1000)
    const olderQueries = queries.filter(q => {
      const age = Date.now() - q.timestamp
      return age >= 7 * 24 * 60 * 60 * 1000 && age < 14 * 24 * 60 * 60 * 1000
    })
    
    if (recentQueries.length > 0 && olderQueries.length > 0) {
      const growth = ((recentQueries.length - olderQueries.length) / olderQueries.length) * 100
      if (Math.abs(growth) > 20) {
        detected.push({
          id: 'usage-trend',
          type: growth > 0 ? 'trend' : 'anomaly',
          title: growth > 0 ? 'Usage Growing' : 'Usage Declining',
          description: `Query volume ${growth > 0 ? 'increased' : 'decreased'} by ${Math.abs(growth).toFixed(0)}% compared to the previous week. ${growth > 0 ? 'Consider scaling resources.' : 'Investigate potential issues or changes in user behavior.'}`,
          impact: 'high',
          data: {
            recentCount: recentQueries.length,
            previousCount: olderQueries.length,
            growthPercentage: growth
          }
        })
      }
    }
    
    const uniqueDays = new Set(queries.map(q => new Date(q.timestamp).toDateString())).size
    const avgQueriesPerDay = queries.length / Math.max(uniqueDays, 1)
    
    if (avgQueriesPerDay > 10) {
      detected.push({
        id: 'high-activity',
        type: 'insight',
        title: 'High Activity Level',
        description: `Your system averages ${avgQueriesPerDay.toFixed(1)} queries per day. This indicates strong user engagement and knowledge base utilization.`,
        impact: 'low',
        data: {
          avgQueriesPerDay,
          uniqueDays,
          totalQueries: queries.length
        }
      })
    }
    
    return detected
  }, [queries, knowledgeBases])
  
  const timeSeriesData = useMemo(() => {
    const dailyData: Record<string, { date: string; count: number; azureCount: number }> = {}
    
    queries.forEach(q => {
      const date = new Date(q.timestamp).toLocaleDateString()
      if (!dailyData[date]) {
        dailyData[date] = { date, count: 0, azureCount: 0 }
      }
      dailyData[date].count++
      if (q.searchMethod === 'azure') {
        dailyData[date].azureCount++
      }
    })
    
    return Object.values(dailyData).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    ).slice(-30)
  }, [queries])
  
  const hourlyHeatmap = useMemo(() => {
    const heatmap: Record<number, Record<number, number>> = {}
    
    queries.forEach(q => {
      const date = new Date(q.timestamp)
      const day = date.getDay()
      const hour = date.getHours()
      
      if (!heatmap[day]) heatmap[day] = {}
      heatmap[day][hour] = (heatmap[day][hour] || 0) + 1
    })
    
    return heatmap
  }, [queries])
  
  const getPatternIcon = (type: Pattern['type']) => {
    switch (type) {
      case 'trend':
        return <TrendUp size={18} weight="duotone" />
      case 'peak':
        return <ChartLine size={18} weight="duotone" />
      case 'anomaly':
        return <Warning size={18} weight="duotone" />
      case 'insight':
        return <Lightbulb size={18} weight="duotone" />
    }
  }
  
  const getImpactColor = (impact: Pattern['impact']) => {
    switch (impact) {
      case 'high':
        return 'border-red-500/50 bg-red-500/5'
      case 'medium':
        return 'border-yellow-500/50 bg-yellow-500/5'
      case 'low':
        return 'border-green-500/50 bg-green-500/5'
    }
  }
  
  if (queries.length < 5) {
    return (
      <Card className="p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
          <Brain size={32} className="text-muted-foreground" weight="duotone" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Not enough data yet</h3>
        <p className="text-sm text-muted-foreground">
          Usage patterns will appear once you have at least 5 queries
        </p>
      </Card>
    )
  }
  
  return (
    <div className="space-y-6">
      <Tabs defaultValue="patterns" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="patterns" className="gap-2">
            <Target size={16} />
            Patterns
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-2">
            <Calendar size={16} />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="gap-2">
            <Clock size={16} />
            Heatmap
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="patterns" className="space-y-4 mt-4">
          {patterns.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle size={48} className="mx-auto mb-4 text-green-500" weight="duotone" />
              <h3 className="font-semibold mb-2">No significant patterns detected</h3>
              <p className="text-sm text-muted-foreground">
                Your usage appears balanced. Keep monitoring as you accumulate more data.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {patterns.map(pattern => (
                <Card key={pattern.id} className={`p-4 border-2 ${getImpactColor(pattern.impact)}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {getPatternIcon(pattern.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-sm">{pattern.title}</h3>
                        <Badge variant="outline" className="text-xs">
                          {pattern.impact}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {pattern.description}
                      </p>
                      {pattern.type === 'peak' && pattern.data.distribution && (
                        <div className="flex gap-1 h-12 items-end">
                          {Array.from({ length: 24 }, (_, i) => {
                            const count = pattern.data.distribution[i] || 0
                            const max = Math.max(...Object.values(pattern.data.distribution as Record<string, number>))
                            const height = (count / max) * 100
                            return (
                              <div
                                key={i}
                                className="flex-1 bg-primary/20 rounded-t"
                                style={{ height: `${height}%`, minHeight: count > 0 ? '2px' : '0' }}
                                title={`${i}:00 - ${count} queries`}
                              />
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="timeline" className="space-y-4 mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ChartLine size={18} weight="duotone" />
              Query Volume Over Time
            </h3>
            <ScrollArea className="w-full">
              <div className="min-w-max pb-4">
                <div className="flex gap-3 items-end h-64">
                  {timeSeriesData.map((day, index) => {
                    const maxCount = Math.max(...timeSeriesData.map(d => d.count))
                    const heightPercentage = (day.count / maxCount) * 100
                    const azurePercentage = day.count > 0 ? (day.azureCount / day.count) * 100 : 0
                    
                    return (
                      <div key={index} className="flex flex-col items-center gap-2 group">
                        <div className="flex flex-col justify-end h-56 relative">
                          <div 
                            className="w-12 bg-primary rounded-t-md transition-all cursor-pointer relative overflow-hidden"
                            style={{ height: `${heightPercentage}%`, minHeight: '4px' }}
                          >
                            {day.azureCount > 0 && (
                              <div 
                                className="absolute bottom-0 left-0 right-0 bg-accent"
                                style={{ height: `${azurePercentage}%` }}
                              />
                            )}
                            <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-popover border rounded-lg p-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                              <div className="font-semibold mb-1">{day.date}</div>
                              <div>Total: {day.count}</div>
                              {day.azureCount > 0 && <div className="text-accent">Azure: {day.azureCount}</div>}
                            </div>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground -rotate-45 origin-top-left whitespace-nowrap">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </ScrollArea>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-primary" />
                <span>Total Queries</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-accent" />
                <span>Azure AI Search</span>
              </div>
            </div>
          </Card>
        </TabsContent>
        
        <TabsContent value="heatmap" className="space-y-4 mt-4">
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Clock size={18} weight="duotone" />
              Activity Heatmap (Day × Hour)
            </h3>
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="flex gap-2 mb-2 ml-20">
                  {Array.from({ length: 24 }, (_, i) => (
                    <div key={i} className="w-6 text-xs text-center text-muted-foreground">
                      {i}
                    </div>
                  ))}
                </div>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIndex) => {
                  const maxValue = Math.max(
                    ...Object.values(hourlyHeatmap).flatMap(hours => Object.values(hours))
                  )
                  
                  return (
                    <div key={dayIndex} className="flex gap-2 items-center mb-2">
                      <div className="w-16 text-xs text-right text-muted-foreground">{day}</div>
                      {Array.from({ length: 24 }, (_, hourIndex) => {
                        const value = hourlyHeatmap[dayIndex]?.[hourIndex] || 0
                        const intensity = maxValue > 0 ? value / maxValue : 0
                        const opacity = 0.1 + intensity * 0.9
                        
                        return (
                          <div
                            key={hourIndex}
                            className="w-6 h-6 rounded transition-all cursor-pointer group relative"
                            style={{ 
                              backgroundColor: value > 0 ? `rgba(var(--color-primary), ${opacity})` : 'rgb(var(--color-muted))' 
                            }}
                            title={`${day} ${hourIndex}:00 - ${value} queries`}
                          >
                            {value > 0 && (
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover border rounded px-2 py-1 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                {value}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
                <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
                  <span>Less</span>
                  <div className="flex gap-1">
                    {[0.2, 0.4, 0.6, 0.8, 1.0].map((opacity, i) => (
                      <div 
                        key={i}
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: `rgba(var(--color-primary), ${opacity})` }}
                      />
                    ))}
                  </div>
                  <span>More</span>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
