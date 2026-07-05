import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { APP_STORE_REVIEW_URL } from '../../../shared/constants'

const MAYBE_LATER_KEY = 'feedback_maybe_later_at'
const MAYBE_LATER_DELAY_MS = 3 * 24 * 60 * 60 * 1000 // 3 days

interface FeedbackModalProps {
  open: boolean
  onClose: () => void
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const handleLoveIt = () => {
    window.electronAPI?.openExternal(APP_STORE_REVIEW_URL)
    onClose()
  }

  const handleDontLikeIt = () => {
    onClose()
  }

  const handleMaybeLater = () => {
    localStorage.setItem(MAYBE_LATER_KEY, String(Date.now()))
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="p-0 border-none shadow-2xl overflow-hidden"
        style={{
          background: '#18191f',
          borderRadius: '24px',
          maxWidth: '480px',
          width: '100%',
        }}
      >
        <DialogTitle className="sr-only">Rate your experience</DialogTitle>
        <div className="flex flex-col items-center px-8 pt-10 pb-8 gap-0">
          {/* Icon circle */}
          <div
            className="flex items-center justify-center mb-6"
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: '#25263a',
            }}
          >
            <span style={{ fontSize: 52 }}>🎉</span>
          </div>

          {/* Headline */}
          <h2
            className="font-bold text-center"
            style={{ fontSize: 26, color: '#ffffff', marginBottom: 8 }}
          >
            Thank you!
          </h2>
          <p
            className="text-center"
            style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: 20 }}
          >
            Your subscription is now active.
          </p>

          <p
            className="text-center"
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.7)',
              marginBottom: 28,
              lineHeight: 1.5,
            }}
          >
            We'd love to hear your feedback.
            <br />
            How do you feel about our app?
          </p>

          {/* Option cards */}
          <div className="grid grid-cols-3 gap-3 w-full mb-7">
            <OptionCard
              emoji="❤️"
              emojiStyle={{ fontSize: 36 }}
              label="I love it"
              sub="Leave a review"
              onClick={handleLoveIt}
            />
            <OptionCard
              emoji="💔"
              emojiStyle={{ fontSize: 36 }}
              label="I don't like it"
              sub="Let us know"
              onClick={handleDontLikeIt}
            />
            <OptionCard
              emoji="🕐"
              emojiStyle={{ fontSize: 34, filter: 'hue-rotate(200deg) saturate(1.5)' }}
              label="Maybe later"
              sub="Remind me later"
              onClick={handleMaybeLater}
            />
          </div>

          {/* Footer note */}
          <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            It only takes a few seconds. Thanks!
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function OptionCard({
  emoji,
  emojiStyle,
  label,
  sub,
  onClick,
}: {
  emoji: string
  emojiStyle?: React.CSSProperties
  label: string
  sub: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-2xl transition-all duration-150 hover:scale-[1.04] active:scale-[0.97]"
      style={{
        background: '#25263a',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '18px 10px 16px',
        cursor: 'pointer',
      }}
    >
      <span style={{ lineHeight: 1, ...emojiStyle }}>{emoji}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', textAlign: 'center', lineHeight: 1.3 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 1.3 }}>
        {sub}
      </span>
    </button>
  )
}

/**
 * Returns true if the feedback modal should be shown.
 *
 * Currently DISABLED: after a successful subscription we take the user straight
 * to the app (dashboard) instead of interrupting them with the feedback prompt.
 * Flip `FEEDBACK_ENABLED` to true to restore the post-subscribe review prompt.
 */
const FEEDBACK_ENABLED = false

export function shouldShowFeedback(): boolean {
  if (!FEEDBACK_ENABLED) return false
  const raw = localStorage.getItem(MAYBE_LATER_KEY)
  if (!raw) return true
  const dismissedAt = Number(raw)
  return Date.now() - dismissedAt >= MAYBE_LATER_DELAY_MS
}
