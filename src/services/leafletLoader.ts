import type * as Leaflet from 'leaflet';

let pending: Promise<void> | null = null;

export async function loadLeaflet(): Promise<void> {
  if (window.L) return;
  if (!pending) {
    pending = Promise.all([
      import('leaflet'),
      import('leaflet/dist/leaflet.css')
    ]).then(([module]) => {
      const leafletModule = module as typeof import('leaflet');
      const instance = leafletModule.default as typeof Leaflet;
      if (!instance) throw new Error('Leaflet module did not load');
      window.L = instance;
    }).finally(() => {
      pending = null;
    });
  }
  await pending;
}
