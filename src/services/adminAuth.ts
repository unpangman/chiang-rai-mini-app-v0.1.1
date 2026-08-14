import { env } from '../config';

/**
 * หมายเหตุด้านความปลอดภัย
 * ------------------------
 * นี่คือการกันแบบฝั่ง client เท่านั้น เหมาะสำหรับกันคนทั่วไปไม่ให้แก้ไขเลเยอร์/หมุด
 * บนแผนที่โดยไม่ได้ตั้งใจ "ไม่ใช่" ระบบยืนยันตัวตนที่แท้จริง เพราะรหัสผ่าน (ในรูป hash)
 * ถูกฝังอยู่ใน JS bundle ที่ส่งถึงเบราว์เซอร์ทุกคน ผู้ที่มีความรู้ด้านเทคนิคสามารถอ่านค่านี้
 * หรือข้ามการตรวจสอบใน devtools ได้ หากต้องการปกป้องข้อมูลจริงบนฐานข้อมูล (เช่น Supabase)
 * ต้องบังคับสิทธิ์ที่ฝั่งเซิร์ฟเวอร์ด้วย Supabase Auth หรือ Edge Function ประกอบ RLS เสมอ
 */

const SESSION_KEY = 'chiang-rai-admin-session-v1';

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** true เมื่อมีการตั้งค่า VITE_ADMIN_PASSWORD_HASH ไว้แล้ว */
export function isAdminConfigured(): boolean {
  return Boolean(env.adminPasswordHash);
}

export function isAdminLoggedIn(): boolean {
  return sessionStorage.getItem(SESSION_KEY) === 'true';
}

/**
 * ตรวจรหัสผ่านผู้ดูแล หากยังไม่ได้ตั้งค่า VITE_ADMIN_PASSWORD_HASH จะถือเป็นโหมดทดลอง
 * และอนุญาตให้เข้าสู่ระบบได้ทันทีเพื่อให้ทดสอบ UI ได้ (เช่นเดียวกับโหมดทดลองส่วนอื่นของแอป)
 */
export async function loginAdmin(password: string): Promise<{ ok: boolean; demo: boolean }> {
  if (!isAdminConfigured()) {
    sessionStorage.setItem(SESSION_KEY, 'true');
    return { ok: true, demo: true };
  }
  const hash = await sha256Hex(password);
  if (hash === env.adminPasswordHash) {
    sessionStorage.setItem(SESSION_KEY, 'true');
    return { ok: true, demo: false };
  }
  return { ok: false, demo: false };
}

export function logoutAdmin(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
