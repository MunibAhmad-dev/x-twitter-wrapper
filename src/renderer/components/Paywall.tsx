import { toast } from 'sonner'
import { PremiumModal } from './PremiumModal'
import { useSettingsStore } from '../store/settingsStore'
import { useUIStore } from '../store/uiStore'
import { useWorkspaceStore } from '../store/workspaceStore'

export function Paywall() {
  const { setSettings, updateSettings } = useSettingsStore()
  const { setCurrentUser, setIsLoggedIn, setActiveView } = useUIStore()
  const { setWorkspaces, setWorkspaceAccounts, setActiveWorkspaceAccountId } = useWorkspaceStore()

  const handlePurchaseSuccess = async (productId: string) => {
    toast.success('Premium unlocked! Welcome to productivity.')
    const latest = await window.electronAPI?.settings.get()
    if (latest) setSettings(latest)
    else updateSettings({ isPremium: true, premiumProductId: productId })
    await new Promise(r => setTimeout(r, 500))
    const user = await window.electronAPI?.auth.autoLogin()
    if (user) setCurrentUser(user)
    setIsLoggedIn(true)
    try {
      const ws = (await window.electronAPI?.workspace.list()) || []
      if (ws.length > 0) {
        setWorkspaces(ws)
        const accts = (await window.electronAPI?.workspaceAccount.list(ws[0].id)) || []
        if (accts.length > 0) {
          setWorkspaceAccounts(accts)
          setActiveWorkspaceAccountId(accts[0].id)
          await window.electronAPI?.workspace.loadFacebook(ws[0].id, accts[0].id)
        }
      }
    } catch {}
    setActiveView('dashboard')
  }

  return (
    <div className="h-full flex items-center justify-center bg-background p-6">
      <PremiumModal
        onDismiss={() => setActiveView('dashboard')}
        onPurchaseSuccess={handlePurchaseSuccess}
        showCloseButton
      />
    </div>
  )
}
