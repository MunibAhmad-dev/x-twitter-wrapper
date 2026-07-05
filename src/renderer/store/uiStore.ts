import { create } from 'zustand'
import type { ActiveView, User } from '../../shared/types'

type DemoToolbarMode = 'ai' | 'translate' | 'quick-reply'

interface UIStore {
  // Auth
  currentUser: User | null
  isLoggedIn: boolean

  // Active view / navigation
  activeView: ActiveView
  activeWorkspaceId: string | null
  splashVisible: boolean

  // Unread counts (populated from IPC)
  unreadCounts: Record<string, number>

  // Modals
  isUpgradeModalOpen: boolean
  isPrefsModalOpen: boolean
  isDisclaimerModalOpen: boolean
  isCreateWorkspaceModalOpen: boolean
  isFeedbackModalOpen: boolean
  isCommandPaletteOpen: boolean
  isReviewModalOpen: boolean

  // Pending text — set when user clicks "→ AI Reply" / "→ Translate" in toolbar
  // so the dedicated panel can pre-fill its input without clipboard
  pendingAIText: string
  pendingTranslateText: string

  // Demo mode
  isDemoMode: boolean
  pendingDemoText: string
  demoToolbarMode: DemoToolbarMode | null
  demoToolbarPrefill: string

  // Actions
  setCurrentUser: (user: User | null) => void
  setIsLoggedIn: (loggedIn: boolean) => void
  setActiveView: (view: ActiveView) => void
  setActiveWorkspaceId: (id: string | null) => void
  setUnreadCounts: (counts: Record<string, number>) => void
  setUpgradeModalOpen: (open: boolean) => void
  setPrefsModalOpen: (open: boolean) => void
  setDisclaimerModalOpen: (open: boolean) => void
  setCreateWorkspaceModalOpen: (open: boolean) => void
  setFeedbackModalOpen: (open: boolean) => void
  setCommandPaletteOpen: (open: boolean) => void
  setReviewModalOpen: (open: boolean) => void
  hideSplash: () => void
  setPendingAIText: (text: string) => void
  setPendingTranslateText: (text: string) => void
  setIsDemoMode: (demo: boolean) => void
  setPendingDemoText: (text: string) => void
  setDemoToolbar: (mode: DemoToolbarMode | null, prefill?: string) => void
}

export const useUIStore = create<UIStore>((set) => ({
  currentUser: null,
  isLoggedIn: false,

  activeView: 'messaging',
  activeWorkspaceId: null,
  splashVisible: true,
  unreadCounts: {},

  isUpgradeModalOpen: false,
  isPrefsModalOpen: false,
  isDisclaimerModalOpen: false,
  isCreateWorkspaceModalOpen: false,
  isFeedbackModalOpen: false,
  isCommandPaletteOpen: false,
  isReviewModalOpen: false,

  pendingAIText: '',
  pendingTranslateText: '',

  isDemoMode: false,
  pendingDemoText: '',
  demoToolbarMode: null,
  demoToolbarPrefill: '',

  setCurrentUser: (user) => set({ currentUser: user }),
  setIsLoggedIn: (loggedIn) => set({ isLoggedIn: loggedIn }),
  setActiveView: (view) => set({ activeView: view }),
  setActiveWorkspaceId: (id) => set({ activeWorkspaceId: id }),
  setUnreadCounts: (counts) => set({ unreadCounts: counts }),
  setUpgradeModalOpen: (open) => set({ isUpgradeModalOpen: open }),
  setPrefsModalOpen: (open) => set({ isPrefsModalOpen: open }),
  setDisclaimerModalOpen: (open) => set({ isDisclaimerModalOpen: open }),
  setCreateWorkspaceModalOpen: (open) => set({ isCreateWorkspaceModalOpen: open }),
  setFeedbackModalOpen: (open) => set({ isFeedbackModalOpen: open }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setReviewModalOpen: (open) => set({ isReviewModalOpen: open }),
  hideSplash: () => set({ splashVisible: false }),
  setPendingAIText: (text) => set({ pendingAIText: text }),
  setPendingTranslateText: (text) => set({ pendingTranslateText: text }),
  setIsDemoMode: (demo) => set({ isDemoMode: demo }),
  setPendingDemoText: (text) => set({ pendingDemoText: text }),
  setDemoToolbar: (mode, prefill = '') => set({ demoToolbarMode: mode, demoToolbarPrefill: prefill }),
}))
