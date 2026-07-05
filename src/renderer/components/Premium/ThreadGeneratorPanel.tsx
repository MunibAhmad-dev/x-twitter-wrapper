import { useState } from 'react'
import { PremiumGate } from '../PremiumGate'
import { Button } from '../ui/button'
import { AI_TONES } from '../../../shared/constants'
import { GitBranch, Copy, RefreshCw, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { safeCopy } from '../../lib/clipboard'

const THREAD_COUNTS = [5, 7, 10, 15, 20]

export function ThreadGeneratorPanel() {
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('friendly')
  const [tweetCount, setTweetCount] = useState(7)
  const [tweets, setTweets] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const generate = async () => {
    if (!topic.trim()) { toast.error('Describe your thread topic first'); return }
    setIsLoading(true)
    setTweets([])
    try {
      const fn = window.electronAPI?.ai?.generateThread
      if (!fn) { toast.error('AI service not available — please restart the app'); setIsLoading(false); return }
      const result = await fn(topic.trim(), tweetCount, tone)
      if (result?.success && result.tweets && result.tweets.length > 0) {
        setTweets(result.tweets)
        setExpandedIndex(null)
      } else {
        toast.error(result?.error ? `AI error: ${result.error}` : 'Could not generate thread. Please try again.')
      }
    } catch (err: any) {
      console.error('[ThreadGenerator]', err)
      toast.error(`Error: ${err?.message ?? 'Failed to reach AI service. Please try again.'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const copyTweet = async (text: string, index: number) => {
    const ok = await safeCopy(text)
    if (ok) toast.success(`Tweet ${index + 1} copied ✓`)
    else toast.error('Copy failed — please select the text manually')
  }

  const copyAll = async () => {
    const full = tweets.map((t, i) => `${i + 1}/ ${t}`).join('\n\n')
    const ok = await safeCopy(full)
    if (ok) toast.success('Full thread copied ✓')
    else toast.error('Copy failed')
  }

  const charCount = (text: string) => text.length

  return (
    <PremiumGate
      feature="AI Thread Generator"
      description="Enter a topic and AI creates a complete, viral Twitter thread in seconds."
      icon="🧵"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div
            className="w-8 h-8 rounded-xl bg-[#1D9BF0]/10 dark:bg-[#1D9BF0]/15 flex items-center justify-center text-[#1D9BF0]"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <GitBranch className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">AI Thread Generator</h2>
            <p className="text-[11px] text-muted-foreground">Create complete Twitter threads with AI</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Topic input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Thread topic
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 10 lessons I learned building my first startup from scratch…"
              rows={3}
              className="w-full resize-none rounded-xl bg-muted/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>

          {/* Thread length */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Thread length — {tweetCount} tweets
            </label>
            <div className="flex gap-2 flex-wrap">
              {THREAD_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => setTweetCount(n)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    tweetCount === n
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border/50 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {n} tweets
                </button>
              ))}
            </div>
          </div>

          {/* Tone selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tone
            </label>
            <div className="flex flex-wrap gap-2">
              {AI_TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                    tone === t.id
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border/50 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <Button
            className="w-full gap-2"
            onClick={generate}
            disabled={isLoading || !topic.trim()}
          >
            {isLoading
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Generating thread…</>
              : <><Sparkles className="h-4 w-4" /> Generate Thread</>}
          </Button>

          {/* Output */}
          {tweets.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Your thread ({tweets.length} tweets)
                </label>
                <button
                  onClick={copyAll}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  <Copy className="h-3 w-3" /> Copy all
                </button>
              </div>

              {tweets.map((tweet, i) => {
                const chars = charCount(tweet)
                const isOver = chars > 280
                const isExpanded = expandedIndex === i

                return (
                  <div
                    key={i}
                    className="rounded-xl border border-border/50 bg-card overflow-hidden"
                  >
                    {/* Tweet header */}
                    <div
                      className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedIndex(isExpanded ? null : i)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-[#1D9BF0] shrink-0">
                          {i + 1}/{tweets.length}
                        </span>
                        {!isExpanded && (
                          <span className="text-xs text-foreground truncate">{tweet.slice(0, 60)}{tweet.length > 60 ? '…' : ''}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-semibold ${isOver ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {chars}/280
                        </span>
                        {isExpanded
                          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    </div>

                    {/* Expanded tweet body */}
                    {isExpanded && (
                      <div className="px-4 pb-3 space-y-2 border-t border-border/30">
                        <p className="text-sm text-foreground leading-relaxed pt-2 whitespace-pre-wrap">{tweet}</p>
                        {isOver && (
                          <p className="text-[11px] text-red-500 font-medium">
                            ⚠ {chars - 280} chars over limit — consider trimming
                          </p>
                        )}
                        <div className="flex justify-end">
                          <button
                            onClick={() => copyTweet(tweet, i)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1D9BF0]/10 hover:bg-[#1D9BF0]/20 border border-[#1D9BF0]/30 text-xs font-semibold text-[#1D9BF0] transition-colors"
                          >
                            <Copy className="h-3 w-3" /> Copy tweet
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Powered by GPT-4o-mini · Optimised for X threads
          </p>
        </div>
      </div>
    </PremiumGate>
  )
}
