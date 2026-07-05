/**
 * MessagingToolbar
 *
 * Compact panel below the top bar in messaging view. Three modes:
 *   'ai'          — AI Reply generator
 *   'translate'   — Message translator
 *   'quick-reply' — Type and inject text directly into the open chat
 *
 * In demo mode, "Send" routes text to the DemoMessagingView input via
 * pendingDemoText rather than calling injectText on the BrowserView.
 */
import { useState, useEffect, useRef } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useUIStore } from '../store/uiStore'
import { AI_TONES, SUPPORTED_LANGUAGES, QUICK_REPLY_DRAFTS_KEY, IAP_ENABLED } from '../../shared/constants'
import {
  Bot, Languages, Copy, RefreshCw, Sparkles, X, ChevronDown,
  MessageSquarePlus, Send, Clock, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../lib/utils'
import { safeCopy } from '../lib/clipboard'

export const MESSAGING_TOOLBAR_HEIGHT = 228

interface Draft {
  id: string
  message: string
  savedAt: number
}

function loadDrafts(): Draft[] {
  try { return JSON.parse(localStorage.getItem(QUICK_REPLY_DRAFTS_KEY) || '[]') } catch { return [] }
}
function saveDraftsToStorage(drafts: Draft[]) {
  localStorage.setItem(QUICK_REPLY_DRAFTS_KEY, JSON.stringify(drafts.slice(0, 20)))
}

const EXAMPLE_REPLIES: Record<string, string[]> = {
  professional: [
    "Thank you for reaching out. I'll review this and respond shortly.",
    "I appreciate your message and will get back to you soon.",
    "Thank you for bringing this to my attention. I'll address it promptly.",
  ],
  friendly: [
    "Hey! Thanks for the message 😊 I'll get back to you soon!",
    "Oh nice, thanks for letting me know! I'll reply properly shortly.",
    "Awesome, thanks! Give me a moment 🙌",
  ],
  casual: ["Got it, will reply soon", "Sure thing, back to you shortly", "Sounds good, talk later"],
  concise: ["Acknowledged. On it.", "Received. Will respond shortly.", "Noted. Reply soon."],
}

interface Props {
  mode: 'ai' | 'translate' | 'quick-reply' | null
  prefillText: string
  onClose: () => void
}

export function MessagingToolbar({ mode, prefillText, onClose }: Props) {
  const { targetLanguage, updateSettings } = useSettingsStore()
  const isPremium = useSettingsStore(s => s.isPremium)
  const { setActiveView, setPendingAIText, setPendingTranslateText, isDemoMode, setPendingDemoText } = useUIStore()

  const featuresUnlocked = !IAP_ENABLED || isPremium || isDemoMode

  // ── Send selected text to dedicated panel ────────────────────────────────
  const [isSendingToPanel, setIsSendingToPanel] = useState<'ai' | 'translate' | null>(null)
  const sendToPanel = async (panel: 'ai' | 'translate') => {
    setIsSendingToPanel(panel)
    try {
      const result = await window.electronAPI?.browser.getSelectedText()
      const text = result?.text ?? ''
      if (!text) {
        toast.warning('Select some text in X first, then click this button.', { duration: 4000 })
        return
      }
      if (panel === 'ai') {
        setPendingAIText(text)
        setActiveView('ai-reply')
      } else {
        setPendingTranslateText(text)
        setActiveView('translate')
      }
    } catch {
      toast.error('Could not read selected text. Please try again.')
    } finally {
      setIsSendingToPanel(null)
    }
  }

  // ── Shared send-to-chat helper (demo-aware) ───────────────────────────────
  const sendToChat = async (t: string) => {
    if (isDemoMode) {
      setPendingDemoText(t.trim())
      return
    }
    const result = await window.electronAPI?.injectText(t.trim())
    if (result?.success) {
      toast.success('✓ Inserted — press Enter to send')
    } else {
      const ok = await safeCopy(t.trim())
      toast.info(ok ? '📋 Copied — paste into chat' : '⚠️ Copy failed')
    }
  }

  // ── AI Reply ─────────────────────────────────────────────────────────────
  const [aiInput, setAiInput]     = useState('')
  const [tone, setTone]           = useState<'professional' | 'friendly' | 'casual' | 'concise'>('professional')
  const [replies, setReplies]     = useState<string[]>([])
  const [aiLoading, setAiLoading] = useState(false)

  // ── Translate ────────────────────────────────────────────────────────────
  const [translateInput, setTranslateInput]     = useState('')
  const [translated, setTranslated]             = useState('')
  const [translateLoading, setTranslateLoading] = useState(false)
  const [langOpen, setLangOpen]                 = useState(false)

  // ── Quick Reply ───────────────────────────────────────────────────────────
  const [qrText, setQrText]         = useState('')
  const [qrSending, setQrSending]   = useState(false)
  const [drafts, setDrafts]         = useState<Draft[]>(loadDrafts)
  const [showDrafts, setShowDrafts] = useState(false)
  const qrRef = useRef<HTMLTextAreaElement>(null)

  // Pre-fill from right-click / demo context menu
  useEffect(() => {
    if (!prefillText) return
    if (mode === 'ai')          { setAiInput(prefillText);        setReplies([]) }
    if (mode === 'translate')   { setTranslateInput(prefillText); setTranslated('') }
    if (mode === 'quick-reply') { setQrText(prefillText) }
  }, [prefillText, mode])

  // Focus quick reply input when it opens
  useEffect(() => {
    if (mode === 'quick-reply') setTimeout(() => qrRef.current?.focus(), 80)
  }, [mode])

  // ── AI Reply ─────────────────────────────────────────────────────────────
  const generateReplies = async () => {
    if (!aiInput.trim()) { toast.error('Enter a message to reply to'); return }
    setAiLoading(true)
    try {
      const result = await window.electronAPI?.ai?.generateReplies(aiInput.trim(), tone)
      if (result?.success && result.replies && result.replies.length > 0) {
        setReplies(result.replies)
      } else {
        toast.error(result?.error ? `AI error: ${result.error}` : 'AI returned no replies. Please try again.')
        setReplies(EXAMPLE_REPLIES[tone])
      }
    } catch {
      toast.error('Failed to reach AI service. Please try again.')
      setReplies(EXAMPLE_REPLIES[tone])
    } finally {
      setAiLoading(false)
    }
  }

  // ── Translate ─────────────────────────────────────────────────────────────
  const handleTranslate = async () => {
    if (!translateInput.trim()) { toast.error('Enter text to translate'); return }
    setTranslateLoading(true)
    try {
      const result = await window.electronAPI?.ai?.translate(translateInput.trim(), targetLanguage || 'es')
      if (result?.success && result.text) {
        setTranslated(result.text)
      } else {
        toast.error(result?.error ? `Translation error: ${result.error}` : 'Translation failed. Please try again.')
      }
    } catch { toast.error('Translation failed. Please try again.') }
    finally { setTranslateLoading(false) }
  }

  // ── Quick Reply: inject directly into chat ────────────────────────────────
  const insertIntoChat = async (text = qrText) => {
    if (!text.trim()) { toast.error('Type a reply first'); return }
    // Demo mode: route to DemoMessagingView instead of BrowserView
    if (isDemoMode) { setPendingDemoText(text.trim()); setQrText(''); return }
    setQrSending(true)
    try {
      const result = await window.electronAPI?.injectText(text.trim())
      if (result?.success) {
        toast.success('✓ Inserted into X DM — press Enter to send', { duration: 3500 })
        setQrText('')
      } else if ((result as any)?.error === 'no_conversation') {
        toast.warning('Click on a conversation in X messages first, then try again.', { duration: 5000 })
      } else {
        const ok = await safeCopy(text.trim())
        toast.info(ok ? '📋 Copied to clipboard — paste into X DM chat.' : '⚠️ Could not copy automatically — please copy the text manually.', { duration: 4000 })
      }
    } catch {
      const ok = await safeCopy(text.trim())
      toast.info(ok ? '📋 Copied to clipboard — paste into X DM chat.' : '⚠️ Could not copy automatically — please copy the text manually.')
    } finally {
      setQrSending(false)
    }
  }

  const saveDraft = () => {
    if (!qrText.trim()) return
    const updated = [{ id: Date.now().toString(), message: qrText.trim(), savedAt: Date.now() }, ...drafts]
    setDrafts(updated)
    saveDraftsToStorage(updated)
    toast.success('Draft saved')
  }

  const deleteDraft = (id: string) => {
    const updated = drafts.filter(d => d.id !== id)
    setDrafts(updated)
    saveDraftsToStorage(updated)
  }

  const loadDraft = (d: Draft) => {
    setQrText(d.message)
    setShowDrafts(false)
    qrRef.current?.focus()
  }

  const copy = async (t: string) => {
    const ok = await safeCopy(t)
    if (ok) toast.success('Copied to clipboard ✓')
    else toast.error('Copy failed — please select the text and copy manually')
  }

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === (targetLanguage || 'es'))

  if (!mode) return null

  return (
    <div
      className="shrink-0 border-b border-border/60 bg-background/98 backdrop-blur-xl flex flex-col overflow-visible"
      style={{ height: MESSAGING_TOOLBAR_HEIGHT }}
    >
      {/* ── SEND SELECTION TO DEDICATED PAGE ──────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-1.5 px-3 py-1 border-b border-border/30 bg-muted/20">
        <span className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide mr-1">Select text → send to:</span>
        <button
          onClick={() => sendToPanel('ai')}
          disabled={isSendingToPanel === 'ai'}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 hover:bg-[#1D9BF0]/20 dark:hover:bg-[#1D9BF0]/25 text-[#1D9BF0] dark:text-[#1D9BF0] text-[10px] font-semibold border border-[#1D9BF0]/30 dark:border-[#1D9BF0]/40 transition-colors disabled:opacity-60"
        >
          {isSendingToPanel === 'ai' ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Bot className="h-2.5 w-2.5" />}
          AI Reply Page
        </button>
        <button
          onClick={() => sendToPanel('translate')}
          disabled={isSendingToPanel === 'translate'}
          className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-800/50 transition-colors disabled:opacity-60"
        >
          {isSendingToPanel === 'translate' ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : <Languages className="h-2.5 w-2.5" />}
          Translator Page
        </button>
      </div>

      {/* ── AI REPLY ────────────────────────────────────────────────────── */}
      {mode === 'ai' && (
        <div className="flex-1 min-h-0 flex flex-col px-4 py-2.5 gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded-lg bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 flex items-center justify-center">
              <Bot className="h-3.5 w-3.5 text-[#1D9BF0] dark:text-[#1D9BF0]" />
            </div>
            <span className="text-xs font-bold text-foreground">AI Reply</span>
            <div className="flex gap-1 ml-1">
              {AI_TONES.map(t => (
                <button key={t.id} onClick={() => setTone(t.id as typeof tone)}
                  className={cn('px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all',
                    tone === t.id ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border/50 text-muted-foreground hover:border-primary/40 bg-muted/30')}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            {!featuresUnlocked && <span className="text-[9px] font-bold text-[#1D9BF0] bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 border border-[#1D9BF0]/30 dark:border-[#1D9BF0]/40 rounded-full px-1.5 py-0.5">PRO</span>}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>

          <div className="flex gap-2 shrink-0">
            <input value={aiInput} onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !aiLoading && generateReplies()}
              placeholder="Paste a message to reply to… or right-click selected text in chat"
              className="flex-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            <button onClick={generateReplies} disabled={aiLoading || !aiInput.trim() || !featuresUnlocked}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D9BF0] hover:bg-[#1a8cd8] text-white text-xs font-semibold disabled:opacity-50 transition-colors shrink-0">
              {aiLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Generate
            </button>
          </div>

          {replies.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-0.5">
              {replies.map((r, i) => (
                <div key={i} className="shrink-0 max-w-[260px] flex flex-col gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted/40 border border-border/40 hover:border-primary/40 transition-all">
                  <span className="text-[10px] text-foreground/70 leading-relaxed line-clamp-3">{r}</span>
                  <div className="flex gap-1">
                    <button onClick={() => copy(r)}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-muted hover:bg-accent border border-border/40 text-[9px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                      <Copy className="h-2.5 w-2.5" /> Copy
                    </button>
                    <button onClick={() => sendToChat(r)}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[#1D9BF0]/10 hover:bg-[#1D9BF0]/20 border border-[#1D9BF0]/30 text-[9px] font-semibold text-[#1D9BF0] transition-colors">
                      <Send className="h-2.5 w-2.5" /> {isDemoMode ? 'Send to Chat' : 'Send'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground italic">
              {featuresUnlocked ? 'Replies appear here' : '⭐ Premium required'}
            </p>
          )}
        </div>
      )}

      {/* ── TRANSLATE ───────────────────────────────────────────────────── */}
      {mode === 'translate' && (
        <div className="flex-1 min-h-0 flex flex-col px-4 py-2.5 gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
              <Languages className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-xs font-bold text-foreground">Translate</span>

            {/* Language dropdown */}
            <div className="relative ml-1">
              <button onClick={() => setLangOpen(o => !o)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg border border-border/50 bg-muted/30 text-[10px] font-semibold text-foreground hover:border-primary/40 transition-colors">
                <span>{currentLang?.flag}</span>
                <span>{currentLang?.name}</span>
                <ChevronDown className="h-2.5 w-2.5 text-muted-foreground" />
              </button>
              {langOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-background border border-border rounded-xl shadow-xl p-1 grid grid-cols-2 gap-0.5 min-w-[220px]">
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <button key={lang.code}
                      onClick={() => { updateSettings({ targetLanguage: lang.code }); setLangOpen(false); setTranslated('') }}
                      className={cn('flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors text-left',
                        targetLanguage === lang.code ? 'bg-primary text-primary-foreground' : 'hover:bg-accent text-foreground')}>
                      <span>{lang.flag}</span><span>{lang.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1" />
            {!featuresUnlocked && <span className="text-[9px] font-bold text-[#1D9BF0] bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 border border-[#1D9BF0]/30 dark:border-[#1D9BF0]/40 rounded-full px-1.5 py-0.5">PRO</span>}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>

          <div className="flex gap-2 shrink-0">
            <input value={translateInput} onChange={e => setTranslateInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !translateLoading && handleTranslate()}
              placeholder="Paste text or right-click selected text in chat → Translate…"
              className="flex-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
            <button onClick={handleTranslate} disabled={translateLoading || !translateInput.trim() || !featuresUnlocked}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors shrink-0">
              {translateLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Languages className="h-3 w-3" />} Translate
            </button>
          </div>

          <div className="flex-1 flex items-center gap-3 min-h-0">
            {translated ? (
              <>
                <p className="flex-1 text-xs text-foreground leading-relaxed line-clamp-3">{translated}</p>
                <button onClick={() => copy(translated)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50 hover:bg-accent border border-border/40 text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  <Copy className="h-3 w-3" /> Copy
                </button>
                <button onClick={() => sendToChat(translated)}
                  className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-600/30 text-[10px] font-semibold text-emerald-600 transition-colors">
                  <Send className="h-3 w-3" /> {isDemoMode ? 'Send to Chat' : 'Send'}
                </button>
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground italic">
                {featuresUnlocked ? `Translation to ${currentLang?.name} appears here` : '⭐ Premium required'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── QUICK REPLY ─────────────────────────────────────────────────── */}
      {mode === 'quick-reply' && (
        <div className="flex-1 min-h-0 flex flex-col px-4 py-2.5 gap-2 relative">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-6 h-6 rounded-lg bg-pink-100 dark:bg-pink-950/60 flex items-center justify-center">
              <MessageSquarePlus className="h-3.5 w-3.5 text-pink-600 dark:text-pink-400" />
            </div>
            <span className="text-xs font-bold text-foreground">Quick Reply</span>
            <span className="text-[10px] text-muted-foreground">
              {isDemoMode ? '— type and click Send to Chat' : '— opens a conversation, then click Insert'}
            </span>
            <div className="flex-1" />
            {!featuresUnlocked && <span className="text-[9px] font-bold text-[#1D9BF0] bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 border border-[#1D9BF0]/30 dark:border-[#1D9BF0]/40 rounded-full px-1.5 py-0.5">PRO</span>}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
          </div>

          <div className="flex gap-2 flex-1 min-h-0">
            <textarea
              ref={qrRef}
              value={qrText}
              onChange={e => setQrText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); insertIntoChat() } }}
              placeholder="Type your reply… (⌘+Enter to send)"
              className="flex-1 resize-none rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-pink-400/50 leading-relaxed"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Drafts dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowDrafts(o => !o)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-all',
                  showDrafts ? 'bg-accent border-border' : 'border-border/50 text-muted-foreground hover:border-border bg-muted/30'
                )}
              >
                <Clock className="h-3 w-3" />
                Drafts {drafts.length > 0 && <span className="ml-0.5 bg-primary text-primary-foreground rounded-full w-3.5 h-3.5 flex items-center justify-center text-[8px]">{drafts.length}</span>}
              </button>
              {showDrafts && (
                <div className="absolute bottom-full left-0 mb-1 z-50 bg-background border border-border rounded-xl shadow-xl w-72 overflow-hidden">
                  {drafts.length === 0 ? (
                    <p className="p-3 text-xs text-muted-foreground text-center">No saved drafts</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto">
                      {drafts.map(d => (
                        <div key={d.id} className="flex items-start gap-2 px-3 py-2.5 hover:bg-accent group border-b border-border/30 last:border-0">
                          <button className="flex-1 text-left min-w-0" onClick={() => loadDraft(d)}>
                            <p className="text-[10px] text-muted-foreground mb-0.5">{new Date(d.savedAt).toLocaleString()}</p>
                            <p className="text-xs text-foreground line-clamp-2">{d.message}</p>
                          </button>
                          <button onClick={() => deleteDraft(d.id)} className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:text-destructive transition-all">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={saveDraft}
              disabled={!qrText.trim()}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border/50 bg-muted/30 text-[10px] font-semibold text-muted-foreground hover:text-foreground hover:border-border transition-all disabled:opacity-40"
            >
              <Clock className="h-3 w-3" /> Save Draft
            </button>

            <div className="flex-1" />

            <button
              onClick={() => insertIntoChat()}
              disabled={!qrText.trim() || qrSending || !featuresUnlocked}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {qrSending
                ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Inserting…</>
                : <><Send className="h-3.5 w-3.5" /> {isDemoMode ? 'Send to Chat' : 'Insert into Chat'}</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
