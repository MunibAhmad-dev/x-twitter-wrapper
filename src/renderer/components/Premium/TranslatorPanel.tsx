import { useState, useEffect } from 'react'
import { PremiumGate } from '../PremiumGate'
import { useUIStore } from '../../store/uiStore'
import { Button } from '../ui/button'
import { SUPPORTED_LANGUAGES } from '../../../shared/constants'
import { Languages, Copy, Send, ArrowRight, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useSettingsStore } from '../../store/settingsStore'
import { safeCopy } from '../../lib/clipboard'

// Translation is handled via IPC in the main process (avoids renderer sandbox restrictions)

export function TranslatorPanel() {
  const { targetLanguage, updateSettings } = useSettingsStore()
  const { pendingTranslateText, setPendingTranslateText, isDemoMode, setPendingDemoText, setActiveView } = useUIStore()
  const [inputText, setInputText] = useState('')
  const [translatedText, setTranslatedText] = useState('')
  const [selectedLang, setSelectedLang] = useState(targetLanguage || 'es')
  const [isLoading, setIsLoading] = useState(false)
  const [detectedLang, setDetectedLang] = useState('')

  // Pre-fill from toolbar "→ Translator Page" button (avoids clipboard/paste issues on Mac)
  useEffect(() => {
    if (pendingTranslateText) {
      setInputText(pendingTranslateText)
      setTranslatedText('')
      setPendingTranslateText('')
    }
  }, [pendingTranslateText, setPendingTranslateText])

  const handleTranslate = async () => {
    if (!inputText.trim()) { toast.error('Please enter text to translate'); return }
    setIsLoading(true)
    try {
      const result = await window.electronAPI?.ai?.translate(inputText.trim(), selectedLang)
      if (result?.success && result.text) {
        setTranslatedText(result.text)
      } else {
        toast.error(result?.error ? `Translation error: ${result.error}` : 'Translation failed. Please try again.')
      }
    } catch {
      toast.error('Translation failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLangChange = (code: string) => {
    setSelectedLang(code)
    updateSettings({ targetLanguage: code })
    setTranslatedText('')
  }

  const copyTranslation = async () => {
    const ok = await safeCopy(translatedText)
    if (ok) toast.success('Copied to clipboard ✓')
    else toast.error('Copy failed — please select the text manually')
  }

  const sendTranslation = async () => {
    if (!translatedText) return
    if (isDemoMode) { setPendingDemoText(translatedText); setActiveView('messaging'); return }
    const result = await window.electronAPI?.injectText(translatedText)
    if (result?.success) { setActiveView('messaging'); toast.success('✓ Inserted') }
    else { await safeCopy(translatedText); toast.info('📋 Copied — paste into chat') }
  }

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)

  return (
    <PremiumGate
      feature="Message Translation"
      description="Instantly translate any message into 14 languages. Auto-detects source language and works seamlessly with your conversations."
      icon="🌐"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div
          className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-background/95 backdrop-blur sticky top-0 z-10"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div
            className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Languages className="h-4 w-4" />
          </div>
          <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
            <h2 className="text-sm font-semibold text-foreground">Message Translation</h2>
            <p className="text-[11px] text-muted-foreground">Translate into {SUPPORTED_LANGUAGES.length} languages</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Language selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Translate to
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {SUPPORTED_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLangChange(lang.code)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border text-[10px] font-semibold transition-all ${
                    selectedLang === lang.code
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card border-border/50 text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  <span className="text-lg leading-none">{lang.flag}</span>
                  {lang.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Input / Output */}
          <div className="grid grid-cols-1 gap-3">
            {/* Source */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Original Message
              </label>
              <textarea
                value={inputText}
                onChange={(e) => { setInputText(e.target.value); setTranslatedText('') }}
                placeholder="Paste a message here to translate…"
                rows={4}
                className="w-full resize-none rounded-xl bg-muted/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-xs">
              <ArrowRight className="h-4 w-4" />
              <span>Translating to {currentLang?.flag} {currentLang?.name}</span>
            </div>

            {/* Output */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Translation
                </label>
                {translatedText && (
                  <div className="flex items-center gap-2">
                    <button onClick={copyTranslation} className="flex items-center gap-1 text-[11px] text-primary hover:underline">
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                    <button onClick={sendTranslation} className="flex items-center gap-1 text-[11px] text-emerald-600 hover:underline">
                      <Send className="h-3 w-3" /> {isDemoMode ? 'Send to Chat' : 'Send to X'}
                    </button>
                  </div>
                )}
              </div>
              <div className="min-h-[100px] rounded-xl bg-muted/20 border border-border/50 px-4 py-3 text-sm text-foreground">
                {translatedText || (
                  <span className="text-muted-foreground italic">Translation will appear here…</span>
                )}
              </div>
            </div>
          </div>

          {/* Translate button */}
          <Button
            className="w-full gap-2"
            onClick={handleTranslate}
            disabled={isLoading || !inputText.trim()}
          >
            {isLoading ? (
              <><RefreshCw className="h-4 w-4 animate-spin" /> Translating…</>
            ) : (
              <><Languages className="h-4 w-4" /> Translate Now</>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            Powered by GPT-4o-mini · Context-aware, natural translations
          </p>
        </div>
      </div>
    </PremiumGate>
  )
}
