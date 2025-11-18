import { useState, useMemo } from 'react'
import { Query } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChatCircle, Sparkle, ChartBar, TrendUp, Clock, 
interface QueryHistoryProps {
  knowledgeBases: Array<{ id: string; name: string }>

import { ChatCircle, Sparkle, ChartBar, TrendUp, Clock, Lightning, MagnifyingGlass } from '@phosphor-icons/react'

interface QueryHistoryProps {
  queries: Query[]
  knowledgeBases: Array<{ id: string; name: string }>
}

type TimeRange = 'all' | 'today' | 'week' | 'month'
    }

    if (selectedKB !== 'all') {
    }
    return filtered.sort((a, b) => b.timestamp - a.timest
  
  
    const avgSourcesPerQuery = total > 0 
      : 0
    
      acc[kbName] = (acc[k
    }, {} as Record<
    const methodDistribution = fi
      acc[method] = (acc[method] || 
    }, {} as Record<string, number>)
    const timeDistr
    }
    
    
    
    if (selectedKB !== 'all') {
      const last7Days = filteredQueries.filter(q => 
    }
    
      }).length
      if (prev7Days === 0) return 0
  
    return {
      azureCount,
      avgSourcesPerQuery,
    const avgSourcesPerQuery = total > 0 
      topKBs,
      : 0
    
    const kb = knowledgeBases.find(k => k.id === kbId)
  }
  const groupedQueries = useMemo(() => {
      return { '
    }, {} as Record<string, number>)
    
        key = getKnowledgeBaseName(query.knowledgeBaseId)
        key = query.searchMethod === 'azure' ? 'Az
      
      acc[key].p
    }, {} as Record<string, Query[]>
  
    return (
        <div className="w-16 h-16 rounde
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
  }, [filteredQueries])
  
  const getKnowledgeBaseName = (kbId: string) => {
    const kb = knowledgeBases.find(k => k.id === kbId)
    return kb?.name || 'Unknown'
  }
  
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
        </Tabs
        <TabsContent value="analytics" className="space-y-4 mt-4">
            <Card className="p-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items
            
             
     
   
  
          
                </div>
                  <p className="text-2xl font-bold">{a
                </div>
            </Card>
            <Card className="p-4">
                <div clas
                </div>
                  <p className="text-2xl font-bold">{analyt
                </div>
            </Card>
            <Card classN
                <di
        
                </div>
                  <p className="text-2xl font-bo
                </div>
            </Card>
          
            <Card className="p
                <ChartBar siz
              </h3>
                {analytics.topKBs.length > 0 ? (
                    const percentage = (count / analytics.total
                      <div key={kb} className="space-y-1">
                          <spa
                     
            
                            style={{ width: `${percentage}%` }}
                        </div>
                    )
                ) : (
                )}
            </Card>
            <Card className="p-4">
                <Lightning size={18} weight="duotone" />
              </h3>
                {Object.entrie
                  con
            
                        <span className="font-medium">{displayName}</span>
                      </div>
                        <div 
                            me
                          sty
                      </div>
                  )
              </div>
          </div>
          <Card class
              <C
          
              <div className="flex gap-2 pb-4 min-w-max">
                  .sort(([a], [b]) => new Date(a).getTime() - new Date(b
                
          
                      <div key={date} classN
                          <div 
                            style={{ height: `${heightPercentage}%`, minHeight: '4
                            <div clas
                            </div>
                        </div>
                          {new Da
                      </div>
                  })}
            </Scroll
        </TabsCont
    </div>
}




















































        <TabsContent value="analytics" className="space-y-4 mt-4">

            <Card className="p-4">










            




                </div>



                </div>

            </Card>

            <Card className="p-4">



                </div>



                </div>

            </Card>







                </div>



                </div>

            </Card>

          





              </h3>

                {analytics.topKBs.length > 0 ? (



                      <div key={kb} className="space-y-1">







                            style={{ width: `${percentage}%` }}

                        </div>

                    )

                ) : (

                )}

            </Card>

            <Card className="p-4">

                <Lightning size={18} weight="duotone" />

              </h3>







                        <span className="font-medium">{displayName}</span>

                      </div>

                        <div 





                      </div>

                  )

              </div>

          </div>
          






              <div className="flex gap-2 pb-4 min-w-max">









                          <div 





                            </div>

                        </div>



                      </div>

                  })}





    </div>

}
