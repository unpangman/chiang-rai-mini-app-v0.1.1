export type PerformanceMetric = {
  key: string;
  label: string;
  value: number | null;
  target: number;
};

const SESSION_KEY = 'chiang-rai-performance-v1';
const startedAt = performance.now();

const defaults: PerformanceMetric[] = [
  { key: 'appStart', label: 'App Start', value: 0, target: 500 },
  { key: 'firstRender', label: 'First Render', value: null, target: 500 },
  { key: 'hydration', label: 'LIFF + Supabase', value: null, target: 2000 },
  { key: 'weather', label: 'Weather', value: null, target: 4000 },
  { key: 'leaflet', label: 'Leaflet', value: null, target: 2500 },
  { key: 'mapReady', label: 'Map Ready', value: null, target: 3000 }
];

function read(): PerformanceMetric[] {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (Array.isArray(saved)) return saved as PerformanceMetric[];
  } catch {
    // Ignore invalid session data.
  }
  return defaults.map(item => ({ ...item }));
}

let metrics = read();

function persist(): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(metrics));
  } catch {
    // Performance metrics are non-critical diagnostics.
  }
}

export function mark(key: string): number {
  const value = Math.round(performance.now() - startedAt);
  const item = metrics.find(metric => metric.key === key);
  if (item) item.value = value;
  persist();
  return value;
}

export function reset(): void {
  metrics = defaults.map(item => ({ ...item }));
  persist();
}

export function getMetrics(): PerformanceMetric[] {
  return metrics.map(item => ({ ...item }));
}

export function getAppStartedAt(): number {
  return startedAt;
}
