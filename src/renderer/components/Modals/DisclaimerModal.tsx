import { useEffect } from 'react'
import { useUIStore } from '../../store/uiStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'

export function DisclaimerModal() {
  const { isDisclaimerModalOpen, setDisclaimerModalOpen } = useUIStore()

  const handleOpenChange = (open: boolean) => {
    window.electronAPI?.setModalOpen(open)
    setDisclaimerModalOpen(open)
  }

  useEffect(() => {
    window.electronAPI?.setModalOpen(isDisclaimerModalOpen)
  }, [isDisclaimerModalOpen])

  return (
    <Dialog open={isDisclaimerModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disclaimer</DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong>Apps for X</strong> is an independent, third-party
            application and is{' '}
            <strong>not affiliated with, endorsed by, sponsored by, or connected to X Corp.</strong>{' '}
            X is a service owned and operated by X Corp. This app
            provides an enhanced desktop wrapper for{' '}
            <em>x.com</em>. Use is subject to X's Terms of Service and
            Privacy Policy.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All X trademarks, logos, and brand features are the property of
            X Corp. This app is an independent productivity tool and
            makes no claim of official status.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => setDisclaimerModalOpen(false)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
