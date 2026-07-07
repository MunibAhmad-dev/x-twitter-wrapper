/**
 * Message Scheduler
 *
 * Schedule a message to be injected into Messenger at a specific time.
 *
 * How it works:
 *  1. User writes a message and sets a date + time
 *  2. A countdown timer runs in the component
 *  3. When the scheduled time arrives:
 *     - A native macOS notification fires ("Your scheduled message is ready")
 *     - The message row shows a green "Send Now" button
 *  4. Clicking "Send Now" injects the text directly into the Messenger input
 *     (same `browser:injectText` IPC as Quick Reply Composer)
 *  5. User presses Enter in Messenger to send
 */
import { useState, useEffect, useMemo } from 'react'
import { PremiumGate } from '../PremiumGate'
import { useWorkspaceStore, getUniqueWorkspaceAccounts } from '../../store/workspaceStore'
import { useUIStore } from '../../store/uiStore'
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import { Button } from '../ui/button'
import { CalendarClock, Trash2, Clock, Send, CheckCircle2, Bell } from 'lucide-react'
import { toast } from 'sonner'
import { safeCopy } from '../../lib/clipboard'

interface ScheduledMessage {
  id: string
  accountId: string
  accountLabel: string
  accountColor: string
  accountInitials: string
  accountAvatarUrl?: string
  message: string
  scheduledFor: number          // Unix ms
  status: 'pending' | 'ready' | 'sent' | 'sending'
}

