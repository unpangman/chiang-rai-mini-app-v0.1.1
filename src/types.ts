export type UserProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
  isDemo: boolean;
};

export type ServiceItem = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  enabled: boolean;
  sort_order: number;
};

export type NoticeItem = {
  id: string;
  title: string;
  summary: string;
  published_at: string;
  priority: 'urgent' | 'important' | 'info';
};

export type NewsItem = {
  id: string;
  title: string;
  excerpt: string;
  image_url?: string;
  published_at: string;
  type: 'news' | 'activity';
};

export type ComplaintCategory = 'streetlight' | 'road' | 'waste' | 'flood' | 'pm25';

export type ComplaintDraft = {
  category: ComplaintCategory;
  subtype: string;
  description: string;
  latitude?: number;
  longitude?: number;
  photo?: File;
};

export type MapIssue = {
  id: string;
  category: ComplaintCategory;
  title: string;
  status: string;
  latitude: number;
  longitude: number;
};

export type PlaceMarker = {
  id: string;
  name: string;
  info: string;
  latitude: number;
  longitude: number;
};

export type ManagedMapLayer = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  markers: PlaceMarker[];
};
