import { useState, useEffect } from 'react'
import { APP_NAME, APP_VERSION, APP_STORE_REVIEW_URL } from '../../../shared/constants'
import { useUIStore } from '../../store/uiStore'
import {
  dismissReview,
  REVIEW_LEFT_KEY,
  REVIEW_DISMISS_KEY,
  REVIEW_VERSION_KEY,
} from '../../lib/reviewPrompt'
import logoUrl from '../../assets/logo.jpeg'

const SNOOZE_MS          = 7  * 24 * 60 * 60 * 1000
const LOW_STAR_SNOOZE_MS = 30 * 24 * 60 * 60 * 1000

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    )
    obs.observe(document.documentElement, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

export function ReviewModal() {
  const { isReviewModalOpen, setReviewModalOpen } = useUIStore()
  const dark = useIsDark()
  const [hovered, setHovered] = useState(-1)
  const [rating, setRating]   = useState(-1)
  const [step, setStep]       = useState<'rate' | 'thanks'>('rate')

  useEffect(() => {
    window.electronAPI?.setModalOpen(isReviewModalOpen)
    if (!isReviewModalOpen) { setHovered(-1); setRating(-1); setStep('rate') }
    return () => { if (isReviewModalOpen) window.electronAPI?.setModalOpen(false) }
  }, [isReviewModalOpen])

  const close = () => {
    window.electronAPI?.setModalOpen(false)
    setReviewModalOpen(false)
  }

  const handleStar = (idx: number) => {
    setRating(idx)
    if (idx + 1 >= 4) {
      setStep('thanks')
    } else {
      localStorage.setItem(REVIEW_DISMISS_KEY, String(Date.now() + LOW_STAR_SNOOZE_MS - SNOOZE_MS))
      dismissReview(APP_VERSION)
      close()
    }
  }

  const handleWriteReview = async () => {
    localStorage.setItem(REVIEW_LEFT_KEY, '1')
    localStorage.setItem(REVIEW_VERSION_KEY, APP_VERSION)
    try {
      const native = await (window.electronAPI as any)?.requestNativeReview?.()
      if (!native) window.electronAPI?.openExternal(APP_STORE_REVIEW_URL)
    } catch {
      window.electronAPI?.openExternal(APP_STORE_REVIEW_URL)
    }
    close()
  }

  const handleOK = () => {
    localStorage.setItem(REVIEW_LEFT_KEY, '1')
    dismissReview(APP_VERSION)
    close()
  }

  const handleNotNow = () => {
    dismissReview(APP_VERSION)
    close()
  }

  if (!isReviewModalOpen) return null

  const t = {
    card:     dark ? '#1e1e1e' : '#ffffff',
    border:   dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    title:    dark ? '#f2f2f2' : '#111111',
    body:     dark ? '#888888' : '#777777',
    divider:  dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
    btnHover: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    starIdle: dark ? '#444444' : '#d1d1d6',
    starOn:   '#FE2C55',
    starDone: '#FF3B30',
  }

  const shadow = dark
    ? '0 16px 48px rgba(0,0,0,0.60), 0 2px 8px rgba(0,0,0,0.30)'
    : '0 4px 6px rgba(0,0,0,0.04), 0 12px 36px rgba(0,0,0,0.10)'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, pointerEvents: 'none',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 52,
    }}>
      <div style={{
        pointerEvents: 'auto', width: 296, background: t.card,
        border: `1px solid ${t.border}`, borderRadius: 18, boxShadow: shadow, overflow: 'hidden',
      }}>

        {step === 'rate' && (
          <>
            <div style={{ padding: '22px 20px 16px' }}>
              <img
                src={logoUrl}
                alt={APP_NAME}
                style={{ width: 56, height: 56, borderRadius: 13, display: 'block', marginBottom: 14, objectFit: 'cover' }}
              />
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: t.title, lineHeight: 1.35 }}>
                Enjoying {APP_NAME}?
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: t.body, lineHeight: 1.5 }}>
                Click a star to rate it on the App Store.
              </p>
            </div>

            <div style={{ height: 1, background: t.divider }} />

            <div
              style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 20px' }}
              onMouseLeave={() => setHovered(-1)}
            >
              {[0, 1, 2, 3, 4].map(i => {
                const on = i <= hovered
                return (
                  <button
                    key={i}
                    onMouseEnter={() => setHovered(i)}
                    onClick={() => handleStar(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
                  >
                    <svg
                      width={36} height={36} viewBox="0 0 24 24"
                      style={{
                        display: 'block',
                        transition: 'fill 0.08s, transform 0.08s',
                        transform: on ? 'scale(1.08)' : 'scale(1)',
                      }}
                      fill={on ? t.starOn : 'none'}
                      stroke={on ? t.starOn : t.starIdle}
                      strokeWidth={on ? 0 : 1.8}
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                )
              })}
            </div>

            <div style={{ height: 1, background: t.divider }} />

            <button
              onClick={handleNotNow}
              style={{
                display: 'block', width: '100%', padding: '13px 0', background: 'none',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: t.body,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = t.btnHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              Not Now
            </button>
          </>
        )}

        {step === 'thanks' && (
          <>
            <div style={{ padding: '22px 20px 16px' }}>
              <img
                src={logoUrl}
                alt={APP_NAME}
                style={{ width: 56, height: 56, borderRadius: 13, display: 'block', marginBottom: 14, objectFit: 'cover' }}
              />
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: t.title, lineHeight: 1.35 }}>
                Thanks for your feedback.
              </p>
              <p style={{ margin: 0, fontSize: 12.5, color: t.body, lineHeight: 1.5 }}>
                You can also write a review.
              </p>
            </div>

            <div style={{ height: 1, background: t.divider }} />

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '16px 20px' }}>
              {[0, 1, 2, 3, 4].map(i => (
                <svg key={i} width={34} height={34} viewBox="0 0 24 24" style={{ display: 'block' }}
                  fill={i <= rating ? t.starDone : t.starIdle} stroke="none">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              ))}
            </div>

            <div style={{ height: 1, background: t.divider }} />

            <button
              onClick={handleWriteReview}
              style={{
                display: 'block', width: '100%', padding: '13px 0', background: 'none',
                border: 'none', borderBottom: `1px solid ${t.divider}`, cursor: 'pointer',
                fontSize: 13, fontWeight: 600, color: t.starOn,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = t.btnHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              Write a Review
            </button>

            <button
              onClick={handleOK}
              style={{
                display: 'block', width: '100%', padding: '13px 0', background: 'none',
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: t.body,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = t.btnHover)}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              OK
            </button>
          </>
        )}

      </div>
    </div>
  )
}
