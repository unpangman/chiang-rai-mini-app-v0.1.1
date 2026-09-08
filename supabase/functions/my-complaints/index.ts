import { corsHeaders, isOriginAllowed, json } from '../_shared/http.ts';
import { requireLineProfile } from '../_shared/line-auth.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== 'GET') return json(request, { error: 'Method not allowed' }, 405);
  if (!isOriginAllowed(request)) return json(request, { error: 'Origin not allowed' }, 403);

  try {
    const profile = await requireLineProfile(request);
    const { data, error } = await createAdminClient()
      .from('complaints')
      .select('ticket_no,category,subtype,title,description,status,created_at,updated_at,photo_path')
      .eq('user_id', profile.userId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    const complaints = (data || []).map(item => ({
      ticket_no: item.ticket_no,
      category: item.category,
      subtype: item.subtype,
      title: item.title,
      description: item.description,
      status: item.status,
      created_at: item.created_at,
      updated_at: item.updated_at,
      has_photo: Boolean(item.photo_path)
    }));
    return json(request, { complaints });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'UNAUTHORIZED') return json(request, { error: 'กรุณาเข้าสู่ระบบ LINE ใหม่' }, 401);
    console.error('my-complaints failed', error);
    return json(request, { error: 'ไม่สามารถโหลดประวัติคำร้องได้' }, 500);
  }
});
