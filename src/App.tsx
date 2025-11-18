import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { KnowledgeBase, Document, Query, SourceType, AzureSearchSettings } from '@/lib/types'
import { generateId, simulateDocumentExtraction } from '@/lib/helpers'
import { AzureSearchService } from '@/lib/azure-search'
import { scrapeWebContent, convertToDocument as convertWebToDocument } from '@/lib/web-scraper'
import { fetchRepoContent, convertRepoToDocuments } from '@/lib/github-service'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { KnowledgeBaseCard } from '@/components/KnowledgeBaseCard'
import { CreateKnowledgeBaseDialog } from '@/components/CreateKnowledgeBaseDialog'
import { AddContentDialog } from '@/components/AddContentDialog'
import { DocumentListItem } from '@/components/DocumentListItem'
import { DocumentViewerDialog } from '@/components/DocumentViewerDialog'
import { QueryInterface } from '@/components/QueryInterface'
import { QueryHistory } from '@/components/QueryHistory'
import { AzureSettingsDialog } from '@/components/AzureSettingsDialog'
import { ChunkVisualizerDialog } from '@/components/ChunkVisualizerDialog'
import { Database, Plus, ArrowLeft, ChartBar, MagnifyingGlass, FileText, Gear, Lightning } from '@phosphor-icons/react'
import { toast, Toaster } from 'sonner'
import { motion } from 'framer-motion'

type View = 'dashboard' | 'details' | 'analytics'

