import { useEffect, useRef, useState, useMemo } from 'react'
import { useUIStore } from '../store/uiStore'
import { useWorkspaceStore, getUniqueWorkspaceAccounts } from '../store/workspaceStore'
import { useSettingsStore } from '../store/settingsStore'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import {
  Bot, Languages, Target, Search as SearchIcon, BarChart3,
  Command, Home, MessageCircle, Settings, Sparkles, UserPlus,
  MessageSquarePlus, Bell, Palette, CalendarClock, Keyboard,
} from 'lucide-react'
import type { ActiveView } from '../../shared/types'

interface CommandItem {
  id: string
  label: string
  subtitle?: string
  icon: React.ReactNode
  action: () => void
  category: string
  keywords?: string
}

export function CommandPalette() {
  const { isCommandPaletteOpen, setCommandPaletteOpen, setActiveView, setPrefsModalOpen, setCreateWorkspaceModalOpen } = useUIStore()
  const { workspaceAccounts, setActiveWorkspaceAccountId } = useWorkspaceStore()
  const { isPremium } = useSettingsStore()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const accounts = useMemo(() => getUniqueWorkspaceAccounts(workspaceAccounts), [workspaceAccounts])

  const openAccount = async (accountId: string) => {
    const account = workspaceAccounts.find(a => a.id === accountId)
    if (!account) return
    setActiveWorkspaceAccountId(accountId)
    await window.electronAPI?.workspace.loadFacebook(account.workspaceId, accountId)
    setActiveView('messaging')
    setCommandPaletteOpen(false)
  }

  const navTo = (view: ActiveView) => {
    setActiveView(view)
    setCommandPaletteOpen(false)
  }

  const allCommands: CommandItem[] = useMemo(() => {
    const base: CommandItem[] = [
      {
        id: 'home',
        label: 'Go to Dashboard',
        subtitle: 'Home screen with all accounts and tools',
        icon: <Home className="h-4 w-4" />,
        action: () => navTo('dashboard'),
        category: 'Navigation',
        keywords: 'home dashboard',
      },
      {
        id: 'messaging',
        label: 'Open Messaging',
        subtitle: 'Switch to the messaging view',
        icon: <MessageCircle className="h-4 w-4" />,
        action: () => navTo('messaging'),
        category: 'Navigation',
        keywords: 'chat message',
      },
      {
        id: 'ai-reply',
        label: isPremium ? 'AI Reply Assistant' : '🔒 AI Reply Assistant',
        subtitle: 'Generate smart reply suggestions',
        icon: <Bot className="h-4 w-4" />,
        action: () => navTo(isPremium ? 'ai-reply' : 'upgrade'),
        category: 'Tools',
        keywords: 'ai reply generate suggestions',
      },
      {
        id: 'translate',
        label: isPremium ? 'Message Translation' : '🔒 Message Translation',
        subtitle: 'Translate messages into 14 languages',
        icon: <Languages className="h-4 w-4" />,
        action: () => navTo(isPremium ? 'translate' : 'upgrade'),
        category: 'Tools',
        keywords: 'translate language',
      },
      {
        id: 'content',
        label: isPremium ? 'AI Post Studio' : '🔒 AI Post Studio',
        subtitle: 'Generate post captions & trending hashtags',
        icon: <Sparkles className="h-4 w-4" />,
        action: () => navTo(isPremium ? 'content' : 'upgrade'),
        category: 'Tools',
        keywords: 'caption hashtags post content studio title description',
      },
      {
        id: 'focus',
        label: isPremium ? 'Focus Mode' : '🔒 Focus Mode',
        subtitle: 'Start a distraction-free session',
        icon: <Target className="h-4 w-4" />,
        action: () => navTo(isPremium ? 'focus' : 'upgrade'),
        category: 'Tools',
        keywords: 'focus dnd do not disturb timer',
      },
      {
        id: 'filters',
        label: isPremium ? 'Smart Filters' : '🔒 Smart Filters',
        subtitle: 'Filter conversations by type or status',
        icon: <SearchIcon className="h-4 w-4" />,
        action: () => navTo(isPremium ? 'filters' : 'upgrade'),
        category: 'Tools',
        keywords: 'filter search unread business personal',
      },
      {
        id: 'analytics',
        label: isPremium ? 'Analytics' : '🔒 Analytics',
        subtitle: 'View account activity and statistics',
        icon: <BarChart3 className="h-4 w-4" />,
        action: () => navTo(isPremium ? 'analytics' : 'upgrade'),
        category: 'Tools',
        keywords: 'analytics stats unread activity',
      },
      {
        id: 'settings',
        label: 'Open Settings',
        subtitle: 'App preferences and account management',
        icon: <Settings className="h-4 w-4" />,
        action: () => {
          window.electronAPI?.setModalOpen(true)
          setPrefsModalOpen(true)
          setCommandPaletteOpen(false)
        },
        category: 'App',
        keywords: 'preferences settings config',
      },
      {
        id: 'add-account',
        label: 'Add Account',
        subtitle: 'Add a new messaging account',
        icon: <UserPlus className="h-4 w-4" />,
        action: () => {
          window.electronAPI?.setModalOpen(true)
          setCreateWorkspaceModalOpen(true)
          setCommandPaletteOpen(false)
        },
        category: 'App',
        keywords: 'add new account create',
      },
      {
        id: 'quick-reply',
        label: isPremium ? 'Quick Reply Composer' : '🔒 Quick Reply Composer',
        subtitle: 'Draft replies natively without opening the web view',
        icon: <MessageSquarePlus className="h-4 w-4" />,
        action: () => navTo(isPremium ? 'quick-reply' : 'upgrade'),
        category: 'Tools',
        keywords: 'quick reply compose draft message',
      },
      {
        id: 'scheduler',
        label: isPremium ? 'Message Scheduler' : '🔒 Message Scheduler',
        subtitle: 'Schedule messages to be sent at a specific time',
        icon: <CalendarClock className="h-4 w-4" />,
        action: () => navTo(isPremium ? 'scheduler' : 'upgrade'),
        category: 'Tools',
        keywords: 'schedule message later time',
      },
      {
        id: 'notification-history',
        label: isPremium ? 'Notification History' : '🔒 Notification History',
        subtitle: 'Log of all received notifications',
        icon: <Bell className="h-4 w-4" />,
        action: () => navTo(isPremium ? 'notification-history' : 'upgrade'),
        category: 'Tools',
        keywords: 'notification history log bell',
      },
      {
        id: 'themes',
        label: isPremium ? 'Theme Customizer' : '🔒 Theme Customizer',
        subtitle: 'Accent colours, text size, layout density',
        icon: <Palette className="h-4 w-4" />,
        action: () => navTo(isPremium ? 'themes' : 'upgrade'),
        category: 'Tools',
        keywords: 'theme colour accent appearance customize',
      },
      {
        id: 'shortcuts',
        label: 'Keyboard Shortcuts',
        subtitle: 'View all keyboard shortcuts',
        icon: <Keyboard className="h-4 w-4" />,
        action: () => navTo('shortcuts'),
        category: 'App',
        keywords: 'keyboard shortcuts hotkeys help',
      },
      ...(!isPremium ? [{
        id: 'upgrade',
        label: '⭐ Upgrade to Premium',
        subtitle: 'Unlock AI, Translation, Quick Reply, Analytics and more',
        icon: <Sparkles className="h-4 w-4 text-[#1D9BF0]" />,
        action: () => navTo('upgrade'),
        category: 'App',
        keywords: 'upgrade premium subscribe',
      }] : []),
    ]

    const accountCommands: CommandItem[] = accounts.map(account => ({
      id: `account-${account.id}`,
      label: `Open ${account.label}`,
      subtitle: 'Switch to this account',
      icon: (
        <Avatar className="h-4 w-4">
          {account.avatarUrl && <AvatarFallback style={{ backgroundColor: account.avatarColor }} className="text-white text-[8px] font-bold">{account.avatarText}</AvatarFallback>}
        </Avatar>
      ),
      action: () => openAccount(account.id),
      category: 'Accounts',
      keywords: account.label.toLowerCase(),
    }))

    return [...accountCommands, ...base]
  }, [accounts, isPremium])

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands
    const q = query.toLowerCase()
    return allCommands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.subtitle?.toLowerCase().includes(q) ||
      c.keywords?.includes(q)
    )
  }, [allCommands, query])

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, CommandItem[]> = {}
    filtered.forEach(c => {
      if (!map[c.category]) map[c.category] = []
      map[c.category].push(c)
    })
    return map
  }, [filtered])

  // True global index for each item by id — avoids collision when same-category
  // items are non-contiguous in the filtered array (e.g. Tools items appear both
  // before and after App items in allCommands).
  const itemIndex = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach((item, idx) => { map[item.id] = idx })
    return map
  }, [filtered])

  // Reset on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isCommandPaletteOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isCommandPaletteOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelected(s => Math.min(s + 1, filtered.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelected(s => Math.max(s - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        filtered[selected]?.action()
      } else if (e.key === 'Escape') {
        setCommandPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isCommandPaletteOpen, filtered, selected])

  return (
    <Dialog open={isCommandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent className="p-0 overflow-hidden border shadow-2xl" hideCloseButton style={{ maxWidth: 560, borderRadius: 16 }}>
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        {/* Search input — Radix close button hidden via [&>button]:hidden; ESC key still works */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
          <Command className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="text-[10px] font-mono bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground shrink-0">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {category}
                </div>
                {items.map((item) => {
                    const idx = itemIndex[item.id]
                    const isSelected = idx === selected
                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelected(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                          isSelected ? 'bg-accent' : ''
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                        }`}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                          {item.subtitle && (
                            <p className="text-[11px] text-muted-foreground truncate">{item.subtitle}</p>
                          )}
                        </div>
                        {isSelected && (
                          <kbd className="text-[10px] font-mono bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground shrink-0">
                            ↵
                          </kbd>
                        )}
                      </button>
                    )
                  })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
