import { create } from 'zustand'
import type { AppSettings } from '../../shared/types'
import { IAP_ENABLED } from '../../shared/constants'

interface SettingsStore extends AppSettings {
  // AI assistant
  aiApiKey: string
  // Translation
  translateApiKey: string
  targetLanguage: string
  autoTranslate: boolean
  // Focus
  focusScheduled: boolean
  focusDurationMinutes: number
  // Filters
  activeFilters: string[]
  // Dock
  showDockBadge: boolean
  // Appearance
  accentColor: string
  compactMode: boolean
  fontSize: 'small' | 'medium' | 'large'
  // Actions
  setSettings: (settings: AppSettings) => void
  updateSettings: (patch: Partial<Omit<SettingsStore, 'setSettings' | 'updateSettings'>>) => void
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  activeAccountId: null,
  focusMode: false,
  autoLaunch: false,
  showNotifications: true,
  isPremium: !IAP_ENABLED,
  premiumExpiresAt: undefined,
  premiumProductId: undefined,
  sidebarExpanded: false,
  theme: 'dark',

  // Premium feature defaults
  aiApiKey: '',
  translateApiKey: '',
  targetLanguage: 'en',
  autoTranslate: false,
  focusScheduled: false,
  focusDurationMinutes: 25,
  activeFilters: [],
  showDockBadge: true,
  accentColor: '#6366f1',
  compactMode: false,
  fontSize: 'medium' as const,

  setSettings: (settings) => set((state) => ({ ...state, ...settings })),
  updateSettings: (patch) => set((state) => ({ ...state, ...patch })),
}))