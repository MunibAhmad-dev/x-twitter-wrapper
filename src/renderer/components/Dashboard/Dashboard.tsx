import { useMemo } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useSettingsStore } from '../../store/settingsStore'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { getUniqueWorkspaceAccounts } from '../../store/workspaceStore'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { PREMIUM_FEATURE_LIST } from '../../../shared/constants'
import {
  Bot, Languages, Target, Search, BarChart3,
  RefreshCw, UserPlus, Sparkles, MessageCircle, Settings,
  MessageSquarePlus, Bell, Palette, CalendarClock, Keyboard,
} from 'lucide-react'
import type { ActiveView } from '../../../shared/types'

// Map each feature emoji to a Lucide icon
const FEATURE_ICONS: Record<string, React.ReactNode> = {
  '🤖': <Bot className="w-5 h-5" />,
  '✍️': <MessageSquarePlus className="w-5 h-5" />,
  '🌐': <Languages className="w-5 h-5" />,
  '📅': <CalendarClock className="w-5 h-5" />,
  '🎯': <Target className="w-5 h-5" />,
  '🔍': <Search className="w-5 h-5" />,
  '📊': <BarChart3 className="w-5 h-5" />,
  '🔔': <Bell className="w-5 h-5" />,
  '🎨': <Palette className="w-5 h-5" />,
  '💼': <UserPlus className="w-5 h-5" />,
  '⌨️': <Keyboard className="w-5 h-5" />,
  '🔄': <RefreshCw className="w-5 h-5" />,
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export function Dashboard() {
  const { setActiveView, setActiveWorkspaceId, unreadCounts, setPrefsModalOpen, isDemoMode, setIsDemoMode } = useUIStore()
  const { isPremium } = useSettingsStore()
  const { workspaceAccounts, workspaces, setActiveWorkspaceAccountId, setWorkspaces, setWorkspaceAccounts } = useWorkspaceStore()

  const accounts = useMemo(() => getUniqueWorkspaceAccounts(workspaceAccounts), [workspaceAccounts])
  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((s, n) => s + n, 0),
    [unreadCounts]
  )

  const handleOpenAccount = async (accountId: string) => {
    const account = workspaceAccounts.find(a => a.id === accountId)
    if (!account) return
    const wsId = workspaces[0]?.id || account.workspaceId
    setActiveWorkspaceId(wsId)
    setActiveWorkspaceAccountId(accountId)
    await window.electronAPI?.workspace.loadFacebook(wsId, accountId)
    setActiveView('messaging')
  }

  // Simple add-account: just create the account and open X.
  // No modal, no workspace setup. X profile picture and name
  // auto-sync in the background once the user logs in.
  const handleAddAccount = async () => {
    // Ensure a workspace exists (silently create one if not)
    let wsId = workspaces[0]?.id
    if (!wsId) {
      const ws = await window.electronAPI?.workspace.create('Accounts', '💬', '#5C6BC0')
      if (!ws) return
      setWorkspaces([ws])
      setActiveWorkspaceId(ws.id)
      wsId = ws.id
    }
    const newAccount = await window.electronAPI?.workspaceAccount.add(wsId, 'X Account')
    if (!newAccount || 'error' in newAccount) return
    const allAccounts = await window.electronAPI?.workspaceAccount.list(wsId) || []
    setWorkspaceAccounts(allAccounts)
    setActiveWorkspaceAccountId(newAccount.id)
    await window.electronAPI?.workspace.loadFacebook(wsId, newAccount.id)
    setActiveView('messaging')
    // Profile picture and real name sync automatically after X loads
  }

  const handleFeatureClick = (view: string) => {
    setActiveView(view as ActiveView)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-background">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-8 py-5 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-foreground leading-tight">
              {getGreeting()} 👋
            </h1>
            <p className="text-xs text-muted-foreground">
              {accounts.length === 0
                ? 'Add an account to get started'
                : `${accounts.length} account${accounts.length !== 1 ? 's' : ''} · ${totalUnread > 0 ? `${totalUnread} unread` : 'all caught up'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {!isPremium && (
            <Button
              size="sm"
              className="gap-1.5 bg-[#1D9BF0] hover:bg-[#E0234A] text-white text-xs border-none"
              onClick={() => setActiveView('upgrade')}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Upgrade
            </Button>
          )}
          <Button
            size="sm"
            variant={isDemoMode ? 'outline' : 'secondary'}
            className={`text-xs gap-1.5 ${isDemoMode ? 'border-emerald-500 text-emerald-600' : ''}`}
            onClick={() => {
              const next = !isDemoMode
              setIsDemoMode(next)
              if (next) setActiveView('messaging')
            }}
          >
            {isDemoMode ? '✓ Exit Demo' : '▶ Try Demo'}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => {
              window.electronAPI?.setModalOpen(true)
              setPrefsModalOpen(true)
            }}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex-1 px-8 py-6 space-y-8 max-w-4xl mx-auto w-full">

        {/* ── Accounts section ──────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Your Accounts
            </h2>
            {(isPremium || accounts.length === 0) && (
              <button
                onClick={handleAddAccount}
                className="text-xs text-primary hover:underline font-medium"
              >
                + Add account
              </button>
            )}
          </div>

          {accounts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-border/60 p-10 text-center">
              <div className="text-4xl mb-3">𝕏</div>
              <p className="font-semibold text-foreground mb-1">No accounts yet</p>
              <p className="text-sm text-muted-foreground mb-4">
                Add an X account to start messaging
              </p>
              <Button size="sm" onClick={handleAddAccount}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {accounts.map((account) => {
                const unread = unreadCounts[account.id] || 0
                return (
                  <button
                    key={account.id}
                    onClick={() => handleOpenAccount(account.id)}
                    className="group flex flex-col items-center gap-3 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/40 hover:bg-accent/30 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 text-left"
                  >
                    <div className="relative">
                      <Avatar className="h-12 w-12 ring-2 ring-border group-hover:ring-primary/40 transition-all">
                        {account.avatarUrl && (
                          <AvatarImage src={account.avatarUrl} alt={account.label} className="object-cover" />
                        )}
                        <AvatarFallback
                          style={{ backgroundColor: account.avatarColor }}
                          className="text-white font-bold text-sm"
                        >
                          {account.avatarText}
                        </AvatarFallback>
                      </Avatar>
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                    <div className="text-center min-w-0 w-full">
                      <p className="text-sm font-semibold text-foreground truncate">{account.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {unread > 0 ? `${unread} unread` : 'Open messages'}
                      </p>
                    </div>
                  </button>
                )
              })}

              {/* Add account card — only shown for premium users */}
              {isPremium && (
                <button
                  onClick={handleAddAccount}
                  className="flex flex-col items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/40 hover:bg-accent/20 transition-all duration-200 text-muted-foreground hover:text-primary"
                >
                  <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                    <UserPlus className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-medium">Add account</span>
                </button>
              )}
            </div>
          )}
        </section>

        {/* ── Quick open messaging button ────────────────────────────────── */}
        {accounts.length > 0 && (
          <div className="flex gap-3">
            <Button
              className="gap-2 flex-1"
              onClick={() => {
                const first = accounts[0]
                handleOpenAccount(first.id)
              }}
            >
              <MessageCircle className="h-4 w-4" />
              Open Messaging
            </Button>
          </div>
        )}

        {/* ── Productivity tools section ─────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Productivity Tools
            </h2>
            {!isPremium && (
              <button
                onClick={() => setActiveView('upgrade')}
                className="text-xs font-semibold text-[#1D9BF0] hover:underline flex items-center gap-1"
              >
                <Sparkles className="h-3 w-3" />
                Unlock All
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {PREMIUM_FEATURE_LIST.map((feature) => {
              const isLocked = !isPremium && feature.icon !== '💼' && feature.icon !== '⌨️'
              return (
                <button
                  key={feature.title}
                  onClick={() => isLocked ? setActiveView('upgrade') : handleFeatureClick(feature.view)}
                  className={`
                    group relative flex flex-col items-start gap-2 p-4 rounded-2xl border transition-all duration-200 text-left
                    ${isLocked
                      ? 'bg-card/50 border-border/30 opacity-70 hover:opacity-90 hover:border-[#1D9BF0]/40'
                      : 'bg-card border-border/50 hover:border-primary/40 hover:bg-accent/30 hover:shadow-md hover:-translate-y-0.5'}
                  `}
                >
                  <div className={`
                    w-9 h-9 rounded-xl flex items-center justify-center text-base
                    ${isLocked
                      ? 'bg-muted/60 text-muted-foreground'
                      : 'bg-primary/10 text-primary'}
                  `}>
                    {FEATURE_ICONS[feature.icon] || <span>{feature.icon}</span>}
                  </div>

                  <div className="min-w-0 w-full">
                    <p className="text-xs font-semibold text-foreground leading-tight">{feature.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight line-clamp-2">{feature.desc}</p>
                  </div>

                  {isLocked && (
                    <span className="absolute top-2.5 right-2.5 text-[9px] font-bold text-[#1D9BF0] bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 border border-[#1D9BF0]/30 dark:border-[#1D9BF0]/40 rounded-full px-1.5 py-0.5">
                      PRO
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Tip banner ────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-gradient-to-r from-[#1D9BF0]/10 to-[#0a66c2]/10 dark:from-[#1D9BF0]/8 dark:to-[#0a66c2]/8 border border-[#1D9BF0]/20 dark:border-[#1D9BF0]/25 p-4 flex items-center gap-4">
          <div className="text-2xl">⌨️</div>
          <div>
            <p className="text-sm font-semibold text-foreground">Command Palette</p>
            <p className="text-xs text-muted-foreground">
              Press <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono font-semibold">⌘K</kbd>{' '}
              anywhere to quickly switch accounts, open tools, or search
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
