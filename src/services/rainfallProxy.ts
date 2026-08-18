const THAIWATER_BASE_URL = 'https://api-v3.thaiwater.net/api/v1/thaiwater30/public';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_STALE_MS = 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;

type RecordValue = Record<string, unknown>;

type SourceResult = {
  ok: boolean;
  error?: string;
};

export type RainStation = {
  id: string;
  name: string;
  district: string;
  rainfall24h: number;
  rainfall1h: number;
  measuredAt: string;
};

export type RainForecast = {
  label: string;
  level: string | null;
  rainfallMm: number | null;
  measuredAt: string | null;
};

export type ChiangRaiRainSnapshot = {
  provinceName: 'เชียงราย';
  fetchedAt: string;
  sourceUpdatedAt: string | null;
  isStale: boolean;
  degraded?: boolean;
  sources?: {
    rainfall: SourceResult;
    forecast: SourceResult;
  };
  summary: {
    stationCount: number;
    wetStationCount: number;
    rainfall24hMax: number;
    rainfall1hMax: number;
  };
  topStation: RainStation | null;
  stations: RainStation[];
  recentRain: RainForecast | null;
  forecastRain: RainForecast | null;
};

type CachedSnapshot = {
  value: Omit<ChiangRaiRainSnapshot, 'isStale'>;
  fetchedAtMs: number;
};

let cache: CachedSnapshot | null = null;
let pendingRequest: Promise<Omit<ChiangRaiRainSnapshot, 'isStale'>> | null = null;

function asRecord(value: unknown): RecordValue | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as RecordValue
    : null;
}

function at(record: RecordValue | null, path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    const container = asRecord(current);
    if (!container) return undefined;
    current = container[key];
  }
  return current;
}

