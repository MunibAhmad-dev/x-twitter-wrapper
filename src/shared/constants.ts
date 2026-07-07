export const APP_NAME = "Apps for X";
// Flip to true once IAP products are approved in App Store Connect.
export const IAP_ENABLED = false;
// Numeric App Store ID — fill this in after your app is published (e.g. "id6741234567")
export const APP_STORE_REVIEW_URL = "https://apps.apple.com/app/id_PLACEHOLDER?action=write-review";
export const APP_VERSION = "1.2.0";
export const MESSENGER_URL = "https://x.com";
export const MESSENGER_CHAT_URL = "https://x.com/messages";
export const FACEBOOK_LANGUAGE_URL = "https://x.com/settings/language";
export const FACEBOOK_NOTIFICATIONS_URL = "https://x.com/messages";
export const BUNDLE_ID = "com.mihai.appsforx";

// ── Legal / support links (shown in the About tab and Help menu) ───────────────
// IMPORTANT: Replace PRIVACY_POLICY_URL with YOUR OWN hosted URL before submitting.
// The root index.html in this repo is ready to upload to GitHub Pages.
// Example: "https://munibahmad-dev.github.io/x-Twitter-wrapper-privacy-page/"
export const PRIVACY_POLICY_URL = "https://munibahmad-dev.github.io/x-Twitter-wrapper-privacy-page/";
// Apple's standard EULA is the accepted Terms of Service for MAS apps using StoreKit subscriptions.
// Apple's standard EULA covers MAS apps — do not point to a third-party ToS URL.
export const TERMS_OF_SERVICE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
export const SUPPORT_URL = "mailto:Grauremihai439@icloud.com";

export const SIDEBAR_WIDTH_COLLAPSED = 80; // px (matches w-20)
export const SIDEBAR_WIDTH_EXPANDED = 254; // px (matches w-64)
export const TOP_BAR_HEIGHT = 48; // px (matches h-12)

export const FREE_TIER_MAX_ACCOUNTS = 1;

// IAP product identifiers — must match App Store Connect EXACTLY.
export const IAP_PRODUCTS = {
  PREMIUM_MONTHLY: "premium_monthly",
  PREMIUM_YEARLY: "premium_yearly",
  PREMIUM_LIFETIME: "premium_lifetime",
} as const;

export const AVATAR_COLORS = [
  "#1D9BF0", // X blue
  "#000000", // X black
  "#536471", // X slate
  "#0a66c2", // deep blue
  "#4A90D9", // light blue
  "#1a8cd8", // mid blue
  "#5851DB", // indigo accent
  "#26A69A", // teal accent
];

export const ALLOWED_HOSTS = [
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "t.co",
  "abs.twimg.com",
  "pbs.twimg.com",
  "video.twimg.com",
  "accounts.google.com", // Google login via X
  "apple.com",
  "localhost",
  "127.0.0.1",
];

export const PREMIUM_FEATURES = [
  "Unlimited X accounts",
  "Focus / Do Not Disturb mode",
  "Priority support",
];

// ── Premium productivity feature constants ────────────────────────────────────

export const AI_TONES = [
  { id: 'professional', label: 'Professional', emoji: '💼' },
  { id: 'friendly',     label: 'Friendly',     emoji: '😊' },
  { id: 'casual',       label: 'Casual',       emoji: '👋' },
  { id: 'concise',      label: 'Concise',      emoji: '⚡' },
] as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English',    flag: '🇬🇧' },
  { code: 'es', name: 'Spanish',    flag: '🇪🇸' },
  { code: 'fr', name: 'French',     flag: '🇫🇷' },
  { code: 'de', name: 'German',     flag: '🇩🇪' },
  { code: 'it', name: 'Italian',    flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian',    flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese',    flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese',   flag: '🇯🇵' },
  { code: 'ko', name: 'Korean',     flag: '🇰🇷' },
  { code: 'ar', name: 'Arabic',     flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi',      flag: '🇮🇳' },
  { code: 'ro', name: 'Romanian',   flag: '🇷🇴' },
  { code: 'tr', name: 'Turkish',    flag: '🇹🇷' },
] as const;

export const SMART_FILTERS = [
  { id: 'unread',   label: 'Unread Only',     emoji: '🔵' },
  { id: 'business', label: 'Creator Accounts', emoji: '🐦' },
  { id: 'personal', label: 'Personal Accounts', emoji: '👤' },
  { id: 'flagged',  label: 'Flagged',          emoji: '🚩' },
] as const;

export const PREMIUM_FEATURE_LIST = [
  { icon: '🤖', title: 'AI Reply Assistant',   desc: 'Generate smart DM replies with adjustable tone', view: 'ai-reply'            },
  { icon: '✍️',  title: 'Quick Reply',          desc: 'Compose replies natively, paste into DMs',       view: 'quick-reply'         },
  { icon: '🌐', title: 'Translation',           desc: 'Translate messages into 14 languages instantly', view: 'translate'           },
  { icon: '✨', title: 'AI Post Studio',         desc: 'Draft tweets & threads with AI assistance',      view: 'content'             },
  { icon: '📅', title: 'Message Scheduler',     desc: 'Plan DMs and get reminded to send them',         view: 'scheduler'           },
  { icon: '🎯', title: 'Focus Mode',            desc: 'Scheduled Do Not Disturb sessions',              view: 'focus'               },
  { icon: '🔍', title: 'Smart Filters',         desc: 'Filter accounts by type or flag status',         view: 'filters'             },
  { icon: '📊', title: 'Analytics',             desc: 'Track DM activity across your X accounts',       view: 'analytics'           },
  { icon: '🔔', title: 'Notification History',  desc: 'Full log of all received notifications',         view: 'notification-history'},
  { icon: '🎨', title: 'Theme Customizer',      desc: 'Accent colours, text size, layout density',      view: 'themes'              },
  { icon: '💼', title: 'Multiple Accounts',     desc: 'Add unlimited X accounts in one place',          view: 'messaging'           },
  { icon: '⌨️',  title: 'Keyboard Shortcuts',   desc: 'Lightning-fast ⌘K command navigation',           view: 'shortcuts'           },
  { icon: '🔄', title: 'Workspace Sync',        desc: 'Backup and restore your workspace config',       view: 'dashboard'           },
] as const;

// ── OpenAI ────────────────────────────────────────────────────────────────────
export const OPENAI_MODEL = 'gpt-4o-mini';

// Shared localStorage key for Quick Reply drafts.
// Used by both MessagingToolbar (inline) and QuickReplyComposer (full panel)
// so drafts saved in one place always appear in the other.
export const QUICK_REPLY_DRAFTS_KEY = 'igw_quick_reply_drafts';

// User-agent pretending to be Safari for best X/Twitter compatibility
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
  "Version/17.3 Safari/605.1.15";
