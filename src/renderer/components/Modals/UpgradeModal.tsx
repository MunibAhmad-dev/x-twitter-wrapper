import { useEffect, useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useSettingsStore } from '../../store/settingsStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { IAP_PRODUCTS } from '../../../shared/constants'
import { ProductInfo } from '../../../shared/types'
import { toast } from 'sonner'
import { ShieldCheck, ExternalLink } from 'lucide-react'

export function UpgradeModal() {
  const { isUpgradeModalOpen, setUpgradeModalOpen } = useUIStore()
  const { isPremium, premiumExpiresAt } = useSettingsStore()
  const [products, setProducts] = useState<ProductInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleOpenChange = (open: boolean) => {
    window.electronAPI?.setModalOpen(open)
    setUpgradeModalOpen(open)
  }

  useEffect(() => {
    window.electronAPI?.setModalOpen(isUpgradeModalOpen)
    if (isUpgradeModalOpen) {
      loadProducts()
    }
  }, [isUpgradeModalOpen])

  const loadProducts = async () => {
    setIsLoading(true)
    try {
      const pids = [
        IAP_PRODUCTS.PREMIUM_MONTHLY,
        IAP_PRODUCTS.PREMIUM_YEARLY,
        IAP_PRODUCTS.PREMIUM_LIFETIME,
      ]
      const storeProducts = await window.electronAPI?.iap.getProducts(pids) || []
      setProducts(storeProducts)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePurchase = async (productId: string) => {
    setIsProcessing(true)
    const result = await window.electronAPI?.iap.purchase(productId)
    if (!result?.success) {
      toast.error(result?.error || 'Failed to initiate purchase.')
    } else {
      toast.info('Purchase processing... Please follow the App Store prompts.')
    }
    setIsProcessing(false)
  }

  const openAppStoreSubscriptions = () => {
    window.electronAPI?.openExternal("https://apps.apple.com/account/subscriptions")
  }

  const getProduct = (id: string) => products.find((p) => p.id === id)

  // Determine active plan based on expiry
  const isActiveLifetime = isPremium && !premiumExpiresAt;
  const isActiveSubscription = isPremium && premiumExpiresAt !== undefined;

  return (
    <Dialog open={isUpgradeModalOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-[#f0f2f5] p-0 overflow-hidden border-none shadow-2xl">
        <div className="p-8">
          <DialogHeader className="text-center mb-6">
            {isPremium && (
              <div className="mx-auto bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold w-max mb-4 flex items-center gap-1">
                <ShieldCheck size={14} /> ACTIVE PLAN
              </div>
            )}
            <DialogTitle className="text-3xl font-extrabold text-[#1c1e21]">
              Manage Subscription
            </DialogTitle>
            <DialogDescription className="text-md text-[#65676b]">
              {isActiveLifetime 
                ? "You have Life-time Access. Thank you for your support!" 
                : "You have an active subscription. View or upgrade your plan below."}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1877F2]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <PlanOption
                title="Monthly"
                price={getProduct(IAP_PRODUCTS.PREMIUM_MONTHLY)?.price || "$4.99"}
                period="/mo"
                onSelect={() => handlePurchase(IAP_PRODUCTS.PREMIUM_MONTHLY)}
                isProcessing={isProcessing}
                isActive={isActiveSubscription && !isActiveLifetime}
                disabled={isActiveLifetime}
              />
              <PlanOption
                title="Yearly"
                price={getProduct(IAP_PRODUCTS.PREMIUM_YEARLY)?.price || "$14.99"}
                period="/yr"
                trialText="3 Days Free Trial"
                recommended
                onSelect={() => handlePurchase(IAP_PRODUCTS.PREMIUM_YEARLY)}
                isProcessing={isProcessing}
                isActive={isActiveSubscription && !isActiveLifetime}
                disabled={isActiveLifetime}
              />
              <PlanOption
                title="Life-time"
                price={getProduct(IAP_PRODUCTS.PREMIUM_LIFETIME)?.price || "$19.99"}
                period=" Life-time"
                onSelect={() => handlePurchase(IAP_PRODUCTS.PREMIUM_LIFETIME)}
                isProcessing={isProcessing}
                isActive={isActiveLifetime}
                disabled={isActiveLifetime}
              />
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button 
              variant="outline" 
              className="text-[#1877F2] border-[#1877F2] hover:bg-[#e7f3ff]"
              onClick={openAppStoreSubscriptions}
            >
              <ExternalLink size={16} className="mr-2" />
              Manage or Cancel Subscription
            </Button>
            <p className="text-[11px] text-[#65676b] text-center font-medium">
              Note: Subscriptions are managed securely by Apple. Click above to open your App Store settings and cancel at any time.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PlanOption({
  title, price, period, recommended, trialText, onSelect, isProcessing, isActive, disabled
}: {
  title: string; price: string; period: string; recommended?: boolean; trialText?: string; onSelect: () => void; isProcessing: boolean; isActive: boolean; disabled: boolean;
}) {
  return (
    <div className={`relative flex flex-col rounded-xl p-4 bg-white border shadow-sm ${recommended ? 'border-[#1877F2] ring-1 ring-[#1877F2]' : 'border-gray-200'}`}>
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#1877F2] text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm whitespace-nowrap">
          Best Value
        </div>
      )}
      <h3 className="font-bold text-[#1c1e21] mb-1">{title}</h3>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-xl font-extrabold text-[#1c1e21]">{price}</span>
        <span className="text-xs text-[#65676b] font-medium">{period}</span>
      </div>
      {trialText && (
        <div className="mb-3 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-green-700 border border-green-200">
          {trialText}
        </div>
      )}
      
      <Button
        size="sm"
        onClick={onSelect}
        disabled={isProcessing || isActive || disabled}
        variant={isActive ? "secondary" : recommended ? "default" : "outline"}
        className={`w-full ${recommended && !isActive && !disabled ? 'bg-[#1877F2] hover:bg-[#166fe5] text-white' : ''}`}
      >
        {isActive ? "Current Plan" : "Upgrade"}
      </Button>
    </div>
  )
}
