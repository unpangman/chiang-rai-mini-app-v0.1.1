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

export type ComplaintCategory = 'streetlight' | 'road' | 'waste' | 'flood' | 'pm25' | 'information' | 'health';

export type ComplaintStatus = 'received' | 'in_progress' | 'resolved' | 'rejected';

export type ComplaintListItem = {
  ticket_no: string;
  category: ComplaintCategory;
  subtype: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  created_at: string;
  updated_at: string;
  has_photo: boolean;
};

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
  category: string;
  status: 'active' | 'draft' | 'hidden';
  color: string;
  latitude: number;
  longitude: number;
  image_url?: string;
  image_path?: string;
  photo?: File;
};

export type ManagedMapLayer = {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  markers: PlaceMarker[];
};