export function MessageSchedulerPanel() {
  const { workspaceAccounts } = useWorkspaceStore()
  const { setActiveWorkspaceId } = useUIStore()
  const { setActiveWorkspaceAccountId } = useWorkspaceStore()
  const accounts = useMemo(() => getUniqueWorkspaceAccounts(workspaceAccounts), [workspaceAccounts])

  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id || '')
  const [message, setMessage] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [items, setItems] = useState<ScheduledMessage[]>([])
  const [, setTick] = useState(0) // force re-render every second for countdown

  // ── Countdown timer ────────────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1)

      setItems(prev => prev.map(item => {
        if (item.status === 'pending' && Date.now() >= item.scheduledFor) {
          // Fire a native notification when time arrives
          if (Notification.permission === 'granted') {
            new Notification('⏰ Scheduled Message Ready', {
              body: `For ${item.accountLabel}: "${item.message.slice(0, 60)}…"`,
            })
          }
          return { ...item, status: 'ready' }
        }
        return item
      }))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // ── Schedule ────────────────────────────────────────────────────────────
  const addScheduled = () => {
    if (!message.trim()) { toast.error('Enter a message'); return }
    if (!scheduledDate || !scheduledTime) { toast.error('Set a date and time'); return }
    const account = accounts.find(a => a.id === selectedAccountId)
    if (!account) return

    const scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`).getTime()
    if (isNaN(scheduledFor)) { toast.error('Invalid date or time'); return }
    if (scheduledFor <= Date.now()) { toast.error('Scheduled time must be in the future'); return }

    const newItem: ScheduledMessage = {
      id: Date.now().toString(),
      accountId: selectedAccountId,
      accountLabel: account.label,
      accountColor: account.avatarColor,
      accountInitials: account.avatarText,
      accountAvatarUrl: account.avatarUrl,
      message: message.trim(),
      scheduledFor,
      status: 'pending',
    }
    setItems(prev => [...prev, newItem].sort((a, b) => a.scheduledFor - b.scheduledFor))

    setMessage('')
    setScheduledDate('')
    setScheduledTime('')
    toast.success(`Message scheduled for ${new Date(scheduledFor).toLocaleTimeString()} ✓`)
  }

  // ── Send (inject into X DM) ────────────────────────────────────
  // IMPORTANT: do NOT call setActiveView() here — switching views unmounts this
  // component mid-async, which permanently freezes the item in 'sending' state.
  // We load X in the background BrowserView and inject silently instead.
  const sendNow = async (item: ScheduledMessage) => {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'sending' } : i))

    const resetToReady = () => {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'ready' } : i))
    }

    try {
      const account = workspaceAccounts.find(a => a.id === item.accountId)
      if (!account) {
        resetToReady()
        toast.error('Account not found — please re-schedule this message.')
        return
      }

      // Load X in the background BrowserView (no view switch needed)
      setActiveWorkspaceId(account.workspaceId)
      setActiveWorkspaceAccountId(item.accountId)
      await window.electronAPI?.workspace.loadX(account.workspaceId, item.accountId)

      // Give the BrowserView a moment to settle
      await new Promise(r => setTimeout(r, 800))

      const result = await window.electronAPI?.injectText(item.message)

      if (result?.success) {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'sent' } : i))
        toast.success('✅ Message injected into X DM — press Enter in the chat to send!', { duration: 6000 })
      } else if ((result as any)?.error === 'no_conversation') {
        // Reset back to ready so user can try again after opening a conversation
        resetToReady()
        toast.warning(
          '📩 Please click on a conversation in X messages first, then click Send Now again.',
          { duration: 8000 }
        )
      } else {
        const ok = await safeCopy(item.message)
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'sent' } : i))
        toast.info(ok ? '📋 Copied to clipboard — paste it into your X DM conversation.' : '⚠️ Could not inject or copy — please send the message manually.', { duration: 7000 })
      }
    } catch {
      // Unexpected error — reset to ready so user can retry
      resetToReady()
      toast.error('Something went wrong. Please click Send Now again.')
    }
  }

  const deleteItem = (id: string) =>
    setItems(prev => prev.filter(i => i.id !== id))

  const formatCountdown = (ts: number) => {
    const diff = ts - Date.now()
    if (diff <= 0) return 'Now'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    const s = Math.floor((diff % 60000) / 1000)
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  const formatScheduled = (ts: number) =>
    new Date(ts).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const pending = items.filter(i => i.status !== 'sent').length

  return (
    <PremiumGate
      feature="Message Scheduler"
      description="Schedule messages to be automatically injected into X messages at a specific time."
      icon="📅"
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
            <CalendarClock className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">Message Scheduler</h2>
            <p className="text-[11px] text-muted-foreground">
              {pending > 0 ? `${pending} message${pending !== 1 ? 's' : ''} scheduled` : 'No scheduled messages'}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* How it works */}
          <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/30 p-3.5 flex items-start gap-3">
            <Bell className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground mb-0.5">How it works</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Schedule a message → a countdown runs → when time arrives you get a notification and a <strong>Send Now</strong> button appears → clicking it injects the text directly into X messages → press <kbd className="px-1 py-0.5 rounded bg-background border border-border text-[10px] font-mono">Enter</kbd> to send.
              </p>
            </div>
          </div>

          {/* Composer */}
          <div className="space-y-3 p-4 rounded-2xl bg-card border border-border/50">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Schedule New Message</h3>

            {/* Account picker */}
            <div className="flex gap-2 flex-wrap">
              {accounts.map(account => (
                <button
                  key={account.id}
                  onClick={() => setSelectedAccountId(account.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                    selectedAccountId === account.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border/50 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <Avatar className="h-4 w-4">
                    {account.avatarUrl && <AvatarImage src={account.avatarUrl} alt={account.label} className="object-cover" />}
                    <AvatarFallback style={{ backgroundColor: account.avatarColor }} className="text-white text-[7px] font-bold">
                      {account.avatarText}
                    </AvatarFallback>
                  </Avatar>
                  {account.label}
                </button>
              ))}
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type the message to send…"
              rows={3}
              className="w-full resize-none rounded-xl bg-muted/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Date</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-semibold block mb-1">Time</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={e => setScheduledTime(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-muted/40 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <Button
              className="w-full gap-2"
              onClick={addScheduled}
              disabled={!message.trim() || !scheduledDate || !scheduledTime}
            >
              <CalendarClock className="h-4 w-4" /> Schedule Message
            </Button>
          </div>

          {/* Scheduled list */}
          {items.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scheduled</h3>
              {items.map(item => {
                const isReady   = item.status === 'ready'
                const isSent    = item.status === 'sent'
                const isSending = item.status === 'sending'
                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                      isSent    ? 'bg-muted/20 border-border/30 opacity-60' :
                      isReady   ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800/40 shadow-sm' :
                      'bg-card border-border/50'
                    }`}
                  >
                    <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                      {item.accountAvatarUrl && <AvatarImage src={item.accountAvatarUrl} alt={item.accountLabel} className="object-cover" />}
                      <AvatarFallback style={{ backgroundColor: item.accountColor }} className="text-white font-bold text-xs">
                        {item.accountInitials}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-xs font-semibold text-muted-foreground">{item.accountLabel}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          isSent    ? 'bg-muted text-muted-foreground' :
                          isSending ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700' :
                          isReady   ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 animate-pulse' :
                          'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400'
                        }`}>
                          {isSent ? '✓ Sent' : isSending ? '⏳ Sending…' : isReady ? '🔔 Ready to send!' : `⏱ ${formatCountdown(item.scheduledFor)}`}
                        </span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2 mb-1 leading-relaxed">{item.message}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />{formatScheduled(item.scheduledFor)}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1.5 shrink-0">
                      {(isReady || isSending) && !isSent && (
                        <button
                          onClick={() => sendNow(item)}
                          disabled={isSending}
                          className="p-2 rounded-xl bg-green-500 hover:bg-green-600 text-white transition-colors disabled:opacity-50 shadow-sm"
                          title="Send now — injects text into X messages"
                        >
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isSent && (
                        <div className="p-2 rounded-xl bg-muted text-muted-foreground">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </div>
                      )}
                      {!isSent && !isSending && (
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PremiumGate>
  )
}
