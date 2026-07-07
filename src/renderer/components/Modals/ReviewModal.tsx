import { useUIStore } from '../../store/uiStore'
import { APP_STORE_REVIEW_URL } from '../../../shared/constants'
import { Dialog, DialogContent } from '../ui/dialog'

export function ReviewModal() {
  const { isReviewModalOpen, setReviewModalOpen } = useUIStore()

  function dismiss() {
    setReviewModalOpen(false)
  }

  function openReview() {
    window.electronAPI?.openExternal(APP_STORE_REVIEW_URL)
    localStorage.setItem('reviewRated', '1')
    dismiss()
  }

  function dislike() {
    localStorage.setItem('reviewRated', '1')
    dismiss()
  }

  return (
    <Dialog open={isReviewModalOpen} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent
        className="max-w-sm select-none border-0 p-0 overflow-hidden"
        style={{ background: '#1c1c1e', borderRadius: 20 }}
        onPointerDownOutside={dismiss}
      >
        <div className="flex flex-col items-center gap-5 px-6 pt-8 pb-6">

          {/* Icon */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#2c2c2e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 40,
          }}>
            🎉
          </div>

          {/* Text */}
          <div className="text-center">
            <h2 style={{ color: '#ffffff', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
              Thank you!
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14, marginBottom: 12 }}>
              Your subscription is now active.
            </p>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, lineHeight: 1.5 }}>
              We'd love to hear your feedback.<br />How do you feel about our app?
            </p>
          </div>

          {/* Three cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, width: '100%' }}>
            {/* I love it */}
            <button
              onClick={openReview}
              style={{
                background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '16px 8px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#3a3a3c')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2c2c2e')}
            >
              <span style={{ fontSize: 32 }}>❤️</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>I love it</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Leave a review</div>
              </div>
            </button>

            {/* I don't like it */}
            <button
              onClick={dislike}
              style={{
                background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '16px 8px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#3a3a3c')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2c2c2e')}
            >
              <span style={{ fontSize: 32 }}>💔</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>I don't like it</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Let us know</div>
              </div>
            </button>

            {/* Maybe later */}
            <button
              onClick={dismiss}
              style={{
                background: '#2c2c2e', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, padding: '16px 8px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#3a3a3c')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2c2c2e')}
            >
              <span style={{ fontSize: 32 }}>🕐</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>Maybe later</div>
                <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 }}>Remind me later</div>
              </div>
            </button>
          </div>

          {/* Footer */}
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            🔒 It only takes a few seconds. Thanks!
          </p>

        </div>
      </DialogContent>
    </Dialog>
  )
}
