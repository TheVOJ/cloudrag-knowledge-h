import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ChatsCircle, Trash, Plus, PencilSimple, Check, X } from '@phosphor-icons/react'
import { ConversationManager, Conversation } from '@/lib/conversation-manager'
import { motion } from 'framer-motion'

interface ConversationListProps {
  knowledgeBaseId: string
  currentConversationId?: string
  onSelectConversation: (conversationId: string) => void
  onNewConversation: () => void
  refreshKey?: number
  isLoading?: boolean
  onRenameConversation?: (conversationId: string, title: string) => Promise<void> | void
}

export function ConversationList({
  knowledgeBaseId,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  refreshKey,
  isLoading,
  onRenameConversation
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [manager] = useState(() => new ConversationManager())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  useEffect(() => {
    loadConversations()
  }, [knowledgeBaseId, refreshKey])

  const loadConversations = async () => {
    const convs = await manager.getConversationsByKB(knowledgeBaseId)
    setConversations(convs.sort((a, b) => b.updatedAt - a.updatedAt))
  }

  const handleDelete = async (conversationId: string) => {
    await manager.deleteConversation(conversationId)
    loadConversations()
  }

  const startEditing = (conversation: Conversation) => {
    setEditingId(conversation.id)
    setDraftTitle(conversation.title)
  }

  const saveTitle = async (conversationId: string) => {
    const trimmed = draftTitle.trim()
    if (!trimmed) {
      setEditingId(null)
      return
    }

    if (onRenameConversation) {
      await onRenameConversation(conversationId, trimmed)
    } else {
      await manager.updateConversationTitle(conversationId, trimmed)
    }

    setConversations((prev) =>
      prev.map(c => c.id === conversationId ? { ...c, title: trimmed } : c)
    )
    setEditingId(null)
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ChatsCircle size={20} weight="duotone" />
          <h3 className="font-semibold">Conversations</h3>
        </div>
        <Button size="sm" onClick={onNewConversation} className="gap-2">
          <Plus size={16} />
          New
        </Button>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {isLoading && (
            <div className="space-y-2" aria-label="Loading conversations">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
              <div className="text-xs text-muted-foreground">Loading conversations...</div>
            </div>
          )}

          {!isLoading && conversations.length === 0 && (
            <div className="text-sm text-muted-foreground border rounded-lg p-4 text-center">
              No conversations yet. Start a query to create one.
            </div>
          )}

          {!isLoading && conversations.map((conversation) => (
            <motion.div
              key={conversation.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                currentConversationId === conversation.id
                  ? 'bg-primary/10 border-primary'
                  : 'hover:bg-muted'
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {editingId === conversation.id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveTitle(conversation.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          saveTitle(conversation.id)
                        }}
                        aria-label="Save title"
                      >
                        <Check size={14} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingId(null)
                        }}
                        aria-label="Cancel rename"
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-sm truncate">
                        {conversation.title}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          startEditing(conversation)
                        }}
                        aria-label="Rename conversation"
                      >
                        <PencilSimple size={14} />
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">
                      {Math.floor(conversation.messages.length / 2)} exchanges
                    </Badge>
                    {conversation.metadata.averageConfidence > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {(conversation.metadata.averageConfidence * 100).toFixed(0)}% conf
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(conversation.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(conversation.id)
                  }}
                  className="flex-shrink-0"
                >
                  <Trash size={14} />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
}
