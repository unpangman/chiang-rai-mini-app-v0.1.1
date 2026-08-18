import './styles.css';
import { appConfig } from './config';
import { initLine, isInLineClient, shareApp } from './services/liff';
import { isSupabaseConfigured } from './services/supabase';
import { categoryTitle, createComplaint, getMapIssues, getNews, getServices } from './services/repository';
import { getChiangRaiWeather } from './services/weather';
import { getChiangRaiRain } from './services/rainfall';
import { isAdminConfigured, isAdminLoggedIn, loginAdmin, logoutAdmin } from './services/adminAuth';
import type { ComplaintCategory, ComplaintDraft, ManagedMapLayer, NewsItem, ServiceItem, UserProfile } from './types';
import type { ChiangRaiRainSnapshot, RainForecast } from './services/rainfallProxy';

const app = document.querySelector<HTMLDivElement>('#app')!;

let profile: UserProfile;
let services: ServiceItem[] = [];
let news: NewsItem[] = [];
let leafletMap: any = null;
let rainfallSnapshot: ChiangRaiRainSnapshot | null = null;
let reportDraft: ComplaintDraft = { category: 'streetlight', subtype: 'ไฟดับ', description: '' };
let reportStep = 1;
const MAP_LAYERS_STORAGE_KEY = 'chiang-rai-managed-map-layers-v1';

function makeId(prefix: string): string {
  const value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${value}`;
}

function loadManagedLayers(): ManagedMapLayer[] {
  try {
    const saved = localStorage.getItem(MAP_LAYERS_STORAGE_KEY);
    if (!saved) {
      return [{ id: makeId('layer'), name: 'สถานที่ของฉัน', color: '#ea580c', visible: true, markers: [] }];
    }

    const parsed = JSON.parse(saved) as ManagedMapLayer[];
    if (!Array.isArray(parsed)) throw new Error('Invalid map layers');
    return parsed.filter(layer => layer && typeof layer.id === 'string' && typeof layer.name === 'string').map(layer => ({
      id: layer.id,
      name: layer.name,
      color: /^#[0-9a-f]{6}$/i.test(layer.color) ? layer.color : '#2563eb',
      visible: layer.visible !== false,
      markers: Array.isArray(layer.markers) ? layer.markers.filter(marker =>
        marker && typeof marker.id === 'string' && typeof marker.name === 'string' &&
        Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude)
      ) : []
    }));
  } catch (error) {
    console.warn('Could not read saved map layers:', error);
    return [{ id: makeId('layer'), name: 'สถานที่ของฉัน', color: '#ea580c', visible: true, markers: [] }];
  }
}

function saveManagedLayers(): void {
  localStorage.setItem(MAP_LAYERS_STORAGE_KEY, JSON.stringify(managedLayers));
}

let managedLayers: ManagedMapLayer[] = loadManagedLayers();

const ISSUE_FILTERS_STORAGE_KEY = 'chiang-rai-issue-filters-v1';
const ISSUE_FILTER_DEFS: Array<[ComplaintCategory, string, boolean]> = [
  ['streetlight', 'ไฟสาธารณะ', true],
  ['road', 'ถนนชำรุด', true],
  ['waste', 'จุดทิ้งขยะ', true],
  ['flood', 'จุดเสี่ยงน้ำท่วม', false]
];

function loadIssueFilters(): Record<string, boolean> {
  const defaults = Object.fromEntries(ISSUE_FILTER_DEFS.map(([id, , checked]) => [id, checked]));
  try {
    const saved = localStorage.getItem(ISSUE_FILTERS_STORAGE_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved) as Record<string, boolean>;
    return { ...defaults, ...parsed };
  } catch (error) {
    console.warn('Could not read saved issue filters:', error);
    return defaults;
  }
}

function saveIssueFilters(): void {
  localStorage.setItem(ISSUE_FILTERS_STORAGE_KEY, JSON.stringify(issueFilters));
}

let issueFilters: Record<string, boolean> = loadIssueFilters();
let pendingMapFocus: { latitude: number; longitude: number } | null = null;

const icons: Record<string, string> = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 10.8 12 3l9 7.8v9.4a.8.8 0 0 1-.8.8h-5.4v-6.5H9.2V21H3.8a.8.8 0 0 1-.8-.8z"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="m19 13.5 2 1.2-2 3.5-2.1-.8a8 8 0 0 1-2.4 1.4l-.3 2.2h-4l-.3-2.2a8 8 0 0 1-2.4-1.4l-2.1.8-2-3.5 2-1.2a8 8 0 0 1 0-3l-2-1.2 2-3.5 2.1.8a8 8 0 0 1 2.4-1.4L10.2 3h4l.3 2.2a8 8 0 0 1 2.4 1.4l2.1-.8 2 3.5-2 1.2a8 8 0 0 1 0 3Z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  layers: '<svg viewBox="0 0 24 24"><path d="m12 3-9 5 9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>',
  locate: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M13.5 6.5 17.5 10.5M4 20l4.2-1 10.4-10.4a2.8 2.8 0 0 0-4-4L4.2 15 4 20Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M20 10c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>'
};

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[ch] ?? ch);
}

function route(): string {
  return location.hash.replace(/^#\/?/, '') || 'home';
}

function go(path: string): void {
  location.hash = `#/${path}`;
}

function nav(active: string): string {
  const useHomeBrandIcons = true;
  const items = [
    ['home', 'หน้าหลัก', useHomeBrandIcons ? '<img class="brand-tab-icon" src="/brand-icons/home.png" alt="" aria-hidden="true">' : icons.home],
    ['services', 'บริการ', useHomeBrandIcons ? '<img class="brand-tab-icon" src="/brand-icons/services.png" alt="" aria-hidden="true">' : icons.grid],
    ['map', 'แผนที่', icons.map],
    ['settings', 'ตั้งค่า', useHomeBrandIcons ? '<img class="brand-tab-icon" src="/brand-icons/settings.png" alt="" aria-hidden="true">' : icons.gear]
  ];
  return `<nav class="tab-bar">${items.map(([id, label, icon]) => `<button class="tab-item ${active === id ? 'active' : ''}" data-go="${id}"><span>${icon}</span><small>${label}</small></button>`).join('')}</nav>`;
}

