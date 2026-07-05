export interface Account {
  id: string;
  label: string;
  email?: string;
  avatarUrl?: string;
  avatarText: string; // 1-2 initials
  avatarColor: string; // hex color
  partition: string; // 'persist:account-<uuid>'
  createdAt: number;
  lastUsed: number;
  unreadCount: number;
}

export interface User {
  id: string;
  username: string;
  passwordHash?: string;
  createdAt: number;
}

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  icon: string; // emoji or icon name
  color: string;
  isPremium: boolean;
  createdAt: number;
}

export interface WorkspaceAccount {
  id: string;
  workspaceId: string;
  label: string;
  email?: string;
  avatarUrl?: string;
  avatarText: string;
  avatarColor: string;
  partition: string;
  createdAt: number;
  lastUsed: number;
  unreadCount: number;
}

export interface AppSettings {
  activeAccountId: string | null;
  focusMode: boolean;
  autoLaunch: boolean;
  showNotifications: boolean;
  isPremium: boolean;
  premiumExpiresAt?: number;
  premiumProductId?: string;
  sidebarExpanded: boolean;
  openAiApiKey?: string;
  translateApiKey?: string;
  theme?: "light" | "dark";
  hasSeenOnboarding?: boolean;
}

export interface PurchaseResult {
  success: boolean;
  productId?: string;
  error?: string;
}

export interface ProductInfo {
  id: string;
  title: string;
  description: string;
  price: string; // e.g. "$2.99"
  currency: string;
}

export interface NotificationPayload {
  accountId: string;
  title: string;
  body: string;
  icon?: string;
}

export interface AppleUser {
  id: string;
  email?: string;
  name?: string;
  identityToken: string;
  authorizationCode: string;
}

// ── Premium feature types ─────────────────────────────────────────────────────

export type AiTone = 'professional' | 'friendly' | 'casual' | 'concise';

export interface AiReplyRequest {
  originalMessage: string;
  tone: AiTone;
  apiKey: string;
}

export interface AiReplyResult {
  suggestions: string[];
  tone: AiTone;
}

export interface TranslationRequest {
  text: string;
  targetLanguage: string;
  apiKey?: string;
}

export interface TranslationResult {
  translatedText: string;
  detectedLanguage?: string;
  targetLanguage: string;
}

export interface FocusSession {
  id: string;
  startedAt: number;
  durationMinutes: number;
  isActive: boolean;
}

export interface SmartFilter {
  id: 'unread' | 'business' | 'personal' | 'flagged';
  label: string;
  isActive: boolean;
}

export interface AccountAnalytics {
  accountId: string;
  label: string;
  avatarText: string;
  avatarColor: string;
  totalUnread: number;
  lastActive: number;
}

export type ActiveView =
  | 'dashboard'
  | 'messaging'
  | 'ai-reply'
  | 'translate'
  | 'analytics'
  | 'focus'
  | 'filters'
  | 'upgrade'
  | 'quick-reply'
  | 'notification-history'
  | 'themes'
  | 'shortcuts'
  | 'scheduler'
  | 'content'
  | 'thread-generator'
  | 'tweet-optimizer';

export interface SupportedLanguage {
  code: string;
  name: string;
  flag: string;
}
