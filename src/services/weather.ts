export type WeatherNow = {
  temperature: number;
  humidity: number;
  high: number;
  low: number;
  rainChance: number;
  icon: string;
  description: string;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
  };
  daily?: {
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
  };
};

function weatherLabel(code = 0): Pick<WeatherNow, 'icon' | 'description'> {
  if (code === 0) return { icon: '☀️', description: 'ท้องฟ้าแจ่มใส' };
  if ([1, 2].includes(code)) return { icon: '🌤️', description: 'มีเมฆบางส่วน' };
  if (code === 3) return { icon: '☁️', description: 'มีเมฆมาก' };
  if ([45, 48].includes(code)) return { icon: '🌫️', description: 'มีหมอก' };
  if ([51, 53, 55, 56, 57].includes(code)) return { icon: '🌦️', description: 'มีฝนปรอย' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { icon: '🌧️', description: 'มีฝน' };
  if ([95, 96, 99].includes(code)) return { icon: '⛈️', description: 'มีพายุฝนฟ้าคะนอง' };
  return { icon: '🌤️', description: 'สภาพอากาศทั่วไป' };
}

const WEATHER_CACHE_KEY = 'chiang-rai-weather-v1';
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const WEATHER_TIMEOUT_MS = 3500;

type CachedWeather = { savedAt: number; data: WeatherNow };

function readWeatherCache(): WeatherNow | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as CachedWeather;
    if (!cached?.data || Date.now() - cached.savedAt > WEATHER_CACHE_TTL_MS) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function saveWeatherCache(data: WeatherNow): void {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data } satisfies CachedWeather));
  } catch {
    // Ignore storage quota/private mode errors.
  }
}

async function fetchChiangRaiWeather(): Promise<WeatherNow | null> {
  const params = new URLSearchParams({
    latitude: '19.9072',
    longitude: '99.8326',
    current: 'temperature_2m,relative_humidity_2m,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'Asia/Bangkok',
    forecast_days: '1'
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS)
    });
    if (!response.ok) return null;
    const data = await response.json() as OpenMeteoResponse;
    const label = weatherLabel(data.current?.weather_code);
    const weather: WeatherNow = {
      temperature: Math.round(data.current?.temperature_2m ?? 0),
      humidity: Math.round(data.current?.relative_humidity_2m ?? 0),
      high: Math.round(data.daily?.temperature_2m_max?.[0] ?? 0),
      low: Math.round(data.daily?.temperature_2m_min?.[0] ?? 0),
      rainChance: Math.round(data.daily?.precipitation_probability_max?.[0] ?? 0),
      ...label
    };
    saveWeatherCache(weather);
    return weather;
  } catch (error) {
    console.warn('Weather API unavailable:', error);
    return null;
  }
}

export async function getChiangRaiWeather(): Promise<WeatherNow | null> {
  const cached = readWeatherCache();
  if (cached) return cached;
  return fetchChiangRaiWeather();
}
