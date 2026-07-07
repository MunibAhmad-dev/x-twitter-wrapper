import logoUrl from '../../assets/logo.jpeg'
import { useEffect, useMemo, useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useSettingsStore } from '../../store/settingsStore'
import { getUniqueWorkspaceAccounts, useWorkspaceStore } from '../../store/workspaceStore'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Switch } from '../ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { APP_VERSION, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL, SUPPORT_URL } from '../../../shared/constants'
import {
  Settings, User, Bell, Palette, CreditCard, Info,
  Trash2, ExternalLink, CheckCircle2, FlaskConical, Lock, Sparkles,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

type Tab = 'general' | 'appearance' | 'notifications' | 'accounts' | 'premium' | 'about'

const TABS: { id: Tab; label: string; icon: React.ReactNode; premiumRequired?: boolean }[] = [
  { id: 'general',       label: 'General',       icon: <Settings className="h-4 w-4" /> },
  { id: 'appearance',    label: 'Appearance',     icon: <Palette className="h-4 w-4" /> },
  { id: 'notifications', label: 'Notifications',  icon: <Bell className="h-4 w-4" /> },
  { id: 'accounts',      label: 'Accounts',       icon: <User className="h-4 w-4" /> },
  // { id: 'premium', label: 'Premium', icon: <CreditCard className="h-4 w-4" /> }, // hidden while IAP is disabled
  { id: 'about',         label: 'About',          icon: <Info className="h-4 w-4" /> },
]

const ACCENT_COLORS = [
  { label: 'Indigo',  value: '#6366f1' },
  { label: 'Blue',    value: '#3b82f6' },
  { label: 'Violet',  value: '#8b5cf6' },
  { label: 'Rose',    value: '#f43f5e' },
  { label: 'Orange',  value: '#f97316' },
  { label: 'Emerald', value: '#10b981' },
  { label: 'Teal',    value: '#14b8a6' },
  { label: 'Amber',   value: '#f59e0b' },
]

export function PreferencesModal() {
  const { isPrefsModalOpen, setPrefsModalOpen, currentUser, setActiveView } = useUIStore()
  const {
    isPremium, autoLaunch, showNotifications, focusMode, sidebarExpanded,
    theme, showDockBadge, accentColor, compactMode, fontSize,
    updateSettings,
  } = useSettingsStore()
  const { workspaceAccounts, removeWorkspaceAccount } = useWorkspaceStore()
  const visibleAccounts = useMemo(() => getUniqueWorkspaceAccounts(workspaceAccounts), [workspaceAccounts])
  const primaryAccount = visibleAccounts[0]

  const [activeTab, setActiveTab] = useState<Tab>('general')
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  // ── App Review Demo Mode ─────────────────────────────────────────────────
  // Tapping the version number 5 times unlocks all premium features for this
  // session only (renderer state, no IAP involved). For Apple App Review.
  const [versionTapCount, setVersionTapCount] = useState(0)
  const handleVersionTap = () => {
    const next = versionTapCount + 1
    setVersionTapCount(next)
    if (next >= 5) {
      setVersionTapCount(0)
      updateSettings({ isPremium: true })
      toast.success('✅ App Review Mode: All premium features unlocked', {
        description: 'This session only — resets on next launch.',
        duration: 5000,
      })
    }
  }
  const confirmRemoveAccount = visibleAccounts.find(a => a.id === confirmRemoveId)

  const displayUsername = primaryAccount?.label || currentUser?.username || 'My Account'
  const profileImageUrl = primaryAccount?.avatarUrl
  const profileInitials = primaryAccount?.avatarText || displayUsername.charAt(0).toUpperCase()

  // Reset tab when re-opened
  useEffect(() => {
    if (isPrefsModalOpen) setActiveTab('general')
  }, [isPrefsModalOpen])

  // Sync modal-open state with main process for BrowserView management
  useEffect(() => {
    window.electronAPI?.setModalOpen(isPrefsModalOpen)
  }, [isPrefsModalOpen])

  const close = () => {
    window.electronAPI?.setModalOpen(false)
    setPrefsModalOpen(false)
  }

  // Closes the modal AND navigates to the upgrade/paywall view.
  // setMessagingActive(false) must arrive at main BEFORE setModalOpen(false)
  // so repositionMessengerView() never briefly re-attaches the BrowserView
  // on top of the Paywall panel while the Preferences dialog is animating out.
  const closeAndUpgrade = () => {
    window.electronAPI?.setMessagingActive(false)
    window.electronAPI?.setModalOpen(false)
    setPrefsModalOpen(false)
    setActiveView('upgrade')
  }

  const toggle = async (key: string, value: boolean) => {
    updateSettings({ [key]: value } as any)
    await window.electronAPI?.settings.update({ [key]: value } as any)

    // Side-effects
    if (key === 'showDockBadge') {
      window.electronAPI?.dock?.setBadgeEnabled(value)
    }
    if (key === 'focusMode') {
      document.documentElement.style.filter = value ? 'grayscale(100%)' : 'none'
    }
    if (key === 'autoLaunch') {
      // handled in main process via settings:update
    }
  }


  const handleRemoveAccount = async (id: string) => {
    removeWorkspaceAccount(id)
    await window.electronAPI?.workspaceAccount.remove(id)
    setConfirmRemoveId(null)
    toast.success('Account removed')
  }

  return (
    // ── Render TWO sibling dialogs, NOT nested ──────────────────────────────
    // Nesting Radix Dialog inside Dialog breaks the X close button.
    // They must be siblings at the same JSX level.
    <>
      <Dialog open={isPrefsModalOpen} onOpenChange={(open) => { if (!open) close() }}>
        <DialogContent
          className="p-0 overflow-hidden border shadow-2xl"
          style={{ maxWidth: 780, width: '95vw', maxHeight: '85vh', borderRadius: 16, WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <DialogTitle className="sr-only">Preferences</DialogTitle>
          <div className="flex h-full" style={{ minHeight: 520 }}>

            {/* ── Left sidebar nav ───────────────────────────────────────── */}
            <div className="w-48 shrink-0 bg-muted/40 border-r border-border/50 flex flex-col py-4 px-2 gap-0.5">
              {/* Profile mini */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 mb-3">
                <Avatar className="h-8 w-8 shrink-0">
                  {profileImageUrl && <AvatarImage src={profileImageUrl} alt={displayUsername} className="object-cover" />}
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {profileInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{displayUsername}</p>
                  <p className="text-[10px] text-muted-foreground">Apps for X</p>
                </div>
              </div>

              {TABS.map(tab => {
                const isLocked = tab.premiumRequired && !isPremium
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-all',
                      activeTab === tab.id
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:bg-background/60 hover:text-foreground'
                    )}
                  >
                    <span className={activeTab === tab.id ? 'text-primary' : ''}>{tab.icon}</span>
                    <span className="flex-1">{tab.label}</span>
                    {isLocked && (
                      <Lock className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* ── Right content ───────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    {TABS.find(t => t.id === activeTab)?.label}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeTab === 'general'       && 'App behaviour and startup options'}
                    {activeTab === 'appearance'    && 'Colours, fonts, and layout density'}
                    {activeTab === 'notifications' && 'Badge, sound, and DND preferences'}
                    {activeTab === 'accounts'      && 'Manage connected messaging accounts'}
                    {activeTab === 'about'         && 'Version info and legal'}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                {/* ── GENERAL ──────────────────────────────────────────────── */}
                {activeTab === 'general' && (
                  <div className="space-y-5">
                    <SettingsRow
                      label="Launch at Login"
                      description="Automatically open the app when you log into macOS"
                      control={<Switch checked={autoLaunch} onCheckedChange={v => toggle('autoLaunch', v)} />}
                    />
                    <SettingsRow
                      label="Expand Sidebar Labels"
                      description="Show text labels next to icons in the navigation sidebar"
                      control={<Switch checked={sidebarExpanded} onCheckedChange={v => toggle('sidebarExpanded', v)} />}
                    />
                    <SettingsRow
                      label="Dark Mode"
                      description="Switch between light and dark appearance"
                      control={
                        <Switch
                          checked={theme === 'dark'}
                          onCheckedChange={v => {
                            const next = v ? 'dark' : 'light'
                            document.documentElement.classList.toggle('dark', v)
                            updateSettings({ theme: next })
                            window.electronAPI?.settings.update({ theme: next })
                          }}
                        />
                      }
                    />
                    <LockedSettingsRow
                      label="Compact Mode"
                      description="Reduce spacing for a denser, more information-dense layout"
                      isPremium={isPremium}
                      onUpgradeClick={() => { closeAndUpgrade() }}
                      control={
                        <Switch
                          checked={compactMode}
                          disabled={!isPremium}
                          onCheckedChange={v => { if (!isPremium) return; toggle('compactMode', v) }}
                        />
                      }
                    />
                  </div>
                )}

                {/* ── APPEARANCE ── premium-gated ──────────────────────────── */}
                {activeTab === 'appearance' && (
                  !isPremium ? (
                    <SettingsTabGate
                      icon="🎨"
                      title="Appearance Customisation"
                      description="Personalise accent colours, text size, and layout density. Make the app look exactly the way you want."
                      features={['12 accent colour options', '3 text size options', 'Compact / Comfortable layout', 'macOS vibrancy effects']}
                      onUpgrade={() => { closeAndUpgrade() }}
                    />
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <label className="text-sm font-semibold text-foreground block mb-1">Accent Colour</label>
                        <p className="text-xs text-muted-foreground mb-3">Used for highlights, active states, and buttons</p>
                        <div className="flex flex-wrap gap-2.5">
                          {ACCENT_COLORS.map(c => (
                            <button
                              key={c.value}
                              title={c.label}
                              onClick={() => {
                                updateSettings({ accentColor: c.value })
                                document.documentElement.style.setProperty('--accent-override', c.value)
                              }}
                              className={cn(
                                'w-8 h-8 rounded-full transition-all border-2',
                                accentColor === c.value ? 'border-foreground scale-110 shadow-md' : 'border-transparent hover:scale-105'
                              )}
                              style={{ backgroundColor: c.value }}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-foreground block mb-1">Text Size</label>
                        <p className="text-xs text-muted-foreground mb-3">Applies to all panels and the sidebar</p>
                        <div className="flex gap-2">
                          {(['small', 'medium', 'large'] as const).map(size => (
                            <button
                              key={size}
                              onClick={() => updateSettings({ fontSize: size })}
                              className={cn(
                                'flex-1 py-2 rounded-xl border text-sm font-semibold capitalize transition-all',
                                fontSize === size
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-card border-border/50 text-muted-foreground hover:border-primary/40'
                              )}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>

                      <SettingsRow
                        label="macOS Sidebar Vibrancy"
                        description="Translucent frosted glass effect on the sidebar (requires restart)"
                        control={<Switch checked={true} onCheckedChange={() => toast.info('Takes effect after restart')} />}
                      />
                    </div>
                  )
                )}

                {/* ── NOTIFICATIONS ─────────────────────────────────────────── */}
                {activeTab === 'notifications' && (
                  <div className="space-y-5">
                    {/* Free: basic notification toggle */}
                    <SettingsRow
                      label="Show Notifications"
                      description="Receive native macOS notification banners for new messages"
                      control={<Switch checked={showNotifications} onCheckedChange={v => toggle('showNotifications', v)} />}
                    />

                    {/* Premium: dock badge */}
                    <LockedSettingsRow
                      label="Dock Badge Counter"
                      description="Show unread message count on the app icon in the Dock"
                      isPremium={isPremium}
                      onUpgradeClick={() => { closeAndUpgrade() }}
                      control={
                        <Switch
                          checked={showDockBadge}
                          disabled={!isPremium}
                          onCheckedChange={v => {
                            if (!isPremium) return
                            toggle('showDockBadge', v)
                            window.electronAPI?.dock?.setBadgeEnabled(v)
                          }}
                        />
                      }
                    />

                    {/* Premium: dock bounce */}
                    <LockedSettingsRow
                      label="Dock Icon Bounce"
                      description="Bounce the dock icon when a new message arrives"
                      isPremium={isPremium}
                      onUpgradeClick={() => { closeAndUpgrade() }}
                      control={
                        <Switch
                          checked={showNotifications && showDockBadge}
                          disabled={!isPremium}
                          onCheckedChange={v => { if (!isPremium) return; toggle('showNotifications', v) }}
                        />
                      }
                    />

                    {/* Premium: focus mode */}
                    <LockedSettingsRow
                      label="Focus / Do Not Disturb"
                      description="Silence all notifications while Focus Mode is active"
                      isPremium={isPremium}
                      onUpgradeClick={() => { closeAndUpgrade() }}
                      control={
                        <Switch
                          checked={focusMode}
                          disabled={!isPremium}
                          onCheckedChange={v => {
                            if (!isPremium) return
                            toggle('focusMode', v)
                            document.documentElement.style.filter = v ? 'grayscale(100%)' : 'none'
                          }}
                        />
                      }
                    />

                    <div className="rounded-2xl bg-muted/30 border border-border/40 p-4">
                      <p className="text-xs font-semibold text-foreground mb-1">📱 Notification Preview</p>
                      <p className="text-xs text-muted-foreground">
                        Notifications appear as native macOS banners. Click a notification to jump directly to that account's conversation.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── ACCOUNTS ─────────────────────────────────────────────── */}
                {activeTab === 'accounts' && (
                  <div className="space-y-3">
                    {visibleAccounts.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-4xl mb-3">👤</div>
                        <p className="text-sm font-semibold text-foreground">No accounts added yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Add an account from the Dashboard</p>
                      </div>
                    ) : (
                      visibleAccounts.map(account => (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/50 hover:border-border transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt={account.label} className="object-cover" />}
                              <AvatarFallback style={{ backgroundColor: account.avatarColor }} className="text-white font-bold text-sm">
                                {account.avatarText}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-semibold text-foreground">{account.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {account.avatarUrl ? '✓ Profile synced' : 'Session active'}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
                            onClick={() => setConfirmRemoveId(account.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>
                      ))
                    )}

                    {!isPremium && visibleAccounts.length >= 1 && (
                      <div className="rounded-2xl bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 border border-[#1D9BF0]/30 dark:border-[#1D9BF0]/40 p-4 flex items-start gap-3">
                        <span className="text-xl shrink-0">🔒</span>
                        <div>
                          <p className="text-sm font-semibold text-foreground">Multiple Accounts — Premium</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Add unlimited accounts with a Premium subscription</p>
                          <Button
                            size="sm"
                            variant="link"
                            className="p-0 h-auto text-[#1D9BF0] text-xs mt-1"
                            onClick={() => { closeAndUpgrade() }}
                          >
                            Upgrade now →
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── PREMIUM (hidden while IAP is disabled) ───────────────── */}
                {/* {activeTab === 'premium' && ( ... )} */}

                {/* ── ABOUT ────────────────────────────────────────────────── */}
                {activeTab === 'about' && (
                  <div className="space-y-5">
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 border border-border/40">
                      <img src={logoUrl} alt="Apps for X" className="w-14 h-14 rounded-2xl shadow-md shrink-0 object-cover" />
                      <div>
                        <p className="text-base font-bold text-foreground">Apps for X</p>
                        <p
                          className="text-xs text-muted-foreground cursor-default select-none"
                          onClick={handleVersionTap}
                        >
                          Version {APP_VERSION}{versionTapCount > 0 && versionTapCount < 5 ? `  ·  ${versionTapCount}/5` : ''}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">macOS Productivity App</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {[
                        { label: 'Privacy Policy',   url: PRIVACY_POLICY_URL },
                        { label: 'Terms of Service', url: TERMS_OF_SERVICE_URL },
                        { label: 'Support',          url: SUPPORT_URL },
                      ].map(link => (
                        <button
                          key={link.label}
                          onClick={() => window.electronAPI?.openExternal(link.url)}
                          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-card border border-border/40 hover:border-border text-sm font-medium text-foreground transition-colors group"
                        >
                          {link.label}
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </button>
                      ))}
                    </div>

                    <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                      Not affiliated with X Corp. X (Twitter)® is a trademark of X Corp. This app is an independent productivity tool.
                    </p>

                    {/* ── Testing section — only visible in dev / non-packaged builds ── */}
                    {window.location.href.startsWith('http://localhost') && (
                      <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 p-4 space-y-3">
                        <p className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                          <FlaskConical className="h-3.5 w-3.5" />
                          Developer Testing
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          These controls only appear in dev builds and are invisible to App Store users.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              // Reset all subscription fields to simulate a fresh free-user install.
                              // Renderer-only — no restart needed, no IAP code touched.
                              updateSettings({
                                isPremium: false,
                                premiumProductId: undefined,
                                premiumExpiresAt: undefined,
                              })
                              close()
                              toast.info('Showing free-user UI — reopen Settings → About to restore')
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-200 transition-colors"
                          >
                            🔓 Simulate Free User
                          </button>
                          <button
                            onClick={() => {
                              updateSettings({ isPremium: true })
                              close()
                              toast.success('Premium state restored')
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 text-xs font-semibold hover:bg-amber-200 transition-colors"
                          >
                            ⭐ Restore Premium
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Footer */}
              <div className="px-6 py-3 border-t border-border/40 flex items-center justify-end gap-2 bg-background/80">
                <Button variant="ghost" size="sm" onClick={close}>Cancel</Button>
                <Button size="sm" onClick={close}>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Done
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation dialog — SIBLING, NOT CHILD of main Dialog ─────────
          Radix UI breaks the X close button when Dialogs are nested.
          Keeping them as siblings at the same JSX level fixes it.        */}
      <Dialog open={!!confirmRemoveId} onOpenChange={(open) => !open && setConfirmRemoveId(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> Remove Account
            </DialogTitle>
            <DialogDescription>
              Remove <strong>{confirmRemoveAccount?.label}</strong>? This clears its session data. You can re-add it later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" onClick={() => setConfirmRemoveId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => confirmRemoveId && handleRemoveAccount(confirmRemoveId)}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Basic settings row ────────────────────────────────────────────────────────
function SettingsRow({ label, description, control }: {
  label: string; description: string; control: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

// ── Locked settings row (shown for premium-only individual toggles) ────────────
function LockedSettingsRow({ label, description, control, isPremium, onUpgradeClick }: {
  label: string
  description: string
  control: React.ReactNode
  isPremium: boolean
  onUpgradeClick: () => void
}) {
  return (
    <div className={`flex items-center justify-between gap-4 py-1 ${!isPremium ? 'opacity-60' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {!isPremium && (
            <button
              onClick={onUpgradeClick}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 border border-[#1D9BF0]/30 dark:border-[#1D9BF0]/40 text-[#1D9BF0] dark:text-[#1D9BF0] text-[9px] font-bold hover:bg-[#1D9BF0]/20 dark:hover:bg-[#1D9BF0]/25 transition-colors"
            >
              <Lock className="h-2.5 w-2.5" />
              PRO
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

// ── Full tab premium gate (used for entire locked tabs like Appearance) ───────
function SettingsTabGate({ icon, title, description, features, onUpgrade }: {
  icon: string
  title: string
  description: string
  features: string[]
  onUpgrade: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-6 px-4 text-center">
      {/* Icon */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-5 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1D9BF0 0%, #0a66c2 100%)' }}
      >
        {icon}
      </div>

      {/* Lock badge */}
      <div className="flex items-center gap-1.5 bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 border border-[#1D9BF0]/30 dark:border-[#1D9BF0]/40 text-[#1D9BF0] dark:text-[#1D9BF0] px-3 py-1 rounded-full text-xs font-bold mb-3">
        <Lock className="h-3 w-3" />
        Premium Feature
      </div>

      <h3 className="text-base font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-5 leading-relaxed">{description}</p>

      {/* Feature list */}
      <ul className="space-y-1.5 mb-6 text-left w-full max-w-xs">
        {features.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm text-foreground/80">
            <div className="w-4 h-4 rounded-full bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 flex items-center justify-center shrink-0">
              <Sparkles className="h-2.5 w-2.5 text-[#1D9BF0] dark:text-[#1D9BF0]" />
            </div>
            {f}
          </li>
        ))}
      </ul>

      <Button
        onClick={onUpgrade}
        className="gap-2 bg-[#1D9BF0] hover:bg-[#1a8cd8] text-white border-none"
      >
        <Sparkles className="h-4 w-4" />
        Unlock with Premium
      </Button>
      <p className="text-[11px] text-muted-foreground mt-2">From $2.99/month</p>
    </div>
  )
}
