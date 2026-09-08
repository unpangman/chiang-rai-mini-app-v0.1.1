import { getSupabase } from './supabase';
import { env } from '../config';
import { getLineAccessToken } from './liff';
import type { ComplaintDraft, ComplaintListItem, MapIssue, NewsItem, NoticeItem, ServiceItem, UserProfile } from '../types';

const demoServices: ServiceItem[] = [
  { id: '1', slug: 'streetlight', title: 'แจ้งปัญหาไฟสาธารณะ', subtitle: 'ไฟดับ/ไฟกระพริบ/ไฟเสีย', icon: '💡', color: '#ff9f0a', enabled: true, sort_order: 1 },
  { id: '2', slug: 'road', title: 'แจ้งปัญหาถนนชำรุด', subtitle: 'ถนนพัง/หลุมบ่อ/ทางเท้าเสียหาย', icon: '🛣️', color: '#ff453a', enabled: true, sort_order: 2 },
  { id: '3', slug: 'waste', title: 'แจ้งปัญหาขยะ', subtitle: 'ขยะล้น/ไม่เก็บ/ถังขยะเสียหาย', icon: '🗑️', color: '#30d158', enabled: true, sort_order: 3 },
  { id: '4', slug: 'flood', title: 'แจ้งปัญหาน้ำท่วม', subtitle: 'น้ำท่วมขัง/ระบายน้ำไม่ทัน', icon: '💧', color: '#0a84ff', enabled: true, sort_order: 4 },
  { id: '5', slug: 'pm25', title: 'แจ้งปัญหา PM2.5', subtitle: 'ฝุ่นควัน/มลพิษทางอากาศ', icon: '🌫️', color: '#bf5af2', enabled: true, sort_order: 5 },
  { id: '6', slug: 'information', title: 'ขอข้อมูลข่าวสาร (พ.ร.บ.)', subtitle: 'ยื่นคำร้องขอข้อมูลข่าวสาร', icon: '📄', color: '#5856d6', enabled: true, sort_order: 6 },
  { id: '7', slug: 'health', title: 'ศูนย์บริการสุขภาพ', subtitle: 'บริการกองสาธารณสุข', icon: '🏥', color: '#007aff', enabled: true, sort_order: 7 }
];

const demoNotices: NoticeItem[] = [
  { id: 'a1', title: 'ประกาศสำคัญจากเทศบาลนครเชียงราย', summary: 'ติดตามข่าวสารและบริการที่มีผลต่อประชาชนในเขตเทศบาล', published_at: '2026-08-18T09:00:00+07:00', priority: 'important' },
  { id: 'a2', title: 'แจ้งเตือนการปิดถนนชั่วคราว', summary: 'ตรวจสอบเส้นทางก่อนเดินทางและวางแผนการเดินทางล่วงหน้า', published_at: '2026-08-17T13:30:00+07:00', priority: 'urgent' },
  { id: 'a3', title: 'ประกาศบริการประชาชน', summary: 'อัปเดตข้อมูลการให้บริการของเทศบาลในช่วงเวลาทำการ', published_at: '2026-08-15T10:00:00+07:00', priority: 'info' }
];

const demoNews: NewsItem[] = [
  { id: 'n1', title: 'โครงการปลูกต้นไม้เฉลิมพระเกียรติ', excerpt: 'ร่วมเพิ่มพื้นที่สีเขียวในเขตเทศบาลนครเชียงราย', published_at: '2026-08-01T09:00:00+07:00', type: 'activity' },
  { id: 'n2', title: 'ประชาสัมพันธ์เฝ้าระวัง PM2.5', excerpt: 'ติดตามสถานการณ์คุณภาพอากาศและข้อแนะนำสุขภาพ', published_at: '2026-07-30T09:00:00+07:00', type: 'news' }
];

const demoIssues: MapIssue[] = [
  { id: 'm1', category: 'streetlight', title: 'ไฟสาธารณะดับ', status: 'รับเรื่องแล้ว', latitude: 19.9103, longitude: 99.8295 },
  { id: 'm2', category: 'road', title: 'ถนนเป็นหลุม', status: 'กำลังดำเนินการ', latitude: 19.9028, longitude: 99.838 },
  { id: 'm3', category: 'waste', title: 'ขยะตกค้าง', status: 'เสร็จสิ้น', latitude: 19.9145, longitude: 99.8402 },
  { id: 'm4', category: 'flood', title: 'น้ำท่วมขัง', status: 'รับเรื่องแล้ว', latitude: 19.8978, longitude: 99.8254 }
];

