import { useUIStore } from '../../store/uiStore'
import { APP_STORE_REVIEW_URL } from '../../../shared/constants'
import { Dialog, DialogContent } from '../ui/dialog'
import { Button } from '../ui/button'
import { Star } from 'lucide-react'

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

  return (
    <Dialog open={isReviewModalOpen} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-sm text-center select-none" onPointerDownOutside={dismiss}>
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex gap-1 text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-7 w-7 fill-yellow-400" />
            ))}
          </div>

          <div>
            <h2 className="text-lg font-semibold">Enjoying Apps for X?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your review helps others discover the app and keeps it improving. Takes just a few seconds!
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full">
            <Button className="w-full" onClick={openReview}>
              Rate on the App Store
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground text-sm" onClick={dismiss}>
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
