/**
 * Shared premium upgrade UI used by both OnboardingScreen and Paywall.
 * Layout: title → 2-col features grid → 3 pricing buttons → footer links.
 *
 * Rendered as a CENTERED modal (never a full-screen top bar) so it never sits
 * under the macOS traffic-light buttons — fixes Apple Guideline 4 overlap.
 */
import { useEffect, useRef, useState } from 'react'
import { IAP_PRODUCTS, PRIVACY_POLICY_URL } from '../../shared/constants'
import { ProductInfo } from '../../shared/types'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'

// Apple requires a functional Terms of Use (EULA) link for auto-renewable
// subscriptions. The Apple standard EULA is the accepted default.
const APPLE_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'

const FEATURES = [
  { emoji: '🤖', title: 'AI Reply Assistant', desc: 'Generate smart replies with adjustable tone and length.' },
  { emoji: '💼', title: 'Multiple Accounts',  desc: 'Stay signed in to unlimited X accounts at once.' },
  { emoji: '🌐', title: 'AI Translate',       desc: 'Translate messages into 14 languages with one click.' },
  { emoji: '✨', title: 'AI Post Studio',      desc: 'Generate post captions and trending hashtags instantly.' },
  { emoji: '📊', title: 'Analytics',          desc: 'Track DM activity across your accounts over time.' },
  { emoji: '✍️', title: 'Quick Reply',         desc: 'Compose replies natively and paste into any chat.' },
  { emoji: '🎯', title: 'Focus Mode',         desc: 'Schedule Do Not Disturb sessions to stay productive.' },
  { emoji: '🔍', title: 'Smart Filters',      desc: 'Filter accounts by creator type, status, or flags.' },
]

export interface PremiumModalProps {
  onDismiss: () => void
  onPurchaseSuccess: (productId: string) => void
  showCloseButton?: boolean
}

