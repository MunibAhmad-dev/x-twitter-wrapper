import { useState, useEffect } from 'react'
import { PremiumGate } from '../PremiumGate'
import { useUIStore } from '../../store/uiStore'
import { Button } from '../ui/button'
import { AI_TONES } from '../../../shared/constants'
import { Bot, Copy, Send, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { safeCopy } from '../../lib/clipboard'

const EXAMPLE_REPLIES: Record<string, string[]> = {
  professional: [
    "Thank you for reaching out. I'll review this and get back to you with a detailed response shortly.",
    "I appreciate your message. Let me look into this and provide you with a comprehensive answer.",
    "Thank you for bringing this to my attention. I will address this promptly.",
  ],
  friendly: [
    "Hey! Thanks so much for the message 😊 I'll get back to you soon!",
    "Oh nice, thanks for letting me know! I'll check it out and reply shortly.",
    "Awesome, thanks! Give me a moment and I'll respond properly 🙌",
  ],
  casual: [
    "Got it, I'll get back to you",
    "Sure thing, will reply soon",
    "Sounds good, talk later",
  ],
  concise: [
    "Acknowledged. Will respond shortly.",
    "Received. On it.",
    "Noted. Reply soon.",
  ],
}

export function AIReplyPanel() {
  const { pendingAIText, setPendingAIText, isDemoMode, setPendingDemoText, setActiveView } = useUIStore()
  const [inputText, setInputText] = useState('')
  const [selectedTone, setSelectedTone] = useState<'professional' | 'friendly' | 'casual' | 'concise'>('professional')
  const [replies, setReplies] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Pre-fill from toolbar "→ AI Reply Page" button (avoids clipboard/paste issues on Mac)
  useEffect(() => {
    if (pendingAIText) {
      setInputText(pendingAIText)
      setReplies([])
      setPendingAIText('')
    }
  }, [pendingAIText, setPendingAIText])

  const generateReplies = async () => {
    if (!inputText.trim()) {
      toast.error('Please paste a message to reply to')
      return
    }

    setIsLoading(true)
    try {
      const result = await window.electronAPI?.ai?.generateReplies(inputText.trim(), selectedTone)
      if (result?.success && result.replies && result.replies.length > 0) {
        setReplies(result.replies)
      } else {
        toast.error(result?.error ? `AI error: ${result.error}` : 'AI returned no replies. Please try again.')
        setReplies(EXAMPLE_REPLIES[selectedTone])
      }
    } catch {
      toast.error('Failed to reach AI service. Please try again.')
      setReplies(EXAMPLE_REPLIES[selectedTone])
    } finally {
      setIsLoading(false)
    }
  }

  const copyReply = async (text: string) => {
    const ok = await safeCopy(text)
    if (ok) toast.success('Copied to clipboard ✓')
    else toast.error('Copy failed — please select the text manually')
  }

  const sendReply = async (text: string) => {
    if (isDemoMode) { setPendingDemoText(text); setActiveView('messaging'); return }
    const result = await window.electronAPI?.injectText(text)
    if (result?.success) { setActiveView('messaging'); toast.success('✓ Inserted') }
    else { await safeCopy(text); toast.info('📋 Copied — paste into chat') }
  }

  return (
    <PremiumGate
      feature="AI Reply Assistant"
      description="Generate smart, context-aware reply suggestions with adjustable tone — Professional, Friendly, Casual, or Concise."
      icon="🤖"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
          <div className="w-8 h-8 rounded-xl bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 flex items-center justify-center text-[#1D9BF0] dark:text-[#1D9BF0]" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <Bot className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">AI Reply Assistant</h2>
            <p className="text-[11px] text-muted-foreground">Generate smart replies in seconds</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Message input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Paste the message you want to reply to
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. &quot;Hi, can we schedule a call this week to discuss the project?&quot;"
              rows={4}
              className="w-full resize-none rounded-xl bg-muted/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>

          {/* Tone selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Reply Tone
            </label>
            <div className="grid grid-cols-4 gap-2">
              {AI_TONES.map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => setSelectedTone(tone.id as typeof selectedTone)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all ${
                    selectedTone === tone.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border/50 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <span className="text-base">{tone.emoji}</span>
                  {tone.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <Button
            className="w-full gap-2"
            onClick={generateReplies}
            disabled={isLoading || !inputText.trim()}
          >
            {isLoading ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="h-4 w-4" /> Generate Replies</>
            )}
          </Button>

          {/* Results */}
          {replies.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Suggestions
              </label>
              {replies.map((reply, i) => (
                <div
                  key={i}
                  className="group w-full p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 transition-all"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-xs font-bold text-muted-foreground mt-0.5 shrink-0">#{i + 1}</span>
                    <span className="flex-1 text-sm text-foreground leading-relaxed">{reply}</span>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => copyReply(reply)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted hover:bg-accent border border-border/40 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                    <button
                      onClick={() => sendReply(reply)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1D9BF0]/10 hover:bg-[#1D9BF0]/20 border border-[#1D9BF0]/30 text-xs font-semibold text-[#1D9BF0] transition-colors"
                    >
                      <Send className="h-3 w-3" /> {isDemoMode ? 'Send to Chat' : 'Send to X'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </PremiumGate>
  )
}
