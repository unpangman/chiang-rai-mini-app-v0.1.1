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


it('supports standard ThaiWater timeSeriesObservation payloads', () => {
  const stations = toChiangRaiStations({
    metadata: { version: '1.0', interval: 'C-15' },
    timeSeriesObservation: [{
      resultTime: '2026-08-18T15:15:00',
      station: { stationCode: 'RAIN-001', stationName: 'สถานีทดสอบเชียงราย' },
      geocode: { province_code: '57', province_name: { th: 'เชียงราย' } },
      measurementResults: [{
        measureTime: '2026-08-18T15:00:00',
        variable: 'Rainfall',
        value: 12.4,
        uom: 'mm',
      }],
    }],
  });

  expect(stations).toEqual([expect.objectContaining({
    id: 'RAIN-001',
    name: 'สถานีทดสอบเชียงราย',
    rainfall24h: 12.4,
  })]);
});
