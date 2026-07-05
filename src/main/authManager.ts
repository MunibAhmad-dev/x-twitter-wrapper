import { v4 as uuidv4 } from 'uuid';
import { Store } from './store';
import type { AppSettings, User, Workspace, WorkspaceAccount, AppleUser } from '../shared/types';

export class AuthManager {
  private store: Store;
  private currentUserId: string | null = null;
  private readonly autoUserId = 'local-premium-user';

  constructor(store: Store) {
    this.store = store;
    this.refreshCurrentUserId();
  }

  refreshCurrentUserId(): void {
    // First try the explicit currentUserId key
    let id = this.store.get<string>('currentUserId') || null;

    // Fall back to the Apple user's ID if stored (covers the case where
    // Apple Sign-In saved the user but currentUserId was lost/not persisted)
    if (!id) {
      const appleUser = this.store.get<AppleUser | null>('appleUser', null);
      if (appleUser?.id) {
        id = appleUser.id;
        // Persist it so future calls are consistent
        this.store.set('currentUserId', id);
        console.log('[AuthManager] refreshCurrentUserId: restored from appleUser.id =', id);
      }
    }

    this.currentUserId = id;
  }

  // User authentication
  signup(username: string, password: string): { success: boolean; user?: User; error?: string } {
    const users = this.store.get<User[]>('users') || [];
    
    if (users.find(u => u.username === username)) {
      return { success: false, error: 'Username already exists' };
    }

    const newUser: User = {
      id: uuidv4(),
      username,
      passwordHash: this.hashPassword(password),
      createdAt: Date.now(),
    };

    users.push(newUser);
    this.store.set('users', users);
    this.currentUserId = newUser.id;
    this.store.set('currentUserId', newUser.id);

    return { success: true, user: newUser };
  }

  login(username: string, password: string): { success: boolean; user?: User; error?: string } {
    const users = this.store.get<User[]>('users') || [];
    const user = users.find(u => u.username === username);

    if (!user || user.passwordHash !== this.hashPassword(password)) {
      return { success: false, error: 'Invalid username or password' };
    }

    this.currentUserId = user.id;
    this.store.set('currentUserId', user.id);

    return { success: true, user };
  }

  ensureAutoLogin(): User {
    this.refreshCurrentUserId();

    const users = this.store.get<User[]>('users') || [];
    const userId = this.currentUserId || this.autoUserId;
    let user = users.find(u => u.id === userId);

    if (!user) {
      user = {
        id: userId,
        username: 'App User',
        createdAt: Date.now(),
      };
      users.push(user);
      this.store.set('users', users);
    }

    this.currentUserId = user.id;
    this.store.set('currentUserId', user.id);

    return user;
  }

  logout(): void {
    this.currentUserId = null;
    this.store.delete('currentUserId');
  }

  getCurrentUser(): User | null {
    if (!this.currentUserId) return null;
    const users = this.store.get<User[]>('users') || [];
    return users.find(u => u.id === this.currentUserId) || null;
  }

  isLoggedIn(): boolean {
    return this.currentUserId !== null;
  }

  // Workspace management
  createWorkspace(name: string, icon: string = '📁', color: string = '#5C6BC0'): Workspace | null {
    // Always refresh before creating to pick up any sign-in that happened after constructor
    this.refreshCurrentUserId();
    console.log('[AuthManager] createWorkspace called', { name, currentUserId: this.currentUserId });
    if (!this.currentUserId) {
      console.log('[AuthManager] createWorkspace failed: no currentUserId');
      return null;
    }

    const workspaces = this.store.get<Workspace[]>('workspaces') || [];
    const newWorkspace: Workspace = {
      id: uuidv4(),
      userId: this.currentUserId,
      name,
      icon,
      color,
      isPremium: false,
      createdAt: Date.now(),
    };

    workspaces.push(newWorkspace);
    this.store.set('workspaces', workspaces);

    return newWorkspace;
  }

  listWorkspaces(): Workspace[] {
    this.refreshCurrentUserId();
    if (!this.currentUserId) return [];
    const workspaces = this.store.get<Workspace[]>('workspaces') || [];
    return workspaces.filter(w => w.userId === this.currentUserId);
  }

  getWorkspace(id: string): Workspace | null {
    const workspaces = this.store.get<Workspace[]>('workspaces') || [];
    return workspaces.find(w => w.id === id) || null;
  }