function shell(content: string, active = '', options: { title?: string; back?: boolean; noTabs?: boolean } = {}): string {
  const title = options.title
    ? `<header class="ios-nav"><button class="nav-back ${options.back ? '' : 'hidden'}" data-back>${icons.back}</button><strong>${esc(options.title)}</strong><span class="nav-space"></span></header>`
    : '';
  return `<div class="app-shell">${title}<main class="page ${options.title ? 'with-nav' : ''}">${content}</main>${options.noTabs ? '' : nav(active)}</div>`;
}

function serviceIcon(item: ServiceItem): string {
  return `<span class="service-icon" style="--icon-color:${esc(item.color)}">${esc(item.icon)}</span>`;
}

function dashboard(): string {
  const quick = services.slice(0, 6);
  const story = news.slice(0, 4);
  return shell(`
    <section class="dashboard-head">
      <div class="profile-row">
        ${profile.pictureUrl
          ? `<img class="avatar" src="${esc(profile.pictureUrl)}" alt="รูปโปรไฟล์ LINE ของ ${esc(profile.displayName)}" />`
          : '<span class="avatar avatar-fallback" aria-hidden="true">ชร</span>'}
        <div><h1>สวัสดี, ${esc(profile.displayName)}</h1><p>${appConfig.cityName} · ${profile.isDemo ? 'โหมดทดลอง' : 'บัญชี LINE'}</p></div>
        <button class="circle-button" aria-label="การแจ้งเตือน">🔔<span class="badge">3</span></button>
      </div>
      <article class="hero-card">
        <img src="/watch_tower.jpg" alt="หอนาฬิกาเชียงรายยามเย็น" width="627" height="535" />
        <div class="hero-overlay"><span>เทศบาลนครเชียงราย</span><small>เมืองน่าอยู่ สิ่งแวดล้อมดี ชีวิตมีคุณภาพ</small></div>
      </article>
      <article class="weather-card glass">
        <div class="weather-main"><span class="weather-icon" id="weather-icon">🌤️</span><strong id="weather-temp">--°</strong><small id="weather-desc">กำลังโหลด...</small></div>
        <div class="weather-detail"><b>เชียงราย</b><span id="weather-range">↑ --° ↓ --°</span><span id="weather-humidity">ความชื้น --%</span></div>
        <div class="rain"><span>💧</span><small id="weather-rain">ฝน --%</small></div>
      </article>
      <section id="rainfall-home-card" class="rainfall-home-card" aria-live="polite"><div class="rainfall-loading"><span>💧</span><b>กำลังโหลดสถานการณ์ฝนเชียงราย...</b></div></section>
    </section>
    <section class="content-section"><div class="section-title"><h2>บริการของเรา</h2><button data-go="services">ดูทั้งหมด</button></div>
      <div class="quick-grid">${quick.map(item => `<button class="quick-card" data-service="${esc(item.slug)}">${serviceIcon(item)}<span>${esc(item.title.replace('แจ้งปัญหา', 'แจ้ง'))}</span></button>`).join('')}</div>
    </section>
    <section class="content-section"><div class="section-title"><h2>ข่าวสาร & กิจกรรม</h2><button>ดูทั้งหมด</button></div>
      <div class="story-strip">${story.map((item, index) => `<article class="story-card story-${(index % 3) + 1}"><span class="story-type">${item.type === 'activity' ? 'กิจกรรม' : 'ข่าวสาร'}</span><div><strong>${esc(item.title)}</strong><small>${new Date(item.published_at).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</small></div></article>`).join('')}</div>
    </section>
    ${profile.isDemo || !isSupabaseConfigured ? `<div class="demo-banner">โหมดทดลอง: ${profile.isDemo ? 'ยังไม่ได้ตั้งค่า LIFF' : ''}${profile.isDemo && !isSupabaseConfigured ? ' · ' : ''}${!isSupabaseConfigured ? 'ยังไม่ได้ตั้งค่า Supabase' : ''}</div>` : ''}
  `, 'home');
}

function formatRainNumber(value: number): string {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 1 }).format(value);
}

function formatRainTime(value: string | null): string {
  if (!value) return 'ยังไม่พบเวลา';
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok'
  }).format(date);
}

function rainfallHomeHtml(snapshot: ChiangRaiRainSnapshot | null): string {
  if (!snapshot) return '<div class="rainfall-unavailable"><b>ยังอัปเดตสถานการณ์ฝนไม่ได้</b><span>กรุณาลองใหม่อีกครั้งในภายหลัง</span></div>';
  const top = snapshot.topStation;
  return `
    <div class="rainfall-card-head"><div><span class="eyebrow">สภาพภูมิอากาศ</span><h2>สถานการณ์ฝนเชียงราย</h2></div><button type="button" class="rain-detail-link" data-go="rainfall">ดูทั้งหมด <span>›</span></button></div>
    ${snapshot.isStale ? '<div class="rain-stale-note">กำลังแสดงข้อมูลล่าสุดที่บันทึกไว้</div>' : ''}
    <div class="rainfall-metrics"><div><small>สูงสุด 24 ชม.</small><b>${formatRainNumber(snapshot.summary.rainfall24hMax)} <em>มม.</em></b></div><div><small>สูงสุด 1 ชม.</small><b>${formatRainNumber(snapshot.summary.rainfall1hMax)} <em>มม.</em></b></div></div>
    <div class="rainfall-top-station"><span>สถานีฝนสูงสุด</span><b>${esc(top?.name || 'ยังไม่พบข้อมูล')}</b><small>${top ? `อ.${esc(top.district)} · ${formatRainNumber(top.rainfall24h)} มม. · ${formatRainTime(top.measuredAt)}` : 'ยังไม่มีสถานีรายงานข้อมูล'}</small></div>`;
}

function forecastHtml(period: RainForecast | null, tone: 'blue' | 'pink'): string {
  const title = period?.label || (tone === 'blue' ? 'สถานการณ์ฝน' : 'ฝนคาดการณ์');
  if (!period) return `<article class="rain-forecast-card ${tone}"><small>${title}</small><b>ยังไม่มีข้อมูลเชียงราย</b><span>Thaiwater ยังไม่ส่งข้อมูลชุดนี้สำหรับจังหวัดเชียงรายในรอบล่าสุด</span></article>`;
  const value = period.rainfallMm === null ? esc(period.level || 'มีข้อมูล') : `${formatRainNumber(period.rainfallMm)} มม.`;
  return `<article class="rain-forecast-card ${tone}"><small>${esc(title)}</small><b>${value}</b><span>${esc(period.level || 'ข้อมูลจาก Thaiwater')} · ${formatRainTime(period.measuredAt)}</span></article>`;
}