export function PremiumModal({ onDismiss, onPurchaseSuccess, showCloseButton = true }: PremiumModalProps) {
  const [products, setProducts] = useState<ProductInfo[]>([])
  const [processingId, setProcessingId] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let mounted = true
    window.electronAPI?.iap.getProducts([
      IAP_PRODUCTS.PREMIUM_MONTHLY,
      IAP_PRODUCTS.PREMIUM_YEARLY,
      IAP_PRODUCTS.PREMIUM_LIFETIME,
    ]).then(p => { if (mounted) setProducts(p ?? []) }).catch(() => {})

    window.electronAPI?.iap?.onPremiumUnlocked((productId) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setProcessingId(null)
      onPurchaseSuccess(productId)
    })

    window.electronAPI?.iap?.onPurchaseFailed((reason) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setProcessingId(null)
      toast.error(reason || 'Purchase failed or was cancelled.')
    })

    window.electronAPI?.iap?.onPurchaseDeferred?.(() => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setProcessingId(null)
      toast.info('Your purchase is pending approval.', { duration: 8000 })
    })

    return () => { mounted = false; if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  const purchase = async (productId: string) => {
    setProcessingId(productId)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setProcessingId(null)
      toast.error("Apple Store is taking longer than expected. If you've purchased, tap 'Restore Purchases'.", { duration: 10000 })
    }, 25000)
    try {
      const result = await window.electronAPI!.iap.purchase(productId)
      if (!result.success) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        toast.error(result.error || 'Could not start purchase. Please try again.')
        setProcessingId(null)
      }
    } catch (err) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setProcessingId(null)
      toast.error(err instanceof Error ? err.message : 'An unexpected error occurred.')
    }
  }

  const restore = async () => {
    setProcessingId('restore')
    toast.info('Restoring purchases…')
    try {
      await window.electronAPI!.iap.restore()
      setTimeout(() => setProcessingId(null), 5000)
    } catch {
      setProcessingId(null)
      toast.error('Restore failed. Please try again.')
    }
  }

  const price = (id: string) => products.find(p => p.id === id)?.price
  const busy = processingId !== null

  const yearlyPrice   = price(IAP_PRODUCTS.PREMIUM_YEARLY)   || '$14.99'
  const monthlyPrice  = price(IAP_PRODUCTS.PREMIUM_MONTHLY)  || '$4.99'
  const lifetimePrice = price(IAP_PRODUCTS.PREMIUM_LIFETIME) || '$19.99'

  return (
    <div style={{
      background: 'var(--modal-bg, #121214)',
      borderRadius: 20,
      border: '1px solid rgba(255,255,255,0.10)',
      padding: '36px 40px 28px',
      width: '100%',
      maxWidth: 680,
      position: 'relative',
    }}>
      {/* X button */}
      {showCloseButton && (
        <button
          onClick={onDismiss}
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 30, height: 30, borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: 16, lineHeight: 1,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
        >
          ×
        </button>
      )}

      {/* Title */}
      <h1 style={{
        fontSize: 28, fontWeight: 700, color: '#fff',
        textAlign: 'center', letterSpacing: '-0.4px', marginBottom: 28,
      }}>
        Upgrade to Premium
      </h1>

      {/* Features 2-col grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 32px', marginBottom: 32,
      }}>
        {FEATURES.map(f => (
          <div key={f.title} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 26, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{f.emoji}</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 3 }}>{f.title}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 3 pricing cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20, alignItems: 'end' }}>

        {/* Monthly */}
        <button
          onClick={() => !busy && purchase(IAP_PRODUCTS.PREMIUM_MONTHLY)}
          disabled={busy}
          style={{
            background: processingId === IAP_PRODUCTS.PREMIUM_MONTHLY
              ? 'rgba(37,244,238,0.35)'
              : 'linear-gradient(160deg, #0e7490 0%, #22d3ee 100%)',
            border: '1px solid rgba(37,244,238,0.35)',
            borderRadius: 16, padding: '18px 14px 16px',
            color: '#fff', cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy && processingId !== IAP_PRODUCTS.PREMIUM_MONTHLY ? 0.45 : 1,
            transition: 'filter 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            textAlign: 'center',
            boxShadow: '0 6px 24px rgba(37,244,238,0.25)',
          }}
          onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.12)' }}
          onMouseLeave={e => { if (!busy) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)' }}
        >
          {processingId === IAP_PRODUCTS.PREMIUM_MONTHLY
            ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', margin: '10px 0' }} />
            : <>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Monthly</span>
                <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{monthlyPrice}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>per month</span>
                <span style={{
                  marginTop: 10, width: '100%', borderRadius: 8, padding: '8px 0',
                  background: 'rgba(255,255,255,0.15)',
                  fontSize: 12, fontWeight: 600, color: '#fff',
                }}>Subscribe</span>
              </>}
        </button>

        {/* Yearly — featured */}
        <button
          onClick={() => !busy && purchase(IAP_PRODUCTS.PREMIUM_YEARLY)}
          disabled={busy}
          style={{
            background: processingId === IAP_PRODUCTS.PREMIUM_YEARLY
              ? 'rgba(254,44,85,0.4)'
              : 'linear-gradient(160deg, #be123c 0%, #1D9BF0 100%)',
            border: '1px solid rgba(254,44,85,0.5)',
            borderRadius: 16, padding: '22px 14px 18px',
            color: '#fff', cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy && processingId !== IAP_PRODUCTS.PREMIUM_YEARLY ? 0.45 : 1,
            transition: 'opacity 0.15s, filter 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(254,44,85,0.45)',
            position: 'relative',
          }}
          onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.1)' }}
          onMouseLeave={e => { if (!busy) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)' }}
        >
          {/* BEST VALUE badge */}
          <span style={{
            position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)',
            background: 'linear-gradient(90deg, #1D9BF0, #0a66c2)',
            borderRadius: 20, padding: '3px 12px',
            fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
            color: '#fff', whiteSpace: 'nowrap', textTransform: 'uppercase',
          }}>Best Value</span>

          {processingId === IAP_PRODUCTS.PREMIUM_YEARLY
            ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', margin: '14px 0' }} />
            : <>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' }}>Yearly</span>
                <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{yearlyPrice}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>per year</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>3-day free trial</span>
                <span style={{
                  marginTop: 12, width: '100%', borderRadius: 8, padding: '9px 0',
                  background: 'rgba(255,255,255,0.20)',
                  fontSize: 13, fontWeight: 700, color: '#fff',
                }}>Try Free</span>
              </>}
        </button>

        {/* Lifetime — dark */}
        <button
          onClick={() => !busy && purchase(IAP_PRODUCTS.PREMIUM_LIFETIME)}
          disabled={busy}
          style={{
            background: processingId === IAP_PRODUCTS.PREMIUM_LIFETIME
              ? 'rgba(63,63,70,0.6)'
              : 'linear-gradient(160deg, #18181b 0%, #3f3f46 100%)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 16, padding: '18px 14px 16px',
            color: '#fff', cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy && processingId !== IAP_PRODUCTS.PREMIUM_LIFETIME ? 0.45 : 1,
            transition: 'filter 0.15s',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            textAlign: 'center',
            boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
          }}
          onMouseEnter={e => { if (!busy) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.18)' }}
          onMouseLeave={e => { if (!busy) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)' }}
        >
          {processingId === IAP_PRODUCTS.PREMIUM_LIFETIME
            ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', margin: '10px 0' }} />
            : <>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>Lifetime</span>
                <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.1 }}>{lifetimePrice}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>one-time</span>
                <span style={{
                  marginTop: 10, width: '100%', borderRadius: 8, padding: '8px 0',
                  background: 'rgba(255,255,255,0.15)',
                  fontSize: 12, fontWeight: 600, color: '#fff',
                }}>Buy Once</span>
              </>}
        </button>
      </div>

      {/* Footer links */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
        <button onClick={() => window.electronAPI?.openExternal(APPLE_EULA_URL)}
          style={linkStyle}>Terms of Service</button>
        <button onClick={() => window.electronAPI?.openExternal(PRIVACY_POLICY_URL)}
          style={linkStyle}>Privacy Policy</button>
        <button onClick={restore} disabled={busy} style={{ ...linkStyle, opacity: busy ? 0.4 : 1 }}>
          {processingId === 'restore' ? 'Restoring…' : 'Restore Purchases'}
        </button>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

const linkStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 12, color: 'rgba(255,255,255,0.35)',
  textDecoration: 'underline', textUnderlineOffset: 3,
  transition: 'color 0.15s',
}
