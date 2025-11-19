import { useEffect, useRef, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  ArrowRight, 
  Circle,
  FlowArrow,
  TreeStructure,
  Minus,
  Plus,
  GitBranch
} from '@phosphor-icons/react'
import * as d3 from 'd3'

export type QueryNode = {
  id: string
  query: string
  type: 'original' | 'reformulation' | 'subquery' | 'expansion' | 'simplification'
  iteration?: number
  confidence?: number
  reasoning?: string
  timestamp: number
}

export type QueryLink = {
  source: string
  target: string
  type: 'decomposed' | 'expanded' | 'simplified' | 'refined' | 'fallback'
  reasoning?: string
}

export type QueryReformulationData = {
  nodes: QueryNode[]
  links: QueryLink[]
}

interface QueryReformulationGraphProps {
  data: QueryReformulationData
  onNodeClick?: (node: QueryNode) => void
}

type D3Node = d3.SimulationNodeDatum & QueryNode
type D3Link = d3.SimulationLinkDatum<D3Node> & QueryLink

export function QueryReformulationGraph({ data, onNodeClick }: QueryReformulationGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<QueryNode | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({
          width: Math.max(rect.width, 400),
          height: Math.max(rect.height, 400)
        })
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  useEffect(() => {
    if (!svgRef.current || !data.nodes.length) return

    const width = dimensions.width
    const height = dimensions.height

    d3.select(svgRef.current).selectAll('*').remove()

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height])

    const g = svg.append('g')

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        setZoomLevel(event.transform.k)
      })

    svg.call(zoom)

    const nodes: D3Node[] = data.nodes.map(d => ({ ...d }))
    const links: D3Link[] = data.links.map(d => ({ 
      ...d,
      source: d.source,
      target: d.target
    }))

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink<D3Node, D3Link>(links)
        .id(d => d.id)
        .distance(d => {
          if (d.type === 'decomposed') return 150
          if (d.type === 'expanded' || d.type === 'simplified') return 100
          return 120
        })
      )
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(60))

    const defs = g.append('defs')

    const arrowMarker = defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')

    arrowMarker.append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'oklch(0.58 0.15 65)')

    const linkTypeColors: Record<string, string> = {
      decomposed: 'oklch(0.58 0.15 65)',
      expanded: 'oklch(0.78 0.12 45)',
      simplified: 'oklch(0.68 0.10 85)',
      refined: 'oklch(0.48 0.12 25)',
      fallback: 'oklch(0.62 0.18 35)'
    }

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => linkTypeColors[d.type] || 'oklch(0.80 0.05 75)')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrowhead)')

    const linkLabel = g.append('g')
      .selectAll('text')
      .data(links)
      .join('text')
      .attr('font-size', 10)
      .attr('fill', 'oklch(0.48 0.02 55)')
      .attr('text-anchor', 'middle')
      .attr('dy', -5)
      .text(d => d.type)

    const nodeTypeColors: Record<string, string> = {
      original: 'oklch(0.58 0.15 65)',
      reformulation: 'oklch(0.78 0.12 45)',
      subquery: 'oklch(0.68 0.10 85)',
      expansion: 'oklch(0.85 0.08 85)',
      simplification: 'oklch(0.88 0.08 95)'
    }

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, D3Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        })
      )

    node.append('circle')
      .attr('r', d => d.type === 'original' ? 25 : 20)
      .attr('fill', d => nodeTypeColors[d.type] || 'oklch(0.80 0.05 75)')
      .attr('stroke', 'oklch(1.00 0 0)')
      .attr('stroke-width', 2)
      .attr('opacity', 0.9)

    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 50)
      .attr('font-size', 11)
      .attr('font-weight', 500)
      .attr('fill', 'oklch(0.22 0.04 55)')
      .each(function(d) {
        const text = d3.select(this)
        const words = d.query.split(' ')
        const maxWidth = 120
        let line: string[] = []
        let lineNumber = 0
        const lineHeight = 1.1

        words.forEach((word, i) => {
          line.push(word)
          const testLine = line.join(' ')
          
          if (testLine.length > 20 || i === words.length - 1) {
            text.append('tspan')
              .attr('x', 0)
              .attr('dy', lineNumber === 0 ? 0 : lineHeight + 'em')
              .text(testLine.length > 25 ? testLine.substring(0, 22) + '...' : testLine)
            line = []
            lineNumber++
            
            if (lineNumber >= 2) return
          }
        })
      })

    if (nodes.some(n => n.confidence !== undefined)) {
      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', -30)
        .attr('font-size', 9)
        .attr('fill', 'oklch(0.48 0.02 55)')
        .text(d => d.confidence !== undefined ? `${(d.confidence * 100).toFixed(0)}%` : '')
    }

    node.on('click', (event, d) => {
      setSelectedNode(d)
      if (onNodeClick) {
        onNodeClick(d)
      }
    })

    node.on('mouseenter', function(event, d) {
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', d.type === 'original' ? 28 : 23)
        .attr('opacity', 1)
    })

    node.on('mouseleave', function(event, d) {
      d3.select(this).select('circle')
        .transition()
        .duration(200)
        .attr('r', d.type === 'original' ? 25 : 20)
        .attr('opacity', 0.9)
    })

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as D3Node).x || 0)
        .attr('y1', d => (d.source as D3Node).y || 0)
        .attr('x2', d => (d.target as D3Node).x || 0)
        .attr('y2', d => (d.target as D3Node).y || 0)

      linkLabel
        .attr('x', d => ((d.source as D3Node).x! + (d.target as D3Node).x!) / 2)
        .attr('y', d => ((d.source as D3Node).y! + (d.target as D3Node).y!) / 2)

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    return () => {
      simulation.stop()
    }
  }, [data, dimensions, onNodeClick])

  const handleZoomIn = () => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
      1.3
    )
  }

  const handleZoomOut = () => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().scaleBy as any,
      0.7
    )
  }

  const handleReset = () => {
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    )
  }

  const getNodeTypeInfo = (type: QueryNode['type']) => {
    const info = {
      original: { label: 'Original Query', icon: Circle, color: 'oklch(0.58 0.15 65)' },
      reformulation: { label: 'Reformulation', icon: FlowArrow, color: 'oklch(0.78 0.12 45)' },
      subquery: { label: 'Sub-query', icon: GitBranch, color: 'oklch(0.68 0.10 85)' },
      expansion: { label: 'Expansion', icon: Plus, color: 'oklch(0.85 0.08 85)' },
      simplification: { label: 'Simplification', icon: Minus, color: 'oklch(0.88 0.08 95)' }
    }
    return info[type] || info.original
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TreeStructure size={20} weight="duotone" className="text-primary" />
          <h3 className="text-sm font-semibold">Query Reformulation Graph</h3>
          <Badge variant="secondary" className="text-xs">
            {data.nodes.length} {data.nodes.length === 1 ? 'node' : 'nodes'}
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            className="h-7 px-2"
          >
            <Minus size={14} />
          </Button>
          <span className="text-xs text-muted-foreground px-2 min-w-[60px] text-center">
            {(zoomLevel * 100).toFixed(0)}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            className="h-7 px-2"
          >
            <Plus size={14} />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-7 px-3 ml-1 text-xs"
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card className="p-4 bg-muted/30" ref={containerRef} style={{ minHeight: '500px' }}>
            {data.nodes.length === 0 ? (
              <div className="flex items-center justify-center h-[500px] text-center">
                <div className="space-y-2">
                  <TreeStructure size={48} weight="duotone" className="mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No query reformulations yet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Perform an agentic query to see the reformulation graph
                  </p>
                </div>
              </div>
            ) : (
              <svg ref={svgRef} className="w-full" style={{ minHeight: '500px' }} />
            )}
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-3">
          <Card className="p-3">
            <h4 className="text-xs font-semibold mb-3">Legend</h4>
            <div className="space-y-2">
              {(['original', 'reformulation', 'subquery', 'expansion', 'simplification'] as const).map(type => {
                const info = getNodeTypeInfo(type)
                const Icon = info.icon
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: info.color }}
                    />
                    <span className="text-xs text-muted-foreground">{info.label}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-3">
            <h4 className="text-xs font-semibold mb-3">Link Types</h4>
            <div className="space-y-2">
              {[
                { type: 'decomposed', label: 'Decomposed', color: 'oklch(0.58 0.15 65)' },
                { type: 'expanded', label: 'Expanded', color: 'oklch(0.78 0.12 45)' },
                { type: 'simplified', label: 'Simplified', color: 'oklch(0.68 0.10 85)' },
                { type: 'refined', label: 'Refined', color: 'oklch(0.48 0.12 25)' },
                { type: 'fallback', label: 'Fallback', color: 'oklch(0.62 0.18 35)' }
              ].map(({ type, label, color }) => (
                <div key={type} className="flex items-center gap-2">
                  <ArrowRight size={12} style={{ color }} className="flex-shrink-0" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </Card>

          {selectedNode && (
            <Card className="p-3 border-primary">
              <h4 className="text-xs font-semibold mb-2">Selected Node</h4>
              <div className="space-y-2">
                <div>
                  <Badge variant="secondary" className="text-xs mb-1">
                    {getNodeTypeInfo(selectedNode.type).label}
                  </Badge>
                  <p className="text-xs break-words">{selectedNode.query}</p>
                </div>
                {selectedNode.confidence !== undefined && (
                  <div>
                    <span className="text-xs text-muted-foreground">Confidence: </span>
                    <span className="text-xs font-medium">
                      {(selectedNode.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
                {selectedNode.iteration !== undefined && (
                  <div>
                    <span className="text-xs text-muted-foreground">Iteration: </span>
                    <span className="text-xs font-medium">{selectedNode.iteration}</span>
                  </div>
                )}
                {selectedNode.reasoning && (
                  <div>
                    <span className="text-xs text-muted-foreground block mb-1">Reasoning:</span>
                    <p className="text-xs break-words">{selectedNode.reasoning}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {data.nodes.length > 0 && (
            <Card className="p-3 bg-muted/50">
              <h4 className="text-xs font-semibold mb-2">Graph Stats</h4>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Total Nodes:</span>
                  <span className="font-medium">{data.nodes.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Links:</span>
                  <span className="font-medium">{data.links.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Iterations:</span>
                  <span className="font-medium">
                    {Math.max(...data.nodes.map(n => n.iteration || 0))}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
        <p className="font-medium mb-1">💡 Interaction Tips:</p>
        <ul className="space-y-0.5 ml-4 list-disc">
          <li>Click and drag nodes to reposition them</li>
          <li>Use mouse wheel or zoom controls to adjust view</li>
          <li>Click on nodes to see detailed information</li>
          <li>Hover over nodes for visual emphasis</li>
        </ul>
      </div>
    </div>
  )
}