function rainfallPage(): string {
  return shell('<section class="rainfall-page" aria-live="polite"><div class="rainfall-page-loading"><span>💧</span><b>กำลังโหลดข้อมูลฝนเชียงราย...</b></div></section>', '', { title: 'สถานการณ์ฝนเชียงราย', back: true });
}

function rainfallPageHtml(snapshot: ChiangRaiRainSnapshot | null): string {
  if (!snapshot) return '<div class="rainfall-unavailable full"><b>ยังอัปเดตข้อมูลฝนเชียงรายไม่ได้</b><span>ระบบไม่สามารถเชื่อมต่อข้อมูลจาก Thaiwater ได้ในขณะนี้</span><button type="button" class="primary-button" data-go="home">กลับหน้าหลัก</button></div>';
  const stations = snapshot.stations.slice(0, 30);
  return `
    <section class="rainfall-detail-hero"><span class="eyebrow">THAIWATER · เชียงราย</span><h1>ฝนวันนี้</h1><p>มี ${snapshot.summary.wetStationCount} จาก ${snapshot.summary.stationCount} สถานีที่รายงานฝนสะสม</p><small>วัดล่าสุด ${formatRainTime(snapshot.sourceUpdatedAt)}</small></section>
    ${snapshot.isStale ? '<div class="rain-stale-note detail">กำลังแสดงข้อมูลล่าสุดที่บันทึกไว้ เนื่องจากยังอัปเดตข้อมูลต้นทางไม่ได้</div>' : ''}
    <section class="rainfall-detail-metrics"><article><small>ฝนสูงสุด 24 ชม.</small><b>${formatRainNumber(snapshot.summary.rainfall24hMax)} <em>มม.</em></b></article><article><small>ฝนสูงสุด 1 ชม.</small><b>${formatRainNumber(snapshot.summary.rainfall1hMax)} <em>มม.</em></b></article></section>
    <section class="rainfall-section"><div class="section-title"><h2>ฝนและการพยากรณ์</h2></div><div class="rain-forecast-grid">${forecastHtml(snapshot.recentRain, 'blue')}${forecastHtml(snapshot.forecastRain, 'pink')}</div></section>
    <section class="rainfall-section"><div class="section-title"><h2>สถานีฝนเชียงราย</h2><span class="rain-station-count">${snapshot.summary.stationCount} สถานี</span></div><p class="rainfall-section-copy">เรียงจากปริมาณฝนสะสม 24 ชั่วโมงมากไปน้อย</p><div class="rain-station-list">${stations.length ? stations.map((station, index) => `<article class="rain-station-row"><span class="rain-rank">${String(index + 1).padStart(2, '0')}</span><div><b>${esc(station.name)}</b><small>อ.${esc(station.district)} · ${formatRainTime(station.measuredAt)}</small></div><strong>${formatRainNumber(station.rainfall24h)}<small>มม.</small></strong></article>`).join('') : '<p class="rainfall-unavailable">ยังไม่มีสถานีฝนเชียงรายรายงานข้อมูลในรอบล่าสุด</p>'}</div></section>
    <p class="rainfall-source">ข้อมูลโดย Thaiwater · แสดงเฉพาะจังหวัดเชียงราย</p>`;
}

function servicesPage(): string {
  return shell(`
    <div class="page-heading"><h1>บริการ</h1></div>
    <label class="search-box"><span>⌕</span><input id="service-search" type="search" placeholder="ค้นหาบริการ..." /></label>
    <section class="list-section"><h3>บริการทั้งหมด</h3><div class="ios-list" id="service-list">
      ${services.map(item => `<button class="ios-list-item" data-service="${esc(item.slug)}" data-search="${esc(`${item.title} ${item.subtitle}`)}">${serviceIcon(item)}<span class="list-copy"><b>${esc(item.title)}</b><small>${esc(item.subtitle)}</small></span><span class="chevron">${icons.chevron}</span></button>`).join('')}
    </div></section>
  `, 'services');
}

function mapPage(): string {
  return shell(`
    <div class="map-page"><div id="map" class="map-canvas"></div>
      <button class="map-fab locate" id="locate-btn" aria-label="ไปยังตำแหน่งของฉัน">${icons.locate}</button>
    </div>
  `, 'map');
}

function managedLayerCardsHtml(): string {
  return managedLayers.length
    ? managedLayers.map(layer => `
      <article class="managed-layer-card" style="--layer-color:${esc(layer.color)}">
        <div class="managed-layer-head">
          <label class="layer-visibility">
            <input class="managed-layer-toggle" type="checkbox" value="${esc(layer.id)}" ${layer.visible ? 'checked' : ''}>
            <i aria-hidden="true"></i>
            <span class="layer-color" aria-hidden="true"></span>
            <span class="layer-title"><b>${esc(layer.name)}</b><small>${layer.markers.length} สถานที่</small></span>
          </label>
        </div>
        <div class="layer-actions">
          <button type="button" class="layer-action primary" data-add-marker="${esc(layer.id)}">${icons.pin}<span>เพิ่มสถานที่</span></button>
          <button type="button" class="layer-action" data-edit-layer="${esc(layer.id)}">${icons.edit}<span>แก้ไขชื่อ</span></button>
          <button type="button" class="layer-action danger" data-delete-layer="${esc(layer.id)}">${icons.trash}<span>ลบ</span></button>
        </div>
        ${layer.markers.length ? `<div class="layer-place-list">${layer.markers.map(marker => `
          <div class="layer-place-row">
            <button type="button" class="place-summary" data-focus-marker="${esc(layer.id)}:${esc(marker.id)}">
              <span class="place-dot" aria-hidden="true"></span>
              <span><b>${esc(marker.name)}</b><small>${marker.latitude.toFixed(5)}, ${marker.longitude.toFixed(5)}</small></span>
            </button>
            <button type="button" class="icon-action" data-edit-marker="${esc(layer.id)}:${esc(marker.id)}" aria-label="แก้ไข ${esc(marker.name)}">${icons.edit}</button>
            <button type="button" class="icon-action danger" data-delete-marker="${esc(layer.id)}:${esc(marker.id)}" aria-label="ลบ ${esc(marker.name)}">${icons.trash}</button>
          </div>`).join('')}</div>` : '<p class="layer-empty">ยังไม่มีสถานที่ในเลเยอร์นี้</p>'}
      </article>`).join('')
    : '<div class="map-empty-state"><b>ยังไม่มีเลเยอร์ส่วนตัว</b><span>สร้างเลเยอร์เพื่อเริ่มเพิ่มสถานที่ลงบนแผนที่</span></div>';
}

