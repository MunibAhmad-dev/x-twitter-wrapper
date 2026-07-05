import { useState } from 'react'
import { PremiumGate } from '../PremiumGate'
import { useWorkspaceStore, getUniqueWorkspaceAccounts } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { SMART_FILTERS } from '../../../shared/constants'
import { Search } from 'lucide-react'
import { useMemo } from 'react'

export function SmartFiltersPanel() {
  const { workspaceAccounts } = useWorkspaceStore()
  const { unreadCounts, setActiveView, setActiveWorkspaceId } = useUIStore()
  const { setActiveWorkspaceAccountId } = useWorkspaceStore()

  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const allAccounts = useMemo(() => getUniqueWorkspaceAccounts(workspaceAccounts), [workspaceAccounts])

  const toggleFilter = (id: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredAccounts = useMemo(() => {
    let result = allAccounts

    if (searchQuery) {
      result = result.filter(a => a.label.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    if (activeFilters.has('unread')) {
      result = result.filter(a => (unreadCounts[a.id] || 0) > 0)
    }

    // business / personal heuristics based on label
    if (activeFilters.has('business')) {
      result = result.filter(a => /business|work|company|corp|llc|inc|ltd|office|team|brand|official/i.test(a.label))
    }

    if (activeFilters.has('personal')) {
      result = result.filter(a => !/business|work|company|corp|llc|inc|ltd|office|team|brand|official/i.test(a.label))
    }

    return result
  }, [allAccounts, activeFilters, searchQuery, unreadCounts])

  const handleOpenAccount = async (accountId: string) => {
    const account = workspaceAccounts.find(a => a.id === accountId)
    if (!account) return
    setActiveWorkspaceId(account.workspaceId)
    setActiveWorkspaceAccountId(accountId)
    await window.electronAPI?.workspace.loadFacebook(account.workspaceId, accountId)
    setActiveView('messaging')
  }

  return (
    <PremiumGate
      feature="Smart Filters"
      description="Filter your accounts by unread status, account type (business or personal), or search by name."
      icon="🔍"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div
            className="w-8 h-8 rounded-xl bg-cyan-100 dark:bg-cyan-950/50 flex items-center justify-center text-cyan-600 dark:text-cyan-400"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Search className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">Smart Filters</h2>
            <p className="text-[11px] text-muted-foreground">
              {filteredAccounts.length} of {allAccounts.length} accounts shown
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Search + Filters sticky bar */}
          <div className="px-4 py-3 space-y-3 border-b border-border/30 bg-background/80 backdrop-blur sticky top-0 z-10">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search accounts…"
                className="w-full pl-8 pr-4 py-2 rounded-lg bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap gap-2">
              {SMART_FILTERS.map(f => (
                <button
                  key={f.id}
                  onClick={() => toggleFilter(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                    activeFilters.has(f.id)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border/50 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <span>{f.emoji}</span>
                  {f.label}
                </button>
              ))}
              {activeFilters.size > 0 && (
                <button
                  onClick={() => setActiveFilters(new Set())}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Account list */}
          <div className="p-4 space-y-2">
            {filteredAccounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                {activeFilters.size > 0 || searchQuery
                  ? 'No accounts match your filters'
                  : 'No accounts added yet'}
              </div>
            ) : (
              filteredAccounts.map(account => {
                const unread = unreadCounts[account.id] || 0
                return (
                  <button
                    key={account.id}
                    onClick={() => handleOpenAccount(account.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/40 hover:bg-accent/30 transition-all text-left"
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
                      <p className="text-sm font-semibold text-foreground truncate">{account.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {unread > 0 ? `${unread} unread` : 'No unread messages'}
                      </p>
                    </div>
                    {unread > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      </div>
    </PremiumGate>
  )
}
