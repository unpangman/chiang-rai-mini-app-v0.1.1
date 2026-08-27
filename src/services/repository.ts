import { supabase } from './supabase';
import type { ComplaintDraft, MapIssue, NewsItem, NoticeItem, ServiceItem, UserProfile } from '../types';

const READ_TIMEOUT_MS = 2500;

export const demoServices: ServiceItem[] = [
  { id: '1', slug: 'streetlight', title: 'แจ้งปัญหาไฟสาธารณะ', subtitle: 'ไฟดับ/ไฟกระพริบ/ไฟเสีย', icon: '💡', color: '#ff9f0a', enabled: true, sort_order: 1 },
  { id: '2', slug: 'road', title: 'แจ้งปัญหาถนนชำรุด', subtitle: 'ถนนพัง/หลุมบ่อ/ทางเท้าเสียหาย', icon: '🛣️', color: '#ff453a', enabled: true, sort_order: 2 },
  { id: '3', slug: 'waste', title: 'แจ้งปัญหาขยะ', subtitle: 'ขยะล้น/ไม่เก็บ/ถังขยะเสียหาย', icon: '🗑️', color: '#30d158', enabled: true, sort_order: 3 },
  { id: '4', slug: 'flood', title: 'แจ้งปัญหาน้ำท่วม', subtitle: 'น้ำท่วมขัง/ระบายน้ำไม่ทัน', icon: '💧', color: '#0a84ff', enabled: true, sort_order: 4 },
  { id: '5', slug: 'pm25', title: 'แจ้งปัญหา PM2.5', subtitle: 'ฝุ่นควัน/มลพิษทางอากาศ', icon: '🌫️', color: '#bf5af2', enabled: true, sort_order: 5 },
  { id: '6', slug: 'information', title: 'ขอข้อมูลข่าวสาร (พ.ร.บ.)', subtitle: 'ยื่นคำร้องขอข้อมูลข่าวสาร', icon: '📄', color: '#5856d6', enabled: true, sort_order: 6 },
  { id: '7', slug: 'health', title: 'ศูนย์บริการสุขภาพ', subtitle: 'บริการกองสาธารณสุข', icon: '🏥', color: '#007aff', enabled: true, sort_order: 7 }
];

export const demoNotices: NoticeItem[] = [
  { id: 'a1', title: 'ประกาศสำคัญจากเทศบาลนครเชียงราย', summary: 'ติดตามข่าวสารและบริการที่มีผลต่อประชาชนในเขตเทศบาล', published_at: '2026-08-18T09:00:00+07:00', priority: 'important' },
  { id: 'a2', title: 'แจ้งเตือนการปิดถนนชั่วคราว', summary: 'ตรวจสอบเส้นทางก่อนเดินทางและวางแผนการเดินทางล่วงหน้า', published_at: '2026-08-17T13:30:00+07:00', priority: 'urgent' },
  { id: 'a3', title: 'ประกาศบริการประชาชน', summary: 'อัปเดตข้อมูลการให้บริการของเทศบาลในช่วงเวลาทำการ', published_at: '2026-08-15T10:00:00+07:00', priority: 'info' }
];

export const demoNews: NewsItem[] = [
  { id: 'n1', title: 'โครงการปลูกต้นไม้เฉลิมพระเกียรติ', excerpt: 'ร่วมเพิ่มพื้นที่สีเขียวในเขตเทศบาลนครเชียงราย', published_at: '2026-08-01T09:00:00+07:00', type: 'activity' },
  { id: 'n2', title: 'ประชาสัมพันธ์เฝ้าระวัง PM2.5', excerpt: 'ติดตามสถานการณ์คุณภาพอากาศและข้อแนะนำสุขภาพ', published_at: '2026-07-30T09:00:00+07:00', type: 'news' }
];

const demoIssues: MapIssue[] = [
  { id: 'm1', category: 'streetlight', title: 'ไฟสาธารณะดับ', status: 'รับเรื่องแล้ว', latitude: 19.9103, longitude: 99.8295 },
  { id: 'm2', category: 'road', title: 'ถนนเป็นหลุม', status: 'กำลังดำเนินการ', latitude: 19.9028, longitude: 99.838 },
  { id: 'm3', category: 'waste', title: 'ขยะตกค้าง', status: 'เสร็จสิ้น', latitude: 19.9145, longitude: 99.8402 },
  { id: 'm4', category: 'flood', title: 'น้ำท่วมขัง', status: 'รับเรื่องแล้ว', latitude: 19.8978, longitude: 99.8254 }
];

