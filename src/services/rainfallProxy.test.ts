import { describe, expect, it } from 'vitest';
import { toChiangRaiForecasts, toChiangRaiStations } from './rainfallProxy';

describe('Thaiwater Chiang Rai filtering', () => {
  it('keeps station data only when it belongs to Chiang Rai', () => {
    const stations = toChiangRaiStations({
      data: [
        {
          id: 1,
          rain_24h: 11.5,
          rain_1h: 1.2,
          rainfall_datetime: '2026-08-18 12:00',
          geocode: { province_code: '57', province_name: { th: 'เชียงราย' }, amphoe_name: { th: 'แม่สรวย' } },
          station: { tele_station_name: { th: 'สถานีเชียงราย' } },
        },
        {
          id: 2,
          rain_24h: 99,
          geocode: { province_code: '58', province_name: { th: 'พะเยา' }, amphoe_name: { th: 'เมืองพะเยา' } },
          station: { tele_station_name: { th: 'สถานีต่างจังหวัด' } },
        },
      ],
    });

    expect(stations).toEqual([expect.objectContaining({
      name: 'สถานีเชียงราย', district: 'แม่สรวย', rainfall24h: 11.5, rainfall1h: 1.2,
    })]);
  });

  it('does not expose forecasting data from other provinces', () => {
    const forecasts = toChiangRaiForecasts({
      pre_rain: { data: { data: [{ province_code: '58', rainforecast_level: 5 }] } },
      pre_rain_forecast: {
        data: {
          data: [{
            rainforecast_value: 24,
            geocode: { province_code: '57', province_name: { th: 'เชียงราย' } },
            rainforecast_datetime: '2026-08-19 07:00',
            rainforecast_level: 3,
          }],
        },
      },
    });

    expect(forecasts.recentRain).toBeNull();
    expect(forecasts.forecastRain).toMatchObject({ rainfallMm: 24, level: 'ระดับ 3' });
  });
});

