import { create } from 'zustand'

const STORAGE_KEY = 'igw_notification_history'
const MAX_ENTRIES = 100

export interface NotificationEntry {
  id: string
  accountId: string
  accountLabel: string
  accountColor: string
  accountInitials: string
  accountAvatarUrl?: string
  title: string
  body: string
  receivedAt: number
  read: boolean
}

interface NotificationStore {
  entries: NotificationEntry[]
  addEntry: (entry: NotificationEntry) => void
  markRead: (accountId: string) => void
  markAllRead: () => void
  clearAll: () => void
}

function loadHistory(): NotificationEntry[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

function persist(entries: NotificationEntry[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES))) } catch { /* ignore */ }
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  entries: loadHistory(),

  addEntry: (entry) => set((state) => {
    const next = [entry, ...state.entries].slice(0, MAX_ENTRIES)
    persist(next)
    return { entries: next }
  }),

  markRead: (accountId) => set((state) => {
    const next = state.entries.map(e => e.accountId === accountId ? { ...e, read: true } : e)
    persist(next)
    return { entries: next }
  }),

  markAllRead: () => set((state) => {
    const next = state.entries.map(e => ({ ...e, read: true }))
    persist(next)
    return { entries: next }
  }),

  clearAll: () => {
    persist([])
    return set({ entries: [] })
  },
}))
