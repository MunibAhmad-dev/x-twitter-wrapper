import { useMemo } from 'react'
import { PremiumGate } from '../PremiumGate'
import { useWorkspaceStore, getUniqueWorkspaceAccounts } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { BarChart3, MessageCircle, TrendingUp, Users } from 'lucide-react'

export function AnalyticsPanel() {
  const { workspaceAccounts } = useWorkspaceStore()
  const { unreadCounts } = useUIStore()

  const accounts = useMemo(() => getUniqueWorkspaceAccounts(workspaceAccounts), [workspaceAccounts])

  const totalUnread = useMemo(
    () => Object.values(unreadCounts).reduce((s, n) => s + n, 0),
    [unreadCounts]
  )

  const mostActive = useMemo(() => {
    if (!accounts.length) return null
    return accounts.reduce((max, a) => {
      const count = unreadCounts[a.id] || 0
      const maxCount = unreadCounts[max.id] || 0
      return count > maxCount ? a : max
    }, accounts[0])
  }, [accounts, unreadCounts])

  const stats = [
    { label: 'Total Accounts',  value: accounts.length, icon: <Users className="h-4 w-4" />,          color: 'text-blue-500'   },
    { label: 'Unread Messages', value: totalUnread,      icon: <MessageCircle className="h-4 w-4" />,  color: 'text-red-500'    },
    { label: 'Active Today',    value: accounts.length,  icon: <TrendingUp className="h-4 w-4" />,     color: 'text-green-500'  },
  ]

  return (
    <PremiumGate
      feature="Advanced Analytics"
      description="Track message activity, unread counts, and account usage patterns across all your accounts."
      icon="📊"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div
            className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <BarChart3 className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">Advanced Analytics</h2>
            <p className="text-[11px] text-muted-foreground">Activity overview across all accounts</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            {stats.map(stat => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-card border border-border/50 text-center"
              >
                <div className={`${stat.color}`}>{stat.icon}</div>
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{stat.label}</span>
              </div>
            ))}
          </div>

          {/* Per-account breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Account Activity
            </h3>

            {accounts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No accounts added yet
              </div>
            ) : (
              accounts.map(account => {
                const unread = unreadCounts[account.id] || 0
                const barWidth = totalUnread > 0 ? Math.max(4, (unread / totalUnread) * 100) : 4
                return (
                  <div
                    key={account.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-card border border-border/50"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      {account.avatarUrl && (
                        <AvatarImage src={account.avatarUrl} alt={account.label} className="object-cover" />
                      )}
                      <AvatarFallback style={{ backgroundColor: account.avatarColor }} className="text-white font-bold text-xs">
                        {account.avatarText}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold text-foreground truncate">{account.label}</span>
                        <span className={`text-xs font-bold shrink-0 ml-2 ${unread > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {unread > 0 ? `${unread} unread` : 'All read'}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Most active */}
          {mostActive && (unreadCounts[mostActive.id] || 0) > 0 && (
            <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200/50 dark:border-amber-800/30 p-4 flex items-center gap-3">
              <span className="text-xl">🔥</span>
              <div>
                <p className="text-sm font-semibold text-foreground">Most Active Account</p>
                <p className="text-xs text-muted-foreground">
                  {mostActive.label} has {unreadCounts[mostActive.id]} unread messages
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </PremiumGate>
  )
}
