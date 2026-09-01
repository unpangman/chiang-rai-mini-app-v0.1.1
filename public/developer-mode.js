(function () {
  'use strict';

  const STORAGE_KEY = 'chiang-rai-developer-mode-v1';
  const PANEL_ID = 'developer-mode-panel';
  const SECTION_ID = 'developer-mode-section';
  const state = {
    enabled: readEnabled(),
    mapReadyAt: null,
    errorCount: 0,
    rejectionCount: 0
  };

  function readEnabled() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch (_) {
      return false;
    }
  }

  function setEnabled(value) {
    state.enabled = Boolean(value);
    try {
      localStorage.setItem(STORAGE_KEY, String(state.enabled));
    } catch (_) {
      // Ignore storage failures; the current session still works.
    }
    renderPanel();
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char;
    });
  }

  function ms(value) {
    if (!Number.isFinite(value) || value < 0) return '—';
    if (value < 1000) return value.toFixed(0) + ' ms';
    return (value / 1000).toFixed(2) + ' s';
  }

  function durationFromEntries(matcher) {
    if (!performance || !performance.getEntriesByType) return null;
    const entries = performance.getEntriesByType('resource').filter(function (entry) {
      return matcher(entry.name);
    });
    if (!entries.length) return null;
    entries.sort(function (a, b) { return b.startTime - a.startTime; });
    return entries[0].duration;
  }

  function latestEntries(matchers, limit) {
    if (!performance || !performance.getEntriesByType) return [];
    const entries = performance.getEntriesByType('resource').filter(function (entry) {
      return matchers.some(function (matcher) { return matcher(entry); });
    });
    entries.sort(function (a, b) { return b.startTime - a.startTime; });
    return entries.slice(0, limit);
  }

  function resourceKind(entry) {
    const name = entry.name || '';
    if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') return 'API';
    if (/leaflet/i.test(name)) return 'Leaflet';
    if (/supabase/i.test(name)) return 'Supabase';
    if (/liff/i.test(name)) return 'LIFF';
    return entry.initiatorType || 'Resource';
  }

  function shortUrl(url) {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname || parsed.hostname;
      return parsed.hostname + path;
    } catch (_) {
      return url;
    }
  }

  function findMapReady() {
    if (state.mapReadyAt != null) return;
    const map = document.querySelector('.leaflet-container');
    if (map) state.mapReadyAt = performance.now();
  }

  function navMetrics() {
    const navigation = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
    const dom = navigation && navigation.domContentLoadedEventEnd > 0 ? navigation.domContentLoadedEventEnd : null;
    const load = navigation && navigation.loadEventEnd > 0 ? navigation.loadEventEnd : null;
    return {
      domReady: dom,
      load: load
    };
  }

  function metricRow(label, value, detail) {
    return '<div class="dev-metric-row"><span>' + esc(label) + '</span><strong>' + esc(value) + '</strong>' + (detail ? '<small>' + esc(detail) + '</small>' : '') + '</div>';
  }

  function renderPanel() {
    const section = document.getElementById(SECTION_ID);
    const panel = document.getElementById(PANEL_ID);
    const toggle = document.getElementById('developer-mode-toggle');
    if (!section || !panel) return;
    if (toggle) toggle.checked = state.enabled;
    panel.hidden = !state.enabled;
    if (!state.enabled) return;

    findMapReady();
    const nav = navMetrics();
    const leafletJs = durationFromEntries(function (name) { return /leaflet(?:\.min)?\.js/i.test(name); });
    const leafletCss = durationFromEntries(function (name) { return /leaflet(?:\.min)?\.css/i.test(name); });
    const liff = durationFromEntries(function (name) { return /liff/i.test(name) && /\.js(?:\?|$)/i.test(name); });
    const supabaseSdk = durationFromEntries(function (name) { return /supabase/i.test(name) && /\.js(?:\?|$)/i.test(name); });

    const apiEntries = latestEntries([
      function (entry) { return entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest'; },
      function (entry) { return /supabase\.co|open-meteo\.com/i.test(entry.name); }
    ], 5);

    const apiHtml = apiEntries.length
      ? apiEntries.map(function (entry) {
          return '<div class="dev-api-row"><span><b>' + esc(resourceKind(entry)) + '</b><small>' + esc(shortUrl(entry.name)) + '</small></span><strong>' + esc(ms(entry.duration)) + '</strong></div>';
        }).join('')
      : '<div class="dev-empty">ยังไม่พบรายการเรียก API จาก Performance API</div>';

    panel.innerHTML = [
      '<div class="dev-panel-heading"><div><b>Developer Mode</b><small>ข้อมูลประสิทธิภาพจากเบราว์เซอร์ของเครื่องนี้</small></div><button type="button" id="developer-refresh">รีเฟรช</button></div>',
      '<div class="dev-metric-grid">',
      metricRow('Leaflet JS', ms(leafletJs), leafletJs == null ? 'ยังไม่พบ resource' : 'เวลาโหลดไฟล์ JS'),
      metricRow('Leaflet CSS', ms(leafletCss), leafletCss == null ? 'ยังไม่พบ resource' : 'เวลาโหลดไฟล์ CSS'),
      metricRow('Leaflet Map init', ms(state.mapReadyAt != null ? state.mapReadyAt : null), state.mapReadyAt != null ? 'เวลาตั้งแต่ navigation start ถึงพบ .leaflet-container' : 'เปิดหน้าแผนที่เพื่อเก็บค่า'),
      metricRow('LIFF SDK', ms(liff), liff == null ? 'ยังไม่พบ resource' : 'เวลาโหลด LIFF SDK'),
      metricRow('Supabase SDK', ms(supabaseSdk), supabaseSdk == null ? 'ยังไม่พบ resource' : 'เวลาโหลด Supabase SDK'),
      metricRow('DOM ready', ms(nav.domReady), 'หน้าเว็บพร้อมสร้าง DOM'),
      metricRow('Page load', ms(nav.load), 'เหตุการณ์ load ของหน้า'),
      metricRow('Errors', String(state.errorCount), 'window.error'),
      metricRow('Unhandled rejection', String(state.rejectionCount), 'promise ที่ไม่ถูกจัดการ'),
      '</div>',
      '<div class="dev-api-heading">API / Network ล่าสุด</div>',
      '<div class="dev-api-list">' + apiHtml + '</div>',
      '<div class="dev-footnote">ค่าทั้งหมดเป็น client-side timing และเก็บเฉพาะสถานะ Developer Mode ไว้ใน localStorage</div>'
    ].join('');

    document.getElementById('developer-refresh')?.addEventListener('click', renderPanel);
  }

  function ensureSettingsUI() {
    const heading = Array.from(document.querySelectorAll('.page-heading h1')).find(function (element) {
      return element.textContent && element.textContent.trim() === 'ตั้งค่า';
    });
    if (!heading) return;

    let created = false;
    if (!document.getElementById(SECTION_ID)) {
      created = true;
      const section = document.createElement('section');
      section.id = SECTION_ID;
      section.className = 'settings-group';
      section.innerHTML = [
        '<h3>สำหรับนักพัฒนา</h3>',
        '<div class="ios-list">',
        '<label class="ios-list-item developer-mode-toggle-row">',
        '<span class="setting-icon blue">🛠️</span>',
        '<span class="list-copy"><b>โหมดนักพัฒนา</b><small>แสดงเวลาโหลด Leaflet, API, LIFF และ Network</small></span>',
        '<input class="switch" id="developer-mode-toggle" type="checkbox">',
        '<i></i>',
        '</label>',
        '<div class="developer-mode-panel" id="developer-mode-panel" hidden></div>',
        '</div>'
      ].join('');

      const aboutSection = Array.from(document.querySelectorAll('.settings-group')).find(function (item) {
        const title = item.querySelector('h3');
        return title && /เกี่ยวกับ/.test(title.textContent || '');
      });
      const adminSection = Array.from(document.querySelectorAll('.settings-group')).find(function (item) {
        const title = item.querySelector('h3');
        return title && /ผู้ดูแลระบบ/.test(title.textContent || '');
      });

      if (adminSection && adminSection.parentNode) {
        adminSection.parentNode.insertBefore(section, adminSection);
      } else if (aboutSection && aboutSection.parentNode) {
        aboutSection.parentNode.insertBefore(section, aboutSection);
      } else {
        heading.closest('.page')?.appendChild(section);
      }

      const toggle = section.querySelector('#developer-mode-toggle');
      toggle?.addEventListener('change', function (event) {
        setEnabled(event.target.checked);
      });
    }

    if (created) renderPanel();
  }

  window.addEventListener('error', function () {
    state.errorCount += 1;
    if (state.enabled) renderPanel();
  });

  window.addEventListener('unhandledrejection', function () {
    state.rejectionCount += 1;
    if (state.enabled) renderPanel();
  });

  const observer = new MutationObserver(function () {
    ensureSettingsUI();
    findMapReady();
  });

  function start() {
    const app = document.getElementById('app');
    if (!app) return;
    observer.observe(app, { childList: true, subtree: true });
    ensureSettingsUI();
    findMapReady();
    window.addEventListener('hashchange', ensureSettingsUI);
    setInterval(function () {
      if (state.enabled) renderPanel();
      findMapReady();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
