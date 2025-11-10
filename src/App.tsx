import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { KnowledgeBase, Document, Query, SourceType } from '@/lib/types'
import { generateId, simulateDocumentExtraction } from '@/lib/helpers'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { KnowledgeBaseCard } from '@/components/KnowledgeBaseCard'
import { CreateKnowledgeBaseDialog } from '@/components/CreateKnowledgeBaseDialog'
import { AddContentDialog } from '@/components/AddContentDialog'
import { DocumentListItem } from '@/components/DocumentListItem'
import { DocumentViewerDialog } from '@/components/DocumentViewerDialog'
import { QueryInterface } from '@/components/QueryInterface'
import { QueryHistory } from '@/components/QueryHistory'
import { Database, Plus, ArrowLeft, ChartBar, MagnifyingGlass, FileText } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'

type View = 'dashboard' | 'details' | 'analytics'

function App() {
  const [knowledgeBases, setKnowledgeBases] = useKV<KnowledgeBase[]>('knowledge-bases', [])
  const [documents, setDocuments] = useKV<Document[]>('documents', [])
  const [queries, setQueries] = useKV<Query[]>('queries', [])
  
  const [currentView, setCurrentView] = useState<View>('dashboard')
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showAddContentDialog, setShowAddContentDialog] = useState(false)
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null)
  const [showDocumentViewer, setShowDocumentViewer] = useState(false)
  
  const kbs = knowledgeBases || []
  const docs = documents || []
  const qs = queries || []
  
  const handleCreateKB = (name: string, description: string) => {
    const newKB: KnowledgeBase = {
      id: generateId(),
      name,
      description,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      documentCount: 0,
      sources: []
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
  
  const handleAddContent = (sourceType: SourceType, sourceUrl: string) => {
    if (!selectedKB) return
    
    const extracted = simulateDocumentExtraction(sourceType, sourceUrl)
    const newDoc: Document = {
      id: generateId(),
      title: extracted.title!,
      content: extracted.content!,
      sourceType,
      sourceUrl,
      addedAt: Date.now(),
      metadata: extracted.metadata!
    }
    
    setDocuments((current) => [...(current || []), newDoc])
    
    setKnowledgeBases((current) =>
      (current || []).map(kb => {
        if (kb.id === selectedKB.id) {
          const updatedSources = kb.sources.includes(sourceType) 
            ? kb.sources 
            : [...kb.sources, sourceType]
          return {
            ...kb,
            documentCount: kb.documentCount + 1,
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
        documentCount: current.documentCount + 1,
        sources: updatedSources,
        updatedAt: Date.now()
      }
    })
    
    toast.success('Content added successfully')
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
  
  const handleQuery = (query: string, response: string, sources: string[]) => {
    if (!selectedKB) return
    
    const newQuery: Query = {
      id: generateId(),
      knowledgeBaseId: selectedKB.id,
      query,
      response,
      sources,
      timestamp: Date.now()
    }
    
    setQueries((current) => [...(current || []), newQuery])
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
            </div>
            <Button onClick={() => setShowAddContentDialog(true)} className="gap-2">
              <Plus size={20} weight="bold" />
              Add Content
            </Button>
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
    </div>
  )
}

export default App
