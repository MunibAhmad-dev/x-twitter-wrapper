import { useState } from 'react'
import { PremiumGate } from '../PremiumGate'
import { Button } from '../ui/button'
import { AI_TONES } from '../../../shared/constants'
import { Sparkles, Copy, RefreshCw, Hash, Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { safeCopy } from '../../lib/clipboard'

// Caption & hashtag generation runs via IPC in the main process (avoids renderer sandbox).

export function ContentStudioPanel() {
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState<string>('friendly')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [captionLoading, setCaptionLoading] = useState(false)
  const [hashtagsLoading, setHashtagsLoading] = useState(false)

  const generateCaption = async () => {
    if (!topic.trim()) { toast.error('Describe your post first'); return }
    setCaptionLoading(true)
    try {
      const result = await window.electronAPI?.ai?.generatePostContent(topic.trim(), 'caption', tone)
      if (result?.success && result.text) {
        setCaption(result.text)
      } else {
        toast.error(result?.error ? `AI error: ${result.error}` : 'Could not generate a caption. Please try again.')
      }
    } catch {
      toast.error('Failed to reach AI service. Please try again.')
    } finally {
      setCaptionLoading(false)
    }
  }

  const generateHashtags = async () => {
    if (!topic.trim()) { toast.error('Describe your post first'); return }
    setHashtagsLoading(true)
    try {
      const result = await window.electronAPI?.ai?.generatePostContent(topic.trim(), 'hashtags')
      if (result?.success && result.hashtags && result.hashtags.length > 0) {
        setHashtags(result.hashtags)
      } else {
        toast.error(result?.error ? `AI error: ${result.error}` : 'Could not generate hashtags. Please try again.')
      }
    } catch {
      toast.error('Failed to reach AI service. Please try again.')
    } finally {
      setHashtagsLoading(false)
    }
  }

  const copyText = async (text: string, label: string) => {
    const ok = await safeCopy(text)
    if (ok) toast.success(`${label} copied ✓`)
    else toast.error('Copy failed — please select the text manually')
  }

  return (
    <PremiumGate
      feature="AI Post Studio"
      description="Generate scroll-stopping tweets and trending hashtags for your X posts in seconds."
      icon="✨"
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
            <Sparkles className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">AI Post Studio</h2>
            <p className="text-[11px] text-muted-foreground">Captions &amp; hashtags for your posts</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Topic input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              What's your post about?
            </label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. a 30-second recipe for crispy garlic noodles…"
              rows={3}
              className="w-full resize-none rounded-xl bg-muted/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>

          {/* Tone selector (for the caption) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Caption tone
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

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              className="gap-2"
              onClick={generateCaption}
              disabled={captionLoading || !topic.trim()}
            >
              {captionLoading
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Writing…</>
                : <><Wand2 className="h-4 w-4" /> Caption</>}
            </Button>
            <Button
              variant="secondary"
              className="gap-2"
              onClick={generateHashtags}
              disabled={hashtagsLoading || !topic.trim()}
            >
              {hashtagsLoading
                ? <><RefreshCw className="h-4 w-4 animate-spin" /> Finding…</>
                : <><Hash className="h-4 w-4" /> Hashtags</>}
            </Button>
          </div>

          {/* Caption output */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Caption
              </label>
              {caption && (
                <button onClick={() => copyText(caption, 'Caption')} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <Copy className="h-3 w-3" /> Copy
                </button>
              )}
            </div>
            <div className="min-h-[72px] rounded-xl bg-muted/20 border border-border/50 px-4 py-3 text-sm text-foreground whitespace-pre-wrap">
              {caption || <span className="text-muted-foreground italic">Your generated caption will appear here…</span>}
            </div>
          </div>

          {/* Hashtags output */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Hashtags
              </label>
              {hashtags.length > 0 && (
                <button onClick={() => copyText(hashtags.join(' '), 'Hashtags')} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                  <Copy className="h-3 w-3" /> Copy all
                </button>
              )}
            </div>
            <div className="min-h-[72px] rounded-xl bg-muted/20 border border-border/50 px-4 py-3">
              {hashtags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {hashtags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => copyText(tag, tag)}
                      title="Click to copy"
                      className="px-2 py-0.5 rounded-full bg-[#1D9BF0]/10 text-[#1D9BF0] border border-[#1D9BF0]/30 text-[11px] font-semibold hover:bg-[#1D9BF0]/20 transition-colors"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic">Trending hashtags will appear here…</span>
              )}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground text-center">
            Powered by GPT-4o-mini · Tailored for X
          </p>
        </div>
      </div>
    </PremiumGate>
  )
}
