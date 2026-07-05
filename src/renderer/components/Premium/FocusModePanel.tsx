import { useState, useEffect, useRef } from 'react'
import { PremiumGate } from '../PremiumGate'
import { Button } from '../ui/button'
import { useSettingsStore } from '../../store/settingsStore'
import { Target, Bell, BellOff, Play, Square, Timer } from 'lucide-react'
import { toast } from 'sonner'

const PRESET_DURATIONS = [
  { label: '15 min', value: 15 },
  { label: '25 min', value: 25, default: true },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
]

export function FocusModePanel() {
  const { focusMode, focusDurationMinutes, updateSettings } = useSettingsStore()
  const [duration, setDuration] = useState(focusDurationMinutes || 25)
  const [remaining, setRemaining] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Sync focusMode filter with document
  useEffect(() => {
    document.documentElement.style.filter = focusMode ? 'grayscale(100%)' : 'none'
  }, [focusMode])

  const startSession = () => {
    const secs = duration * 60
    setRemaining(secs)
    setIsRunning(true)
    updateSettings({ focusMode: true, focusDurationMinutes: duration })
    window.electronAPI?.settings.update({ focusMode: true })
    toast.success(`Focus session started — ${duration} minutes`)

    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          endSession()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const endSession = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setIsRunning(false)
    setRemaining(0)
    updateSettings({ focusMode: false })
    window.electronAPI?.settings.update({ focusMode: false })
    document.documentElement.style.filter = 'none'
    toast.success('Focus session complete! Notifications restored.')
  }

  const toggleFocusMode = () => {
    if (focusMode && !isRunning) {
      updateSettings({ focusMode: false })
      window.electronAPI?.settings.update({ focusMode: false })
      document.documentElement.style.filter = 'none'
      toast.info('Focus Mode disabled')
    } else {
      updateSettings({ focusMode: true })
      window.electronAPI?.settings.update({ focusMode: true })
      toast.success('Focus Mode enabled')
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const progress = isRunning ? ((duration * 60 - remaining) / (duration * 60)) * 100 : 0

  return (
    <PremiumGate
      feature="Focus Mode"
      description="Block distractions, silence notifications, and schedule timed focus sessions to maximize your productivity."
      icon="🎯"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div
            className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 dark:text-orange-400"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Target className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">Focus Mode</h2>
            <p className="text-[11px] text-muted-foreground">Distraction-free sessions</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status */}
          <div className={`rounded-2xl p-5 text-center border transition-all ${
            focusMode
              ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/30'
              : 'bg-card border-border/50'
          }`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              {focusMode
                ? <BellOff className="h-5 w-5 text-orange-500" />
                : <Bell className="h-5 w-5 text-muted-foreground" />}
              <span className={`text-sm font-semibold ${focusMode ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}>
                {focusMode ? 'Focus Mode Active' : 'Focus Mode Off'}
              </span>
            </div>

            {isRunning ? (
              <div className="mt-3">
                {/* Timer ring */}
                <div className="relative w-24 h-24 mx-auto mb-3">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                    <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                    <circle
                      cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 40}`}
                      strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
                      className="text-orange-500 transition-all duration-1000"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-bold text-foreground font-mono">{formatTime(remaining)}</span>
                  </div>
                </div>
                <Button variant="destructive" size="sm" className="gap-2" onClick={endSession}>
                  <Square className="h-3.5 w-3.5" />
                  End Session
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {focusMode ? 'Notifications silenced · Grayscale active' : 'Start a session or toggle Focus Mode'}
              </p>
            )}
          </div>

          {/* Quick toggle */}
          {!isRunning && (
            <Button
              variant={focusMode ? 'outline' : 'default'}
              className="w-full gap-2"
              onClick={toggleFocusMode}
            >
              {focusMode ? (
                <><Bell className="h-4 w-4" /> Disable Focus Mode</>
              ) : (
                <><BellOff className="h-4 w-4" /> Enable Focus Mode</>
              )}
            </Button>
          )}

          {/* Timed session */}
          {!isRunning && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Timer className="h-3.5 w-3.5" />
                Timed Session
              </h3>

              <div className="grid grid-cols-4 gap-2">
                {PRESET_DURATIONS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setDuration(p.value)}
                    className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      duration === p.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border/50 text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <Button className="w-full gap-2 bg-orange-500 hover:bg-orange-600 text-white border-none" onClick={startSession}>
                <Play className="h-4 w-4" />
                Start {duration}-Minute Session
              </Button>
            </div>
          )}

          {/* What focus mode does */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              What Focus Mode Does
            </h3>
            {[
              { emoji: '🔕', text: 'Silences all message notifications' },
              { emoji: '🔲', text: 'Applies grayscale filter to reduce distraction' },
              { emoji: '🏷️', text: 'Hides dock badge unread counts' },
              { emoji: '⏱️', text: 'Auto-disables when timed session ends' },
            ].map(item => (
              <div key={item.text} className="flex items-center gap-3 text-sm text-foreground">
                <span className="text-base w-6 text-center">{item.emoji}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PremiumGate>
  )
}
