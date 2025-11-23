import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UnifiedQueryTracker, UnifiedQueryRecord, UnifiedQueryMethod } from '@/lib/unified-query-model'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DownloadSimple } from '@phosphor-icons/react'

interface Props {
  knowledgeBaseId?: string
  knowledgeBases?: Array<{ id: string; name: string }>
  onGenerateSamples?: () => void
}

type TimeFilter = 'all' | '7d' | '30d'

export function UnifiedAnalyticsDashboard({ knowledgeBaseId, knowledgeBases = [], onGenerateSamples }: Props) {
  const [tracker] = useState(() => new UnifiedQueryTracker())
  const [history, setHistory] = useState<UnifiedQueryRecord[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [method, setMethod] = useState<'all' | UnifiedQueryMethod>('all')
  const [timeRange, setTimeRange] = useState<TimeFilter>('all')
  const [selectedKB, setSelectedKB] = useState<string>(knowledgeBaseId || 'all')

  useEffect(() => {
    const load = async () => {
      const filter: any = {}
      if (selectedKB !== 'all') filter.knowledgeBaseId = selectedKB
      if (method !== 'all') filter.method = method

      const now = Date.now()
      if (timeRange === '7d') filter.startDate = now - 7 * 86400000
      if (timeRange === '30d') filter.startDate = now - 30 * 86400000

      const hist = await tracker.getHistory(filter)
      setHistory(hist.slice().reverse())
      const analytics = await tracker.getAnalytics(knowledgeBaseId)
      setSummary(analytics)
    }

    load()
    setSelectedKB(knowledgeBaseId || 'all')
  }, [knowledgeBaseId])

  useEffect(() => {
    const load = async () => {
      const filter: any = {}
      if (selectedKB !== 'all') filter.knowledgeBaseId = selectedKB
      if (method !== 'all') filter.method = method

      const now = Date.now()
      if (timeRange === '7d') filter.startDate = now - 7 * 86400000
      if (timeRange === '30d') filter.startDate = now - 30 * 86400000

      const hist = await tracker.getHistory(filter)
      setHistory(hist.slice().reverse())
      const analytics = await tracker.getAnalytics(selectedKB === 'all' ? undefined : selectedKB)
      setSummary(analytics)
    }

    load()
  }, [selectedKB, method, timeRange, tracker])

  const exportData = (format: 'csv' | 'json') => {
    if (!history.length) return

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `analytics-${Date.now()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      return
    }

    const headers = ['id', 'timestamp', 'knowledgeBaseId', 'method', 'query', 'confidence', 'userFeedback', 'timeMs']
    const rows = history.map((item) => headers.map((key) => {
      const value = (item as any)[key]
      if (value === undefined || value === null) return ''
      if (key === 'timestamp') return new Date(value).toISOString()
      return String(value).replace(/"/g, '""')
    }).join(','))

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `analytics-${Date.now()}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  if (!summary) {
    return (
      <Card className="p-4">Loading analytics...</Card>
    )
  }

  if (history.length === 0) {
    return (
      <Card className="p-6 text-center space-y-3">
        <h3 className="text-lg font-semibold">No analytics yet</h3>
        <p className="text-sm text-muted-foreground">Run a few queries to populate the unified analytics dashboard.</p>
        {onGenerateSamples && (
          <Button size="sm" onClick={onGenerateSamples}>
            Generate sample queries
          </Button>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">Unified Query Analytics</h3>
          <p className="text-sm text-muted-foreground">Combined view across standard, Azure, and agentic queries</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedKB} onValueChange={setSelectedKB}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="All knowledge bases" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All knowledge bases</SelectItem>
              {knowledgeBases.map(kb => (
                <SelectItem key={kb.id} value={kb.id}>{kb.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeFilter)}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={(v) => setMethod(v as any)}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="standard">Standard</SelectItem>
              <SelectItem value="azure">Azure</SelectItem>
              <SelectItem value="agentic">Agentic</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => exportData('csv')}>
            <DownloadSimple size={14} /> CSV
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => exportData('json')}>
            <DownloadSimple size={14} /> JSON
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Total Queries</div>
          <div className="text-2xl font-bold">{summary.totalQueries}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Success Rate</div>
          <div className="text-2xl font-bold">{summary.successRate.toFixed(1)}%</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Avg Confidence</div>
          <div className="text-2xl font-bold">{(summary.agenticMetrics.averageConfidence * 100).toFixed(0)}%</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">Avg Time</div>
          <div className="text-2xl font-bold">{summary.agenticMetrics.averageTimeMs.toFixed(0)} ms</div>
        </Card>
      </div>

      <Card className="p-4">
        <h4 className="font-semibold mb-3">Feedback</h4>
        <div className="flex gap-2 flex-wrap text-sm">
          {(['positive', 'neutral', 'negative'] as const).map((key) => (
            <Badge key={key} variant="outline" className="text-xs gap-1">
              <span className="capitalize">{key}</span>
              <span className="font-semibold">{summary.feedbackBreakdown[key]}</span>
            </Badge>
          ))}
          <Badge variant="secondary" className="text-xs gap-1">
            Success Rate
            <span className="font-semibold">{summary.successRate.toFixed(1)}%</span>
          </Badge>
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="font-semibold mb-3">Method Breakdown</h4>
        <div className="flex gap-2 flex-wrap text-sm">
          {Object.entries(summary.methodBreakdown).map(([key, value]) => (
            <Badge key={key} variant="outline" className="text-xs gap-1">
              <span className="capitalize">{key}</span>
              <span className="font-semibold">{value as number}</span>
            </Badge>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="font-semibold mb-3">Recent Queries</h4>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {history.slice(0, 30).map((q) => (
            <div key={q.id} className="p-3 rounded-lg border">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{q.query}</div>
                  <div className="flex gap-2 items-center mt-1 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px] capitalize">{q.method}</Badge>
                    {q.confidence !== undefined && (
                      <span>{Math.round(q.confidence * 100)}% conf</span>
                    )}
                    {q.userFeedback && <Badge variant="outline" className="text-[10px]">{q.userFeedback}</Badge>}
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {new Date(q.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
          {history.length === 0 && (
            <div className="text-sm text-muted-foreground">No queries yet.</div>
          )}
        </div>
      </Card>
    </div>
  )
}
