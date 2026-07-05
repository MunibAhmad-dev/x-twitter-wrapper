import { useEffect, useMemo, useState } from 'react'
import { useSettingsStore } from '../../store/settingsStore'
import { useUIStore } from '../../store/uiStore'
import { getUniqueWorkspaceAccounts, useWorkspaceStore } from '../../store/workspaceStore'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog'
import { cn } from '../../lib/utils'
import {
  Home, MessageCircle, Bot, Languages, Target, Search, BarChart3,
  Settings, Sparkles, Trash2, Menu, Plus, Command,
  MessageSquarePlus, Bell, Palette, CalendarClock, Keyboard, Wand2,
  GitBranch, Zap,
} from 'lucide-react'
import type { WorkspaceAccount } from '../../../shared/types'
import type { ActiveView } from '../../../shared/types'
import { APP_VERSION } from '../../../shared/constants'

interface NavItem {
  id: ActiveView
  icon: React.ReactNode
  label: string
  premium?: boolean
  tooltip: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard',  icon: <Home className="h-5 w-5" />,          label: 'Dashboard',  tooltip: 'Dashboard — home screen' },
  { id: 'messaging',  icon: <MessageCircle className="h-5 w-5" />, label: 'Messaging',  tooltip: 'Open messaging view' },
]

const TOOL_ITEMS: NavItem[] = [
  { id: 'ai-reply',             icon: <Bot className="h-5 w-5" />,             label: 'AI Reply',      premium: true, tooltip: 'AI Reply Assistant' },
  { id: 'quick-reply',          icon: <MessageSquarePlus className="h-5 w-5" />,label: 'Quick Reply',  premium: true, tooltip: 'Quick Reply Composer' },
  { id: 'translate',            icon: <Languages className="h-5 w-5" />,       label: 'Translate',     premium: true, tooltip: 'Message Translation' },
  { id: 'content',              icon: <Wand2 className="h-5 w-5" />,           label: 'Post Studio',   premium: true, tooltip: 'AI Post Studio — captions & hashtags' },
  { id: 'thread-generator',     icon: <GitBranch className="h-5 w-5" />,       label: 'Thread Gen',    premium: true, tooltip: 'AI Thread Generator — create full threads' },
  { id: 'tweet-optimizer',      icon: <Zap className="h-5 w-5" />,             label: 'Optimizer',     premium: true, tooltip: 'AI Tweet Optimizer — maximize engagement' },
  { id: 'scheduler',            icon: <CalendarClock className="h-5 w-5" />,   label: 'Scheduler',    premium: true, tooltip: 'Message Scheduler' },
  { id: 'focus',                icon: <Target className="h-5 w-5" />,          label: 'Focus',        premium: true, tooltip: 'Focus Mode' },
  { id: 'filters',              icon: <Search className="h-5 w-5" />,          label: 'Filters',      premium: true, tooltip: 'Smart Filters' },
  { id: 'analytics',            icon: <BarChart3 className="h-5 w-5" />,       label: 'Analytics',    premium: true, tooltip: 'Advanced Analytics' },
  { id: 'notification-history', icon: <Bell className="h-5 w-5" />,            label: 'Notifications',premium: true, tooltip: 'Notification History' },
  { id: 'themes',               icon: <Palette className="h-5 w-5" />,         label: 'Themes',       premium: true, tooltip: 'Theme Customizer' },
  { id: 'shortcuts',            icon: <Keyboard className="h-5 w-5" />,        label: 'Shortcuts',    premium: false, tooltip: 'Keyboard Shortcuts' },
]

interface SidebarProps {
  onCreateWorkspace?: () => void
  onWorkspaceSelect?: (workspaceId: string) => void
}