function adminMapSectionHtml(): string {
  if (!isAdminLoggedIn()) {
    return `
      <section class="settings-group"><h3>ผู้ดูแลระบบ</h3><div class="ios-list">
        <form id="admin-login-form" class="dialog-form" style="padding:14px">
          ${isAdminConfigured() ? '' : '<p class="form-helper">โหมดทดลอง: ยังไม่ได้ตั้งค่ารหัสผ่านผู้ดูแล (VITE_ADMIN_PASSWORD_HASH) กด "เข้าสู่ระบบ" เพื่อทดสอบได้ทันที</p>'}
          <label><span>รหัสผ่านผู้ดูแล</span><input id="admin-password" type="password" autocomplete="current-password" placeholder="กรอกรหัสผ่าน"></label>
          <div class="dialog-actions"><button type="submit" class="dialog-primary">เข้าสู่ระบบ</button></div>
        </form>
      </div></section>`;
  }
  return `
    <section class="settings-group"><h3>ผู้ดูแลระบบ</h3><div class="ios-list">
      <div class="ios-list-item"><span class="setting-icon blue">🛡️</span><span class="list-copy"><b>เข้าสู่ระบบผู้ดูแลแล้ว</b><small>จัดการเลเยอร์และหมุดบนแผนที่ได้</small></span></div>
      <button class="ios-list-item" id="admin-logout-btn"><span class="setting-icon gray">⎋</span><span class="list-copy"><b>ออกจากระบบผู้ดูแล</b></span></button>
    </div></section>
    <section class="settings-group"><h3>ตัวกรองข้อมูลคำร้องบนแผนที่</h3><div class="ios-list" style="padding:14px">
      <div class="system-layer-grid">
        ${ISSUE_FILTER_DEFS.map(([id, label]) => `<label class="system-layer-toggle"><input class="issue-filter" type="checkbox" value="${id}" ${issueFilters[id] ? 'checked' : ''}/><i></i><span>${label}</span></label>`).join('')}
      </div>
    </div></section>
    <section class="settings-group">
      <div class="subsection-title" style="margin:22px 14px 8px"><h3 style="margin:0">เลเยอร์ของฉันบนแผนที่</h3><button class="add-layer-button" id="add-layer-btn" type="button">${icons.plus}<span>เพิ่มเลเยอร์</span></button></div>
      ${managedLayerCardsHtml()}
    </section>`;
}

function openAppDialog(title: string, content: string): HTMLDialogElement {
  document.querySelector<HTMLDialogElement>('.app-dialog')?.close();
  const dialog = document.createElement('dialog');
  dialog.className = 'app-dialog';
  dialog.setAttribute('aria-label', title);
  dialog.innerHTML = `<div class="dialog-card"><div class="dialog-heading"><h2>${esc(title)}</h2><button type="button" data-close-dialog aria-label="ปิด">${icons.close}</button></div>${content}</div>`;
  document.body.append(dialog);
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.querySelector('[data-close-dialog]')?.addEventListener('click', () => dialog.close());
  dialog.showModal();
  requestAnimationFrame(() => dialog.querySelector<HTMLElement>('input, textarea, button')?.focus());
  return dialog;
}

function openLayerDialog(layerId?: string): void {
  const layer = managedLayers.find(item => item.id === layerId);
  const dialog = openAppDialog(layer ? 'แก้ไขเลเยอร์' : 'เพิ่มเลเยอร์', `
    <form id="layer-form" class="dialog-form">
      <label><span>ชื่อเลเยอร์ <b aria-hidden="true">*</b></span><input id="layer-name" name="name" required maxlength="60" value="${esc(layer?.name || '')}" autocomplete="off"></label>
      <label><span>สีของหมุด</span><input id="layer-color" class="color-input" name="color" type="color" value="${esc(layer?.color || '#2563eb')}"></label>
      <div class="dialog-actions"><button type="button" class="dialog-secondary" data-close-dialog-footer>ยกเลิก</button><button type="submit" class="dialog-primary">${layer ? 'บันทึกการแก้ไข' : 'สร้างเลเยอร์'}</button></div>
    </form>`);
  dialog.querySelector('[data-close-dialog-footer]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector<HTMLFormElement>('#layer-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const name = dialog.querySelector<HTMLInputElement>('#layer-name')?.value.trim() || '';
    const color = dialog.querySelector<HTMLInputElement>('#layer-color')?.value || '#2563eb';
    if (!name) return;
    if (layer) {
      layer.name = name;
      layer.color = color;
    } else {
      managedLayers.push({ id: makeId('layer'), name, color, visible: true, markers: [] });
    }
    saveManagedLayers();
    dialog.close();
    toast(layer ? 'แก้ไขเลเยอร์แล้ว' : 'สร้างเลเยอร์แล้ว');
    void render();
  });
}

