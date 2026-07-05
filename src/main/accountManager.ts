import { v4 as uuidv4 } from 'uuid';
import { app } from 'electron';
import { Account, AppSettings } from '../shared/types';
import {
  AVATAR_COLORS,
  FREE_TIER_MAX_ACCOUNTS,
} from '../shared/constants';
import { Store } from './store';
import { IAPManager } from './iapManager';

export class AccountManager {
  private store: Store;
  private iapManager: IAPManager;

  constructor(store: Store, iapManager: IAPManager) {
    this.store = store;
    this.iapManager = iapManager;
  }

  getSettings(): AppSettings {
    const settings = this.store.get<AppSettings>('settings', {
      activeAccountId: null,
      focusMode: false,
      autoLaunch: false,
      showNotifications: true,
      isPremium: false,
      sidebarExpanded: false,
      theme: 'dark',
    });
    
    // Automatically bypass paywall in development mode (running via npm run dev)
    if (!app.isPackaged) {
      settings.isPremium = true;
    }
    
    return settings;
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...patch };
    this.store.set('settings', updated);
    return updated;
  }

  listAccounts(): Account[] {
    const accounts = this.store.get<Account[]>('accounts', []);
    
    // Offline fallback & Expired Subscription Handling:
    // If the user is no longer premium, only return the free tier limit.
    // The other accounts are safely kept in storage but hidden until they resubscribe.
    if (!this.iapManager.isPremium() && accounts.length > FREE_TIER_MAX_ACCOUNTS) {
      return accounts.slice(0, FREE_TIER_MAX_ACCOUNTS);
    }
    return accounts;
  }

  getAccount(id: string): Account | undefined {
    return this.listAccounts().find((a) => a.id === id);
  }

  getActiveAccount(): Account | undefined {
    const { activeAccountId } = this.getSettings();
    if (!activeAccountId) return undefined;
    return this.getAccount(activeAccountId);
  }

  canAddAccount(): { allowed: boolean; reason?: string } {
    const accounts = this.listAccounts();
    if (!this.iapManager.isPremium() && accounts.length >= FREE_TIER_MAX_ACCOUNTS) {
      return {
        allowed: false,
        reason: `Free tier is limited to ${FREE_TIER_MAX_ACCOUNTS} account. Upgrade to Premium for unlimited accounts.`,
      };
    }
    return { allowed: true };
  }

  addAccount(label: string, email?: string): Account | { error: string } {
    const { allowed, reason } = this.canAddAccount();
    if (!allowed) return { error: reason! };

    const accounts = this.listAccounts();
    const colorIndex = accounts.length % AVATAR_COLORS.length;
    const initials = label
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');

    const id = uuidv4();
    const account: Account = {
      id,
      label,
      email,
      avatarText: initials || label[0]?.toUpperCase() || '?',
      avatarColor: AVATAR_COLORS[colorIndex],
      partition: `persist:account-${id}`,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      unreadCount: 0,
    };

    accounts.push(account);
    this.store.set('accounts', accounts);

    // Auto-switch to first account
    if (accounts.length === 1) {
      this.updateSettings({ activeAccountId: id });
    }

    return account;
  }

  removeAccount(id: string): void {
    let accounts = this.listAccounts();
    accounts = accounts.filter((a) => a.id !== id);
    this.store.set('accounts', accounts);

    const { activeAccountId } = this.getSettings();
    if (activeAccountId === id) {
      this.updateSettings({ activeAccountId: accounts[0]?.id ?? null });
    }
  }

  switchAccount(id: string): Account | undefined {
    const account = this.getAccount(id);
    if (!account) return undefined;

    // Update lastUsed
    const accounts = this.listAccounts().map((a) =>
      a.id === id ? { ...a, lastUsed: Date.now() } : a
    );
    this.store.set('accounts', accounts);
    this.updateSettings({ activeAccountId: id });
    return account;
  }

  updateUnreadCount(accountId: string, count: number): void {
    const accounts = this.listAccounts().map((a) =>
      a.id === accountId ? { ...a, unreadCount: count } : a
    );
    this.store.set('accounts', accounts);
  }

  totalUnread(): number {
    return this.listAccounts().reduce((sum, a) => sum + (a.unreadCount || 0), 0);
  }
}
