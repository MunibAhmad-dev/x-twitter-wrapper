/**
 * Notification History Panel
 *
 * Reads from notificationStore — the listener lives in App.tsx so every
 * notification is captured regardless of which view is currently open.
 */
import { PremiumGate } from '../PremiumGate'
import { useWorkspaceStore } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { useNotificationStore } from '../../store/notificationStore'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Bell, BellOff, Trash2 } from 'lucide-react'
import { Button } from '../ui/button'
import { toast } from 'sonner'

export function NotificationHistoryPanel() {
  const { entries, markRead, markAllRead, clearAll } = useNotificationStore()
  const { workspaceAccounts } = useWorkspaceStore()
  const { setActiveView, setActiveWorkspaceId } = useUIStore()
  const { setActiveWorkspaceAccountId } = useWorkspaceStore()

  const unread = entries.filter(e => !e.read).length

  const handleClearAll = () => {
    clearAll()
    toast.success('History cleared')
  }

  const openAccount = async (entry: { id: string; accountId: string; read: boolean }) => {
    const account = workspaceAccounts.find(a => a.id === entry.accountId)
    if (!account) return
    markRead(entry.accountId)
    setActiveWorkspaceId(account.workspaceId)
    setActiveWorkspaceAccountId(entry.accountId)
    await window.electronAPI?.workspace.loadFacebook(account.workspaceId, entry.accountId)
    setActiveView('messaging')
  }

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts
    if (diff < 60000)    return 'just now'
    if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return new Date(ts).toLocaleDateString()
  }

  return (
    <PremiumGate
      feature="Notification History"
      description="A native log of all message notifications received while the app is running. Never miss a message."
      icon="🔔"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <div className="relative w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Notification History</h2>
              <p className="text-[11px] text-muted-foreground">
                {unread > 0
                  ? `${unread} unread · ${entries.length} total`
                  : entries.length > 0
                    ? `${entries.length} notifications · All read`
                    : 'No notifications yet this session'}
              </p>
            </div>
          </div>
          {entries.length > 0 && (
            <div className="flex gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              {unread > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllRead} className="text-xs">
                  Mark all read
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleClearAll} className="text-xs text-muted-foreground gap-1">
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
              <div className="w-16 h-16 rounded-3xl bg-muted/50 flex items-center justify-center">
                <BellOff className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                  Notifications appear here automatically when messages arrive while the app is open.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveView('messaging')}>
                Open Messaging
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {entries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => openAccount(entry)}
                  className={`w-full flex items-start gap-3 px-5 py-4 text-left hover:bg-accent/50 transition-colors ${
                    !entry.read ? 'bg-primary/[0.04]' : ''
                  }`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <Avatar className="h-10 w-10">
                      {entry.accountAvatarUrl && (
                        <AvatarImage src={entry.accountAvatarUrl} alt={entry.accountLabel} className="object-cover" />
                      )}
                      <AvatarFallback
                        style={{ backgroundColor: entry.accountColor }}
                        className="text-white font-bold text-xs"
                      >
                        {entry.accountInitials}
                      </AvatarFallback>
                    </Avatar>
                    {!entry.read && (
                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-primary rounded-full border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-semibold text-muted-foreground truncate">{entry.accountLabel}</p>
                      <p className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatTime(entry.receivedAt)}</p>
                    </div>
                    <p className={`text-sm leading-snug truncate ${!entry.read ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                      {entry.title}
                    </p>
                    {entry.body && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.body}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </PremiumGate>
  )
}