function App() {
  const [knowledgeBases, setKnowledgeBases] = useKV<KnowledgeBase[]>('knowledge-bases', [])
  const [documents, setDocuments] = useKV<Document[]>('documents', [])
  const [queries, setQueries] = useKV<Query[]>('queries', [])
  const [azureSettings, setAzureSettings] = useKV<AzureSearchSettings>('azure-settings', {
    endpoint: '',
    apiKey: '',
    enabled: false,
  })
  
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showAddContentDialog, setShowAddContentDialog] = useState(false)
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null)
  const [showDocumentViewer, setShowDocumentViewer] = useState(false)
  const [showAzureSettings, setShowAzureSettings] = useState(false)
  const [syncingToAzure, setSyncingToAzure] = useState(false)
  const [showChunkVisualizer, setShowChunkVisualizer] = useState(false)
  const [visualizerDocument, setVisualizerDocument] = useState<Document | null>(null)
  
  const kbs = knowledgeBases || []
  const docs = documents || []
  const qs = queries || []
  
  const handleCreateKB = async (name: string, description: string) => {
    const indexName = `kb-${generateId().toLowerCase().replace(/[^a-z0-9-]/g, '')}`
    const newKB: KnowledgeBase = {
      id: generateId(),
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      documentCount: 0,
      sources: [],
      azureSearchEnabled: azureSettings?.enabled || false,
      azureIndexName: azureSettings?.enabled ? indexName : undefined,
    }
    
    if (azureSettings?.enabled && azureSettings.endpoint && azureSettings.apiKey) {
      try {
        const service = new AzureSearchService({
          endpoint: azureSettings.endpoint,
          apiKey: azureSettings.apiKey,
          indexName,
        })
        await service.createIndex()
        toast.success(`Knowledge base "${name}" created with Azure AI Search`)
      } catch (error) {
        toast.error('Failed to create Azure index: ' + (error instanceof Error ? error.message : 'Unknown error'))
      }
    }
    
    setKnowledgeBases((current) => [...(current || []), newKB])
    toast.success(`Knowledge base "${name}" created successfully`)
  }
  
  const handleDeleteKB = (id: string) => {
    const kb = kbs.find(k => k.id === id)
    setKnowledgeBases((current) => (current || []).filter(k => k.id !== id))
    setDocuments((current) => (current || []).filter(d => d.sourceUrl !== id))
    toast.success(`Knowledge base "${kb?.name}" deleted`)
  }
  
  const handleSelectKB = (kb: KnowledgeBase) => {
    setSelectedKB(kb)
    setCurrentView('details')
  }
  
  const handleAddContent = async (sourceType: SourceType, sourceUrl: string) => {
    if (!selectedKB) return
    
    toast.info('Processing content...')
    
    try {
      let documentsToAdd: Omit<Document, 'id' | 'addedAt'>[] = []
      
      if (sourceType === 'web') {
        const scraped = await scrapeWebContent(sourceUrl)
        documentsToAdd = [convertWebToDocument(scraped, sourceUrl)]
      } else if (sourceType === 'github') {
        const repoContent = await fetchRepoContent(sourceUrl)
        documentsToAdd = convertRepoToDocuments(repoContent, sourceUrl)
      } else {
        const extracted = simulateDocumentExtraction(sourceType, sourceUrl)
        documentsToAdd = [{
          title: extracted.title!,
          content: extracted.content!,
          sourceType,
          sourceUrl,
          metadata: extracted.metadata!
        }]
      }
      
      const newDocs: Document[] = documentsToAdd.map(doc => ({
        ...doc,
        id: generateId(),
        addedAt: Date.now()
      }))
      
      setDocuments((current) => [...(current || []), ...newDocs])
      
      if (selectedKB.azureSearchEnabled && selectedKB.azureIndexName && azureSettings?.enabled) {
        try {
          const service = new AzureSearchService({
            endpoint: azureSettings.endpoint,
            apiKey: azureSettings.apiKey,
            indexName: selectedKB.azureIndexName,
          })
          await service.indexDocuments(newDocs)
          toast.success(`${newDocs.length} document(s) indexed in Azure AI Search`)
        } catch (error) {
          toast.error('Failed to index in Azure: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
      }
      
      setKnowledgeBases((current) =>
        (current || []).map(kb => {
          if (kb.id === selectedKB.id) {
            const updatedSources = kb.sources.includes(sourceType) 
              ? kb.sources 
              : [...kb.sources, sourceType]
            return {
              ...kb,
              documentCount: kb.documentCount + newDocs.length,
              sources: updatedSources,
              updatedAt: Date.now()
            }
          }
          return kb
        })
      )
      
      setSelectedKB((current) => {
        if (!current) return null
        const updatedSources = current.sources.includes(sourceType) 
          ? current.sources 
          : [...current.sources, sourceType]
        return {
          ...current,
          documentCount: current.documentCount + newDocs.length,
          sources: updatedSources,
          updatedAt: Date.now()
        }
      })
      
      toast.success(`${newDocs.length} document(s) added successfully`)
    } catch (error) {
      toast.error('Failed to add content: ' + (error instanceof Error ? error.message : 'Unknown error'))
      throw error
    }
  }
  
  const handleDeleteDocument = (id: string) => {
    const doc = docs.find(d => d.id === id)
    setDocuments((current) => (current || []).filter(d => d.id !== id))
    
    if (selectedKB && doc) {
      setKnowledgeBases((current) =>
        (current || []).map(kb => 
          kb.id === selectedKB.id 
            ? { ...kb, documentCount: Math.max(0, kb.documentCount - 1), updatedAt: Date.now() }
            : kb
        )
      )
      
      setSelectedKB((current) => 
        current 
          ? { ...current, documentCount: Math.max(0, current.documentCount - 1), updatedAt: Date.now() }
          : null
      )
    }
    
    toast.success('Document removed')
  }
  
  const handleViewDocument = (document: Document) => {
    setViewingDocument(document)
    setShowDocumentViewer(true)
  }
  
  const handleViewChunks = (document: Document) => {
    setVisualizerDocument(document)
    setShowChunkVisualizer(true)
  }
  
  const handleEditDocument = (document: Document) => {
    setViewingDocument(document)
    setShowDocumentViewer(true)
  }
  
  const handleSaveDocument = (id: string, title: string, content: string) => {
    setDocuments((current) =>
      (current || []).map(doc =>
        doc.id === id
          ? { ...doc, title, content, metadata: { ...doc.metadata, lastModified: Date.now() } }
          : doc
      )
    )
    
    setViewingDocument((current) =>
      current && current.id === id
        ? { ...current, title, content, metadata: { ...current.metadata, lastModified: Date.now() } }
        : current
    )
    
    toast.success('Document updated successfully')
  }
  
  const handleQuery = (query: string, response: string, sources: string[], searchMethod: 'simulated' | 'azure') => {
    if (!selectedKB) return
    
    const newQuery: Query = {
      id: generateId(),
      knowledgeBaseId: selectedKB.id,
      query,
      response,
      sources,
      timestamp: Date.now(),
      searchMethod,
    }
    
    setQueries((current) => [...(current || []), newQuery])
  }
  
  const handleSaveAzureSettings = (settings: AzureSearchSettings) => {
    setAzureSettings(settings)
  }
  
  const syncExistingDocumentsToAzure = async () => {
    if (!selectedKB || !selectedKB.azureIndexName || !azureSettings?.enabled) return
    
    const kbDocs = getKBDocuments(selectedKB.id)
    if (kbDocs.length === 0) {
      toast.info('No documents to sync')
      return
    }
    
    setSyncingToAzure(true)
    try {
      const service = new AzureSearchService({
        endpoint: azureSettings.endpoint,
        apiKey: azureSettings.apiKey,
        indexName: selectedKB.azureIndexName,
      })
      
      await service.indexDocuments(kbDocs)
      toast.success(`Synced ${kbDocs.length} documents to Azure AI Search`)
    } catch (error) {
      toast.error('Sync failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setSyncingToAzure(false)
    }
  }
  
  const getKBDocuments = (kbId: string) => {
    return docs.filter(doc => {
      const kb = kbs.find(k => k.id === kbId)
      return kb && doc.addedAt >= kb.createdAt
    }).slice(0, 50)
  }
  
  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Knowledge Bases</h1>
          <p className="text-muted-foreground">
            Create and manage your RAG-powered knowledge bases
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} size="lg" className="gap-2">
          <Plus size={20} weight="bold" />
          Create Knowledge Base
        </Button>
      </div>
      
      {kbs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-24"
        >
          <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto mb-6 flex items-center justify-center">
            <Database size={40} className="text-primary" weight="duotone" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">No knowledge bases yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Get started by creating your first knowledge base to organize and query your content
          </p>
          <Button onClick={() => setShowCreateDialog(true)} size="lg" className="gap-2">
            <Plus size={20} weight="bold" />
            Create Your First Knowledge Base
          </Button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kbs.map((kb) => (
            <motion.div
              key={kb.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <KnowledgeBaseCard
                knowledgeBase={kb}
                onSelect={handleSelectKB}
                onDelete={handleDeleteKB}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
  
  const renderDetails = () => {
    if (!selectedKB) return null
    
    const kbDocs = getKBDocuments(selectedKB.id)
    
    return (
      <div className="space-y-6">
        <div>
          <Button 
            variant="ghost" 
            onClick={() => setCurrentView('dashboard')}
            className="mb-4 gap-2"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Button>
          
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight mb-2">{selectedKB.name}</h1>
              <p className="text-muted-foreground">{selectedKB.description}</p>
              {selectedKB.azureSearchEnabled && (
                <div className="flex items-center gap-2 mt-2">
                  <Lightning size={16} weight="fill" className="text-accent" />
                  <span className="text-sm text-muted-foreground">Azure AI Search enabled</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {selectedKB.azureSearchEnabled && azureSettings?.enabled && kbDocs.length > 0 && (
                <Button 
                  variant="outline" 
                  onClick={syncExistingDocumentsToAzure} 
                  disabled={syncingToAzure}
                  className="gap-2"
                >
                  <Lightning size={16} weight="duotone" />
                  {syncingToAzure ? 'Syncing...' : 'Sync to Azure'}
                </Button>
              )}
              <Button onClick={() => setShowAddContentDialog(true)} className="gap-2">
                <Plus size={20} weight="bold" />
                Add Content
              </Button>
            </div>
          </div>
        </div>
        
        <Tabs defaultValue="query" className="space-y-4">
          <TabsList>
            <TabsTrigger value="query" className="gap-2">
              <MagnifyingGlass size={16} />
              Query
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText size={16} />
              Documents ({kbDocs.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="query">
            {kbDocs.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <FileText size={48} className="mx-auto mb-4 text-muted-foreground" weight="duotone" />
                <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add some content to this knowledge base to start querying
                </p>
                <Button onClick={() => setShowAddContentDialog(true)} className="gap-2">
                  <Plus size={16} />
                  Add Your First Document
                </Button>
              </div>
            ) : (
              <QueryInterface
                knowledgeBaseName={selectedKB.name}
                documents={kbDocs}
                onQuery={handleQuery}
                azureSettings={azureSettings}
                indexName={selectedKB.azureIndexName}
              />
            )}
          </TabsContent>
          
          <TabsContent value="documents">
            {kbDocs.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <FileText size={48} className="mx-auto mb-4 text-muted-foreground" weight="duotone" />
                <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add content from various sources to build your knowledge base
                </p>
                <Button onClick={() => setShowAddContentDialog(true)} className="gap-2">
                  <Plus size={16} />
                  Add Content
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {kbDocs.map((doc) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <DocumentListItem
                      document={doc}
                      onDelete={handleDeleteDocument}
                      onView={handleViewDocument}
                      onEdit={handleEditDocument}
                      onViewChunks={handleViewChunks}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    )
  }
  
  const renderAnalytics = () => (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Analytics</h1>
        <p className="text-muted-foreground">
          View query history and usage patterns
        </p>
      </div>
      
      <QueryHistory queries={qs} knowledgeBases={kbs} />
    </div>
  )
  
  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-right" />
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Database size={24} className="text-primary-foreground" weight="duotone" />
              </div>
              <div>
                <h1 className="font-semibold text-lg">RAG Knowledge Manager</h1>
                <p className="text-xs text-muted-foreground">AI-Powered Search & Retrieval</p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={currentView === 'dashboard' ? 'default' : 'ghost'}
                onClick={() => setCurrentView('dashboard')}
                className="gap-2"
              >
                <Database size={16} />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button
                variant={currentView === 'analytics' ? 'default' : 'ghost'}
                onClick={() => setCurrentView('analytics')}
                className="gap-2"
              >
                <ChartBar size={16} />
                <span className="hidden sm:inline">Analytics</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowAzureSettings(true)}
                className="gap-2"
              >
                {azureSettings?.enabled ? (
                  <Lightning size={16} weight="fill" className="text-accent" />
                ) : (
                  <Gear size={16} />
                )}
                <span className="hidden sm:inline">Azure Search</span>
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-6 py-8">
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'details' && renderDetails()}
        {currentView === 'analytics' && renderAnalytics()}
      </main>
      
      <CreateKnowledgeBaseDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreate={handleCreateKB}
      />
      
      <AddContentDialog
        open={showAddContentDialog}
        onOpenChange={setShowAddContentDialog}
        onAdd={handleAddContent}
      />
      
      <DocumentViewerDialog
        document={viewingDocument}
        open={showDocumentViewer}
        onOpenChange={setShowDocumentViewer}
        onSave={handleSaveDocument}
      />
      
      <AzureSettingsDialog
        open={showAzureSettings}
        onOpenChange={setShowAzureSettings}
        settings={azureSettings || { endpoint: '', apiKey: '', enabled: false }}
        onSave={handleSaveAzureSettings}
      />
      
      <ChunkVisualizerDialog
        document={visualizerDocument}
        open={showChunkVisualizer}
        onOpenChange={setShowChunkVisualizer}
      />
    </div>
  )
}

export default App