function text(record: RecordValue | null, path: string[]): string | null {
  const value = at(record, path);
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function number(record: RecordValue | null, path: string[]): number {
  const value = at(record, path);
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(record: RecordValue | null, path: string[]): number | null {
  const value = at(record, path);
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isChiangRai(record: RecordValue): boolean {
  const provinceCode = text(record, ['geocode', 'province_code']) ?? text(record, ['province_code']);
  const provinceName = text(record, ['geocode', 'province_name', 'th'])
    ?? text(record, ['province_name', 'th'])
    ?? text(record, ['province_name']);

  return provinceCode === '57' || provinceName === 'เชียงราย' || provinceName === 'Chiang Rai';
}

function randomId(): string {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID();
  return `rain-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeArray(value: unknown): RecordValue[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is RecordValue => item !== null)
    : [];
}

function rainEntries(payload: unknown): RecordValue[] {
  const root = asRecord(payload);
  if (!root) return [];

  // Legacy ThaiWater30 response.
  const legacy = normalizeArray(root.data);
  if (legacy.length) return legacy;

  // Standard ThaiWater response: timeSeriesObservation[].
  const observations = normalizeArray(root.timeSeriesObservation);
  const flattened: RecordValue[] = [];

  for (const observation of observations) {
    const measurementResults = normalizeArray(observation.measurementResults);
    const resultTime = text(observation, ['resultTime']) ?? '';

    const stationCode = text(observation, ['station', 'stationCode']);
    const stationName = text(observation, ['station', 'stationName']) ?? stationCode;
    const provinceCode = text(observation, ['geocode', 'province_code']);
    const provinceName = text(observation, ['geocode', 'province_name', 'th']);

    if (measurementResults.length) {
      for (const measurement of measurementResults) {
        flattened.push({
          id: stationCode ?? randomId(),
          rain_24h: number(measurement, ['value']),
          rain_1h: number(measurement, ['value']),
          rainfall_datetime: text(measurement, ['measureTime']) ?? resultTime,
          geocode: {
            province_code: provinceCode,
            province_name: { th: provinceName },
          },
          station: {
            tele_station_oldcode: stationCode,
            tele_station_name: { th: stationName },
          },
        });
      }
    }
  }

  return flattened;
}

function thailandEntries(payload: unknown, section: string): RecordValue[] {
  const root = asRecord(payload);
  const sectionBox = asRecord(root?.[section]);
  const dataBox = asRecord(sectionBox?.data);
  const data = dataBox?.data;
  return normalizeArray(data);
}

export function toChiangRaiStations(payload: unknown): RainStation[] {
  const mapped = rainEntries(payload)
    .filter(isChiangRai)
    .map((item) => ({
      id: text(item, ['id']) ?? text(item, ['station', 'tele_station_oldcode']) ?? randomId(),
      name: text(item, ['station', 'tele_station_name', 'th'])
        ?? text(item, ['station', 'stationName'])
        ?? text(item, ['station', 'tele_station_oldcode'])
        ?? 'ไม่ระบุชื่อสถานี',
      district: text(item, ['geocode', 'amphoe_name', 'th']) ?? 'ไม่ระบุอำเภอ',
      rainfall24h: number(item, ['rain_24h']),
      rainfall1h: number(item, ['rain_1h']),
      measuredAt: text(item, ['rainfall_datetime']) ?? '',
    }));

  // If the provider only sends a 15/30/60-minute observation, de-duplicate by station.
  const byStation = new Map<string, RainStation>();
  for (const station of mapped) {
    const current = byStation.get(station.id);
    if (!current || station.measuredAt > current.measuredAt) {
      byStation.set(station.id, station);
    }
  }

  return [...byStation.values()].sort(
    (left, right) => right.rainfall24h - left.rainfall24h || right.rainfall1h - left.rainfall1h,
  );
}

function toForecast(value: RecordValue | undefined, label: string): RainForecast | null {
  if (!value) return null;
  const level = text(value, ['rainforecast_level']);
  return {
    label,
    level: level ? `ระดับ ${level}` : null,
    rainfallMm: optionalNumber(value, ['rainforecast_value']),
    measuredAt: text(value, ['rainforecast_datetime']) ?? text(value, ['rainfall_datetime']),
  };
}

export function toChiangRaiForecasts(payload: unknown): Pick<ChiangRaiRainSnapshot, 'recentRain' | 'forecastRain'> {
  return {
    recentRain: toForecast(thailandEntries(payload, 'pre_rain').find(isChiangRai), 'สถานการณ์ฝน'),
    forecastRain: toForecast(thailandEntries(payload, 'pre_rain_forecast').find(isChiangRai), 'ฝนคาดการณ์'),
  };
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ChiangRai-Municipality-LINE-MiniApp/1.0',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Thaiwater ตอบกลับ HTTP ${response.status} (${url})`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function loadSnapshot(): Promise<Omit<ChiangRaiRainSnapshot, 'isStale'>> {
  const results = await Promise.allSettled([
    getJson(`${THAIWATER_BASE_URL}/rain_24h`),
    getJson(`${THAIWATER_BASE_URL}/thailand`),
  ]);

  const rainResult = results[0];
  const forecastResult = results[1];

  let stations: RainStation[] = [];
  let forecasts: Pick<ChiangRaiRainSnapshot, 'recentRain' | 'forecastRain'> = {
    recentRain: null,
    forecastRain: null,
  };

  const rainSource: SourceResult = rainResult.status === 'fulfilled'
    ? { ok: true }
    : { ok: false, error: rainResult.reason instanceof Error ? rainResult.reason.message : String(rainResult.reason) };

  const forecastSource: SourceResult = forecastResult.status === 'fulfilled'
    ? { ok: true }
    : { ok: false, error: forecastResult.reason instanceof Error ? forecastResult.reason.message : String(forecastResult.reason) };

  if (rainResult.status === 'fulfilled') {
    stations = toChiangRaiStations(rainResult.value);
  }

  if (forecastResult.status === 'fulfilled') {
    forecasts = toChiangRaiForecasts(forecastResult.value);
  }

  // Forecast is optional. Rainfall data should still be shown when forecast fails.
  if (rainResult.status === 'rejected') {
    throw new Error(rainSource.error ?? 'ไม่สามารถเรียกข้อมูลฝนได้');
  }

  const times = [
    ...stations.map((station) => station.measuredAt),
    forecasts.recentRain?.measuredAt ?? '',
    forecasts.forecastRain?.measuredAt ?? '',
  ].filter(Boolean).sort();

  return {
    provinceName: 'เชียงราย',
    fetchedAt: new Date().toISOString(),
    sourceUpdatedAt: times.length ? times[times.length - 1] : null,
    degraded: !forecastSource.ok,
    sources: {
      rainfall: rainSource,
      forecast: forecastSource,
    },
    summary: {
      stationCount: stations.length,
      wetStationCount: stations.filter((station) => station.rainfall24h > 0).length,
      rainfall24hMax: stations[0]?.rainfall24h ?? 0,
      rainfall1hMax: Math.max(0, ...stations.map((station) => station.rainfall1h)),
    },
    topStation: stations[0] ?? null,
    stations,
    ...forecasts,
  };
}

function withCacheState(entry: CachedSnapshot, isStale: boolean): ChiangRaiRainSnapshot {
  return { ...entry.value, isStale };
}

export async function getChiangRaiRainSnapshot(): Promise<ChiangRaiRainSnapshot> {
  const now = Date.now();

  if (cache && now - cache.fetchedAtMs < CACHE_TTL_MS) {
    return withCacheState(cache, false);
  }

  if (!pendingRequest) {
    pendingRequest = loadSnapshot().finally(() => {
      pendingRequest = null;
    });
  }

  try {
    const value = await pendingRequest;
    cache = { value, fetchedAtMs: Date.now() };
    return withCacheState(cache, false);
  } catch (error) {
    if (cache && now - cache.fetchedAtMs < MAX_STALE_MS) {
      return withCacheState(cache, true);
    }

    const reason = error instanceof Error ? error.message : 'ไม่ทราบสาเหตุ';
    throw new Error(`ไม่สามารถดึงข้อมูล Thaiwater ได้: ${reason}`);
  }
}
