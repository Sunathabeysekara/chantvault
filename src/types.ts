export type TopicCategory = 
  | 'all'
  | 'government_whistleblower'
  | 'struggles'
  | 'secrets'
  | 'daily_whisper';

export interface Chant {
  id: string;
  title: string;
  content: string;
  author_alias: string;
  topic: TopicCategory;
  tags: string[];
  image_url: string | null;
  likes_count: number;
  flags_count: number;
  is_hidden: number;
  created_at: string;
}

export interface Comment {
  id: string;
  chant_id: string;
  author_alias: string;
  content: string;
  is_hidden: number;
  created_at: string;
}

export interface ChatGroup {
  id: string;
  name: string;
  description: string;
  topic: TopicCategory | 'general';
  tags: string[];
  is_encrypted: number;
  encryption_passphrase?: string;
  passphrase_hash?: string;
  member_count: number;
  is_hidden: number;
  created_at: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  author_alias: string;
  content: string; // Could be JSON of EncryptedPayload or plaintext
  is_encrypted: number;
  image_url: string | null;
  read_by: string; // JSON array of aliases or count
  is_hidden: number;
  created_at: string;
}

export interface ReportItem {
  id: string;
  content_type: string;
  content_id: string;
  reason: string;
  details?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

export interface AdminStats {
  totalChants: number;
  hiddenChants: number;
  totalComments: number;
  totalGroups: number;
  totalMessages: number;
  pendingReports: number;
  totalVisits: number;
  uniqueVisitors: number;
  dbFileSizeKb: number;
}

export interface PopularPage {
  page_name: string;
  path: string;
  visit_count: number;
  percentage: number;
}

export interface PopularInteraction {
  label: string;
  category: string;
  interaction_count: number;
}

export interface PopularPageOption {
  option_name: string;
  count: number;
}

export interface PageVisitItem {
  id: string;
  path: string;
  page_name: string;
  option_name: string | null;
  session_id: string;
  referrer: string;
  created_at: string;
}

export interface AnalyticsData {
  timeRange: string;
  metrics: {
    totalVisits: number;
    uniqueVisitors: number;
    visits24h: number;
    unique24h: number;
  };
  popularPages: PopularPage[];
  popularInteractions: PopularInteraction[];
  popularPageOptions: PopularPageOption[];
  recentVisits: PageVisitItem[];
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'ERROR' | 'WARN' | 'INFO' | 'RATE_LIMIT' | 'SECURITY';
  ip?: string;
  method?: string;
  route?: string;
  message: string;
  stack?: string;
  raw: string;
}

export interface SystemLogStats {
  totalEntries: number;
  fileSizeBytes: number;
  fileSizeKb: number;
  filePath: string;
  lastModified: string | null;
}

export interface RateLimitClientRecord {
  ip: string;
  limiter: string;
  count: number;
  blockedUntil?: string;
}

export interface RateLimitStats {
  totalBlockedEvents: number;
  activeRateLimitedClients: RateLimitClientRecord[];
  topBlockedIps: Array<{ ip: string; count: number }>;
}
