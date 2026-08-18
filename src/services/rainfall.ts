import type { ChiangRaiRainSnapshot } from './rainfallProxy';

export async function getChiangRaiRain(): Promise<ChiangRaiRainSnapshot | null> {
  try {
    const response = await fetch('/api/chiangrai-rain', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    return await response.json() as ChiangRaiRainSnapshot;
  } catch (error) {
    console.warn('Chiang Rai rain API unavailable:', error);
    return null;
  }
}
