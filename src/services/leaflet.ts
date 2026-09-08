import { loadScript, loadStylesheet } from './assetLoader';

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

export async function loadLeaflet(): Promise<void> {
  await Promise.all([
    loadStylesheet(LEAFLET_CSS),
    loadScript(LEAFLET_JS, () => typeof L !== 'undefined')
  ]);
}
