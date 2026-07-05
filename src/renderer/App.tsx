/**
 * App.tsx — root component
 *
 * Apple compliance:
 *   - Core messaging is FREE for all users. No subscription required to use the app.
 *   - Premium features (AI Reply, Translation, Focus, Analytics, Filters) are gated
 *     individually and clearly positioned as productivity tools, not messaging access.
 *   - The Paywall is accessible via the "Upgrade" button, never as a launch gate.
 */
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { Sidebar } from './components/Sidebar/Sidebar'
import { WorkspaceView } from './components/WorkspaceView'
import { PreferencesModal } from './components/Modals/PreferencesModal'
import { DisclaimerModal } from './components/Modals/DisclaimerModal'
import { CreateWorkspaceModal } from './components/Modals/CreateWorkspaceModal'
import { FeedbackModal } from './components/Modals/FeedbackModal'
import { ReviewModal } from './components/Modals/ReviewModal'
import { OnboardingScreen } from './components/OnboardingScreen'
import { SplashScreen } from './components/SplashScreen'
import { CommandPalette } from './components/CommandPalette'
import { useSettingsStore } from './store/settingsStore'
import { useUIStore } from './store/uiStore'
import { useWorkspaceStore } from './store/workspaceStore'
import { useNotificationStore } from './store/notificationStore'
import { IAP_ENABLED } from '../shared/constants'