export async function getServices(): Promise<ServiceItem[]> {
  try {
    const supabase = await getSupabase();
    if (!supabase) return demoServices;
    const { data, error } = await supabase.from('services').select('*').eq('enabled', true).order('sort_order');
    if (error || !data?.length) return demoServices;
    return data as ServiceItem[];
  } catch (error) {
    console.warn('Services unavailable, using demo data:', error);
    return demoServices;
  }
}

export async function getNotices(): Promise<NoticeItem[]> {
  try {
    const supabase = await getSupabase();
    if (!supabase) return demoNotices;
    const { data, error } = await supabase.from('notices').select('*').eq('published', true).order('published_at', { ascending: false }).limit(5);
    if (error || !data?.length) return demoNotices;
    return data as NoticeItem[];
  } catch (error) {
    console.warn('Notices unavailable, using demo data:', error);
    return demoNotices;
  }
}

export async function getNews(): Promise<NewsItem[]> {
  try {
    const supabase = await getSupabase();
    if (!supabase) return demoNews;
    const { data, error } = await supabase.from('news').select('*').eq('published', true).order('published_at', { ascending: false }).limit(10);
    if (error || !data?.length) return demoNews;
    return data as NewsItem[];
  } catch (error) {
    console.warn('News unavailable, using demo data:', error);
    return demoNews;
  }
}

export async function getMapIssues(): Promise<MapIssue[]> {
  try {
    const supabase = await getSupabase();
    if (!supabase) return demoIssues;
    const { data, error } = await supabase.rpc('get_public_map_issues');
    if (error || !Array.isArray(data) || data.length === 0) return demoIssues;
    return data as MapIssue[];
  } catch (error) {
    console.warn('Map issues unavailable, using demo data:', error);
    return demoIssues;
  }
}

async function callProtectedFunction<T>(name: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${env.supabaseUrl}/functions/v1/${name}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
      ...init.headers
    }
  });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || `Edge Function ${name} failed (${response.status})`);
  return payload;
}

export async function createComplaint(draft: ComplaintDraft, profile: UserProfile): Promise<{ id: string; demo: boolean }> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    const id = `CR-${Date.now().toString().slice(-8)}`;
    const saved = JSON.parse(localStorage.getItem('demo-complaints') || '[]') as unknown[];
    saved.unshift({ id, ...draft, photo: draft.photo?.name, user_id: profile.userId, created_at: new Date().toISOString() });
    localStorage.setItem('demo-complaints', JSON.stringify(saved));
    return { id, demo: true };
  }

  const token = await getLineAccessToken();
  if (!token) throw new Error('LINE_LOGIN_REQUIRED');
  const form = new FormData();
  form.set('category', draft.category);
  form.set('subtype', draft.subtype);
  form.set('description', draft.description);
  if (draft.latitude != null) form.set('latitude', String(draft.latitude));
  if (draft.longitude != null) form.set('longitude', String(draft.longitude));
  if (draft.photo) form.set('photo', draft.photo);
  const result = await callProtectedFunction<{ ticket_no: string }>('create-complaint', token, { method: 'POST', body: form });
  return { id: result.ticket_no, demo: false };
}

export async function getMyComplaints(): Promise<ComplaintListItem[]> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    const saved = JSON.parse(localStorage.getItem('demo-complaints') || '[]') as Array<Record<string, unknown>>;
    return saved.map(item => ({
      ticket_no: String(item.id || ''),
      category: String(item.category || 'streetlight') as ComplaintListItem['category'],
      subtype: String(item.subtype || ''),
      title: categoryTitle(String(item.category || '')),
      description: String(item.description || ''),
      status: 'received',
      created_at: String(item.created_at || new Date().toISOString()),
      updated_at: String(item.created_at || new Date().toISOString()),
      has_photo: Boolean(item.photo)
    }));
  }
  const token = await getLineAccessToken();
  if (!token) throw new Error('LINE_LOGIN_REQUIRED');
  const result = await callProtectedFunction<{ complaints: ComplaintListItem[] }>('my-complaints', token, { method: 'GET' });
  return result.complaints;
}

export function categoryTitle(category: string): string {
  const map: Record<string, string> = {
    streetlight: 'ปัญหาไฟสาธารณะ',
    road: 'ปัญหาถนนชำรุด',
    waste: 'ปัญหาขยะ',
    flood: 'ปัญหาน้ำท่วม',
    pm25: 'ปัญหา PM2.5',
    information: 'คำขอข้อมูลข่าวสาร',
    health: 'บริการด้านสุขภาพ'
  };
  return map[category] ?? 'คำร้องทั่วไป';
}
