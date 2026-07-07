/**
 * Quick Reply Composer
 *
 * Lets users compose a reply natively in the app and inject it directly into
 * the active Messenger conversation input — no manual copy-paste needed.
 *
 * How it works:
 *  1. User types a reply (or picks one from AI Reply Assistant)
 *  2. Clicks "Send to Messenger"
 *  3. App switches to the messaging view
 *  4. `browser:injectText` IPC calls executeJavaScript on the BrowserView,
 *     finds the Messenger input field, and inserts the text directly.
 *  5. The text appears in the input — the user just presses Enter/⏎ to send.
 *
 * Drafts are saved in local state for the session.
 */
import { useState, useRef, useMemo } from 'react'
import { PremiumGate } from '../PremiumGate'
import { useWorkspaceStore, getUniqueWorkspaceAccounts } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { MessageSquarePlus, Send, Clock, Trash2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { QUICK_REPLY_DRAFTS_KEY } from '../../../shared/constants'
import { safeCopy } from '../../lib/clipboard'

interface Draft {
  id: string
  accountId: string
  accountLabel: string
  message: string
  savedAt: number
}

export function QuickReplyComposer() {
  const { workspaceAccounts, setActiveWorkspaceAccountId } = useWorkspaceStore()
  const { setActiveView, setActiveWorkspaceId, isDemoMode, setPendingDemoText } = useUIStore()
  const accounts = useMemo(() => getUniqueWorkspaceAccounts(workspaceAccounts), [workspaceAccounts])

  const loadDraftsFromStorage = (): Draft[] => {
    try { return JSON.parse(localStorage.getItem(QUICK_REPLY_DRAFTS_KEY) || '[]') } catch { return [] }
  }

  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '')
  const [message, setMessage] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>(loadDraftsFromStorage)
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const selectedAccount = accounts.find(a => a.id === selectedAccountId)

  // ── Inject text directly into the Messenger input field ─────────────────
  const sendToMessenger = async () => {
    if (!message.trim()) { toast.error('Type a message first'); return }
    // Demo mode: inject into DemoMessagingView instead of the live BrowserView
    if (isDemoMode) { setPendingDemoText(message.trim()); setActiveView('messaging'); setMessage(''); return }
    if (!selectedAccount) { toast.error('Select an account'); return }

    setIsSending(true)
    try {
      // 1. Make sure the right account's messaging view is open
      const wsId = workspaceAccounts.find(a => a.id === selectedAccountId)?.workspaceId
      if (!wsId) { toast.error('Could not find workspace'); return }

      setActiveWorkspaceId(wsId)
      setActiveWorkspaceAccountId(selectedAccountId)

      // 2. Load X for this account if not already loaded
      await window.electronAPI?.workspace.loadX(wsId, selectedAccountId)

      // 3. Switch to messaging view so the BrowserView is visible
      setActiveView('messaging')

      // 4. Wait for the BrowserView to attach and X to focus
      await new Promise(r => setTimeout(r, 500))

      // 5. Inject text using native OS paste (most reliable with Lexical editor)
      const result = await window.electronAPI?.injectText(message.trim())

      if (result?.success) {
        toast.success('✓ Text inserted — press Enter in X to send', { duration: 4000 })
        setMessage('')
      } else if ((result as any)?.error === 'no_conversation') {
        toast.warning(
          '📩 Please click on a conversation in X messages first, then click "Send to X" again.',
          { duration: 7000 }
        )
        // Don't clear the message so the user can try again
      } else {
        // Last resort: clipboard fallback
        const ok = await safeCopy(message.trim())
        toast.info(ok ? '📋 Copied to clipboard — paste it into your X DM conversation.' : '⚠️ Could not copy automatically — please copy the text manually.', { duration: 5000 })
      }
    } catch (err) {
      const ok = await safeCopy(message.trim())
      toast.info(ok ? '📋 Copied to clipboard — paste it into your X DM conversation.' : '⚠️ Could not copy automatically — please copy the text manually.')
    } finally {
      setIsSending(false)
    }
  }

  const persistDrafts = (updated: Draft[]) => {
    setDrafts(updated)
    try { localStorage.setItem(QUICK_REPLY_DRAFTS_KEY, JSON.stringify(updated.slice(0, 20))) } catch { /* ignore */ }
  }

  const saveDraft = () => {
    if (!message.trim()) { toast.error('Nothing to save'); return }
    const acct = accounts.find(a => a.id === selectedAccountId)
    if (!acct) return
    const newDraft: Draft = {
      id: Date.now().toString(),
      accountId: selectedAccountId,
      accountLabel: acct.label,
      message: message.trim(),
      savedAt: Date.now(),
    }
    persistDrafts([newDraft, ...drafts])
    setMessage('')
    toast.success('Draft saved ✓')
  }

  const loadDraft = (draft: Draft) => {
    setSelectedAccountId(draft.accountId)
    setMessage(draft.message)
    textareaRef.current?.focus()
  }

  const deleteDraft = (id: string) => {
    persistDrafts(drafts.filter(d => d.id !== id))
  }

  const formatTime = (ts: number) => {
    const d = Date.now() - ts
    if (d < 60000) return 'just now'
    if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
    return `${Math.floor(d / 3600000)}h ago`
  }

  return (
    <PremiumGate
      feature="Quick Reply Composer"
      description="Compose replies natively and inject them directly into X messages — no copy-paste needed."
      icon="✍️"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div
            className="w-8 h-8 rounded-xl bg-pink-100 dark:bg-pink-950/50 flex items-center justify-center text-pink-600 dark:text-pink-400"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <MessageSquarePlus className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">Quick Reply Composer</h2>
            <p className="text-[11px] text-muted-foreground">Injects text directly into X DM</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* How it works — one-time hint */}
          <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/30 p-3.5 flex items-start gap-3">
            <CheckCircle2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-0.5">How it works</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Type your reply below → click <strong>Send to X</strong> → the text is inserted directly into the active DM input. Just press <kbd className="px-1 py-0.5 rounded bg-background border border-border text-[10px] font-mono">⏎ Enter</kbd> to send it.
              </p>
            </div>
          </div>

          {/* Account selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</label>
            <div className="flex gap-2 flex-wrap">
              {accounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                    selectedAccountId === account.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border/50 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <Avatar className="h-5 w-5">
                    {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt={account.label} className="object-cover" />}
                    <AvatarFallback style={{ backgroundColor: account.avatarColor }} className="text-white text-[8px] font-bold">
                      {account.avatarText}
                    </AvatarFallback>
                  </Avatar>
                  {account.label}
                </button>
              ))}
              {accounts.length === 0 && (
                <p className="text-xs text-muted-foreground">Add an account first from the Dashboard</p>
              )}
            </div>
          </div>

          {/* Message composer */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Reply</label>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your reply here…"
              rows={5}
              className="w-full resize-none rounded-2xl bg-muted/30 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground text-right">{message.length} characters</p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2"
              onClick={sendToMessenger}
              disabled={!message.trim() || !selectedAccount || isSending}
            >
              {isSending
                ? <><span className="animate-spin text-sm">⏳</span> Injecting…</>
                : <><Send className="h-4 w-4" /> Send to X</>}
            </Button>
            <Button variant="outline" className="gap-2 shrink-0" onClick={saveDraft} disabled={!message.trim()}>
              <Clock className="h-4 w-4" />
              Save Draft
            </Button>
          </div>

          {/* Saved drafts */}
          {drafts.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Drafts
              </label>
              {drafts.map(draft => (
                <div
                  key={draft.id}
                  className="flex items-start gap-3 p-3.5 rounded-2xl bg-card border border-border/50 hover:border-primary/30 transition-all group cursor-pointer"
                  onClick={() => loadDraft(draft)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-1">
                      {draft.accountLabel} · {formatTime(draft.savedAt)}
                    </p>
                    <p className="text-sm text-foreground line-clamp-2 leading-relaxed">{draft.message}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteDraft(draft.id) }}
                    className="shrink-0 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PremiumGate>
  )
}
