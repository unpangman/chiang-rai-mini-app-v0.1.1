import { env } from '../config';
import type { ManagedMapLayer, PlaceMarker } from '../types';

const ADMIN_SESSION_KEY = 'chiang-rai-admin-password-v2';

async function call<T>(method: string, body?: BodyInit, admin = true): Promise<T> {
  const password = sessionStorage.getItem(ADMIN_SESSION_KEY) || '';
  const response = await fetch(`${env.supabaseUrl}/functions/v1/staff-map-markers`, {
    method,
    headers: {
      apikey: env.supabaseAnonKey,
      Authorization: `Bearer ${env.supabaseAnonKey}`,
      ...(admin ? { 'x-admin-password': password } : {}),
      ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' })
    },
    body
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `MAP_MARKERS_${response.status}`);
  return payload;
}

export async function loginMapAdmin(password: string): Promise<boolean> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return false;
  sessionStorage.setItem(ADMIN_SESSION_KEY, password);
  try {
    await call<{ ok: boolean }>('POST', JSON.stringify({ action: 'login' }));
    return true;
  } catch {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return false;
  }
}

export function logoutMapAdmin(): void {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

export function hasMapAdminSession(): boolean {
  return Boolean(sessionStorage.getItem(ADMIN_SESSION_KEY));
}

export async function loadMapLayers(admin = false): Promise<ManagedMapLayer[]> {
  const result = await call<{ layers: ManagedMapLayer[] }>('GET', undefined, admin);
  return result.layers;
}

export async function saveMapLayer(layer: ManagedMapLayer): Promise<void> {
  await call('POST', JSON.stringify({ action: 'save-layer', layer: { id: layer.id, name: layer.name, color: layer.color, visible: layer.visible } }));
}

export async function saveMapMarker(layerId: string, marker: PlaceMarker): Promise<PlaceMarker> {
  const form = new FormData();
  form.set('action', 'save-marker');
  form.set('layer_id', layerId);
  form.set('id', marker.id);
  form.set('name', marker.name);
  form.set('info', marker.info);
  form.set('category', marker.category);
  form.set('status', marker.status);
  form.set('color', marker.color);
  form.set('latitude', String(marker.latitude));
  form.set('longitude', String(marker.longitude));
  if (marker.photo) form.set('photo', marker.photo);
  return (await call<{ marker: PlaceMarker }>('POST', form)).marker;
}

export async function deleteMapLayer(id: string): Promise<void> {
  await call('DELETE', JSON.stringify({ action: 'delete-layer', id }));
}

export async function deleteMapMarker(id: string): Promise<void> {
  await call('DELETE', JSON.stringify({ action: 'delete-marker', id }));
}
