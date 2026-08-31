type LeafletWindow = Window & { L?: any };

const JS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

let pending: Promise<void> | null = null;

function loadCss(): Promise<void> {
  if (document.querySelector('link[data-leaflet-lazy="true"]')) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    link.dataset.leafletLazy = 'true';
    link.onload = () => resolve();
    link.onerror = () => reject(new Error('Leaflet CSS failed to load'));
    document.head.appendChild(link);
  });
}

function loadJs(): Promise<void> {
  const win = window as LeafletWindow;
  if (win.L) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = JS_URL;
    script.async = true;
    script.dataset.leafletLazy = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Leaflet JS failed to load'));
    document.head.appendChild(script);
  });
}

export async function loadLeaflet(): Promise<void> {
  const win = window as LeafletWindow;
  if (win.L) return;
  if (!pending) {
    pending = Promise.all([loadCss(), loadJs()]).then(() => {
      if (!win.L) throw new Error('Leaflet loaded without global L');
    }).finally(() => {
      pending = null;
    });
  }
  await pending;
}
