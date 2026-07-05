/**
 * Theme Customizer Panel
 * Accent colours, font size, layout density — all app-native features.
 */
import { useSettingsStore } from '../../store/settingsStore'
import { PremiumGate } from '../PremiumGate'
import { Palette, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { toast } from 'sonner'

const ACCENT_COLORS = [
  { label: 'Indigo',   value: '#6366f1', bg: 'bg-indigo-500' },
  { label: 'Blue',     value: '#3b82f6', bg: 'bg-blue-500' },
  { label: 'Violet',   value: '#8b5cf6', bg: 'bg-violet-500' },
  { label: 'Rose',     value: '#f43f5e', bg: 'bg-rose-500' },
  { label: 'Orange',   value: '#f97316', bg: 'bg-orange-500' },
  { label: 'Emerald',  value: '#10b981', bg: 'bg-emerald-500' },
  { label: 'Teal',     value: '#14b8a6', bg: 'bg-teal-500' },
  { label: 'Amber',    value: '#f59e0b', bg: 'bg-amber-500' },
  { label: 'Cyan',     value: '#06b6d4', bg: 'bg-cyan-500' },
  { label: 'Pink',     value: '#ec4899', bg: 'bg-pink-500' },
  { label: 'Lime',     value: '#84cc16', bg: 'bg-lime-500' },
  { label: 'Slate',    value: '#64748b', bg: 'bg-slate-500' },
]

const WALLPAPERS = [
  { id: 'none',     label: 'None',      preview: 'bg-background' },
  { id: 'dots',     label: 'Dots',      preview: 'bg-[radial-gradient(circle,#6366f120_1px,transparent_1px)] bg-[size:20px_20px]' },
  { id: 'grid',     label: 'Grid',      preview: 'bg-[linear-gradient(#6366f115_1px,transparent_1px),linear-gradient(to_right,#6366f115_1px,transparent_1px)] bg-[size:20px_20px]' },
  { id: 'gradient', label: 'Gradient',  preview: 'bg-gradient-to-br from-violet-50 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30' },
]

export function ThemeCustomizerPanel() {
  const { accentColor, compactMode, fontSize, theme, updateSettings } = useSettingsStore()

  const applyAccent = (color: string) => {
    updateSettings({ accentColor: color })
    document.documentElement.style.setProperty('--color-primary-override', color)
    toast.success('Accent colour updated')
  }

  const applyFontSize = (size: 'small' | 'medium' | 'large') => {
    updateSettings({ fontSize: size })
    const map = { small: '13px', medium: '15px', large: '17px' }
    document.documentElement.style.fontSize = map[size]
    toast.success(`Text size set to ${size}`)
  }

  return (
    <PremiumGate
      feature="Theme Customizer"
      description="Personalise the app's accent colour, text size, and layout density. Make it truly yours."
      icon="🎨"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: accentColor + '22', color: accentColor }}
          >
            <Palette className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">Theme Customizer</h2>
            <p className="text-[11px] text-muted-foreground">Personalise your workspace appearance</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Accent colour */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Accent Colour</h3>
            <div className="grid grid-cols-6 gap-3">
              {ACCENT_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => applyAccent(c.value)}
                  title={c.label}
                  className="group flex flex-col items-center gap-1.5"
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-2xl transition-all flex items-center justify-center border-2',
                      accentColor === c.value ? 'border-foreground scale-110 shadow-lg' : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: c.value }}
                  >
                    {accentColor === c.value && <Check className="h-4 w-4 text-white stroke-[3px]" />}
                  </div>
                  <span className="text-[9px] text-muted-foreground font-medium">{c.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Dark / Light */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Colour Mode</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'light', label: 'Light', icon: '☀️', preview: 'bg-white border-2 border-border/50' },
                { id: 'dark',  label: 'Dark',  icon: '🌙', preview: 'bg-zinc-900 border-2 border-zinc-700' },
              ].map(mode => (
                <button
                  key={mode.id}
                  onClick={() => {
                    const isDark = mode.id === 'dark'
                    document.documentElement.classList.toggle('dark', isDark)
                    updateSettings({ theme: mode.id as 'light' | 'dark' })
                    window.electronAPI?.settings.update({ theme: mode.id as any })
                    toast.success(`${mode.label} mode enabled`)
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all',
                    theme === mode.id ? 'border-primary shadow-md' : 'border-border/40 hover:border-border'
                  )}
                >
                  <div className={cn('w-full h-16 rounded-xl', mode.preview)} />
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <span>{mode.icon}</span> {mode.label}
                  </div>
                  {theme === mode.id && (
                    <div className="flex items-center gap-1 text-xs text-primary font-semibold">
                      <Check className="h-3 w-3" /> Active
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Font size */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Text Size</h3>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: 'small',  label: 'Small',  example: 'text-xs' },
                { id: 'medium', label: 'Medium', example: 'text-sm' },
                { id: 'large',  label: 'Large',  example: 'text-base' },
              ] as const).map(s => (
                <button
                  key={s.id}
                  onClick={() => applyFontSize(s.id)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3.5 rounded-2xl border-2 transition-all',
                    fontSize === s.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/40 hover:border-border'
                  )}
                >
                  <span className={cn('font-semibold text-foreground', s.example)}>Aa</span>
                  <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
                  {fontSize === s.id && <Check className="h-3 w-3 text-primary" />}
                </button>
              ))}
            </div>
          </section>

          {/* Compact mode */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Layout Density</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: false, label: 'Comfortable', desc: 'Standard spacing' },
                { id: true,  label: 'Compact',     desc: 'Denser layout' },
              ].map(option => (
                <button
                  key={String(option.id)}
                  onClick={() => {
                    updateSettings({ compactMode: option.id })
                    toast.success(`${option.label} layout enabled`)
                  }}
                  className={cn(
                    'flex flex-col items-start gap-1 p-4 rounded-2xl border-2 text-left transition-all',
                    compactMode === option.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/40 hover:border-border'
                  )}
                >
                  <p className="text-sm font-semibold text-foreground">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.desc}</p>
                  {compactMode === option.id && <Check className="h-3.5 w-3.5 text-primary mt-1" />}
                </button>
              ))}
            </div>
          </section>

        </div>
      </div>
    </PremiumGate>
  )
}