async function withReadTimeout<T>(query: { abortSignal: (signal: AbortSignal) => PromiseLike<T> }): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    return await query.abortSignal(controller.signal);
  } finally {
    window.clearTimeout(timer);
  }
}

export async function getServices(): Promise<ServiceItem[]> {
  if (!supabase) return demoServices;
  try {
    const { data, error } = await withReadTimeout(
      supabase.from('services').select('id,slug,title,subtitle,icon,color,enabled,sort_order').eq('enabled', true).order('sort_order')
    );
    if (error || !data?.length) return demoServices;
    return data as ServiceItem[];
  } catch (error) {
    console.warn('Services unavailable, using demo data:', error);
    return demoServices;
  }
}

export async function getNotices(): Promise<NoticeItem[]> {
  if (!supabase) return demoNotices;
  try {
    const { data, error } = await withReadTimeout(
      supabase.from('notices').select('id,title,summary,priority,published_at').eq('published', true).order('published_at', { ascending: false }).limit(5)
    );
    if (error || !data?.length) return demoNotices;
    return data as NoticeItem[];
  } catch (error) {
    console.warn('Notices unavailable, using demo data:', error);
    return demoNotices;
  }
}

export async function getNews(): Promise<NewsItem[]> {
  if (!supabase) return demoNews;
  try {
    const { data, error } = await withReadTimeout(
      supabase.from('news').select('id,title,excerpt,image_url,type,published_at').eq('published', true).order('published_at', { ascending: false }).limit(10)
    );
    if (error || !data?.length) return demoNews;
    return data as NewsItem[];
  } catch (error) {
    console.warn('News unavailable, using demo data:', error);
    return demoNews;
  }
}

export async function getMapIssues(): Promise<MapIssue[]> {
  if (!supabase) return demoIssues;
  try {
    const { data, error } = await withReadTimeout(
      supabase.rpc('get_public_map_issues')
    );
    if (error || !Array.isArray(data) || data.length === 0) return demoIssues;
    return data as MapIssue[];
  } catch (error) {
    console.warn('Map issues unavailable, using demo data:', error);
    return demoIssues;
  }
}

async function uploadPhoto(file: File, userId: string): Promise<string | null> {
  if (!supabase) return null;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from('complaint-images').upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('complaint-images').getPublicUrl(path);
  return data.publicUrl;
}

export async function createComplaint(draft: ComplaintDraft, profile: UserProfile): Promise<{ id: string; demo: boolean }> {
  if (!supabase) {
    const id = `CR-${Date.now().toString().slice(-8)}`;
    const saved = JSON.parse(localStorage.getItem('demo-complaints') || '[]') as unknown[];
    saved.unshift({ id, ...draft, photo: draft.photo?.name, user_id: profile.userId, created_at: new Date().toISOString() });
    localStorage.setItem('demo-complaints', JSON.stringify(saved));
    return { id, demo: true };
  }

  const photoUrl = draft.photo ? await uploadPhoto(draft.photo, profile.userId) : null;
  const title = categoryTitle(draft.category);
  const { data, error } = await supabase.from('complaints').insert({
    user_id: profile.userId,
    user_name: profile.displayName,
    category: draft.category,
    subtype: draft.subtype,
    title,
    description: draft.description,
    latitude: draft.latitude ?? null,
    longitude: draft.longitude ?? null,
    photo_url: photoUrl,
    status: 'received'
  }).select('ticket_no').single();
  if (error) throw error;
  return { id: String(data.ticket_no), demo: false };
}

export function categoryTitle(category: string): string {
  const map: Record<string, string> = {
    streetlight: 'ปัญหาไฟสาธารณะ',
    road: 'ปัญหาถนนชำรุด',
    waste: 'ปัญหาขยะ',
    flood: 'ปัญหาน้ำท่วม',
    pm25: 'ปัญหา PM2.5'
  };
  return map[category] ?? 'คำร้องทั่วไป';
}
