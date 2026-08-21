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

export async function getChiangRaiWeather(): Promise<WeatherNow | null> {
  // Temporarily disabled to keep the Home page fast.
  // The weather card is removed locally and no external API request is made.
  document.querySelector('.weather-card')?.remove();
  return null;
}
