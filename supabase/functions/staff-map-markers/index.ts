import { corsHeaders, isOriginAllowed, json } from '../_shared/http.ts';
import { createAdminClient } from '../_shared/supabase-admin.ts';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']);

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function isAdmin(request: Request): Promise<boolean> {
  const expected = (Deno.env.get('ADMIN_PASSWORD_HASH') || '').trim().toLowerCase();
  const password = request.headers.get('x-admin-password') || '';
  return Boolean(expected && password && await sha256Hex(password) === expected);
}

async function readLayers(admin: ReturnType<typeof createAdminClient>, includePrivate: boolean) {
  let layerQuery = admin.from('map_layers').select('*').order('created_at');
  let markerQuery = admin.from('map_markers').select('*').order('created_at');
  if (!includePrivate) {
    layerQuery = layerQuery.eq('visible', true);
    markerQuery = markerQuery.eq('status', 'active');
  }
  const [{ data: layers, error: layerError }, { data: markers, error: markerError }] = await Promise.all([layerQuery, markerQuery]);
  if (layerError || markerError) throw layerError || markerError;
  const enriched = await Promise.all((markers || []).map(async marker => {
    let image_url: string | undefined;
    if (marker.image_path) {
      const { data } = await admin.storage.from('map-marker-images').createSignedUrl(marker.image_path, 3600);
      image_url = data?.signedUrl;
    }
    return { id: marker.id, name: marker.name, info: marker.description, category: marker.category, status: marker.status, color: marker.color, latitude: marker.latitude, longitude: marker.longitude, image_path: marker.image_path, image_url };
  }));
  return (layers || []).map(layer => ({ id: layer.id, name: layer.name, color: layer.color, visible: layer.visible, markers: enriched.filter(marker => (markers || []).find(raw => raw.id === marker.id)?.layer_id === layer.id) }));
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (!isOriginAllowed(request)) return json(request, { error: 'Origin not allowed' }, 403);
  const admin = createAdminClient();
  const authorized = await isAdmin(request);

  try {
    if (request.method === 'GET') return json(request, { layers: await readLayers(admin, authorized) });
    if (!authorized) return json(request, { error: 'รหัสผ่านผู้ดูแลไม่ถูกต้อง' }, 401);

    if (request.method === 'DELETE') {
      const body = await request.json();
      if (body.action === 'delete-layer') {
        const { data: markerRows } = await admin.from('map_markers').select('image_path').eq('layer_id', body.id);
        const paths = (markerRows || []).map(row => row.image_path).filter(Boolean);
        if (paths.length) await admin.storage.from('map-marker-images').remove(paths);
        const { error } = await admin.from('map_layers').delete().eq('id', body.id);
        if (error) throw error;
        return json(request, { ok: true });
      }
      if (body.action === 'delete-marker') {
        const { data: row } = await admin.from('map_markers').select('image_path').eq('id', body.id).maybeSingle();
        if (row?.image_path) await admin.storage.from('map-marker-images').remove([row.image_path]);
        const { error } = await admin.from('map_markers').delete().eq('id', body.id);
        if (error) throw error;
        return json(request, { ok: true });
      }
      return json(request, { error: 'Invalid action' }, 400);
    }

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.action === 'login') return json(request, { ok: true });
      if (body.action === 'save-layer') {
        const layer = body.layer || {};
        if (!layer.id || !layer.name || !/^#[0-9a-f]{6}$/i.test(layer.color || '')) return json(request, { error: 'Invalid layer' }, 400);
        const { error } = await admin.from('map_layers').upsert({ id: layer.id, name: String(layer.name).slice(0, 60), color: layer.color, visible: layer.visible !== false, updated_at: new Date().toISOString() });
        if (error) throw error;
        return json(request, { ok: true });
      }
      return json(request, { error: 'Invalid action' }, 400);
    }

    const form = await request.formData();
    if (form.get('action') !== 'save-marker') return json(request, { error: 'Invalid action' }, 400);
    const id = String(form.get('id') || '');
    const layerId = String(form.get('layer_id') || '');
    const name = String(form.get('name') || '').trim();
    const latitude = Number(form.get('latitude'));
    const longitude = Number(form.get('longitude'));
    const color = String(form.get('color') || '');
    const status = String(form.get('status') || 'active');
    if (!id || !layerId || !name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || !/^#[0-9a-f]{6}$/i.test(color) || !['active','draft','hidden'].includes(status)) return json(request, { error: 'Invalid marker' }, 400);

    const { data: old } = await admin.from('map_markers').select('image_path').eq('id', id).maybeSingle();
    let imagePath = old?.image_path || null;
    const photo = form.get('photo');
    if (photo instanceof File && photo.size) {
      if (photo.size > MAX_FILE_SIZE || !allowedMimeTypes.has(photo.type)) return json(request, { error: 'Invalid image' }, 400);
      const extension = photo.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const nextPath = `${layerId}/${id}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await admin.storage.from('map-marker-images').upload(nextPath, photo, { contentType: photo.type });
      if (uploadError) throw uploadError;
      if (imagePath) await admin.storage.from('map-marker-images').remove([imagePath]);
      imagePath = nextPath;
    }
    const row = { id, layer_id: layerId, name: name.slice(0, 80), description: String(form.get('info') || '').slice(0, 500), category: String(form.get('category') || 'สถานที่').slice(0, 60), status, color, latitude, longitude, image_path: imagePath, updated_at: new Date().toISOString() };
    const { error } = await admin.from('map_markers').upsert(row);
    if (error) throw error;
    const layers = await readLayers(admin, true);
    const marker = layers.flatMap(layer => layer.markers).find(item => item.id === id);
    return json(request, { marker });
  } catch (error) {
    console.error(error);
    return json(request, { error: 'ไม่สามารถจัดการข้อมูลแผนที่ได้' }, 500);
  }
});
