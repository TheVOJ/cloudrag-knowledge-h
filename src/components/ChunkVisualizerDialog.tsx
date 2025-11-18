import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Document as DocType } from '@/lib/types'
import { Chunk, CHUNKING_STRATEGIES, chunkAndEmbed, reduceDimensionsFor2D, cosineSimilarity } from '@/lib/chunking'
import { Sparkle, ChartScatter, ListNumbers } from '@phosphor-icons/react'

interface ChunkVisualizerDialogProps {
  document: DocType | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChunkVisualizerDialog({ document, open, onOpenChange }: ChunkVisualizerDialogProps) {
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [strategy, setStrategy] = useState<keyof typeof CHUNKING_STRATEGIES>('semantic')
  const [loading, setLoading] = useState(false)
  const [selectedChunk, setSelectedChunk] = useState<string | null>(null)

  useEffect(() => {
    if (open && document) {
      loadChunks()
    }
  }, [open, document, strategy])

  const loadChunks = async () => {
    if (!document) return

    setLoading(true)
    try {
      const result = await chunkAndEmbed(document.content, strategy)
      setChunks(result)
      setSelectedChunk(result[0]?.id || null)
    } catch (error) {
      console.error('Failed to chunk document:', error)
    } finally {
      setLoading(false)
    }
  }

  const embeddings2D = chunks.length > 0 && chunks[0].embedding
    ? reduceDimensionsFor2D(chunks.map((c) => c.embedding!))
    : []

  const getSimilarityColor = (similarity: number): string => {
    if (similarity > 0.8) return 'bg-green-500'
    if (similarity > 0.6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const calculateSimilarities = () => {
    const selected = chunks.find((c) => c.id === selectedChunk)
    if (!selected?.embedding) return []

    return chunks
      .filter((c) => c.id !== selectedChunk && c.embedding)
      .map((chunk) => ({
        chunk,
        similarity: cosineSimilarity(selected.embedding!, chunk.embedding!),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkle size={24} weight="duotone" className="text-primary" />
            Document Chunking & Embeddings
          </DialogTitle>
        </DialogHeader>

        {document && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold">{document.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {chunks.length} chunks • {document.content.length.toLocaleString()} characters
                </p>
              </div>

              <Select value={strategy} onValueChange={(v) => setStrategy(v as keyof typeof CHUNKING_STRATEGIES)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHUNKING_STRATEGIES).map(([key, strat]) => (
                    <SelectItem key={key} value={key}>
                      {strat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="chunks" className="flex-1 flex flex-col overflow-hidden">
              <TabsList>
                <TabsTrigger value="chunks" className="gap-2">
                  <ListNumbers size={16} />
                  Chunks
                </TabsTrigger>
                <TabsTrigger value="visualization" className="gap-2">
                  <ChartScatter size={16} />
                  Embedding Space
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chunks" className="flex-1 overflow-auto">
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chunks.map((chunk, index) => (
                      <Card
                        key={chunk.id}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedChunk === chunk.id ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                        }`}
                        onClick={() => setSelectedChunk(chunk.id)}
                      >
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">Chunk {index + 1}</Badge>
                            <span className="text-sm text-muted-foreground">{chunk.tokens} tokens</span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {chunk.startIndex} - {chunk.endIndex}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-3">{chunk.text}</p>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="visualization" className="flex-1 overflow-auto">
                {loading ? (
                  <Skeleton className="w-full h-96" />
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                    <Card className="p-4">
                      <h4 className="font-semibold mb-4">Embedding Space (2D Projection)</h4>
                      <div className="relative w-full h-96 bg-muted/30 rounded-lg border">
                        {embeddings2D.map((point, index) => {
                          const chunk = chunks[index]
                          const isSelected = chunk.id === selectedChunk
                          return (
                            <div
                              key={chunk.id}
                              className={`absolute w-3 h-3 rounded-full cursor-pointer transition-all ${
                                isSelected ? 'w-4 h-4 bg-primary ring-4 ring-primary/30' : 'bg-secondary hover:bg-primary'
                              }`}
                              style={{
                                left: `${point.x}%`,
                                top: `${point.y}%`,
                                transform: 'translate(-50%, -50%)',
                              }}
                              onClick={() => setSelectedChunk(chunk.id)}
                              title={`Chunk ${index + 1}`}
                            />
                          )
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Points that are closer together have more similar semantic meaning
                      </p>
                    </Card>

                    <Card className="p-4">
                      <h4 className="font-semibold mb-4">Similar Chunks</h4>
                      {selectedChunk ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-primary/5 rounded-lg border border-primary">
                            <Badge className="mb-2">Selected</Badge>
                            <p className="text-sm line-clamp-2">
                              {chunks.find((c) => c.id === selectedChunk)?.text}
                            </p>
                          </div>

                          <div className="space-y-2">
                            {calculateSimilarities().map(({ chunk, similarity }) => (
                              <div
                                key={chunk.id}
                                className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted"
                                onClick={() => setSelectedChunk(chunk.id)}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-2 h-2 rounded-full ${getSimilarityColor(similarity)}`} />
                                  <span className="text-xs font-medium">{(similarity * 100).toFixed(1)}% similar</span>
                                </div>
                                <p className="text-sm line-clamp-2">{chunk.text}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Select a chunk to see similar chunks
                        </p>
                      )}
                    </Card>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
