export type MetricKey = 'appStart' | 'firstRender' | 'liffReady' | 'hydration' | 'weather' | 'leaflet' | 'mapReady';

export type Metric = { key: MetricKey; label: string; target: number; value: number | null };

const startedAt = performance.now();
const values = new Map<MetricKey, number>();

const definitions: Array<Omit<Metric, 'value'>> = [
  { key: 'appStart', label: 'App Start', target: 500 },
  { key: 'firstRender', label: 'First Render', target: 500 },
  { key: 'liffReady', label: 'LIFF Ready', target: 1500 },
  { key: 'hydration', label: 'Data Hydrated', target: 2000 },
  { key: 'weather', label: 'Weather Ready', target: 3500 },
  { key: 'leaflet', label: 'Leaflet Loaded', target: 2500 },
  { key: 'mapReady', label: 'Map Ready', target: 3500 }
];

export function mark(key: MetricKey): void {
  if (!values.has(key)) values.set(key, Math.round(performance.now() - startedAt));
}

export function getMetrics(): Metric[] {
  return definitions.map(def => ({ ...def, value: values.get(def.key) ?? null }));
}

export function reset(): void {
  values.clear();
}

mark('appStart');