function openMarkerDialog(layerId: string, markerId?: string): void {
  const layer = managedLayers.find(item => item.id === layerId);
  const marker = layer?.markers.find(item => item.id === markerId);
  if (!layer) return toast('ไม่พบเลเยอร์ที่เลือก');

  const dialog = openAppDialog(marker ? 'แก้ไขสถานที่' : 'เพิ่มสถานที่', `
    <form id="marker-form" class="dialog-form">
      <p class="dialog-context"><span class="layer-color" style="--layer-color:${esc(layer.color)}" aria-hidden="true"></span>เลเยอร์: <b>${esc(layer.name)}</b></p>
      <label><span>ชื่อสถานที่ <b aria-hidden="true">*</b></span><input id="marker-name" required maxlength="80" value="${esc(marker?.name || '')}" autocomplete="off"></label>
      <label><span>ข้อมูลเพิ่มเติม</span><textarea id="marker-info" maxlength="500" rows="3" placeholder="รายละเอียด เวลาเปิดทำการ หรือข้อมูลติดต่อ">${esc(marker?.info || '')}</textarea></label>
      <div class="coordinate-fields">
        <label><span>ละติจูด <b aria-hidden="true">*</b></span><input id="marker-latitude" type="number" inputmode="decimal" min="-90" max="90" step="any" required value="${marker ? marker.latitude : ''}" placeholder="19.9072"></label>
        <label><span>ลองจิจูด <b aria-hidden="true">*</b></span><input id="marker-longitude" type="number" inputmode="decimal" min="-180" max="180" step="any" required value="${marker ? marker.longitude : ''}" placeholder="99.8326"></label>
      </div>
      <div class="coordinate-tools"><button type="button" id="use-map-center">ใช้จุดกึ่งกลางแผนที่</button><button type="button" id="use-current-location">ใช้ตำแหน่งปัจจุบัน</button></div>
      <p class="form-helper" id="coordinate-status" aria-live="polite">กรอกพิกัดด้วยเลขทศนิยม เช่น 19.9072, 99.8326</p>
      <div class="dialog-actions"><button type="button" class="dialog-secondary" data-close-dialog-footer>ยกเลิก</button><button type="submit" class="dialog-primary">${marker ? 'บันทึกการแก้ไข' : 'เพิ่มหมุด'}</button></div>
    </form>`);

  const setCoordinates = (latitude: number, longitude: number, message: string) => {
    const latitudeInput = dialog.querySelector<HTMLInputElement>('#marker-latitude');
    const longitudeInput = dialog.querySelector<HTMLInputElement>('#marker-longitude');
    if (latitudeInput) latitudeInput.value = latitude.toFixed(6);
    if (longitudeInput) longitudeInput.value = longitude.toFixed(6);
    const status = dialog.querySelector('#coordinate-status');
    if (status) status.textContent = message;
  };

  dialog.querySelector('[data-close-dialog-footer]')?.addEventListener('click', () => dialog.close());
  dialog.querySelector('#use-map-center')?.addEventListener('click', () => {
    const center = leafletMap?.getCenter();
    if (center) setCoordinates(center.lat, center.lng, 'ใช้พิกัดจากจุดกึ่งกลางแผนที่แล้ว');
  });
  dialog.querySelector('#use-current-location')?.addEventListener('click', () => {
    const status = dialog.querySelector('#coordinate-status');
    if (!navigator.geolocation) {
      if (status) status.textContent = 'อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง';
      return;
    }
    if (status) status.textContent = 'กำลังค้นหาตำแหน่งปัจจุบัน...';
    navigator.geolocation.getCurrentPosition(
      position => setCoordinates(position.coords.latitude, position.coords.longitude, 'ใช้ตำแหน่งปัจจุบันแล้ว'),
      () => { if (status) status.textContent = 'ไม่สามารถอ่านตำแหน่งได้ กรุณาตรวจสอบสิทธิ์การเข้าถึง'; },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });
  dialog.querySelector<HTMLFormElement>('#marker-form')?.addEventListener('submit', event => {
    event.preventDefault();
    const name = dialog.querySelector<HTMLInputElement>('#marker-name')?.value.trim() || '';
    const info = dialog.querySelector<HTMLTextAreaElement>('#marker-info')?.value.trim() || '';
    const latitude = Number(dialog.querySelector<HTMLInputElement>('#marker-latitude')?.value);
    const longitude = Number(dialog.querySelector<HTMLInputElement>('#marker-longitude')?.value);
    if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return toast('กรุณากรอกชื่อและพิกัดให้ถูกต้อง');
    }
    if (marker) {
      Object.assign(marker, { name, info, latitude, longitude });
    } else {
      layer.markers.push({ id: makeId('marker'), name, info, latitude, longitude });
    }
    layer.visible = true;
    saveManagedLayers();
    dialog.close();
    toast(marker ? 'แก้ไขสถานที่แล้ว' : 'เพิ่มสถานที่บนแผนที่แล้ว');
    void render();
  });
}

function splitLayerMarkerKey(value: string): [string, string] {
  const separator = value.indexOf(':');
  return separator < 0 ? [value, ''] : [value.slice(0, separator), value.slice(separator + 1)];
}

function settingsPage(): string {
  return shell(`
    <div class="page-heading"><h1>ตั้งค่า</h1></div>
    <section class="settings-group"><h3>การแจ้งเตือน</h3><div class="ios-list">
      <label class="ios-list-item"><span class="setting-icon green">🔔</span><span class="list-copy"><b>เปิด/ปิดการแจ้งเตือน</b></span><input class="switch" id="notification-toggle" type="checkbox" checked><i></i></label>
      <button class="ios-list-item"><span class="setting-icon red">●</span><span class="list-copy"><b>ประเภทการแจ้งเตือน</b></span><span class="chevron">${icons.chevron}</span></button>
    </div></section>
    <section class="settings-group"><h3>การแสดงผล</h3><div class="ios-list">
      <label class="ios-list-item"><span class="setting-icon gray">🌙</span><span class="list-copy"><b>โหมดมืด</b></span><input class="switch" id="dark-toggle" type="checkbox"><i></i></label>
      <button class="ios-list-item"><span class="setting-icon blue">Aa</span><span class="list-copy"><b>ขนาดตัวอักษร</b></span><small>ปกติ</small><span class="chevron">${icons.chevron}</span></button>
    </div></section>
    <section class="settings-group"><h3>บัญชี</h3><div class="ios-list">
      <button class="ios-list-item"><span class="setting-icon blue">👤</span><span class="list-copy"><b>ข้อมูลส่วนตัว</b><small>${esc(profile.displayName)}</small></span><span class="chevron">${icons.chevron}</span></button>
      <button class="ios-list-item" id="share-btn"><span class="setting-icon cyan">↗</span><span class="list-copy"><b>แชร์แอป</b><small>${isInLineClient() ? 'ส่งให้เพื่อนใน LINE' : 'คัดลอกลิงก์'}</small></span><span class="chevron">${icons.chevron}</span></button>
    </div></section>
    <section class="settings-group"><h3>เกี่ยวกับ</h3><div class="ios-list">
      <button class="ios-list-item"><span class="list-copy"><b>เกี่ยวกับแอป</b></span><span class="chevron">${icons.chevron}</span></button>
      <button class="ios-list-item"><span class="list-copy"><b>นโยบายความเป็นส่วนตัว</b></span><span class="chevron">${icons.chevron}</span></button>
      <div class="ios-list-item"><span class="list-copy"><b>เวอร์ชัน</b></span><small>1.0.0</small></div>
    </div></section>
    ${adminMapSectionHtml()}
  `, 'settings');
}

