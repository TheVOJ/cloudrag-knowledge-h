import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

interface CreateKnowledgeBaseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (name: string, description: string) => void
}

export function CreateKnowledgeBaseDialog({ open, onOpenChange, onCreate }: CreateKnowledgeBaseDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  
  const handleSubmit = () => {
    if (name.trim()) {
      onCreate(name, description)
      setName('')
      setDescription('')
      onOpenChange(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Create Knowledge Base</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3 sm:space-y-4 py-3 sm:py-4">
          <div className="space-y-2">
            <Label htmlFor="kb-name" className="text-sm">Name</Label>
            <Input
              id="kb-name"
              placeholder="e.g., Product Documentation"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="text-sm sm:text-base"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="kb-description" className="text-sm">Description</Label>
            <Textarea
              id="kb-description"
              placeholder="Brief description of what this knowledge base contains..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="text-sm sm:text-base resize-none"
            />
          </div>
        </div>
        
        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()} className="w-full sm:w-auto">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
