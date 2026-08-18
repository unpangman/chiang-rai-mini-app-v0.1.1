import { getChiangRaiRainSnapshot } from '../src/services/rainfallProxy';

export default async function handler(_request: any, response: any): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');

  try {
    response.status(200).json(await getChiangRaiRainSnapshot());
  } catch (error) {
    console.error('Chiang Rai rain proxy failed:', error);
    response.status(503).json({
      error: 'ยังไม่สามารถอัปเดตข้อมูลฝนจังหวัดเชียงรายได้',
    });
  }
}