const subtypeMap: Record<ComplaintCategory, string[]> = {
  streetlight: ['ไฟดับ', 'ไฟกระพริบ', 'ไฟสว่างตลอดวัน', 'โคมไฟชำรุด'],
  road: ['ถนนเป็นหลุม', 'ทางเท้าชำรุด', 'ฝาท่อชำรุด', 'ป้ายจราจรเสียหาย'],
  waste: ['ขยะตกค้าง', 'ถังขยะเต็ม', 'ทิ้งขยะไม่ถูกที่', 'ถังขยะชำรุด'],
  flood: ['น้ำท่วมขัง', 'ท่อระบายน้ำอุดตัน', 'น้ำเอ่อล้น', 'จุดเสี่ยงน้ำท่วม'],
  pm25: ['การเผาในที่โล่ง', 'ควันผิดปกติ', 'ฝุ่นจากก่อสร้าง', 'อื่น ๆ']
};

function reportPage(category: ComplaintCategory): string {
  if (!subtypeMap[category]) category = 'streetlight';
  reportDraft.category = category;
  const progress = (reportStep / 3) * 100;
  let body = '';
  if (reportStep === 1) {
    body = `<h3>ประเภทปัญหา</h3><div class="radio-card">${subtypeMap[category].map(value => `<label class="radio-row"><input type="radio" name="subtype" value="${esc(value)}" ${reportDraft.subtype === value ? 'checked' : ''}><i></i><span>${esc(value)}</span></label>`).join('')}</div>
      <h3>รายละเอียด</h3><label class="textarea-card"><textarea id="description" maxlength="500" placeholder="ระบุรายละเอียดของปัญหา...">${esc(reportDraft.description)}</textarea><small><span id="char-count">${reportDraft.description.length}</span>/500</small></label>`;
  } else if (reportStep === 2) {
    body = `<h3>ตำแหน่งที่เกิดปัญหา</h3><div class="location-card"><span>📍</span><div><b id="location-label">${reportDraft.latitude ? `${reportDraft.latitude.toFixed(6)}, ${reportDraft.longitude?.toFixed(6)}` : 'ยังไม่ได้ระบุตำแหน่ง'}</b><small>กดปุ่มเพื่อใช้ตำแหน่งปัจจุบัน</small></div></div><button class="secondary-button" id="get-location">ใช้ตำแหน่งปัจจุบัน</button>
      <h3>รูปภาพ (ถ้ามี)</h3><label class="photo-picker"><input id="photo-input" type="file" accept="image/*" capture="environment"><span>📷</span><b id="photo-label">${reportDraft.photo ? esc(reportDraft.photo.name) : 'เพิ่มรูปภาพ'}</b><small>รองรับ JPG, PNG และ HEIC</small></label>`;
  } else {
    body = `<h3>ตรวจสอบข้อมูล</h3><div class="summary-card"><div><span>ประเภท</span><b>${esc(categoryTitle(category))}</b></div><div><span>ลักษณะปัญหา</span><b>${esc(reportDraft.subtype)}</b></div><div><span>รายละเอียด</span><b>${esc(reportDraft.description || '-')}</b></div><div><span>ตำแหน่ง</span><b>${reportDraft.latitude ? `${reportDraft.latitude.toFixed(5)}, ${reportDraft.longitude?.toFixed(5)}` : 'ไม่ได้ระบุ'}</b></div><div><span>รูปภาพ</span><b>${reportDraft.photo ? esc(reportDraft.photo.name) : 'ไม่มี'}</b></div></div><label class="consent"><input id="consent" type="checkbox"><i></i><span>ยืนยันว่าข้อมูลถูกต้องและยินยอมให้เทศบาลใช้ข้อมูลเพื่อดำเนินการตามคำร้อง</span></label>`;
  }
  return shell(`
    <div class="progress-row"><div class="progress-track"><i style="width:${progress}%"></i></div><small>${reportStep}/3</small></div>
    <section class="report-content">${body}</section>
    <div class="report-actions">${reportStep > 1 ? '<button class="secondary-button" id="report-prev">ย้อนกลับ</button>' : ''}<button class="primary-button" id="report-next">${reportStep === 3 ? 'ส่งคำร้อง' : 'ถัดไป'}</button></div>
  `, '', { title: `แจ้ง${categoryTitle(category).replace('ปัญหา', 'ปัญหา')}`, back: true, noTabs: true });
}

function successPage(id: string, demo: boolean): string {
  return shell(`<section class="success-view"><div class="success-icon">✓</div><h1>ส่งคำร้องสำเร็จ</h1><p>เลขที่คำร้อง</p><strong>${esc(id)}</strong>${demo ? '<small>บันทึกใน localStorage เนื่องจากเป็นโหมดทดลอง</small>' : '<small>ระบบได้ส่งข้อมูลเข้าสู่ฐานข้อมูลแล้ว</small>'}<button class="primary-button" data-go="home">กลับหน้าหลัก</button></section>`, '', { title: 'สำเร็จ', noTabs: true });
}

async function render(): Promise<void> {
  leafletMap?.remove();
  leafletMap = null;
  const current = route();
  if (current === 'home') app.innerHTML = dashboard();
  else if (current === 'services') app.innerHTML = servicesPage();
  else if (current === 'map') app.innerHTML = mapPage();
  else if (current === 'rainfall') app.innerHTML = rainfallPage();
  else if (current === 'settings') app.innerHTML = settingsPage();
  else if (current.startsWith('report/')) app.innerHTML = reportPage((current.split('/')[1] || 'streetlight') as ComplaintCategory);
  else if (current.startsWith('success/')) app.innerHTML = successPage(decodeURIComponent(current.split('/')[1] || ''), current.endsWith('/demo'));
  else app.innerHTML = dashboard();
  bindEvents();
  if (current === 'map') await initMap();
  if (current === 'home') { void updateWeather(); void updateRainfallHome(); }
  if (current === 'rainfall') void updateRainfallDetail();
}

