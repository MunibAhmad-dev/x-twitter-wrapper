import { useEffect } from 'react'
import { toast } from 'sonner'
import { PremiumModal } from './PremiumModal'
import { useSettingsStore } from '../store/settingsStore'
import { useUIStore } from '../store/uiStore'
import { useWorkspaceStore } from '../store/workspaceStore'

interface OnboardingScreenProps {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { setSettings, updateSettings } = useSettingsStore()
  const { setCurrentUser, setIsLoggedIn, setActiveView } = useUIStore()
  const { setWorkspaces, setWorkspaceAccounts, setActiveWorkspaceAccountId } = useWorkspaceStore()

  useEffect(() => {
    window.electronAPI?.window?.setClosable(false)
    window.electronAPI?.window?.setMinimizable(false)
    return () => {
      window.electronAPI?.window?.setClosable(true)
      window.electronAPI?.window?.setMinimizable(true)
    }
  }, [])

  const bootIntoApp = async () => {
    window.electronAPI?.window?.setClosable(true)
    window.electronAPI?.window?.setMinimizable(true)
    await new Promise(r => setTimeout(r, 400))
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
        } else {
          const a = await window.electronAPI?.workspaceAccount.add(ws[0].id, 'X Account')
          if (a && !('error' in a)) {
            setWorkspaceAccounts([a])
            setActiveWorkspaceAccountId(a.id)
            await window.electronAPI?.workspace.loadFacebook(ws[0].id, a.id)
          }
        }
      } else {
        const newWs = await window.electronAPI?.workspace.create('My Workspace', '💼', '#5C6BC0')
        if (newWs) {
          setWorkspaces([newWs])
          const a = await window.electronAPI?.workspaceAccount.add(newWs.id, 'X Account')
          if (a && !('error' in a)) {
            setWorkspaceAccounts([a])
            setActiveWorkspaceAccountId(a.id)
            await window.electronAPI?.workspace.loadFacebook(newWs.id, a.id)
          }
        }
      }
    } catch {}
    setActiveView('dashboard')
    onComplete()
  }

  const handleDismiss = async () => {
    await window.electronAPI?.settings.update({ hasSeenOnboarding: true })
    await bootIntoApp()
  }

  const handlePurchaseSuccess = async (productId: string) => {
    toast.success('Welcome to Premium!')
    const latest = await window.electronAPI?.settings.get()
    if (latest) setSettings(latest)
    else updateSettings({ isPremium: true, premiumProductId: productId })
    await window.electronAPI?.settings.update({ hasSeenOnboarding: true })
    await bootIntoApp()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <PremiumModal
          onDismiss={handleDismiss}
          onPurchaseSuccess={handlePurchaseSuccess}
          showCloseButton
        />
      </div>
    </div>
  )
}
