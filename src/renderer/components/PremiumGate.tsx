import { useUIStore } from '../store/uiStore'
import { useSettingsStore } from '../store/settingsStore'
import { Button } from './ui/button'
import { Sparkles } from 'lucide-react'
import { IAP_ENABLED } from '../../shared/constants'

interface PremiumGateProps {
  feature: string
  description: string
  icon: string
  children: React.ReactNode
}

/**
 * Wraps any premium feature. If the user is not premium, it shows a styled
 * upgrade prompt instead of the feature content. If premium, renders children.
 */
export function PremiumGate({ feature, description, icon, children }: PremiumGateProps) {
  const { isPremium } = useSettingsStore()
  const { setActiveView, isDemoMode } = useUIStore()

  if (!IAP_ENABLED || isPremium || isDemoMode) return <>{children}</>

  return (
    <div className="flex flex-col h-full items-center justify-center p-8 text-center">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center text-4xl mb-6 shadow-lg"
        style={{ background: 'linear-gradient(135deg, #1D9BF0 0%, #0a66c2 100%)' }}
      >
        {icon}
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">{feature}</h2>
      <p className="text-muted-foreground text-sm max-w-xs mb-8 leading-relaxed">{description}</p>

      <div className="flex flex-col gap-3 items-center w-full max-w-xs">
        <Button
          className="w-full gap-2 bg-[#1D9BF0] hover:bg-[#1a8cd8] text-white border-none"
          onClick={() => setActiveView('upgrade')}
        >
          <Sparkles className="h-4 w-4" />
          Unlock Productivity Features
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Part of the Premium plan — from $2.99/month
        </p>
      </div>
    </div>
  )
}
