/**
 * Vercel Node.js Serverless Function.
 *
 * Keep the dynamic import inside the try/catch so an import/runtime failure
 * is returned as JSON instead of crashing the invocation with a generic 500.
 */
export default async function handler(_request: any, response: any): Promise<void> {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=300');

  try {
    const { getChiangRaiRainSnapshot } = await import('../src/services/rainfallProxy');
    const snapshot = await getChiangRaiRainSnapshot();

    response.status(200).json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Chiang Rai rain proxy failed:', error);

    response.status(503).json({
      ok: false,
      error: 'ยังไม่สามารถอัปเดตข้อมูลฝนจังหวัดเชียงรายได้',
      detail: message,
      fetchedAt: new Date().toISOString(),
    });
  }
}
