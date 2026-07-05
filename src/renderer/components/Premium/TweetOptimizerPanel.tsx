import { useState } from 'react'
import { PremiumGate } from '../PremiumGate'
import { Button } from '../ui/button'
import { Zap, Copy, RefreshCw, ArrowRight, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { safeCopy } from '../../lib/clipboard'

export function TweetOptimizerPanel() {
  const [input, setInput] = useState('')
  const [optimized, setOptimized] = useState('')
  const [explanation, setExplanation] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const inputChars = input.length
  const optimizedChars = optimized.length

  const optimize = async () => {
    if (!input.trim()) { toast.error('Paste a tweet first'); return }
    setIsLoading(true)
    setOptimized('')
    setExplanation('')
    try {
      const fn = window.electronAPI?.ai?.optimizeTweet
      if (!fn) { toast.error('AI service not available — please restart the app'); setIsLoading(false); return }
      const result = await fn(input.trim())
      if (result?.success && result.optimized) {
        setOptimized(result.optimized)
        setExplanation(result.explanation || '')
      } else {
        toast.error(result?.error ? `AI error: ${result.error}` : 'Could not optimize tweet. Please try again.')
      }
    } catch (err: any) {
      console.error('[TweetOptimizer]', err)
      toast.error(`Error: ${err?.message ?? 'Failed to reach AI service. Please try again.'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const copyOptimized = async () => {
    const ok = await safeCopy(optimized)
    if (ok) toast.success('Optimized tweet copied ✓')
    else toast.error('Copy failed — please select the text manually')
  }

  const reset = () => {
    setInput('')
    setOptimized('')
    setExplanation('')
  }

  return (
    <PremiumGate
      feature="AI Tweet Optimizer"
      description="Paste any tweet and AI rewrites it to maximize engagement, clarity, and reach — always under 280 characters."
      icon="⚡"
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
            <Zap className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">AI Tweet Optimizer</h2>
            <p className="text-[11px] text-muted-foreground">Maximize engagement, clarity &amp; reach</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Your tweet
              </label>
              <span className={`text-[11px] font-semibold ${inputChars > 280 ? 'text-red-500' : 'text-muted-foreground'}`}>
                {inputChars}/280
              </span>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Paste your tweet here — AI will rewrite it to get more engagement…"
              rows={5}
              className="w-full resize-none rounded-xl bg-muted/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>

          {/* What AI improves */}
          <div className="rounded-xl bg-muted/20 border border-border/40 px-4 py-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">AI optimizes for</p>
            <div className="flex flex-wrap gap-2">
              {[
                { emoji: '🎯', label: 'Engagement' },
                { emoji: '✂️', label: '≤280 chars' },
                { emoji: '💡', label: 'Clarity' },
                { emoji: '📢', label: 'Reach' },
              ].map(({ emoji, label }) => (
                <span
                  key={label}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1D9BF0]/10 text-[#1D9BF0] border border-[#1D9BF0]/20 text-[11px] font-semibold"
                >
                  {emoji} {label}
                </span>
              ))}
            </div>
          </div>

          {/* Optimize button */}
          <Button
            className="w-full gap-2"
            onClick={optimize}
            disabled={isLoading || !input.trim()}
          >
            {isLoading
              ? <><RefreshCw className="h-4 w-4 animate-spin" /> Optimizing…</>
              : <><Zap className="h-4 w-4" /> Optimize Tweet</>}
          </Button>

          {/* Output */}
          {optimized && (
            <div className="space-y-3">
              {/* Arrow divider */}
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <div className="flex-1 h-px bg-border/50" />
                <ArrowRight className="h-4 w-4 text-[#1D9BF0]" />
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {/* Optimized tweet */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Optimized tweet
                  </label>
                  <span className={`text-[11px] font-semibold ${optimizedChars > 280 ? 'text-red-500' : 'text-emerald-500'}`}>
                    {optimizedChars}/280
                  </span>
                </div>
                <div className="relative rounded-xl bg-muted/20 border border-[#1D9BF0]/30 px-4 py-3">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{optimized}</p>
                </div>
              </div>

              {/* Explanation */}
              {explanation && (
                <div className="rounded-xl bg-[#1D9BF0]/5 border border-[#1D9BF0]/20 px-4 py-2.5">
                  <p className="text-[11px] text-[#1D9BF0] font-medium">
                    <span className="font-bold">What changed: </span>{explanation}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={copyOptimized}>
                  <Copy className="h-4 w-4" /> Copy
                </Button>
                <Button variant="outline" className="gap-2" onClick={reset} title="Start over">
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground text-center">
            Powered by GPT-4o-mini · Tailored for X
          </p>
        </div>
      </div>
    </PremiumGate>
  )
}
