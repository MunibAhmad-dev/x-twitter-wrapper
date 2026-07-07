import type { Account, AppSettings, User, Workspace, WorkspaceAccount } from '../../shared/types'

declare global {
  interface Window {
    electronAPI: {
      accounts: {
        list: () => Promise<Account[]>
        add: (label: string, email?: string) => Promise<Account | { error: string }>
        remove: (id: string) => Promise<void>
        switch: (id: string) => Promise<Account | undefined>
        onUpdated: (cb: (accounts: Account[]) => void) => void
      }
      settings: {
        get: () => Promise<AppSettings>
        update: (patch: Partial<AppSettings>) => Promise<AppSettings>
        onUpdated: (cb: (s: AppSettings) => void) => void
      }
      iap: {
        purchase: (productId: string) => Promise<{ success: boolean; error?: string }>
        restore: () => Promise<{ success: boolean; error?: string }>
        getProducts: (productIds: string[]) => Promise<{ id: string; title: string; description: string; price: string; currency: string }[]>
        checkSubscriptionStatus: () => Promise<boolean>
        resetSubscription: () => Promise<boolean>
        onPremiumUnlocked: (cb: (productId: string) => void) => void
        onPurchaseFailed: (cb: (reason: string) => void) => void
        onPurchaseDeferred?: (cb: () => void) => void
      }
      auth: {
        signup: (username: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>
        login: (username: string, password: string) => Promise<{ success: boolean; user?: User; error?: string }>
        logout: () => Promise<{ success: boolean }>
        getCurrentUser: () => Promise<User | null>
        isLoggedIn: () => Promise<boolean>
        autoLogin: () => Promise<User>
      }
      iapDevMode: {
        setDevMode: (enabled: boolean) => Promise<{ success: boolean }>
        isDevMode: () => Promise<boolean>
      }
      icloud: {
        login: () => Promise<{ success: boolean; user?: User; error?: string }>
      }
      workspace: {
        create: (name: string, icon?: string, color?: string) => Promise<Workspace | null>
        list: () => Promise<Workspace[]>
        get: (id: string) => Promise<Workspace | null>
        update: (id: string, updates: Partial<Workspace>) => Promise<Workspace | null>
        delete: (id: string) => Promise<boolean>
        setPremium: (id: string, isPremium: boolean) => Promise<boolean>
        loadX: (workspaceId: string, accountId?: string) => Promise<{ success: boolean; accountId?: string; error?: string }>
        hideX: () => Promise<boolean>
      }
      workspaceAccount: {
        add: (workspaceId: string, label: string, email?: string) => Promise<WorkspaceAccount | { error: string }>
        list: (workspaceId: string) => Promise<WorkspaceAccount[]>
        get: (id: string) => Promise<WorkspaceAccount | null>
        remove: (id: string) => Promise<boolean>
        onUpdated: (cb: (accounts: WorkspaceAccount[]) => void) => void
      }
      browser: {
        goBack: () => Promise<{ canGoBack: boolean; canGoForward: boolean; url: string }>
        goForward: () => Promise<{ canGoBack: boolean; canGoForward: boolean; url: string }>
        loadX: () => Promise<{ success: boolean; canGoBack: boolean; canGoForward: boolean; url: string }>
        loadMessenger: () => Promise<{ success: boolean; canGoBack: boolean; canGoForward: boolean; url: string }>
        loadLanguageSettings: () => Promise<{ success: boolean; canGoBack: boolean; canGoForward: boolean; url: string }>
        reload: () => Promise<{ canGoBack: boolean; canGoForward: boolean; url: string }>
        getState: () => Promise<{ canGoBack: boolean; canGoForward: boolean; url: string }>
        getSelectedText: () => Promise<{ text: string }>
        onNavigationUpdated: (cb: (state: { canGoBack: boolean; canGoForward: boolean; url: string }) => void) => void
      }
      onUnreadCountsUpdated: (cb: (counts: Record<string, number>) => void) => void
      onNotificationClicked: (cb: (accountId: string) => void) => void
      onNotificationLogged: (cb: (entry: { id: string; accountId: string; title: string; body: string; receivedAt: number }) => void) => void
      setModalOpen: (isOpen: boolean) => void
      setMessagingActive: (active: boolean) => void
      ai: {
        generateReplies: (inputText: string, tone: string) => Promise<{ success: boolean; replies?: string[]; error?: string }>
        translate: (text: string, targetLangCode: string) => Promise<{ success: boolean; text?: string; error?: string }>
        generatePostContent: (topic: string, kind: 'caption' | 'hashtags', tone?: string) => Promise<{ success: boolean; text?: string; hashtags?: string[]; error?: string }>
        generateThread: (topic: string, tweetCount: number, tone: string) => Promise<{ success: boolean; tweets?: string[]; error?: string }>
        optimizeTweet: (tweet: string) => Promise<{ success: boolean; optimized?: string; explanation?: string; error?: string }>
      }
      injectText: (text: string) => Promise<{ success: boolean; error?: string }>
      setToolbarHeight: (height: number) => void
      onBarAiReply: (cb: (text: string) => void) => void
      onBarTranslate: (cb: (text: string) => void) => void
      dock: {
        setBadgeEnabled: (enabled: boolean) => void
        getCount: () => Promise<number>
      }
      openExternal: (url: string) => void
      onMenuEvent: (event: string, cb: (data?: unknown) => void) => void
      window: {
        setClosable: (enabled: boolean) => void
        setMinimizable: (enabled: boolean) => void
      }
    }
  }
}

export {}
