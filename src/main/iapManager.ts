import { inAppPurchase, BrowserWindow, net, app } from 'electron';
import * as fs from 'fs';
import { Store } from './store';
import { IAP_PRODUCTS } from '../shared/constants';
import { PurchaseResult, ProductInfo } from '../shared/types';

const isMac = process.platform === 'darwin';

// Your app's shared secret from App Store Connect → Apps → [Your App] → In-App Purchases → App-Specific Shared Secret
// Required for validating auto-renewable subscription receipts.
// IMPORTANT: Replace this placeholder before submitting to App Store.
const IAP_SHARED_SECRET = process.env['IAP_SHARED_SECRET'] || '';

export class IAPManager {
  private store: Store;
  private devMode = false;

  constructor(store: Store) {
    this.store = store;
  }

  isDevMode(): boolean {
    return this.devMode;
  }

  setDevMode(enabled: boolean): void {
    this.devMode = enabled;
    console.log(`[IAP] Dev mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  private shouldUseDevMode(): boolean {
    return !isMac || this.devMode;
  }

  initialize(): void {
    if (!isMac || this.devMode) return; // IAP only on macOS MAS (non-dev mode)

    // IMPORTANT: Register the transaction listener UNCONDITIONALLY before
    // checking canMakePayments(). Apple requires the observer be added at
    // launch so any unfinished transactions from a previous session are
    // processed immediately. Gating this behind canMakePayments() leaves
    // orphaned transactions in the queue permanently.
    inAppPurchase.on('transactions-updated', (_event: Electron.Event, transactions: Electron.Transaction[]) => {
      for (const tx of transactions) {
        this.handleTransaction(tx);
      }
    });

    if (!inAppPurchase.canMakePayments()) {
      console.log('[IAP] Payments not allowed on this device. Listener registered but purchases are disabled.');
    }
  }

  private handleTransaction(tx: Electron.Transaction): void {
    console.log(`[IAP] Transaction updated: ${tx.payment.productIdentifier} - State: ${tx.transactionState}`);
    switch (tx.transactionState) {
      case 'purchased':
      case 'restored': {
        console.log(`[IAP] Transaction successful: ${tx.transactionIdentifier}`);

        // 1. Unlock and notify the renderer IMMEDIATELY — do not block on network.
        //    Apple requires finishTransaction to be called promptly.
        this.unlockPremium(tx.payment.productIdentifier);
        this.notifyRenderer('premium-unlocked', tx.payment.productIdentifier);

        // 2. Finish the transaction right away so StoreKit can clear it.
        try {
          inAppPurchase.finishTransactionByDate(tx.transactionDate);
        } catch (e) {
          console.error('[IAP] Error finishing transaction:', e);
        }

        // 3. Validate receipt asynchronously in the background for logging only.
        //    Never block unlock on network — the user is already past the paywall.
        this.validateReceipt().then((valid) => {
          if (!valid) {
            console.warn('[IAP] Background receipt validation did not pass. Purchase was unlocked from StoreKit state.');
          } else {
            console.log('[IAP] Background receipt validation passed.');
          }
        }).catch((e) => {
          console.warn('[IAP] Background receipt validation error:', e);
        });
        break;
      }
      case 'failed': {
        console.error(`[IAP] Transaction failed: ${tx.transactionIdentifier}`);
        this.notifyRenderer('purchase-failed', 'Transaction failed in App Store.');
        try {
          inAppPurchase.finishTransactionByDate(tx.transactionDate);
        } catch (e) {
          console.error('[IAP] Error finishing failed transaction:', e);
        }
        break;
      }
      case 'purchasing': {
        // Transaction is being processed by the App Store — normal intermediate state.
        // The UI is already showing "Processing..." from the purchase initiation.
        console.log(`[IAP] Transaction in purchasing state: ${tx.payment.productIdentifier}`);
        break;
      }
      case 'deferred': {
        // Transaction requires approval from a parent/guardian (Ask to Buy).
        console.log(`[IAP] Transaction deferred (Ask to Buy): ${tx.payment.productIdentifier}`);
        this.notifyRenderer('purchase-deferred', tx.payment.productIdentifier);
        break;
      }
      default:
        console.log(`[IAP] Unknown transaction state: ${tx.transactionState}`);
        break;
    }
  }

  private async validateReceipt(): Promise<boolean> {
    const receiptPath = inAppPurchase.getReceiptURL();
    if (!receiptPath || !fs.existsSync(receiptPath)) {
      console.warn('[IAP] No local Apple receipt found to validate.');
      return false;
    }

    try {
      const receiptData = fs.readFileSync(receiptPath).toString('base64');
      const payloadObj: Record<string, string> = { 'receipt-data': receiptData };
      if (IAP_SHARED_SECRET) {
        payloadObj['password'] = IAP_SHARED_SECRET;
      }
      const payload = JSON.stringify(payloadObj);

      const fetchOpts: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      };

      console.log('[IAP] Verifying receipt with Production server...');
      let res = await fetch('https://buy.itunes.apple.com/verifyReceipt', fetchOpts);
      let json = await res.json();

      // If status 21007, it's a Sandbox receipt
      if (json.status === 21007) {
        console.log('[IAP] Sandbox receipt detected, verifying with Sandbox server...');
        res = await fetch('https://sandbox.itunes.apple.com/verifyReceipt', fetchOpts);
        json = await res.json();
      }

      if (json.status === 0) {
        console.log('[IAP] Apple validation successful!');
        return true;
      } else {
        console.error('[IAP] Apple validation failed with status:', json.status);
        return false;
      }
    } catch (err) {
      console.error('[IAP] Offline or network error during Apple validation:', err);
      // Return false so the fallback logic handles offline state securely
      return false;
    }
  }

  async purchaseProduct(productId: string): Promise<PurchaseResult> {
    if (this.shouldUseDevMode()) {
      // Dev mode: simulate purchase
      this.unlockPremium(productId);
      this.notifyRenderer('premium-unlocked', productId);
      return { success: true, productId };
    }

    console.log(`[IAP] Initiating purchase for ${productId}`);

    if (!net.isOnline()) {
      console.warn('[IAP] Device appears offline before purchase attempt.');
      return { success: false, error: 'No internet connection. Please check your network and try again.' };
    }

    if (!inAppPurchase.canMakePayments()) {
      console.warn('[IAP] canMakePayments() returned false at purchase time.');
      return { success: false, error: 'Purchases are not allowed on this device.' };
    }

    try {
      // Do NOT call getProducts() again here — the Paywall already fetched them
      // at mount time. Calling getProducts() inside purchaseProduct() doubles the
      // StoreKit round-trips and can return an empty array under load, falsely
      // reporting "product not found" to the user.
      const queued = await inAppPurchase.purchaseProduct(productId, 1);
      console.log(`[IAP] Purchase queued: ${queued}`);
      if (!queued) {
        return { success: false, error: 'Could not queue purchase. Please try again.' };
      }
      return { success: true, productId };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[IAP] Purchase exception:', msg);
      return { success: false, error: msg };
    }
  }

  async getProducts(productIds: string[]): Promise<ProductInfo[]> {
    if (this.shouldUseDevMode()) {
      // Dev mode mock products
      return [
        { id: IAP_PRODUCTS.PREMIUM_MONTHLY, title: 'Monthly Plan', description: 'Monthly access to all features.', price: '$4.99', currency: 'USD' },
        { id: IAP_PRODUCTS.PREMIUM_YEARLY, title: 'Yearly Plan', description: 'Yearly access to all features.', price: '$14.99', currency: 'USD' },
        { id: IAP_PRODUCTS.PREMIUM_LIFETIME, title: 'Life-time Access', description: 'Life-time access to all features.', price: '$19.99', currency: 'USD' }
      ];
    }
    try {
      const products = await inAppPurchase.getProducts(productIds);
      return products.map(p => ({
        id: p.productIdentifier,
        title: p.localizedTitle,
        description: p.localizedDescription,
        price: new Intl.NumberFormat(undefined, { 
          style: 'currency', 
          currency: p.currencyCode 
        }).format(p.price),
        currency: p.currencyCode
      }));
    } catch (err) {
      console.error('[IAP] Failed to get products:', err);
      return [];
    }
  }

  checkSubscriptionStatus(): boolean {
    // Fast synchronous local check only.
    // Do NOT call restoreCompletedTransactions() here — doing so on every launch
    // can trigger an Apple ID authentication sheet before the user interacts with
    // the app, and the restore result arrives asynchronously anyway so it cannot
    // meaningfully inform this synchronous check. Explicit restores are triggered
    // only when the user taps "Restore Purchases".
    return this.isPremium();
  }

  async restorePurchases(): Promise<void> {
    if (this.shouldUseDevMode()) return;
    // StoreKit restore — transactions-updated fires for any restored tx
    await inAppPurchase.restoreCompletedTransactions();
  }

  private unlockPremium(productId: string): void {
    const settings = this.store.get<Record<string, unknown>>('settings', {});
    let expiry: number | undefined;

    if (productId === IAP_PRODUCTS.PREMIUM_YEARLY) {
      expiry = Date.now() + 365 * 24 * 60 * 60 * 1000;
    } else if (productId === IAP_PRODUCTS.PREMIUM_MONTHLY) {
      expiry = Date.now() + 31 * 24 * 60 * 60 * 1000;
    } else {
      // Lifetime - no expiry
      expiry = undefined;
    }

    this.store.set('settings', {
      ...settings,
      isPremium: true,
      premiumExpiresAt: expiry,
      premiumProductId: productId,
    });
  }

  isPremium(): boolean {
    // Automatically bypass paywall in development mode (running via npm run dev)
    if (!app.isPackaged) {
      return true;
    }
    const s = this.store.get<{ isPremium?: boolean; premiumExpiresAt?: number }>('settings', {});
    if (!s.isPremium) return false;
    if (s.premiumExpiresAt && Date.now() > s.premiumExpiresAt) {
      console.log('[IAP] Subscription has expired.');
      return false;
    }
    return true;
  }

  resetSubscription(): void {
    console.warn('[IAP] Resetting subscription state for development/testing!');
    const settings = this.store.get<Record<string, unknown>>('settings', {});
    this.store.set('settings', {
      ...settings,
      isPremium: false,
      premiumExpiresAt: undefined,
      premiumProductId: undefined,
    });
  }

  private notifyRenderer(channel: string, data: unknown): void {
    BrowserWindow.getAllWindows().forEach((w) => {
      w.webContents.send(`iap:${channel}`, data);
    });
  }
}
