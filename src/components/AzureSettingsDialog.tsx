import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AzureSearchSettings } from '@/lib/types'
import { validateAzureConfig, AzureSearchService } from '@/lib/azure-search'
import { Eye, EyeSlash, Check, X } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface AzureSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: AzureSearchSettings
  onSave: (settings: AzureSearchSettings) => void
}

export function AzureSettingsDialog({ open, onOpenChange, settings, onSave }: AzureSettingsDialogProps) {
  const [enabled, setEnabled] = useState(settings.enabled)
  const [endpoint, setEndpoint] = useState(settings.endpoint)
  const [apiKey, setApiKey] = useState(settings.apiKey)
  const [showApiKey, setShowApiKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const handleTestConnection = async () => {
    const validation = validateAzureConfig({ endpoint, apiKey, indexName: 'test' })
    if (validation) {
      toast.error(validation)
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const service = new AzureSearchService({ endpoint, apiKey, indexName: 'test' })
      const isConnected = await service.testConnection()
      
      if (isConnected) {
        setTestResult('success')
        toast.success('Connection successful!')
      } else {
        setTestResult('error')
        toast.error('Connection failed')
      }
    } catch (error) {
      setTestResult('error')
      toast.error('Connection failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (enabled) {
      const validation = validateAzureConfig({ endpoint, apiKey, indexName: 'kb' })
      if (validation) {
        toast.error(validation)
        return
      }
    }

    onSave({ enabled, endpoint, apiKey })
    onOpenChange(false)
    toast.success('Azure Search settings saved')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Azure AI Search Settings</DialogTitle>
          <DialogDescription>
            Configure Azure AI Search integration for enhanced vector search capabilities
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="azure-enabled" className="text-base">Enable Azure AI Search</Label>
              <p className="text-sm text-muted-foreground">
                Use Azure AI Search for semantic search and better retrieval
              </p>
            </div>
            <Switch
              id="azure-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="endpoint">Search Service Endpoint</Label>
                <Input
                  id="endpoint"
                  placeholder="https://your-service.search.windows.net"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Your Azure Cognitive Search service endpoint URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="api-key">Admin API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="Enter your API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Admin key with permissions to create indexes and upload documents
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testing || !endpoint || !apiKey}
                  className="gap-2"
                >
                  {testing ? (
                    'Testing...'
                  ) : testResult === 'success' ? (
                    <>
                      <Check size={16} className="text-green-600" />
                      Connected
                    </>
                  ) : testResult === 'error' ? (
                    <>
                      <X size={16} className="text-red-600" />
                      Failed
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
                {testResult && (
                  <p className="text-sm text-muted-foreground flex items-center">
                    {testResult === 'success' 
                      ? 'Successfully connected to Azure AI Search'
                      : 'Could not connect. Check your credentials.'}
                  </p>
                )}
              </div>

              <div className="bg-muted p-4 rounded-lg space-y-2">
                <h4 className="text-sm font-medium">How to get your credentials:</h4>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Go to Azure Portal and navigate to your Search service</li>
                  <li>Copy the URL from the Overview page (endpoint)</li>
                  <li>Go to Keys section and copy an Admin Key (not Query Key)</li>
                  <li>Paste both values above and test the connection</li>
                </ol>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
