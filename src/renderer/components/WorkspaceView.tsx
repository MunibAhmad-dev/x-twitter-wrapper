import { useEffect, useState } from 'react'
import { useUIStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { Button } from './ui/button'
import { Dashboard } from './Dashboard/Dashboard'
import { Paywall } from './Paywall'
import { AIReplyPanel } from './Premium/AIReplyPanel'
import { TranslatorPanel } from './Premium/TranslatorPanel'
import { ContentStudioPanel } from './Premium/ContentStudioPanel'
import { AnalyticsPanel } from './Premium/AnalyticsPanel'
import { FocusModePanel } from './Premium/FocusModePanel'
import { SmartFiltersPanel } from './Premium/SmartFiltersPanel'
import { QuickReplyComposer } from './Premium/QuickReplyComposer'
import { NotificationHistoryPanel } from './Premium/NotificationHistoryPanel'
import { ThemeCustomizerPanel } from './Premium/ThemeCustomizerPanel'
import { ShortcutsPanel } from './ShortcutsPanel'
import { MessageSchedulerPanel } from './Premium/MessageSchedulerPanel'
import { ThreadGeneratorPanel } from './Premium/ThreadGeneratorPanel'
import { TweetOptimizerPanel } from './Premium/TweetOptimizerPanel'
import { MessagingToolbar, MESSAGING_TOOLBAR_HEIGHT } from './MessagingToolbar'
import { DemoMessagingView } from './DemoMessagingView'
import { ChevronLeft, ChevronRight, RotateCcw, Bell, BellOff, Settings, Bot, Languages, MessageSquarePlus } from 'lucide-react'
import { cn } from '../lib/utils'
import { IAP_ENABLED } from '../../shared/constants'

type BrowserState = { canGoBack: boolean; canGoForward: boolean; url: string }
type ToolbarMode = 'ai' | 'translate' | 'quick-reply' | null

export function WorkspaceView() {
  const { activeView, setPrefsModalOpen, isDemoMode, demoToolbarMode, demoToolbarPrefill, setDemoToolbar } = useUIStore()
  const { showNotifications, updateSettings, isPremium } = useSettingsStore()

  const [browserState, setBrowserState] = useState<BrowserState>({ canGoBack: false, canGoForward: false, url: '' })

  // Inline toolbar state
  const [toolbarMode, setToolbarMode] = useState<ToolbarMode>(null)
  const [prefillText, setPrefillText]   = useState('')

  // ── Navigation state ─────────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI?.browser?.getState().then(setBrowserState).catch(() => undefined)
    window.electronAPI?.browser?.onNavigationUpdated(setBrowserState)
  }, [])

  // ── BrowserView visibility (native layer) ────────────────────────────────
  useEffect(() => {
    window.electronAPI?.setMessagingActive(activeView === 'messaging' && !isDemoMode)
  }, [activeView, isDemoMode])

  // ── Demo toolbar pre-fill ─────────────────────────────────────────────────
  useEffect(() => {
    if (!demoToolbarMode) return
    setPrefillText(demoToolbarPrefill)
    setToolbarMode(demoToolbarMode)
    setDemoToolbar(null)
  }, [demoToolbarMode])

  // ── Toolbar height → shifts BrowserView down so it isn't hidden behind toolbar ──
  useEffect(() => {
    const height = (activeView === 'messaging' && toolbarMode) ? MESSAGING_TOOLBAR_HEIGHT : 0
    window.electronAPI?.setToolbarHeight(height)
  }, [activeView, toolbarMode])

  // ── Context-menu IPC from BrowserView right-clicks ───────────────────────
  useEffect(() => {
    window.electronAPI?.onBarAiReply?.((text) => {
      setPrefillText(text)
      setToolbarMode('ai')
    })
    window.electronAPI?.onBarTranslate?.((text) => {
      setPrefillText(text)
      setToolbarMode('translate')
    })
  }, [])

  const openTool = (mode: ToolbarMode) => {
    // Toggle: if same mode already open, close it
    setToolbarMode(prev => prev === mode ? null : mode)
    setPrefillText('')
  }

  const goBack    = async () => { const s = await window.electronAPI?.browser?.goBack();    if (s) setBrowserState(s) }
  const goForward = async () => { const s = await window.electronAPI?.browser?.goForward(); if (s) setBrowserState(s) }
  const reload    = ()       => { window.electronAPI?.browser?.reload() }

  const toggleNotifications = async () => {
    const next = !showNotifications
    updateSettings({ showNotifications: next })
    await window.electronAPI?.settings?.update({ showNotifications: next })
  }

  return (
    <div className="flex-1 min-w-0 h-full flex flex-col bg-background overflow-hidden">

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <div
        className="h-12 shrink-0 border-b border-border/70 bg-background/95 backdrop-blur flex items-center justify-between px-4 z-20 relative"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Left: browser controls + AI/Translate toggles (messaging only) */}
        <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {activeView === 'messaging' && (
            <>
              {/* Back / Forward / Reload */}
              <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded"
                  onClick={goBack} disabled={!browserState.canGoBack} title="Back">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded"
                  onClick={goForward} disabled={!browserState.canGoForward} title="Forward">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={reload} title="Reload">
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>

              {/* Divider */}
              <div className="w-px h-4 bg-border/60 mx-0.5" />

              {/* AI Reply toggle */}
              <button
                onClick={() => openTool('ai')}
                title="AI Reply — generate smart replies"
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                  toolbarMode === 'ai'
                    ? 'bg-[#1D9BF0] text-white border-[#1D9BF0] shadow-sm'
                    : 'border-border/50 text-muted-foreground hover:border-[#1D9BF0]/50 hover:text-[#1D9BF0] hover:bg-[#1D9BF0]/10 dark:hover:bg-[#1D9BF0]/15 bg-muted/30'
                )}
              >
                <Bot className="h-3.5 w-3.5" />
                AI Reply
              </button>

              {/* Translate toggle */}
              <button
                onClick={() => openTool('translate')}
                title="Translate — translate selected or pasted text"
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                  toolbarMode === 'translate'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'border-border/50 text-muted-foreground hover:border-emerald-400/50 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 bg-muted/30'
                )}
              >
                <Languages className="h-3.5 w-3.5" />
                Translate
              </button>

              {/* Quick Reply toggle */}
              <button
                onClick={() => openTool('quick-reply')}
                title="Quick Reply — type and inject a reply directly into the chat"
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all',
                  toolbarMode === 'quick-reply'
                    ? 'bg-pink-600 text-white border-pink-600 shadow-sm'
                    : 'border-border/50 text-muted-foreground hover:border-pink-400/50 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30 bg-muted/30'
                )}
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                Quick Reply
              </button>
            </>
          )}
        </div>

        {/* Center: view title (non-messaging views) */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          {activeView !== 'messaging' && (
            <span className="text-sm font-semibold text-foreground/70">
              {({
                'ai-reply': 'AI Reply Assistant',
                'translate': 'Translation',
                'content': 'AI Post Studio',
                'analytics': 'Analytics',
                'focus': 'Focus Mode',
                'filters': 'Smart Filters',
                'upgrade': 'Upgrade',
                'dashboard': 'Dashboard',
                'quick-reply': 'Quick Reply',
                'notification-history': 'Notifications',
                'themes': 'Theme Customizer',
                'shortcuts': 'Keyboard Shortcuts',
                'scheduler': 'Message Scheduler',
                'thread-generator': 'AI Thread Generator',
                'tweet-optimizer': 'AI Tweet Optimizer',
              } as Record<string, string>)[activeView] || activeView}
            </span>
          )}
        </div>

        {/* Right: notifications + settings */}
        <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
            title={showNotifications ? 'Mute notifications' : 'Enable notifications'}
            onClick={toggleNotifications}
          >
            {showNotifications
              ? <Bell className="h-3.5 w-3.5" />
              : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
          <Button
            variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
            title="Settings"
            onClick={() => { window.electronAPI?.setModalOpen(true); setPrefsModalOpen(true) }}
          >
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ── Inline AI/Translate toolbar (messaging view only) ─────────────── */}
      {activeView === 'messaging' && (
        <MessagingToolbar
          mode={toolbarMode}
          prefillText={prefillText}
          onClose={() => setToolbarMode(null)}
        />
      )}

      {/* ── Content area ──────────────────────────────────────────────────── */}
      {/*
        When activeView === 'messaging', the BrowserView is physically attached
        to the window by the main process (browser:setMessagingActive IPC) and
        positioned BELOW both the top bar AND any open inline toolbar.
        The React layer renders nothing here — the native view shows through.

        For every other view, the BrowserView is detached and a React panel renders.
      */}
      <div className="flex-1 overflow-hidden relative bg-background">
        {activeView === 'messaging' && !isDemoMode && (
          <div className="absolute inset-0" style={{ background: 'transparent' }} />
        )}
        {activeView === 'messaging' && isDemoMode && (
          <div className="absolute inset-0"><DemoMessagingView /></div>
        )}

        {activeView === 'dashboard'            && <div className="absolute inset-0 overflow-y-auto"><Dashboard /></div>}
        {activeView === 'ai-reply'             && <div className="absolute inset-0"><AIReplyPanel /></div>}
        {activeView === 'translate'            && <div className="absolute inset-0"><TranslatorPanel /></div>}
        {activeView === 'content'              && <div className="absolute inset-0"><ContentStudioPanel /></div>}
        {activeView === 'analytics'            && <div className="absolute inset-0"><AnalyticsPanel /></div>}
        {activeView === 'focus'                && <div className="absolute inset-0"><FocusModePanel /></div>}
        {activeView === 'filters'              && <div className="absolute inset-0"><SmartFiltersPanel /></div>}
        {activeView === 'quick-reply'          && <div className="absolute inset-0"><QuickReplyComposer /></div>}
        {activeView === 'notification-history' && <div className="absolute inset-0"><NotificationHistoryPanel /></div>}
        {activeView === 'themes'               && <div className="absolute inset-0"><ThemeCustomizerPanel /></div>}
        {activeView === 'shortcuts'            && <div className="absolute inset-0"><ShortcutsPanel /></div>}
        {activeView === 'scheduler'            && <div className="absolute inset-0"><MessageSchedulerPanel /></div>}
        {activeView === 'thread-generator'    && <div className="absolute inset-0"><ThreadGeneratorPanel /></div>}
        {activeView === 'tweet-optimizer'     && <div className="absolute inset-0"><TweetOptimizerPanel /></div>}
        {IAP_ENABLED && activeView === 'upgrade' && <div className="absolute inset-0 overflow-y-auto"><Paywall /></div>}
      </div>
    </div>
  )
}
