import './styles.css';
import { appConfig } from './config';
import { initLine, isInLineClient, shareApp } from './services/liff';
import { isSupabaseConfigured } from './services/supabase';
import { categoryTitle, createComplaint, getMapIssues, getNews, getServices } from './services/repository';
import { getChiangRaiWeather } from './services/weather';
import type { ComplaintCategory, ComplaintDraft, NewsItem, ServiceItem, UserProfile } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;

let profile: UserProfile;
let services: ServiceItem[] = [];
let news: NewsItem[] = [];
let leafletMap: any = null;
let reportDraft: ComplaintDraft = { category: 'streetlight', subtype: 'ไฟดับ', description: '' };
let reportStep = 1;

const icons: Record<string, string> = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 10.8 12 3l9 7.8v9.4a.8.8 0 0 1-.8.8h-5.4v-6.5H9.2V21H3.8a.8.8 0 0 1-.8-.8z"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="m19 13.5 2 1.2-2 3.5-2.1-.8a8 8 0 0 1-2.4 1.4l-.3 2.2h-4l-.3-2.2a8 8 0 0 1-2.4-1.4l-2.1.8-2-3.5 2-1.2a8 8 0 0 1 0-3l-2-1.2 2-3.5 2.1.8a8 8 0 0 1 2.4-1.4L10.2 3h4l.3 2.2a8 8 0 0 1 2.4 1.4l2.1-.8 2 3.5-2 1.2a8 8 0 0 1 0 3Z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7"/></svg>'
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
  const items = [
    ['home', 'หน้าหลัก', icons.home],
    ['services', 'บริการ', icons.grid],
    ['map', 'แผนที่', icons.map],
    ['settings', 'ตั้งค่า', icons.gear]
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
        <img class="avatar" src="${esc(profile.pictureUrl || '')}" alt="รูปโปรไฟล์" />
        <div><h1>สวัสดี, ${esc(profile.displayName)}</h1><p>${appConfig.cityName}</p></div>
        <button class="circle-button" aria-label="การแจ้งเตือน">🔔<span class="badge">3</span></button>
      </div>
      <article class="hero-card">
        <div class="hero-overlay"><span>เทศบาลนครเชียงราย</span><small>เมืองน่าอยู่ สิ่งแวดล้อมดี ชีวิตมีคุณภาพ</small></div>
      </article>
      <article class="weather-card glass">
        <div class="weather-main"><span class="weather-icon" id="weather-icon">🌤️</span><strong id="weather-temp">--°</strong><small id="weather-desc">กำลังโหลด...</small></div>
        <div class="weather-detail"><b>เชียงราย</b><span id="weather-range">↑ --° ↓ --°</span><span id="weather-humidity">ความชื้น --%</span></div>
        <div class="rain"><span>💧</span><small id="weather-rain">ฝน --%</small></div>
      </article>
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
      <button class="map-fab layers" aria-label="ชั้นข้อมูล">☰</button>
      <button class="map-fab locate" id="locate-btn" aria-label="ตำแหน่งของฉัน">➤</button>
      <section class="map-sheet glass"><span class="sheet-handle"></span><h3>ชั้นข้อมูล</h3>
        ${[['streetlight','💡','ไฟสาธารณะ',true],['road','🛣️','ถนนชำรุด',true],['waste','🗑️','จุดทิ้งขยะ',true],['flood','💧','จุดเสี่ยงน้ำท่วม',false]].map(([id, icon, label, checked]) => `<label class="toggle-row"><span>${icon} ${label}</span><input class="issue-filter" type="checkbox" value="${id}" ${checked ? 'checked' : ''}/><i></i></label>`).join('')}
      </section>
    </div>
  `, 'map');
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
  else if (current === 'settings') app.innerHTML = settingsPage();
  else if (current.startsWith('report/')) app.innerHTML = reportPage((current.split('/')[1] || 'streetlight') as ComplaintCategory);
  else if (current.startsWith('success/')) app.innerHTML = successPage(decodeURIComponent(current.split('/')[1] || ''), current.endsWith('/demo'));
  else app.innerHTML = dashboard();
  bindEvents();
  if (current === 'map') await initMap();
  if (current === 'home') void updateWeather();
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
  document.querySelectorAll<HTMLInputElement>('.issue-filter').forEach(input => {
    const apply = () => {
      const group = groups.get(input.value);
      if (!group || !leafletMap) return;
      if (input.checked) group.addTo(leafletMap); else leafletMap.removeLayer(group);
    };
    input.addEventListener('change', apply);
    apply();
  });
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
