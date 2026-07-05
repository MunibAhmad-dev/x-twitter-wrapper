import { create } from 'zustand'
import type { Account } from '../../shared/types'

interface AccountStore {
  accounts: Account[]
  activeAccountId: string | null
  unreadCounts: Record<string, number>
  setAccounts: (accounts: Account[]) => void
  setActiveAccount: (id: string | null) => void
  setUnreadCounts: (counts: Record<string, number>) => void
  addAccount: (account: Account) => void
  updateAccount: (id: string, updates: Partial<Pick<Account, 'label' | 'email'>>) => void
  removeAccount: (id: string) => void
}

export const useAccountStore = create<AccountStore>((set) => ({
  accounts: [],
  activeAccountId: null,
  unreadCounts: {},
  setAccounts: (accounts) => set({ accounts }),
  setActiveAccount: (id) => set({ activeAccountId: id }),
  setUnreadCounts: (counts) => set({ unreadCounts: counts }),
  addAccount: (account) => set((state) => ({
    accounts: [...state.accounts, account]
  })),
  updateAccount: (id, updates) => set((state) => ({
    accounts: state.accounts.map((a) => 
      a.id === id ? { ...a, ...updates } : a
    )
  })),
  removeAccount: (id) => set((state) => ({
    accounts: state.accounts.filter((a) => a.id !== id)
  })),
}))