function bindEvents(): void {
  document.querySelectorAll<HTMLElement>('[data-go]').forEach(el => el.addEventListener('click', () => go(el.dataset.go || 'home')));
  document.querySelectorAll<HTMLElement>('[data-back]').forEach(el => el.addEventListener('click', () => history.length > 1 ? history.back() : go('home')));
  document.querySelectorAll<HTMLElement>('[data-service]').forEach(el => el.addEventListener('click', () => {
    const slug = el.dataset.service || '';
    if (['streetlight', 'road', 'waste', 'flood', 'pm25'].includes(slug)) {
      reportStep = 1;
      reportDraft = { category: slug as ComplaintCategory, subtype: subtypeMap[slug as ComplaintCategory][0] || '', description: '' };
      go(`report/${slug}`);
    } else toast('เมนูนี้เตรียมไว้สำหรับเชื่อมโมดูลในขั้นถัดไป');
  }));

  document.querySelector<HTMLInputElement>('#service-search')?.addEventListener('input', event => {
    const query = (event.target as HTMLInputElement).value.toLowerCase().trim();
    document.querySelectorAll<HTMLElement>('#service-list [data-search]').forEach(item => item.hidden = !(item.dataset.search || '').toLowerCase().includes(query));
  });

  const darkToggle = document.querySelector<HTMLInputElement>('#dark-toggle');
  if (darkToggle) {
    darkToggle.checked = localStorage.getItem('dark-mode') === 'true';
    darkToggle.addEventListener('change', () => {
      document.documentElement.classList.toggle('dark', darkToggle.checked);
      localStorage.setItem('dark-mode', String(darkToggle.checked));
    });
  }

  document.querySelector('#share-btn')?.addEventListener('click', async () => {
    try {
      if (await shareApp()) toast('เปิดหน้าต่างแชร์ LINE แล้ว');
      else {
        await navigator.clipboard.writeText(location.href);
        toast('คัดลอกลิงก์แล้ว');
      }
    } catch { toast('ไม่สามารถแชร์ได้ในขณะนี้'); }
  });

  document.querySelector<HTMLFormElement>('#admin-login-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = document.querySelector<HTMLInputElement>('#admin-password');
    const result = await loginAdmin(input?.value || '');
    if (!result.ok) return toast('รหัสผ่านไม่ถูกต้อง');
    toast(result.demo ? 'เข้าสู่ระบบผู้ดูแล (โหมดทดลอง) แล้ว' : 'เข้าสู่ระบบผู้ดูแลแล้ว');
    void render();
  });
  document.querySelector('#admin-logout-btn')?.addEventListener('click', () => {
    logoutAdmin();
    toast('ออกจากระบบผู้ดูแลแล้ว');
    void render();
  });

  document.querySelectorAll<HTMLInputElement>('.issue-filter').forEach(input => {
    input.addEventListener('change', () => {
      issueFilters[input.value] = input.checked;
      saveIssueFilters();
    });
  });
  document.querySelectorAll<HTMLInputElement>('.managed-layer-toggle').forEach(input => {
    input.addEventListener('change', () => {
      const layer = managedLayers.find(item => item.id === input.value);
      if (!layer) return;
      layer.visible = input.checked;
      saveManagedLayers();
    });
  });
  document.querySelector('#add-layer-btn')?.addEventListener('click', () => openLayerDialog());
  document.querySelectorAll<HTMLElement>('[data-edit-layer]').forEach(button => button.addEventListener('click', () => openLayerDialog(button.dataset.editLayer)));
  document.querySelectorAll<HTMLElement>('[data-add-marker]').forEach(button => button.addEventListener('click', () => {
    const layerId = button.dataset.addMarker;
    if (layerId) openMarkerDialog(layerId);
  }));
  document.querySelectorAll<HTMLElement>('[data-edit-marker]').forEach(button => button.addEventListener('click', () => {
    const [layerId, markerId] = splitLayerMarkerKey(button.dataset.editMarker || '');
    if (layerId && markerId) openMarkerDialog(layerId, markerId);
  }));
  document.querySelectorAll<HTMLElement>('[data-delete-layer]').forEach(button => button.addEventListener('click', () => {
    const layer = managedLayers.find(item => item.id === button.dataset.deleteLayer);
    if (!layer || !confirm(`ลบเลเยอร์ “${layer.name}” และสถานที่ ${layer.markers.length} รายการหรือไม่?`)) return;
    managedLayers = managedLayers.filter(item => item.id !== layer.id);
    saveManagedLayers();
    toast('ลบเลเยอร์แล้ว');
    void render();
  }));
  document.querySelectorAll<HTMLElement>('[data-delete-marker]').forEach(button => button.addEventListener('click', () => {
    const [layerId, markerId] = splitLayerMarkerKey(button.dataset.deleteMarker || '');
    const layer = managedLayers.find(item => item.id === layerId);
    const marker = layer?.markers.find(item => item.id === markerId);
    if (!layer || !marker || !confirm(`ลบสถานที่ “${marker.name}” หรือไม่?`)) return;
    layer.markers = layer.markers.filter(item => item.id !== markerId);
    saveManagedLayers();
    toast('ลบสถานที่แล้ว');
    void render();
  }));
  document.querySelectorAll<HTMLElement>('[data-focus-marker]').forEach(button => button.addEventListener('click', () => {
    const [layerId, markerId] = splitLayerMarkerKey(button.dataset.focusMarker || '');
    const marker = managedLayers.find(item => item.id === layerId)?.markers.find(item => item.id === markerId);
    if (!marker) return;
    pendingMapFocus = { latitude: marker.latitude, longitude: marker.longitude };
    go('map');
  }));

  const desc = document.querySelector<HTMLTextAreaElement>('#description');
  desc?.addEventListener('input', () => {
    reportDraft.description = desc.value;
    const count = document.querySelector('#char-count');
    if (count) count.textContent = String(desc.value.length);
  });
  document.querySelectorAll<HTMLInputElement>('input[name="subtype"]').forEach(input => input.addEventListener('change', () => reportDraft.subtype = input.value));
  document.querySelector('#get-location')?.addEventListener('click', getCurrentLocation);
  document.querySelector<HTMLInputElement>('#photo-input')?.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    reportDraft.photo = input.files?.[0];
    const label = document.querySelector('#photo-label');
    if (label) label.textContent = reportDraft.photo?.name || 'เพิ่มรูปภาพ';
  });
  document.querySelector('#report-prev')?.addEventListener('click', () => { reportStep -= 1; void render(); });
  document.querySelector('#report-next')?.addEventListener('click', handleReportNext);
}

async function handleReportNext(): Promise<void> {
  if (reportStep === 1) {
    const desc = document.querySelector<HTMLTextAreaElement>('#description');
    reportDraft.description = desc?.value.trim() || '';
    if (!reportDraft.subtype) return toast('กรุณาเลือกประเภทปัญหา');
    if (reportDraft.description.length < 5) return toast('กรุณาระบุรายละเอียดอย่างน้อย 5 ตัวอักษร');
    reportStep = 2;
    return void render();
  }
  if (reportStep === 2) {
    reportStep = 3;
    return void render();
  }
  const consent = document.querySelector<HTMLInputElement>('#consent');
  if (!consent?.checked) return toast('กรุณายืนยันความถูกต้องของข้อมูล');
  const button = document.querySelector<HTMLButtonElement>('#report-next');
  if (button) { button.disabled = true; button.textContent = 'กำลังส่ง...'; }
  try {
    const result = await createComplaint(reportDraft, profile);
    go(`success/${encodeURIComponent(result.id)}${result.demo ? '/demo' : ''}`);
  } catch (error) {
    console.error(error);
    toast('ส่งคำร้องไม่สำเร็จ กรุณาตรวจสอบ Supabase และลองใหม่');
    if (button) { button.disabled = false; button.textContent = 'ส่งคำร้อง'; }
  }
}

