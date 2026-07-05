/**
 * Keyboard Shortcuts Reference Panel
 * FREE for all users — strong signal of a native macOS app, not a browser.
 */
import { Keyboard } from 'lucide-react'

interface Shortcut {
  keys: string[]
  description: string
  category: string
}

const SHORTCUTS: Shortcut[] = [
  // Navigation
  { keys: ['⌘', 'K'],          description: 'Open Command Palette',          category: 'Navigation' },
  { keys: ['⌘', '⇧', 'M'],     description: 'Show / hide app',               category: 'Navigation' },
  { keys: ['⌘', '1'],          description: 'Go to Dashboard',                category: 'Navigation' },
  { keys: ['⌘', '2'],          description: 'Go to Messaging',                category: 'Navigation' },
  { keys: ['⌘', '3'],          description: 'AI Reply Assistant',             category: 'Navigation' },
  { keys: ['⌘', '4'],          description: 'Message Translation',            category: 'Navigation' },
  { keys: ['⌘', '5'],          description: 'Analytics',                      category: 'Navigation' },
  // Messaging
  { keys: ['⌘', '←'],          description: 'Go back',                        category: 'Messaging' },
  { keys: ['⌘', '→'],          description: 'Go forward',                     category: 'Messaging' },
  { keys: ['⌘', 'R'],          description: 'Reload messaging view',          category: 'Messaging' },
  { keys: ['⌘', 'F'],          description: 'Find in page',                   category: 'Messaging' },
  // Workspace
  { keys: ['⌘', ','],          description: 'Open Preferences',               category: 'Workspace' },
  { keys: ['⌘', 'N'],          description: 'Add new account',                category: 'Workspace' },
  { keys: ['⌘', '\\'],         description: 'Toggle sidebar',                 category: 'Workspace' },
  { keys: ['⌘', '⇧', 'F'],    description: 'Toggle Focus Mode',              category: 'Workspace' },
  // Window
  { keys: ['⌘', 'M'],          description: 'Minimise window',                category: 'Window' },
  { keys: ['⌘', 'W'],          description: 'Hide window',                    category: 'Window' },
  { keys: ['⌘', 'Q'],          description: 'Quit app',                       category: 'Window' },
  { keys: ['⌘', '⌃', 'F'],    description: 'Toggle full screen',             category: 'Window' },
]

const grouped = SHORTCUTS.reduce((acc, s) => {
  if (!acc[s.category]) acc[s.category] = []
  acc[s.category].push(s)
  return acc
}, {} as Record<string, Shortcut[]>)

export function ShortcutsPanel() {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div
          className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center text-slate-600 dark:text-slate-400"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          <Keyboard className="h-4 w-4" />
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
          <p className="text-[11px] text-muted-foreground">All shortcuts available in Messaging Workspace</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {Object.entries(grouped).map(([category, shortcuts]) => (
          <section key={category}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              {category === 'Navigation' && '🧭'}
              {category === 'Messaging'  && '💬'}
              {category === 'Workspace'  && '⚙️'}
              {category === 'Window'     && '🖥️'}
              {category}
            </h3>
            <div className="space-y-1">
              {shortcuts.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-muted/40 transition-colors group"
                >
                  <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                    {s.description}
                  </span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, ki) => (
                      <kbd
                        key={ki}
                        className="min-w-[24px] h-6 px-1.5 flex items-center justify-center text-xs font-semibold font-mono bg-background border border-border/80 rounded-lg shadow-sm text-foreground/70"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-2xl bg-muted/30 border border-border/30 p-4">
          <p className="text-xs text-muted-foreground text-center">
            💡 Press <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono font-semibold">⌘K</kbd> anywhere to search all commands instantly
          </p>
        </div>
      </div>
    </div>
  )
}