export function App() {
  const { theme, isPremium, updateSettings, setSettings } = useSettingsStore()
  const {
    hideSplash,
    setCurrentUser,
    setIsLoggedIn,
    setActiveWorkspaceId,
    setPrefsModalOpen,
    setDisclaimerModalOpen,
    setActiveView,
    setUnreadCounts,
    isFeedbackModalOpen,
    setFeedbackModalOpen,
    setReviewModalOpen,
  } = useUIStore()
  const { setWorkspaces, setWorkspaceAccounts, setActiveWorkspaceAccountId } = useWorkspaceStore()
  const { addEntry: addNotificationEntry, markRead: markNotificationRead } = useNotificationStore()
  const [isLoading, setIsLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const init = async () => {
      // Hide splash after 1.6 s regardless of load state
      setTimeout(hideSplash, 1600)

      try {
        if (!window.electronAPI) {
          // Browser/dev preview mode
          document.documentElement.classList.toggle('dark', (theme || 'light') === 'dark')
          setIsLoading(false)
          return
        }

        // ── Register global IPC listeners ────────────────────────────────
        window.electronAPI.workspaceAccount.onUpdated((accounts) => {
          setWorkspaceAccounts(accounts || [])
          const current = useWorkspaceStore.getState().activeWorkspaceAccountId
          if (!current && accounts?.[0]) setActiveWorkspaceAccountId(accounts[0].id)
        })

        window.electronAPI.onUnreadCountsUpdated((counts) => {
          setUnreadCounts(counts)
        })

        // ── Notification history — registered here so events are NEVER missed
        // regardless of which panel/view is currently visible ────────────────
        window.electronAPI.onNotificationLogged?.((raw) => {
          // Resolve account details at call-time (not at registration-time)
          const accounts = useWorkspaceStore.getState().workspaceAccounts
          const account = accounts.find(a => a.id === raw.accountId)
          addNotificationEntry({
            id: raw.id,
            accountId: raw.accountId,
            accountLabel: account?.label || 'Unknown',
            accountColor: account?.avatarColor || '#6366f1',
            accountInitials: account?.avatarText || '?',
            accountAvatarUrl: account?.avatarUrl,
            title: raw.title,
            body: raw.body,
            receivedAt: raw.receivedAt,
            read: false,
          })
        })

        window.electronAPI.onNotificationClicked?.((accountId: string) => {
          markNotificationRead(accountId)
        })

        // ── Menu event wiring ────────────────────────────────────────────
        window.electronAPI.onMenuEvent('menu:open-preferences', () => {
          window.electronAPI?.setModalOpen(true)
          setPrefsModalOpen(true)
        })
        window.electronAPI.onMenuEvent('menu:show-disclaimer', () => {
          window.electronAPI?.setModalOpen(true)
          setDisclaimerModalOpen(true)
        })
        window.electronAPI.onMenuEvent('menu:reload-page', () => {
          window.electronAPI?.browser?.reload()
        })
        window.electronAPI.onMenuEvent('menu:toggle-sidebar', () => {
          const { sidebarExpanded } = useSettingsStore.getState()
          const next = !sidebarExpanded
          useSettingsStore.getState().updateSettings({ sidebarExpanded: next })
          window.electronAPI?.settings.update({ sidebarExpanded: next })
        })
        window.electronAPI.onMenuEvent('menu:set-focus-mode', (data) => {
          const enabled = Boolean(data)
          useSettingsStore.getState().updateSettings({ focusMode: enabled })
          document.documentElement.style.filter = enabled ? 'grayscale(100%)' : 'none'
          window.electronAPI?.settings.update({ focusMode: enabled })
        })
        window.electronAPI.onMenuEvent('menu:set-auto-launch', (data) => {
          const enabled = Boolean(data)
          useSettingsStore.getState().updateSettings({ autoLaunch: enabled })
          window.electronAPI?.settings.update({ autoLaunch: enabled })
        })
        window.electronAPI.onMenuEvent('menu:navigate' as any, (data) => {
          if (data) setActiveView(data as any)
        })
        // "Upgrade to Premium…" menu item → open the in-app paywall view.
        window.electronAPI.onMenuEvent('menu:open-upgrade', () => {
          if (IAP_ENABLED) setActiveView('upgrade')
        })

        // ── Load settings ────────────────────────────────────────────────
        const settingsData = await window.electronAPI.settings.get()
        setSettings(settingsData)
        document.documentElement.classList.toggle('dark', settingsData.theme === 'dark')

        // ── Check subscription ────────────────────────────────────────────
        let isSubscribed: boolean
        if (IAP_ENABLED) {
          isSubscribed = window.electronAPI.iap.checkSubscriptionStatus
            ? await window.electronAPI.iap.checkSubscriptionStatus()
            : false
        } else {
          isSubscribed = true // IAP disabled — treat all users as premium
        }
        updateSettings({ isPremium: isSubscribed })

        // ── First-launch onboarding gate ──────────────────────────────────
        if (!isSubscribed && !settingsData.hasSeenOnboarding) {
          setShowOnboarding(true)
          setIsLoading(false)
          return
        }

        // ── Auto-login (always, regardless of subscription) ──────────────
        const user = await window.electronAPI.auth.autoLogin()
        setCurrentUser(user)
        setIsLoggedIn(true)

        // ── Load workspaces ──────────────────────────────────────────────
        const workspaces = await window.electronAPI.workspace.list()
        setWorkspaces(workspaces)

        if (workspaces.length > 0) {
          const ws = workspaces[0]
          setActiveWorkspaceId(ws.id)
          const accounts = await window.electronAPI.workspaceAccount.list(ws.id)
          setWorkspaceAccounts(accounts || [])
          if (accounts?.length > 0) {
            setActiveWorkspaceAccountId(accounts[0].id)
            // Pre-load TikTok in the BrowserView so it's ready when user clicks messaging
            window.electronAPI.workspace.loadFacebook(ws.id, accounts[0].id).catch(() => {})
          }
        } else {
          // First-time user: auto-create workspace silently
          try {
            const newWs = await window.electronAPI.workspace.create('My Workspace', '💼', '#5C6BC0')
            if (newWs) {
              setWorkspaces([newWs])
              setActiveWorkspaceId(newWs.id)
              const retries = [0, 600]
              for (const delay of retries) {
                if (delay) await new Promise(r => setTimeout(r, delay))
                const newAcct = await window.electronAPI.workspaceAccount.add(newWs.id, 'TikTok Account')
                if (newAcct && !('error' in newAcct)) {
                  setWorkspaceAccounts([newAcct])
                  setActiveWorkspaceAccountId(newAcct.id)
                  window.electronAPI.workspace.loadFacebook(newWs.id, newAcct.id).catch(() => {})
                  break
                }
              }
            }
          } catch (e) {
            console.error('[App] auto-create workspace failed:', e)
          }
        }

        setActiveView('messaging')
        setIsLoading(false)

      } catch (err) {
        console.error('[App] init error:', err)
        setIsLoading(false)
      }
    }

    init()
  }, [])

  // ── Review prompt: show 60 s after first install, once only ─────────────
  useEffect(() => {
    if (localStorage.getItem('reviewRated') || localStorage.getItem('reviewPromptShown')) return
    const DELAY_MS = 60_000
    const stored = localStorage.getItem('firstLaunchTime')
    const firstLaunch = stored ? parseInt(stored, 10) : Date.now()
    if (!stored) localStorage.setItem('firstLaunchTime', String(firstLaunch))
    const elapsed = Date.now() - firstLaunch
    const remaining = Math.max(0, DELAY_MS - elapsed)
    const timer = setTimeout(() => {
      localStorage.setItem('reviewPromptShown', '1')
      setReviewModalOpen(true)
    }, remaining)
    return () => clearTimeout(timer)
  }, [])

  // ── ⌘K global shortcut ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        useUIStore.getState().setCommandPaletteOpen(true)
      }
      // Dev-only: ⌘⇧O → reset + show onboarding
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'O') {
        e.preventDefault()
        window.electronAPI?.settings.update({ hasSeenOnboarding: false, isPremium: false })
          .then(() => setShowOnboarding(true))
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (isLoading) return <SplashScreen forceVisible />

  if (showOnboarding) {
    return (
      <>
        <OnboardingScreen onComplete={() => setShowOnboarding(false)} />
        <Toaster position="bottom-right" richColors />
      </>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <WorkspaceView />

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <PreferencesModal />
      <DisclaimerModal />
      <CreateWorkspaceModal />
      <FeedbackModal open={isFeedbackModalOpen} onClose={() => setFeedbackModalOpen(false)} />
      <CommandPalette />
      <ReviewModal />
      <SplashScreen />
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
