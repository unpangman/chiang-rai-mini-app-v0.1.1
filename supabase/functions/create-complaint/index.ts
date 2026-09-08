import { corsHeaders, isOriginAllowed, json } from '../_shared/http.ts';
import { requireLineProfile } from '../_shared/line-auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';

const allowedCategories = new Set(['streetlight', 'road', 'waste', 'flood', 'pm25', 'information', 'health']);
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function field(form: FormData, name: string, maxLength: number): string {
  const value = form.get(name);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function coordinate(value: string, min: number, max: number): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) throw new Error('INVALID_INPUT');
  return parsed;
}

async function validatedImage(form: FormData): Promise<{ file: File; extension: string } | null> {
  const value = form.get('photo');
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > MAX_FILE_SIZE || !allowedMimeTypes.has(value.type)) throw new Error('INVALID_IMAGE');
  const bytes = new Uint8Array(await value.slice(0, 16).arrayBuffer());
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  const brand = String.fromCharCode(...bytes.slice(4, 12));
  const heic = brand.includes('ftyp') && ['heic', 'heix', 'hevc', 'mif1'].some(type => brand.includes(type));
  if (!jpeg && !png && !webp && !heic) throw new Error('INVALID_IMAGE');
  return { file: value, extension: jpeg ? 'jpg' : png ? 'png' : webp ? 'webp' : 'heic' };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);
  if (!isOriginAllowed(request)) return json(request, { error: 'Origin not allowed' }, 403);

  let photoPath: string | null = null;
  try {
    const profile = await requireLineProfile(request);
    const form = await request.formData();
    const category = field(form, 'category', 40);
    const subtype = field(form, 'subtype', 120);
    const description = field(form, 'description', 500);
    if (!allowedCategories.has(category) || !subtype || description.length < 5) throw new Error('INVALID_INPUT');
    const latitude = coordinate(field(form, 'latitude', 30), -90, 90);
    const longitude = coordinate(field(form, 'longitude', 30), -180, 180);
    if ((latitude == null) !== (longitude == null)) throw new Error('INVALID_INPUT');
    const image = await validatedImage(form);
    const supabase = createAdminClient();

    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count, error: rateError } = await supabase
      .from('complaints')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.userId)
      .gte('created_at', since);
    if (rateError) throw rateError;
    if ((count || 0) >= 3) return json(request, { error: 'ส่งคำร้องถี่เกินไป กรุณารอประมาณ 10 นาที' }, 429);

    if (image) {
      photoPath = `${profile.userId}/${crypto.randomUUID()}.${image.extension}`;
      const { error } = await supabase.storage.from('complaint-images').upload(photoPath, image.file, {
        contentType: image.file.type,
        upsert: false
      });
      if (error) throw error;
    }

    const titleMap: Record<string, string> = {
      streetlight: 'ปัญหาไฟสาธารณะ', road: 'ปัญหาถนนชำรุด', waste: 'ปัญหาขยะ',
      flood: 'ปัญหาน้ำท่วม', pm25: 'ปัญหา PM2.5', information: 'คำขอข้อมูลข่าวสาร', health: 'บริการด้านสุขภาพ'
    };
    const { data, error } = await supabase.from('complaints').insert({
      user_id: profile.userId,
      user_name: profile.displayName,
      category,
      subtype,
      title: titleMap[category],
      description,
      latitude,
      longitude,
      photo_path: photoPath,
      status: 'received'
    }).select('ticket_no').single();
    if (error) throw error;
    return json(request, { ticket_no: data.ticket_no }, 201);
  } catch (error) {
    if (photoPath) {
      try { await createAdminClient().storage.from('complaint-images').remove([photoPath]); } catch { /* best effort */ }
    }
    const code = error instanceof Error ? error.message : '';
    if (code === 'UNAUTHORIZED') return json(request, { error: 'กรุณาเข้าสู่ระบบ LINE ใหม่' }, 401);
    if (code === 'INVALID_INPUT') return json(request, { error: 'ข้อมูลคำร้องไม่ถูกต้อง' }, 400);
    if (code === 'INVALID_IMAGE') return json(request, { error: 'รูปต้องเป็น JPG, PNG, WebP หรือ HEIC และไม่เกิน 10 MB' }, 400);
    console.error('create-complaint failed', error);
    return json(request, { error: 'ไม่สามารถบันทึกคำร้องได้' }, 500);
  }
});
