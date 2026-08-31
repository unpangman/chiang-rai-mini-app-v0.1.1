let pending: Promise<void> | null = null;

export async function loadLeaflet(): Promise<void> {
  if (window.L) return;
  if (!pending) {
    pending = (async () => {
      await import('leaflet/dist/leaflet.css');
      const module = await import('leaflet');
      const leaflet = module as unknown as typeof import('leaflet');
      if (!leaflet || typeof leaflet.map !== 'function') {
        throw new Error('Leaflet module did not load');
      }
      window.L = leaflet;
    })().finally(() => {
      pending = null;
    });
  }
  await pending;
}
