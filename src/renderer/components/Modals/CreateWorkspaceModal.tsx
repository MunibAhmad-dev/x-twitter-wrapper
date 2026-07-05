import { useState, useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { CURATED_WORKSPACE_IMAGES } from '../../constants'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

const WORKSPACE_ICONS = ['📁', '💼', '🏠', '🚀', '💡', '🎯', '🌟', '⚡']
const WORKSPACE_COLORS = ['#5C6BC0', '#26A69A', '#EF5350', '#AB47BC', '#FFA726', '#66BB6A', '#42A5F5', '#EC407A']

export function CreateWorkspaceModal() {
  const { isCreateWorkspaceModalOpen, setCreateWorkspaceModalOpen, setActiveWorkspaceId } = useUIStore()
  const { addWorkspace, setActiveWorkspace, setWorkspaceAccounts, setActiveWorkspaceAccountId } = useWorkspaceStore()
  
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('📁')
  const [color, setColor] = useState('#5C6BC0')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return

    setIsLoading(true)
    console.log('[CreateWorkspaceModal] Creating workspace:', name.trim())
    try {
      const workspace = await window.electronAPI?.workspace.create(name.trim(), icon, color)
      console.log('[CreateWorkspaceModal] workspace result:', workspace)
      if (workspace) {
        addWorkspace(workspace)
        setActiveWorkspace(workspace)
        setActiveWorkspaceId(workspace.id)
        
        // Create an account for this workspace and load Facebook
        const account = await window.electronAPI?.workspaceAccount.add(workspace.id, 'X Account')
        if (account && !('error' in account)) {
          setWorkspaceAccounts([account])
          setActiveWorkspaceAccountId(account.id)
          await window.electronAPI?.workspace.loadFacebook(workspace.id, account.id)
        }
        
        setCreateWorkspaceModalOpen(false)
        setName('')
        setIcon('📁')
        setColor('#5C6BC0')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    console.log('[CreateWorkspaceModal] handleOpenChange:', open)
    window.electronAPI?.setModalOpen(open)
    if (!open) {
      setCreateWorkspaceModalOpen(false)
      setName('')
      setIcon('📁')
      setColor('#5C6BC0')
    }
  }

  useEffect(() => {
    window.electronAPI?.setModalOpen(isCreateWorkspaceModalOpen)
  }, [isCreateWorkspaceModalOpen])

  return (
    <Dialog open={isCreateWorkspaceModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[460px] overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Organize your X accounts within a customized, premium workspace.
          </DialogDescription>
        </DialogHeader>

        {/* Live Premium Preview */}
        <div className="flex flex-col items-center justify-center py-4 bg-accent/10 rounded-2xl border border-border/50 gap-2 mb-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-md border border-white/10 transition-all duration-300 relative overflow-hidden flex-shrink-0"
            style={{
              backgroundColor: color,
              boxShadow: `0 8px 30px ${color}30`
            }}
          >
            {icon.startsWith('http') ? (
              <img src={icon} alt="Workspace Avatar" className="w-full h-full object-cover select-none" />
            ) : (
              <span className="select-none">{icon}</span>
            )}
          </div>
          <span className="text-xs font-semibold text-foreground/40 uppercase tracking-wider">Preview</span>
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="workspace-name" className="text-foreground/80 font-medium">Workspace Name</Label>
            <Input
              id="workspace-name"
              placeholder="e.g. Business, Marketing, Personal..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-foreground/80 font-medium">Curated Premium Avatars</Label>
            <div className="grid grid-cols-4 gap-2">
              {CURATED_WORKSPACE_IMAGES.map((imageUrl, idx) => (
                <button
                  key={imageUrl}
                  type="button"
                  onClick={() => setIcon(imageUrl)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${
                    icon === imageUrl ? 'border-primary scale-95 shadow-sm' : 'border-transparent hover:border-foreground/20'
                  }`}
                  style={{ minHeight: '60px' }}
                >
                  <img
                    src={imageUrl}
                    alt={`Avatar ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 select-none"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground/80 font-medium">Or choose Emoji Icon</Label>
            <div className="flex gap-2 flex-wrap">
              {WORKSPACE_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`text-2xl p-2 w-11 h-11 flex items-center justify-center rounded-xl border-2 transition-all ${
                    icon === emoji ? 'border-primary bg-primary/5 scale-95' : 'border-transparent hover:bg-accent'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground/80 font-medium">Color Palette</Label>
            <div className="flex gap-2.5 flex-wrap">
              {WORKSPACE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    color === c ? 'border-foreground scale-110 shadow-sm' : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" onClick={() => setCreateWorkspaceModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isLoading}>
            {isLoading ? 'Creating...' : 'Create Workspace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
