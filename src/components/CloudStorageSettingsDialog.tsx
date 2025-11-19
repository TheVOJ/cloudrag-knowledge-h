import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Info, CheckCircle, Warning } from '@phosphor-icons/react'

export interface CloudStorageSettings {
  onedrive: {
    enabled: boolean
    accessToken: string
  }
  dropbox: {
    enabled: boolean
    accessToken: string
  }
}

interface CloudStorageSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: CloudStorageSettings
  onSave: (settings: CloudStorageSettings) => void
}

export function CloudStorageSettingsDialog({ 
  open, 
  onOpenChange, 
  settings, 
  onSave 
}: CloudStorageSettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<CloudStorageSettings>(settings)
  const [activeTab, setActiveTab] = useState<'onedrive' | 'dropbox'>('onedrive')

  const handleSave = () => {
    onSave(localSettings)
    onOpenChange(false)
  }

  const updateOneDrive = (field: 'enabled' | 'accessToken', value: boolean | string) => {
    setLocalSettings(prev => ({
      ...prev,
      onedrive: {
        ...prev.onedrive,
        [field]: value
      }
    }))
  }

  const updateDropbox = (field: 'enabled' | 'accessToken', value: boolean | string) => {
    setLocalSettings(prev => ({
      ...prev,
      dropbox: {
        ...prev.dropbox,
        [field]: value
      }
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Cloud Storage Settings</DialogTitle>
          <DialogDescription className="text-sm">
            Configure authentication for OneDrive and Dropbox integrations
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'onedrive' | 'dropbox')}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="onedrive" className="gap-2">
              ☁️ OneDrive
            </TabsTrigger>
            <TabsTrigger value="dropbox" className="gap-2">
              📦 Dropbox
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="onedrive" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="onedrive-enabled" className="text-sm font-medium">
                  Enable OneDrive Integration
                </Label>
                <p className="text-xs text-muted-foreground">
                  Access files and folders from your OneDrive account
                </p>
              </div>
              <Switch
                id="onedrive-enabled"
                checked={localSettings.onedrive.enabled}
                onCheckedChange={(checked) => updateOneDrive('enabled', checked)}
              />
            </div>

            {localSettings.onedrive.enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="onedrive-token" className="text-sm">
                    Access Token
                  </Label>
                  <Input
                    id="onedrive-token"
                    type="password"
                    placeholder="Enter your OneDrive access token"
                    value={localSettings.onedrive.accessToken}
                    onChange={(e) => updateOneDrive('accessToken', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    For security, tokens are stored locally and never sent to external servers
                  </p>
                </div>

                <Alert>
                  <Info size={16} className="flex-shrink-0" />
                  <AlertDescription className="text-xs">
                    <div className="space-y-2">
                      <p className="font-medium">How to get your OneDrive access token:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Visit the <a href="https://developer.microsoft.com/en-us/graph/graph-explorer" target="_blank" rel="noopener noreferrer" className="text-primary underline">Microsoft Graph Explorer</a></li>
                        <li>Sign in with your Microsoft account</li>
                        <li>Grant permissions for Files.Read.All</li>
                        <li>Copy the access token from the top bar</li>
                      </ol>
                      <p className="text-muted-foreground mt-2">
                        Note: Tokens expire after 1 hour. For production, implement OAuth 2.0 flow.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>

                <Alert>
                  <CheckCircle size={16} className="flex-shrink-0 text-green-600" />
                  <AlertDescription className="text-xs">
                    <strong>Supported file types:</strong> .txt, .md, .json, .csv, .xml, .html, .docx, .pdf, .xlsx, .pptx, and code files (.js, .ts, .py, .java, etc.)
                  </AlertDescription>
                </Alert>
              </>
            )}

            {!localSettings.onedrive.enabled && (
              <Alert>
                <Warning size={16} className="flex-shrink-0" />
                <AlertDescription className="text-xs">
                  OneDrive integration is currently disabled. Enable it to access your OneDrive files and folders.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="dropbox" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="dropbox-enabled" className="text-sm font-medium">
                  Enable Dropbox Integration
                </Label>
                <p className="text-xs text-muted-foreground">
                  Access files and folders from your Dropbox account
                </p>
              </div>
              <Switch
                id="dropbox-enabled"
                checked={localSettings.dropbox.enabled}
                onCheckedChange={(checked) => updateDropbox('enabled', checked)}
              />
            </div>

            {localSettings.dropbox.enabled && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="dropbox-token" className="text-sm">
                    Access Token
                  </Label>
                  <Input
                    id="dropbox-token"
                    type="password"
                    placeholder="Enter your Dropbox access token"
                    value={localSettings.dropbox.accessToken}
                    onChange={(e) => updateDropbox('accessToken', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    For security, tokens are stored locally and never sent to external servers
                  </p>
                </div>

                <Alert>
                  <Info size={16} className="flex-shrink-0" />
                  <AlertDescription className="text-xs">
                    <div className="space-y-2">
                      <p className="font-medium">How to get your Dropbox access token:</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Go to the <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="text-primary underline">Dropbox App Console</a></li>
                        <li>Create a new app or select an existing one</li>
                        <li>Set permissions to "files.content.read"</li>
                        <li>Generate an access token in the settings</li>
                        <li>Copy and paste the token here</li>
                      </ol>
                      <p className="text-muted-foreground mt-2">
                        Note: For production, implement OAuth 2.0 flow with refresh tokens.
                      </p>
                    </div>
                  </AlertDescription>
                </Alert>

                <Alert>
                  <CheckCircle size={16} className="flex-shrink-0 text-green-600" />
                  <AlertDescription className="text-xs">
                    <strong>Supported file types:</strong> .txt, .md, .json, .csv, .xml, .html, .docx, .pdf, .xlsx, .pptx, and code files (.js, .ts, .py, .java, etc.)
                  </AlertDescription>
                </Alert>
              </>
            )}

            {!localSettings.dropbox.enabled && (
              <Alert>
                <Warning size={16} className="flex-shrink-0" />
                <AlertDescription className="text-xs">
                  Dropbox integration is currently disabled. Enable it to access your Dropbox files and folders.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button onClick={handleSave} className="w-full sm:w-auto">
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