export function Sidebar({ }: SidebarProps) {
  const { sidebarExpanded, theme, focusMode, updateSettings, isPremium } = useSettingsStore()
  const { setPrefsModalOpen, activeView, setActiveView, setActiveWorkspaceId, setCommandPaletteOpen, isDemoMode, setIsDemoMode } = useUIStore()
  const { workspaces, workspaceAccounts, activeWorkspaceAccountId, setWorkspaceAccounts, setActiveWorkspaceAccountId } = useWorkspaceStore()

  const [accountToRemove, setAccountToRemove] = useState<WorkspaceAccount | null>(null)
  const isMac = typeof window !== 'undefined' && navigator.userAgent.toLowerCase().includes('mac')
  const isExpanded = sidebarExpanded

  const uniqueAccounts = useMemo(() => getUniqueWorkspaceAccounts(workspaceAccounts), [workspaceAccounts])
  const activeAccount = uniqueAccounts.find(a => a.id === activeWorkspaceAccountId) || uniqueAccounts[0]

  useEffect(() => {
    window.electronAPI?.setModalOpen(!!accountToRemove)
  }, [accountToRemove])

  const handleNavClick = async (view: ActiveView) => {
    if (view === 'messaging') {
      // If no account yet, go to dashboard
      if (!activeAccount) { setActiveView('dashboard'); return; }
      const wsId = workspaces[0]?.id || activeAccount.workspaceId
      setActiveWorkspaceId(wsId)
      await window.electronAPI?.workspace.loadFacebook(wsId, activeAccount.id)
    }
    setActiveView(view)
  }

  const handleAccountClick = async (account: WorkspaceAccount) => {
    const wsId = workspaces[0]?.id || account.workspaceId
    setActiveWorkspaceId(wsId)
    setActiveWorkspaceAccountId(account.id)
    await window.electronAPI?.workspace.loadFacebook(wsId, account.id)
    setActiveView('messaging')
  }

  const handleAddAccount = async () => {
    const wsId = workspaces[0]?.id
    if (!wsId) return
    const newAccount = await window.electronAPI?.workspaceAccount.add(wsId, 'New Account')
    if (!newAccount || 'error' in newAccount) return
    const accounts = await window.electronAPI?.workspaceAccount.list(wsId) || []
    setWorkspaceAccounts(accounts)
    setActiveWorkspaceAccountId(newAccount.id)
    await window.electronAPI?.workspace.loadFacebook(wsId, newAccount.id)
    setActiveView('messaging')
  }

  const handleConfirmRemove = async () => {
    if (!accountToRemove) return
    const wsId = accountToRemove.workspaceId
    setAccountToRemove(null)
    setActiveWorkspaceAccountId(null)
    await window.electronAPI?.workspace.hideFacebook()
    await window.electronAPI?.workspaceAccount.remove(accountToRemove.id)
    const remaining = (await window.electronAPI?.workspaceAccount.list(wsId)) || []
    setWorkspaceAccounts(remaining)
    if (remaining.length > 0) {
      setActiveWorkspaceAccountId(remaining[0].id)
      await window.electronAPI?.workspace.loadFacebook(wsId, remaining[0].id)
      setActiveView('messaging')
    } else {
      setActiveView('dashboard')
    }
  }

  const handleToggleExpand = () => {
    const next = !sidebarExpanded
    updateSettings({ sidebarExpanded: next })
    window.electronAPI?.settings.update({ sidebarExpanded: next })
  }

  const W = isExpanded ? 'w-56' : 'w-[72px]'

  return (
    <div className={cn(
      'h-screen bg-[#f7f9f9] dark:bg-[#000000] border-r border-border/50 flex flex-col overflow-hidden transition-all duration-300 shrink-0',
      W
    )}>
      {/* Top bar */}
      <div className={cn('flex items-center border-b border-border/30 px-3 py-3 bg-background/60 backdrop-blur-xl', isMac && 'pt-10', isExpanded ? 'justify-between' : 'justify-center')}>
        {isExpanded && (
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <img src="/logo.png" alt="Apps for X" className="w-7 h-7 rounded-xl shrink-0 shadow-sm object-cover" />
            <span className="text-[13px] font-semibold text-foreground truncate leading-tight">Apps for X</span>
          </div>
        )}
        <button
          onClick={handleToggleExpand}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors shrink-0"
          title="Toggle sidebar"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable area — custom thin scrollbar via .sidebar-scroll CSS class */}
      <div className="sidebar-scroll flex-1 py-2 flex flex-col gap-1 px-2">

        {/* Main navigation */}
        {NAV_ITEMS.map(item => (
          <NavButton
            key={item.id}
            item={item}
            isActive={activeView === item.id}
            isExpanded={isExpanded}
            onClick={() => handleNavClick(item.id)}
          />
        ))}

        {/* Accounts — always visible in sidebar */}
        {uniqueAccounts.length > 0 && (
          <div className={cn('mt-1 mb-1', isExpanded ? 'pl-1' : 'px-0')}>
            {isExpanded && (
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5 mt-1">
                Accounts
              </p>
            )}
            <div className="flex flex-col gap-1">
              {uniqueAccounts.map(account => {
                const isActive = account.id === activeWorkspaceAccountId && activeView === 'messaging'
                return (
                  <button
                    key={account.id}
                    onClick={() => handleAccountClick(account)}
                    onContextMenu={e => { e.preventDefault(); setAccountToRemove(account) }}
                    title={account.label}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-all duration-150 group',
                      isExpanded ? 'w-full' : 'w-10 h-10 justify-center mx-auto',
                      isActive
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                  >
                    {/* ── Avatar: show TikTok profile picture when synced ── */}
                    <div className="relative shrink-0">
                      <Avatar className={cn(
                        isExpanded ? 'h-8 w-8' : 'h-9 w-9',
                        isActive ? 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background' : 'ring-1 ring-border/40'
                      )}>
                        {/* AvatarImage loads the TikTok profile picture */}
                        {account.avatarUrl && (
                          <AvatarImage
                            src={account.avatarUrl}
                            alt={account.label}
                            className="object-cover"
                          />
                        )}
                        {/* Fallback: coloured initials before picture syncs */}
                        <AvatarFallback
                          style={{ backgroundColor: account.avatarColor }}
                          className="text-white font-bold text-[10px]"
                        >
                          {account.avatarText}
                        </AvatarFallback>
                      </Avatar>
                      {/* Green "online" dot when this account is active */}
                      {isActive && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
                      )}
                    </div>

                    {/* ── Name label (expanded sidebar only) ─────────────── */}
                    {isExpanded && (
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          'text-[12px] font-semibold truncate block leading-tight',
                          isActive ? 'text-primary' : 'text-foreground/90 group-hover:text-foreground'
                        )}>
                          {account.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate block">
                          {isActive ? 'Active' : account.avatarUrl ? 'Synced' : 'Tap to open'}
                        </span>
                      </div>
                    )}
                  </button>
                )
              })}

              {/* Add account — show for all users when they have no accounts,
                  show for premium when they want more accounts */}
              {(isPremium || uniqueAccounts.length === 0) && (
                <button
                  onClick={handleAddAccount}
                  title="Add account"
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-2 py-2 text-left text-muted-foreground hover:bg-accent hover:text-foreground transition-all',
                    isExpanded ? 'w-full' : 'w-10 h-10 justify-center mx-auto'
                  )}
                >
                  <div className={cn('shrink-0 rounded-full bg-muted/60 flex items-center justify-center', isExpanded ? 'h-7 w-7' : 'h-8 w-8')}>
                    <Plus className="h-3.5 w-3.5" />
                  </div>
                  {isExpanded && <span className="text-[12px] font-semibold">Add account</span>}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Productivity tools */}
        <div className={cn('mt-2', isExpanded ? 'pl-0' : 'px-0')}>
          {isExpanded && (
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1.5 flex items-center gap-1">
              Tools
              {!isPremium && <Sparkles className="h-2.5 w-2.5 text-[#1D9BF0]" />}
            </p>
          )}
          {TOOL_ITEMS.map(item => (
            <NavButton
              key={item.id}
              item={item}
              isActive={activeView === item.id}
              isExpanded={isExpanded}
              isPremiumLocked={item.premium && !isPremium}
              onClick={() => handleNavClick(item.id)}
            />
          ))}
        </div>

        {/* Command palette shortcut */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          title="Command Palette (⌘K)"
          className={cn(
            'flex items-center gap-2.5 rounded-xl px-2 py-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-all',
            isExpanded ? 'w-full mt-1' : 'w-10 h-10 justify-center mx-auto mt-1'
          )}
        >
          <div className={cn('shrink-0 flex items-center justify-center', isExpanded ? 'w-7 h-7' : 'w-8 h-8')}>
            <Command className="h-4 w-4" />
          </div>
          {isExpanded && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="text-[12px] font-semibold">Command Palette</span>
              <kbd className="text-[9px] font-mono bg-muted border border-border rounded px-1 py-0.5 text-muted-foreground">⌘K</kbd>
            </div>
          )}
        </button>
      </div>

      {/* Bottom actions */}
      <div className={cn('border-t border-border/30 p-2 flex flex-col gap-1', isExpanded ? '' : 'items-center')}>
        {/* Try Demo */}
        <button
          onClick={() => {
            const next = !isDemoMode
            setIsDemoMode(next)
            if (next) setActiveView('messaging')
          }}
          title={isDemoMode ? 'Exit Demo' : 'Try Demo'}
          className={cn(
            'flex items-center gap-2.5 rounded-xl px-2 py-2 transition-all',
            isExpanded ? 'w-full' : 'w-10 h-10 justify-center',
            isDemoMode
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          <div className={cn('shrink-0 flex items-center justify-center', isExpanded ? 'w-7 h-7' : 'w-8 h-8')}>
            <span className="text-sm">{isDemoMode ? '✓' : '▶'}</span>
          </div>
          {isExpanded && (
            <div className="flex items-center justify-between flex-1 min-w-0">
              <span className="text-[12px] font-semibold">{isDemoMode ? 'Exit Demo' : 'Try Demo'}</span>
              {isDemoMode && <span className="text-[9px] font-bold bg-emerald-500 text-white rounded-full px-1.5 py-0.5">ON</span>}
            </div>
          )}
          {!isExpanded && isDemoMode && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full" />
          )}
        </button>

        {/* Settings */}
        <button
          onClick={() => { window.electronAPI?.setModalOpen(true); setPrefsModalOpen(true) }}
          title="Settings"
          className={cn(
            'flex items-center gap-2.5 rounded-xl px-2 py-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-all',
            isExpanded ? 'w-full' : 'w-10 h-10 justify-center'
          )}
        >
          <div className={cn('shrink-0 flex items-center justify-center', isExpanded ? 'w-7 h-7' : 'w-8 h-8')}>
            <Settings className="h-4 w-4" />
          </div>
          {isExpanded && <span className="text-[12px] font-semibold flex-1">Settings</span>}
        </button>

        {/* Version */}
        {isExpanded && (
          <p className="text-[10px] text-muted-foreground/50 text-center py-1 select-none">v{APP_VERSION}</p>
        )}
      </div>

      {/* Remove account dialog */}
      <Dialog open={!!accountToRemove} onOpenChange={open => !open && setAccountToRemove(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Remove Account
            </DialogTitle>
            <DialogDescription>
              Remove <strong>{accountToRemove?.label}</strong>? This clears it from the sidebar. You can re-add it anytime.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setAccountToRemove(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleConfirmRemove}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function NavButton({ item, isActive, isExpanded, onClick, isPremiumLocked }: {
  item: NavItem; isActive: boolean; isExpanded: boolean; onClick: () => void; isPremiumLocked?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={item.tooltip}
      className={cn(
        'relative flex items-center gap-2.5 rounded-xl px-2 py-2 transition-all duration-150 group',
        isExpanded ? 'w-full' : 'w-10 h-10 justify-center mx-auto',
        isActive
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <div className={cn('shrink-0 flex items-center justify-center', isExpanded ? 'w-7 h-7' : 'w-8 h-8')}>
        {item.icon}
      </div>
      {isExpanded && <span className="text-[12px] font-semibold flex-1 truncate">{item.label}</span>}
      {isPremiumLocked && isExpanded && (
        <span className="text-[9px] font-bold text-[#1D9BF0] bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 border border-[#1D9BF0]/30 dark:border-[#1D9BF0]/40 rounded-full px-1.5 py-0.5 shrink-0">
          PRO
        </span>
      )}
      {isPremiumLocked && !isExpanded && (
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#1D9BF0] rounded-full flex items-center justify-center text-[7px] text-white font-bold">
          ✦
        </span>
      )}
    </button>
  )
}