function getCurrentLocation(): void {
  if (!navigator.geolocation) return toast('อุปกรณ์ไม่รองรับการระบุตำแหน่ง');
  const label = document.querySelector('#location-label');
  if (label) label.textContent = 'กำลังค้นหาตำแหน่ง...';
  navigator.geolocation.getCurrentPosition(position => {
    reportDraft.latitude = position.coords.latitude;
    reportDraft.longitude = position.coords.longitude;
    if (label) label.textContent = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
  }, error => {
    console.error(error);
    if (label) label.textContent = 'ไม่สามารถระบุตำแหน่งได้';
    toast('กรุณาอนุญาตการเข้าถึงตำแหน่ง');
  }, { enableHighAccuracy: true, timeout: 12000 });
}

async function initMap(): Promise<void> {
  const container = document.querySelector<HTMLDivElement>('#map');
  if (!container) return;
  leafletMap = L.map(container, { zoomControl: false }).setView([appConfig.mapCenter.lat, appConfig.mapCenter.lng], appConfig.mapZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(leafletMap);
  L.control.zoom({ position: 'topright' }).addTo(leafletMap);
  const issues = await getMapIssues();
  const groups = new Map<string, any>();
  for (const issue of issues) {
    const group = groups.get(issue.category) ?? L.layerGroup().addTo(leafletMap);
    groups.set(issue.category, group);
    const icon = L.divIcon({ className: 'issue-marker-wrap', html: `<span class="issue-marker ${issue.category}"><i>${markerEmoji(issue.category)}</i></span>`, iconSize: [38, 38], iconAnchor: [19, 36] });
    L.marker([issue.latitude, issue.longitude], { icon }).bindPopup(`<b>${esc(issue.title)}</b><br>${esc(issue.status)}`).addTo(group);
  }
  // Category and personal-layer visibility are now controlled from the admin
  // section in Settings, so apply the currently saved state directly here.
  for (const [category, group] of groups) {
    if (!issueFilters[category]) leafletMap.removeLayer(group);
  }
  for (const layer of managedLayers) {
    const group = L.layerGroup();
    for (const marker of layer.markers) {
      const initial = Array.from(marker.name.trim())[0] || '•';
      const markerIcon = L.divIcon({
        className: 'managed-marker-wrap',
        html: `<span class="managed-marker" style="--marker-color:${esc(layer.color)}"><i>${esc(initial)}</i></span>`,
        iconSize: [40, 46],
        iconAnchor: [20, 44],
        popupAnchor: [0, -42]
      });
      const info = marker.info ? `<p>${esc(marker.info).replace(/\n/g, '<br>')}</p>` : '';
      L.marker([marker.latitude, marker.longitude], { icon: markerIcon })
        .bindPopup(`<div class="place-popup"><b>${esc(marker.name)}</b>${info}<small>${marker.latitude.toFixed(6)}, ${marker.longitude.toFixed(6)}</small></div>`)
        .addTo(group);
    }
    if (layer.visible) group.addTo(leafletMap);
  }
  if (pendingMapFocus) {
    leafletMap.setView([pendingMapFocus.latitude, pendingMapFocus.longitude], Math.max(leafletMap.getZoom(), 17));
    pendingMapFocus = null;
  }
  document.querySelector('#locate-btn')?.addEventListener('click', () => {
    leafletMap?.locate({ setView: true, maxZoom: 17 });
    leafletMap?.once('locationfound', (event: any) => L.circleMarker(event.latlng, { radius: 8 }).addTo(leafletMap!).bindPopup('ตำแหน่งของคุณ').openPopup());
    leafletMap?.once('locationerror', () => toast('ไม่สามารถระบุตำแหน่งได้'));
  });
}

function markerEmoji(category: string): string {
  return ({ streetlight: '💡', road: '!', waste: '♻', flood: '≋', pm25: '☁' } as Record<string, string>)[category] || '•';
}

async function updateWeather(): Promise<void> {
  const weather = await getChiangRaiWeather();
  if (!weather || route() !== 'home') return;
  const set = (id: string, value: string) => {
    const el = document.querySelector(`#${id}`);
    if (el) el.textContent = value;
  };
  set('weather-icon', weather.icon);
  set('weather-temp', `${weather.temperature}°`);
  set('weather-desc', weather.description);
  set('weather-range', `↑ ${weather.high}° ↓ ${weather.low}°`);
  set('weather-humidity', `ความชื้น ${weather.humidity}%`);
  set('weather-rain', `ฝน ${weather.rainChance}%`);
}

async function updateRainfallHome(): Promise<void> {
  const card = document.querySelector<HTMLElement>('#rainfall-home-card');
  const snapshot = await getChiangRaiRain();
  if (!card || route() !== 'home') return;
  rainfallSnapshot = snapshot;
  card.innerHTML = rainfallHomeHtml(snapshot);
  bindEvents();
}

async function updateRainfallDetail(): Promise<void> {
  const page = document.querySelector<HTMLElement>('.rainfall-page');
  const snapshot = rainfallSnapshot || await getChiangRaiRain();
  if (!page || route() !== 'rainfall') return;
  rainfallSnapshot = snapshot;
  page.innerHTML = rainfallPageHtml(snapshot);
  bindEvents();
}

function toast(message: string): void {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); }, 2400);
}

async function start(): Promise<void> {
  document.documentElement.classList.toggle('dark', localStorage.getItem('dark-mode') === 'true');
  app.innerHTML = '<div class="loading"><span class="spinner"></span><p>กำลังเปิดบริการเทศบาล...</p></div>';
  profile = await initLine();
  try {
    [services, news] = await Promise.all([getServices(), getNews()]);
  } catch (error) {
    console.error(error);
    services = [];
    news = [];
    toast('เชื่อม Supabase ไม่สำเร็จ กรุณาตรวจสอบตารางและ RLS');
  }
  window.addEventListener('hashchange', () => void render());
  await render();
}

void start();
