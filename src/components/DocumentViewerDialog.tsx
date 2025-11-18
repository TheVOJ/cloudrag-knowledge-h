import { useState, useMemo } from 'react'
import { Document } from '@/lib/types'
  Dialog
  Dialog,
  DialogTitle,
import { Button } fr
import { Textar
import { Badge 
  DialogTitle,
import { getSourceIcon, getSour

  document: Document | null
  onOpenChange: (open: boolean) => void
}
export function DocumentViewerDialog({
  open,
  onSave,
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')


      return marked.parse(document.co
  document: Document | null
  }, [document?
  onOpenChange: (open: boolean) => void
      setEditedTitle(document.title)
}

export function DocumentViewerDialog({
  const han
  open,
  }
  onSave,
      setEditedTitle(document.t
  const [isEditing, setIsEditing] = useState(false)
  }
  const [editedContent, setEditedContent] = useState('')

      <DialogContent className="max-w-4xl m
          <div className="fle
              {isEditing ? (
                  value={editedTitle}
      setIsEditing(false)
     
    onOpenChange(isOpen)
   

                </Badge>
    if (!document) return
                  {extractDomain(document.sourceUrl
    setIsEditing(false)
   

                variant="outli
                onC
              >
                Edit
     
        </DialogHeader>
   

              Preview

          
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <Input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-lg font-semibold mb-2"
                  placeholder="Document title"
                />
              ) : (
                <DialogTitle className="text-xl mb-2">{document.title}</DialogTitle>
              )}
              <DialogDescription className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <span>{getSourceIcon(document.sourceType)}</span>
                  <span>{getSourceLabel(document.sourceType)}</span>
                </Badge>
                <span className="text-xs">•</span>
                <span className="text-xs flex items-center gap-1">
                  <Link size={12} />
                  {extractDomain(document.sourceUrl)}
                </span>
                <span className="text-xs">•</span>
                <span className="text-xs">{formatDate(document.addedAt)}</span>
              </DialogDescription>
            </div>
            {!isEditing && (
              <Button
                variant="outline"
                size="sm"
                  </p>

               
                      Added At
                    
                    </p

                
                       

                      </p>
                  )}

                  <div>
                     
                    <p cla
                    </p>
                )}
                {document.
                    <

                      {new Date(document.metadata.lastModified).toLo
                  </div>

                  <Label className="t
                  </Label>
                    {document.content.length.toLocaleString()} characters
                </div>
            </Sc
        </Tabs>
        <DialogFooter>
            <div className="flex gap-2 w-full sm:w-auto">
                <X size={16} />
              </Button
                <FloppyDisk
              
          ) : (

          )}
      </DialogContent>
  )
                <div>






















                    <p className="mt-1 text-sm bg-muted p-2 rounded">

































                      {new Date(document.metadata.lastModified).toLocaleString()}

                  </div>
                )}


                  <Label className="text-sm font-semibold text-muted-foreground">
                    Content Length
                  </Label>
                  <p className="mt-1 text-sm bg-muted p-2 rounded">
                    {document.content.length.toLocaleString()} characters
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" onClick={handleCancel} className="gap-2">
                <X size={16} />

              </Button>
              <Button onClick={handleSave} className="gap-2">
                <FloppyDisk size={16} weight="bold" />
                Save Changes
              </Button>

          ) : (
            <Button variant="outline" onClick={() => handleOpen(false)}>
              Close

          )}

      </DialogContent>

  )
}
