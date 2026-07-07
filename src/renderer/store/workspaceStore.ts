import { create } from 'zustand'
import type { Workspace, WorkspaceAccount } from '../../shared/types'

const PLACEHOLDER_ACCOUNT_NAMES = new Set(['x account', 'x profile', 'tiktok account', 'tiktok profile', 'instagram account', 'instagram profile', 'facebook account', 'app user'])

export const getWorkspaceAccountIdentityKey = (account: WorkspaceAccount) => {
  const label = account.label.trim().toLowerCase()
  if (account.avatarUrl && label && !PLACEHOLDER_ACCOUNT_NAMES.has(label)) {
    return `x:${label}`
  }
  return `local:${account.id}`
}

export const getUniqueWorkspaceAccounts = (accounts: WorkspaceAccount[]) => {
  const seen = new Set<string>()
  return accounts.filter((account) => {
    const key = getWorkspaceAccountIdentityKey(account)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

interface WorkspaceStore {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  workspaceAccounts: WorkspaceAccount[]
  activeWorkspaceAccountId: string | null
  setWorkspaces: (workspaces: Workspace[]) => void
  setActiveWorkspace: (workspace: Workspace | null) => void
  setWorkspaceAccounts: (accounts: WorkspaceAccount[]) => void
  setActiveWorkspaceAccountId: (id: string | null) => void
  addWorkspace: (workspace: Workspace) => void
  removeWorkspace: (id: string) => void
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void
  addWorkspaceAccount: (account: WorkspaceAccount) => void
  updateWorkspaceAccount: (id: string, updates: Partial<WorkspaceAccount>) => void
  removeWorkspaceAccount: (id: string) => void
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  workspaces: [],
  activeWorkspace: null,
  workspaceAccounts: [],
  activeWorkspaceAccountId: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
  setWorkspaceAccounts: (accounts) => set({ workspaceAccounts: accounts }),
  setActiveWorkspaceAccountId: (id) => set({ activeWorkspaceAccountId: id }),
  addWorkspace: (workspace) => set((state) => ({
    workspaces: [...state.workspaces, workspace]
  })),
  removeWorkspace: (id) => set((state) => ({
    workspaces: state.workspaces.filter((w) => w.id !== id)
  })),
  updateWorkspace: (id, updates) => set((state) => ({
    workspaces: state.workspaces.map((w) => w.id === id ? { ...w, ...updates } : w),
    activeWorkspace: state.activeWorkspace?.id === id ? { ...state.activeWorkspace, ...updates } : state.activeWorkspace
  })),
  addWorkspaceAccount: (account) => set((state) => ({
    workspaceAccounts: [...state.workspaceAccounts, account]
  })),
  updateWorkspaceAccount: (id, updates) => set((state) => ({
    workspaceAccounts: state.workspaceAccounts.map((a) => a.id === id ? { ...a, ...updates } : a)
  })),
  removeWorkspaceAccount: (id) => set((state) => {
    const workspaceAccounts = state.workspaceAccounts.filter((a) => a.id !== id)
    return {
      workspaceAccounts,
      activeWorkspaceAccountId: state.activeWorkspaceAccountId === id ? workspaceAccounts[0]?.id ?? null : state.activeWorkspaceAccountId
    }
  }),
}))