  updateWorkspace(id: string, updates: Partial<Pick<Workspace, 'name' | 'icon' | 'color'>>): Workspace | null {
    const workspaces = this.store.get<Workspace[]>('workspaces') || [];
    const index = workspaces.findIndex(w => w.id === id && w.userId === this.currentUserId);
    
    if (index === -1) return null;

    workspaces[index] = { ...workspaces[index], ...updates };
    this.store.set('workspaces', workspaces);

    return workspaces[index];
  }

  deleteWorkspace(id: string): boolean {
    const workspaces = this.store.get<Workspace[]>('workspaces') || [];
    const filtered = workspaces.filter(w => !(w.id === id && w.userId === this.currentUserId));
    
    if (filtered.length === workspaces.length) return false;

    this.store.set('workspaces', filtered);

    // Also delete all workspace accounts
    const accounts = this.store.get<WorkspaceAccount[]>('workspaceAccounts') || [];
    const filteredAccounts = accounts.filter(a => a.workspaceId !== id);
    this.store.set('workspaceAccounts', filteredAccounts);

    return true;
  }

  // Workspace accounts (TikTok accounts)
  addWorkspaceAccount(workspaceId: string, label: string, email?: string): WorkspaceAccount | { error: string } {
    this.refreshCurrentUserId();
    if (!this.currentUserId) return { error: 'Not logged in' };

    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) return { error: 'Workspace not found' };

    // Check limit for free tier (1 account)
    const accounts = this.listWorkspaceAccounts(workspaceId);
    const settings = this.store.get<AppSettings>('settings');
    const hasGlobalPremium = settings?.isPremium === true;
    if (!hasGlobalPremium && !workspace.isPremium && accounts.length >= 1) {
      return { error: 'Free tier limited to 1 account. Upgrade to Premium for more.' };
    }

    const colors = ['#1D9BF0', '#0a66c2', '#000000', '#4AB3F4', '#4A90D9', '#1D9BF0', '#5851DB', '#26A69A'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const newAccount: WorkspaceAccount = {
      id: uuidv4(),
      workspaceId,
      label,
      email,
      avatarText: label.substring(0, 2).toUpperCase(),
      avatarColor: randomColor,
      partition: `persist:workspace-account-${uuidv4()}`,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      unreadCount: 0,
    };

    const allAccounts = this.store.get<WorkspaceAccount[]>('workspaceAccounts') || [];
    allAccounts.push(newAccount);
    this.store.set('workspaceAccounts', allAccounts);

    return newAccount;
  }

  updateWorkspaceAccountProfile(
    accountId: string,
    updates: Partial<Pick<WorkspaceAccount, 'label' | 'email' | 'avatarUrl' | 'avatarText'>>
  ): WorkspaceAccount | null {
    const accounts = this.store.get<WorkspaceAccount[]>('workspaceAccounts') || [];
    const index = accounts.findIndex(a => a.id === accountId);

    if (index === -1) return null;

    accounts[index] = {
      ...accounts[index],
      ...updates,
    };
    this.store.set('workspaceAccounts', accounts);

    return accounts[index];
  }

  listWorkspaceAccounts(workspaceId: string): WorkspaceAccount[] {
    const accounts = this.store.get<WorkspaceAccount[]>('workspaceAccounts') || [];
    return accounts.filter(a => a.workspaceId === workspaceId);
  }

  getWorkspaceAccount(id: string): WorkspaceAccount | null {
    const accounts = this.store.get<WorkspaceAccount[]>('workspaceAccounts') || [];
    return accounts.find(a => a.id === id) || null;
  }

  removeWorkspaceAccount(id: string): boolean {
    const accounts = this.store.get<WorkspaceAccount[]>('workspaceAccounts') || [];
    const filtered = accounts.filter(a => a.id !== id);
    
    if (filtered.length === accounts.length) return false;

    this.store.set('workspaceAccounts', filtered);
    return true;
  }

  setWorkspacePremium(workspaceId: string, isPremium: boolean): boolean {
    const workspaces = this.store.get<Workspace[]>('workspaces') || [];
    const index = workspaces.findIndex(w => w.id === workspaceId && w.userId === this.currentUserId);
    
    if (index === -1) return false;

    workspaces[index].isPremium = isPremium;
    this.store.set('workspaces', workspaces);

    return true;
  }

  private hashPassword(password: string): string {
    // Simple hash for demo - in production use bcrypt or similar
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(16);
  }
}
